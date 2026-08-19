"""Phishing Awareness Simulator - Cloud Functions (Python).

Design principles enforced here:
  * No real credentials are ever stored. The fake login page discards input in
    the browser; the server only ever records that "something was submitted".
  * Reporting is aggregate only. Raw events and per-participant assignment rows
    live in collections that clients cannot read (see firestore.rules); the
    dashboard reads only pre-aggregated, non-identifying documents.
  * AI drafts are created offline and always land in `pending_review`.
"""

import json
import uuid
import datetime
import random

from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore

import ai_author

initialize_app()
options.set_global_options(region="us-central1")

db = firestore.client()

VALID_ROLES = {"student", "staff", "lecturer", "sales", "consultant"}
VALID_CATEGORIES = {"eduvos_portal", "nsfas", "it_helpdesk"}
VALID_EVENTS = {"opened", "clicked", "submitted", "reported"}

# Final-outcome ranking. Higher rank wins when a new event arrives.
RANK = {"pending": 0, "ignored": 0, "opened": 1, "clicked": 2, "submitted": 3, "reported": 4}
COUNTED_BUCKETS = {"opened", "clicked", "submitted", "reported", "ignored"}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _require_admin(req: https_fn.CallableRequest):
    if req.auth is None or not req.auth.token.get("admin"):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            "Admin access required.",
        )
    return req.auth.uid


def _json(payload: dict, status: int = 200) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        mimetype="application/json",
        headers={"Cache-Control": "no-store"},
    )


def _today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- #
# Participant-facing HTTP endpoints (token based, no auth)
# --------------------------------------------------------------------------- #
@https_fn.on_request()
def scenario_delivery(req: https_fn.Request) -> https_fn.Response:
    """GET /api/scenario?t=TOKEN -> email content only (no answers)."""
    token = req.args.get("t", "")
    if not token:
        return _json({"ok": False, "error": "Missing token."}, 400)

    assignment = db.collection("assignments").document(token).get()
    if not assignment.exists:
        return _json({"ok": False, "error": "Invalid link."}, 404)
    a = assignment.to_dict()

    scenario = db.collection("scenarios").document(a["scenarioId"]).get()
    if not scenario.exists:
        return _json({"ok": False, "error": "Scenario unavailable."}, 404)
    s = scenario.to_dict()
    c = s.get("content", {})

    campaign = db.collection("campaigns").document(a["campaignId"]).get()
    running = campaign.exists and campaign.to_dict().get("status") == "running"
    if running:
        _apply_event(token, "opened")

    # Only the "email" is sent to the participant. Indicators and debrief are
    # withheld until after a response, via the debrief endpoint.
    return _json({
        "ok": True,
        "scenario": {
            "title": s.get("title"),
            "role": s.get("role"),
            "category": s.get("category"),
            "content": {
                "senderName": c.get("senderName"),
                "senderEmail": c.get("senderEmail"),
                "subject": c.get("subject"),
                "body": c.get("body"),
                "ctaText": c.get("ctaText"),
                "landingType": c.get("landingType", "link"),
                "portalName": c.get("portalName", "Student Portal"),
            },
        },
    })


@https_fn.on_request()
def record_event(req: https_fn.Request) -> https_fn.Response:
    """POST /api/event {token, type}. Never stores submitted input."""
    try:
        data = req.get_json(silent=True) or {}
    except Exception:
        data = {}
    token = data.get("token", "")
    event_type = data.get("type", "")

    if not token or event_type not in VALID_EVENTS:
        return _json({"ok": False, "error": "Bad request."}, 400)

    assignment = db.collection("assignments").document(token).get()
    if not assignment.exists:
        return _json({"ok": False, "error": "Invalid link."}, 404)

    campaign = db.collection("campaigns").document(assignment.to_dict()["campaignId"]).get()
    if not campaign.exists or campaign.to_dict().get("status") != "running":
        # Silently accept but do not record once a campaign is closed.
        return _json({"ok": True, "recorded": False})

    _apply_event(token, event_type)
    return _json({"ok": True, "recorded": True})


@https_fn.on_request()
def scenario_debrief(req: https_fn.Request) -> https_fn.Response:
    """GET /api/debrief?t=TOKEN -> indicators + study material + outcome."""
    token = req.args.get("t", "")
    if not token:
        return _json({"ok": False, "error": "Missing token."}, 400)

    assignment = db.collection("assignments").document(token).get()
    if not assignment.exists:
        return _json({"ok": False, "error": "Invalid link."}, 404)
    a = assignment.to_dict()

    scenario = db.collection("scenarios").document(a["scenarioId"]).get()
    if not scenario.exists:
        return _json({"ok": False, "error": "Scenario unavailable."}, 404)
    c = scenario.to_dict().get("content", {})

    return _json({
        "ok": True,
        "outcome": a.get("outcome", "clicked"),
        "content": {
            "indicators": c.get("indicators", []),
            "debrief": c.get("debrief", {}),
        },
    })


def _quiz_item(doc):
    """Public quiz shape. Only called for live, human-approved quiz emails."""
    s = doc.to_dict() or {}
    c = s.get("content") or {}
    debrief = c.get("debrief") or {}
    return {
        "id": doc.id,
        "isPhishing": s.get("isPhishing") is not False,
        "difficulty": s.get("difficulty") or "medium",
        "content": {
            "senderName": c.get("senderName"),
            "senderEmail": c.get("senderEmail"),
            "subject": c.get("subject"),
            "body": c.get("body"),
            "ctaText": c.get("ctaText") or "",
        },
        "verdict": debrief.get("summary") or "",
        "indicators": c.get("indicators") or [],
    }


def _pick_pool(items, n):
    hard, medium, easy = [], [], []
    for item in items:
        level = item.get("difficulty") or "medium"
        if level == "hard":
            hard.append(item)
        elif level == "easy":
            easy.append(item)
        else:
            medium.append(item)
    random.shuffle(hard)
    random.shuffle(medium)
    random.shuffle(easy)
    return (hard + medium + easy)[:n]


@https_fn.on_request()
def quiz_batch(req: https_fn.Request) -> https_fn.Response:
    """GET /api/quiz-batch -> mixed live quiz emails (approved only)."""
    live = [
        _quiz_item(doc)
        for doc in db.collection("scenarios").where("status", "==", "live").stream()
        if (doc.to_dict() or {}).get("useInQuiz") is True
    ]
    phish = [i for i in live if i["isPhishing"]]
    legit = [i for i in live if not i["isPhishing"]]
    need_phish, need_legit = 5, 4
    if len(phish) < need_phish or len(legit) < need_legit:
        return _json({
            "ok": False,
            "error": "Not enough approved quiz emails yet.",
            "livePhishing": len(phish),
            "liveLegit": len(legit),
            "needPhishing": need_phish,
            "needLegit": need_legit,
        }, 409)

    batch = _pick_pool(phish, need_phish) + _pick_pool(legit, need_legit)
    random.shuffle(batch)
    return _json({"ok": True, "batch": batch})


def _apply_event(token: str, event_type: str):
    """Transition an assignment's outcome and keep the aggregate in sync.

    Idempotent: replays and reloads do not double-count, because bucket and
    daily deltas only apply when the outcome actually advances.
    """
    assignment_ref = db.collection("assignments").document(token)

    transaction = db.transaction()

    @firestore.transactional
    def _txn(txn):
        snap = assignment_ref.get(transaction=txn)
        if not snap.exists:
            return
        a = snap.to_dict()
        old = a.get("outcome", "pending")
        candidate = event_type  # already one of opened/clicked/submitted/reported
        new = old if RANK[old] >= RANK[candidate] else candidate

        agg_ref = db.collection("aggregates").document(a["campaignId"])
        daily_ref = db.collection("daily_stats").document(_today())

        now = firestore.SERVER_TIMESTAMP
        updates = {"outcome": new, "lastEventAt": now}
        if new == "opened" and not a.get("openedAt"):
            updates["openedAt"] = now
        if new in ("clicked", "submitted", "reported") and not a.get("respondedAt"):
            updates["respondedAt"] = now
        txn.update(assignment_ref, updates)

        # Raw event log (locked to clients).
        txn.set(db.collection("events").document(), {
            "token": token,
            "campaignId": a["campaignId"],
            "role": a.get("role"),
            "type": event_type,
            "ts": now,
        })

        if new != old:
            agg_updates = {"updatedAt": now, f"{new}": firestore.Increment(1)}
            if old in COUNTED_BUCKETS:
                agg_updates[f"{old}"] = firestore.Increment(-1)
            txn.set(agg_ref, agg_updates, merge=True)

            # Daily rollups for the dashboard time series. "clicks" counts real
            # engagement with the link (clicked/submitted), never a report.
            daily = {"date": _today()}
            if new in ("clicked", "submitted") and old not in ("clicked", "submitted"):
                daily["clicks"] = firestore.Increment(1)
            if new == "reported" and old != "reported":
                daily["reports"] = firestore.Increment(1)
            if len(daily) > 1:
                txn.set(daily_ref, daily, merge=True)

    _txn(transaction)


# --------------------------------------------------------------------------- #
# Admin callable functions (require admin custom claim)
# --------------------------------------------------------------------------- #
@https_fn.on_call()
def create_scenario(req: https_fn.CallableRequest):
    uid = _require_admin(req)
    d = req.data or {}
    title = (d.get("title") or "").strip()
    role = d.get("role")
    category = d.get("category")
    content = d.get("content") or {}

    if not title:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Title required.")
    if role not in VALID_ROLES:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Invalid role.")
    if category not in VALID_CATEGORIES:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Invalid category.")

    ref = db.collection("scenarios").document()
    ref.set({
        "title": title,
        "role": role,
        "category": category,
        "content": content,
        "status": "pending_review",
        "aiGenerated": bool(d.get("aiGenerated", False)),
        "isPhishing": d.get("isPhishing") is not False,
        "useInQuiz": bool(d.get("useInQuiz", False)),
        "difficulty": d.get("difficulty") if d.get("difficulty") in ("easy", "medium", "hard") else "medium",
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"ok": True, "id": ref.id}


@https_fn.on_call()
def generate_ai_draft(req: https_fn.CallableRequest):
    uid = _require_admin(req)
    d = req.data or {}
    role = d.get("role")
    category = d.get("category")
    notes = (d.get("notes") or "").strip()
    email_type = "legit" if d.get("emailType") == "legit" else "phishing"

    if role not in VALID_ROLES or category not in VALID_CATEGORIES:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Invalid role or category.")

    draft = ai_author.build_draft(role, category, notes, email_type)
    ref = db.collection("scenarios").document()
    ref.set({
        "title": draft["title"],
        "role": role,
        "category": category,
        "content": draft["content"],
        "status": "pending_review",
        "aiGenerated": True,
        "isPhishing": draft["isPhishing"],
        "useInQuiz": bool(d.get("useInQuiz", False)),
        "difficulty": d.get("difficulty") if d.get("difficulty") in ("easy", "medium", "hard") else "medium",
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"ok": True, "id": ref.id}


@https_fn.on_call()
def approve_scenario(req: https_fn.CallableRequest):
    uid = _require_admin(req)
    sid = (req.data or {}).get("scenarioId")
    if not sid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "scenarioId required.")
    db.collection("scenarios").document(sid).update({
        "status": "live",
        "approvedBy": uid,
        "approvedAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    snap = db.collection("scenarios").document(sid).get()
    s = snap.to_dict() or {}
    if s.get("useInQuiz"):
        db.collection("quiz_live").document(sid).set(_quiz_item(snap))
    else:
        db.collection("quiz_live").document(sid).delete()
    return {"ok": True}


@https_fn.on_call()
def retire_scenario(req: https_fn.CallableRequest):
    _require_admin(req)
    sid = (req.data or {}).get("scenarioId")
    if not sid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "scenarioId required.")
    db.collection("scenarios").document(sid).update({
        "status": "retired",
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    db.collection("quiz_live").document(sid).delete()
    return {"ok": True}


@https_fn.on_call()
def create_campaign(req: https_fn.CallableRequest):
    uid = _require_admin(req)
    d = req.data or {}
    name = (d.get("name") or "").strip()
    scenario_id = d.get("scenarioId")
    round_no = int(d.get("round") or 1)
    codes = [c.strip() for c in (d.get("participantCodes") or []) if c and c.strip()]
    auto_count = int(d.get("autoCount") or 0)

    if not name:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Campaign name required.")
    scenario = db.collection("scenarios").document(scenario_id).get()
    if not scenario.exists or scenario.to_dict().get("status") != "live":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Scenario must be live.")
    s = scenario.to_dict()

    if not codes and auto_count > 0:
        prefix = s["role"][:3].upper()
        codes = [f"{prefix}-{uuid.uuid4().hex[:6].upper()}" for _ in range(auto_count)]
    codes = list(dict.fromkeys(codes))  # de-dup, keep order
    if not codes:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "No participant codes.")

    ref = db.collection("campaigns").document()
    ref.set({
        "name": name,
        "scenarioId": scenario_id,
        "scenarioTitle": s.get("title"),
        "role": s.get("role"),
        "category": s.get("category"),
        "round": round_no,
        "status": "draft",
        "participantCount": len(codes),
        "pendingCodes": codes,
        "createdBy": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"ok": True, "id": ref.id, "count": len(codes)}


@https_fn.on_call()
def launch_campaign(req: https_fn.CallableRequest):
    _require_admin(req)
    cid = (req.data or {}).get("campaignId")
    camp_ref = db.collection("campaigns").document(cid)
    camp = camp_ref.get()
    if not camp.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Campaign not found.")
    c = camp.to_dict()
    if c.get("status") != "draft":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Campaign already launched.")

    codes = c.get("pendingCodes", [])
    batch = db.batch()
    for code in codes:
        token = uuid.uuid4().hex
        batch.set(db.collection("participant_codes").document(code), {
            "code": code, "role": c["role"], "createdAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        batch.set(db.collection("assignments").document(token), {
            "token": token,
            "campaignId": cid,
            "campaignName": c["name"],
            "code": code,
            "role": c["role"],
            "category": c["category"],
            "scenarioId": c["scenarioId"],
            "round": c["round"],
            "outcome": "pending",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
    batch.commit()

    db.collection("aggregates").document(cid).set({
        "campaignId": cid,
        "campaignName": c["name"],
        "scenarioId": c["scenarioId"],
        "scenarioTitle": c.get("scenarioTitle"),
        "role": c["role"],
        "category": c["category"],
        "round": c["round"],
        "status": "running",
        "total": len(codes),
        "opened": 0, "clicked": 0, "submitted": 0, "reported": 0, "ignored": 0,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)

    db.collection("daily_stats").document(_today()).set({
        "date": _today(),
        "sent": firestore.Increment(len(codes)),
    }, merge=True)

    camp_ref.update({
        "status": "running",
        "launchedAt": firestore.SERVER_TIMESTAMP,
        "pendingCodes": firestore.DELETE_FIELD,
    })
    return {"ok": True, "assignments": len(codes)}


@https_fn.on_call()
def complete_campaign(req: https_fn.CallableRequest):
    _require_admin(req)
    cid = (req.data or {}).get("campaignId")
    camp_ref = db.collection("campaigns").document(cid)
    camp = camp_ref.get()
    if not camp.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Campaign not found.")

    # Non-responders (never opened, or opened but no action) become "ignored".
    q = db.collection("assignments").where("campaignId", "==", cid).where(
        "outcome", "in", ["pending", "opened"]).stream()
    moved = 0
    opened_moved = 0
    batch = db.batch()
    for doc in q:
        a = doc.to_dict()
        if a.get("outcome") == "opened":
            opened_moved += 1
        moved += 1
        batch.update(doc.reference, {"outcome": "ignored"})
    batch.commit()

    agg_ref = db.collection("aggregates").document(cid)
    agg_ref.set({
        "status": "completed",
        "ignored": firestore.Increment(moved),
        "opened": firestore.Increment(-opened_moved),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)
    camp_ref.update({"status": "completed", "completedAt": firestore.SERVER_TIMESTAMP})
    return {"ok": True, "ignored": moved}


@https_fn.on_call()
def get_campaign_links(req: https_fn.CallableRequest):
    _require_admin(req)
    cid = (req.data or {}).get("campaignId")
    if not cid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "campaignId required.")
    docs = db.collection("assignments").where("campaignId", "==", cid).stream()
    links = [{
        "code": d.to_dict().get("code"),
        "token": d.to_dict().get("token"),
        "outcome": d.to_dict().get("outcome", "pending"),
    } for d in docs]
    links.sort(key=lambda x: x["code"] or "")
    return {"ok": True, "links": links}

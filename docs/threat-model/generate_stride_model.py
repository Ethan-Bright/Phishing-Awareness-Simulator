"""Generate OWASP Threat Dragon v2 JSON for the phishing awareness simulator.

Run from repo root:
  python docs/threat-model/generate_stride_model.py
"""

from __future__ import annotations

import copy
import json
import uuid
from pathlib import Path

OUT = Path(__file__).with_name("phishing-awareness-simulator-stride.json")

PORT_CIRCLE = {
    "r": 4,
    "magnet": True,
    "stroke": "#5F95FF",
    "strokeWidth": 1,
    "fill": "#fff",
    "style": {"visibility": "hidden"},
}


def uid() -> str:
    return str(uuid.uuid4())


def port_groups() -> dict:
    return {
        "groups": {
            side: {"position": side, "attrs": {"circle": PORT_CIRCLE}}
            for side in ("top", "right", "bottom", "left")
        },
        "items": [{"group": s, "id": uid()} for s in ("top", "right", "bottom", "left")],
    }


def clone_threats(*items: dict) -> list:
    out = []
    for item in items:
        cloned = copy.deepcopy(item)
        cloned["id"] = uid()
        out.append(cloned)
    return out


def threat(
    title: str,
    ttype: str,
    description: str,
    mitigation: str,
    severity: str = "High",
    status: str = "Open",
) -> dict:
    return {
        "status": status,
        "severity": severity,
        "title": title,
        "type": ttype,
        "description": description,
        "mitigation": mitigation,
        "modelType": "STRIDE",
        "id": uid(),
    }


def node(
    shape: str,
    tm_type: str,
    name: str,
    x: int,
    y: int,
    w: int,
    h: int,
    z: int,
    description: str = "",
    threats: list | None = None,
    extra_data: dict | None = None,
    out_of_scope: bool = False,
    reason_out_of_scope: str = "",
    body_stroke: str = "#333333",
    store: bool = False,
) -> dict:
    threats = clone_threats(*(threats or []))
    open_threats = any(t.get("status") == "Open" for t in threats)
    cell_id = uid()
    attrs: dict
    if store:
        attrs = {
            "text": {"text": name},
            "topLine": {
                "stroke": "red" if open_threats else "#333333",
                "strokeWidth": 2.5 if open_threats else 1,
                "strokeDasharray": None,
            },
            "bottomLine": {
                "stroke": "red" if open_threats else "#333333",
                "strokeWidth": 2.5 if open_threats else 1,
                "strokeDasharray": None,
            },
        }
    else:
        attrs = {
            "text": {"text": name},
            "body": {
                "stroke": "red" if open_threats else body_stroke,
                "strokeWidth": 2.5 if open_threats else 1,
                "strokeDasharray": None,
            },
        }
    data = {
        "name": name,
        "description": description,
        "type": tm_type,
        "isTrustBoundary": False,
        "outOfScope": out_of_scope,
        "reasonOutOfScope": reason_out_of_scope,
        "threats": threats,
        "hasOpenThreats": open_threats,
    }
    if extra_data:
        data.update(extra_data)
    return {
        "position": {"x": x, "y": y},
        "size": {"width": w, "height": h},
        "attrs": attrs,
        "visible": True,
        "shape": shape,
        "zIndex": z,
        "ports": port_groups(),
        "id": cell_id,
        "data": data,
    }


def actor(*args, **kwargs):
    extra = kwargs.get("extra_data") or {}
    extra.setdefault("providesAuthentication", False)
    kwargs["extra_data"] = extra
    return node("actor", "tm.Actor", *args, **kwargs)


def process(*args, **kwargs):
    return node("process", "tm.Process", *args, **kwargs)


def store(*args, **kwargs):
    extra = kwargs.get("extra_data") or {}
    extra.setdefault("isALog", False)
    extra.setdefault("storesCredentials", False)
    extra.setdefault("isEncrypted", True)
    extra.setdefault("isSigned", False)
    kwargs["extra_data"] = extra
    kwargs["store"] = True
    return node("store", "tm.Store", *args, **kwargs)


def flow(
    name: str,
    source_id: str,
    target_id: str,
    z: int,
    description: str = "",
    threats: list | None = None,
    encrypted: bool = True,
    public: bool = True,
    protocol: str = "HTTPS",
    vertices: list | None = None,
) -> dict:
    threats = clone_threats(*(threats or []))
    open_threats = any(t.get("status") == "Open" for t in threats)
    cell = {
        "shape": "flow",
        "attrs": {
            "line": {
                "stroke": "red" if open_threats else "#333333",
                "targetMarker": {"name": "block"},
                "strokeDasharray": None,
            }
        },
        "width": 200,
        "height": 100,
        "zIndex": z,
        "labels": [
            {
                "markup": [
                    {"tagName": "ellipse", "selector": "labelBody"},
                    {"tagName": "text", "selector": "labelText"},
                ],
                "attrs": {
                    "labelText": {
                        "text": name,
                        "textAnchor": "middle",
                        "textVerticalAnchor": "middle",
                    },
                    "labelBody": {
                        "ref": "labelText",
                        "refRx": "50%",
                        "refRy": "60%",
                        "fill": "#fff",
                        "strokeWidth": 0,
                    },
                },
                "position": 0.5,
            }
        ],
        "connector": "smooth",
        "data": {
            "type": "tm.Flow",
            "name": name,
            "description": description,
            "outOfScope": False,
            "reasonOutOfScope": "",
            "hasOpenThreats": open_threats,
            "isBidirectional": False,
            "isEncrypted": encrypted,
            "isPublicNetwork": public,
            "protocol": protocol,
            "threats": threats,
            "isTrustBoundary": False,
        },
        "id": uid(),
        "source": {"cell": source_id},
        "target": {"cell": target_id},
    }
    if vertices:
        cell["vertices"] = vertices
    return cell


def boundary_box(name: str, x: int, y: int, w: int, h: int, z: int, description: str) -> dict:
    return {
        "position": {"x": x, "y": y},
        "size": {"width": w, "height": h},
        "attrs": {"label": {"text": name}},
        "visible": True,
        "shape": "trust-boundary-box",
        "id": uid(),
        "zIndex": z,
        "data": {
            "type": "tm.BoundaryBox",
            "name": name,
            "description": description,
            "isTrustBoundary": True,
            "hasOpenThreats": False,
        },
    }


def text_block(text: str, x: int, y: int, w: int, h: int, z: int) -> dict:
    return {
        "position": {"x": x, "y": y},
        "size": {"width": w, "height": h},
        "attrs": {"text": {"text": text}},
        "visible": True,
        "shape": "td-text-block",
        "zIndex": z,
        "id": uid(),
        "data": {"type": "tm.Text", "name": text, "hasOpenThreats": False},
    }


# --- Threat catalogue (section 4.3 / 4.5) ---

T_TOKEN = threat(
    "Stolen assignment token used as participant",
    "Spoofing",
    "Anyone who obtains a campaign link can open the scenario and record events. "
    "The token is the participant identity; there is no login on this path.",
    "UUID tokens; distribute links only on the ethics-approved channel; "
    "complete campaigns promptly; treat link lists like credentials.",
    "High",
    "Open",
)
T_TOKEN_DISC = threat(
    "Token leakage discloses outcome and debrief",
    "Information disclosure",
    "A leaked token lets a third party fetch debrief content and the recorded outcome for that assignment.",
    "Withhold indicators until debrief; client-denied assignment collection; short campaign windows.",
    "High",
    "Open",
)
T_EVENT = threat(
    "Unauthenticated POST /api/event with a leaked token",
    "Tampering",
    "A token holder can send clicked, submitted, or reported and distort study integrity. "
    "Outcome ranking limits some replay, but does not stop a valid token from choosing an action.",
    "Ranked outcomes; closed campaigns stop recording; no client writes to aggregates. "
    "Review aggregate anomalies; do not treat results as an invigilated exam.",
    "Medium",
    "Open",
)
T_QUIZ = threat(
    "Quiz batch discloses correct phishing/legit labels",
    "Information disclosure",
    "GET /api/quiz-batch and public quiz_live reads include isPhishing so the client can score. "
    "A learner can read the JSON and see answers.",
    "Treat the quiz as practice not a secret exam. Optional later hardening: score on the server "
    "and withhold isPhishing until after the answer.",
    "Medium",
    "Open",
)
T_QUIZ_TAMPER = threat(
    "Learner tampers with self-score via API labels",
    "Tampering",
    "Because labels ship with the batch, quiz scores are not trustworthy as an exam result. "
    "Campaign behavioural data remains separate.",
    "Do not use quiz scores as the sole evaluation measure; keep campaign token path for behaviour.",
    "Low",
    "Open",
)
T_ADMIN = threat(
    "Administrator session hijack",
    "Spoofing",
    "Phishing or password reuse against the researcher Google/Firebase account yields dashboard access.",
    "Firebase Auth plus admin custom claim on the client and on every callable; few admin users; MFA.",
    "High",
    "Open",
)
T_EOP = threat(
    "Elevation via admin custom claim or Admin SDK",
    "Elevation of privilege",
    "The admin claim is minted by set_admin.py / service account. A leaked key or mis-granted claim "
    "exposes approve, launch, and function-accessible collections.",
    "Never commit service accounts; unique strong passwords; MFA; review Cloud Audit logs.",
    "High",
    "Open",
)
T_DOS = threat(
    "Public function flooding",
    "Denial of service",
    "Unauthenticated /api/scenario, /api/event, and /api/quiz-batch can be flooded, stalling a live "
    "campaign or raising Blaze-plan cost.",
    "Keep campaign URLs unlisted; Cloud quotas; complete campaigns when finished. No app-level rate limit yet.",
    "Medium",
    "Open",
)
T_CONTENT = threat(
    "Unapproved or harmful scenario published",
    "Tampering",
    "A rogue or rushed admin could publish offensive, illegally targeted, or too-realistic copy "
    "(real staff names, live campus URLs).",
    "Drafts start as pending_review; approve_scenario required for live and quiz_live; review checklist.",
    "High",
    "Mitigated",
)
T_EXPORT = threat(
    "Researcher CSV export stored on an unmanaged device",
    "Information disclosure",
    "Aggregate exports can still re-identify people in a tiny cohort if stored unsafely.",
    "Aggregate-only dashboard; no export of tiny groups; approved institutional storage; 5-year retention per ethics.",
    "Medium",
    "Open",
)
T_RULES = threat(
    "Future Firestore rules allow client reads of events or assignments",
    "Information disclosure",
    "A rules edit could break the ethics promise that raw outcomes are never readable in the browser.",
    "Default deny; emulator tests before deploy; no dashboard feature that reads assignments client-side.",
    "High",
    "Open",
)
T_HTTPS = threat(
    "Cleartext interception of study traffic",
    "Information disclosure",
    "Participant and admin traffic crosses the public internet.",
    "Firebase Hosting enforces HTTPS; HSTS, X-Frame-Options DENY, nosniff, no-referrer in firebase.json.",
    "High",
    "Mitigated",
)
T_CREDS = threat(
    "Fake login captures real passwords",
    "Information disclosure",
    "A participant may type a real campus password into the simulated portal.",
    "Browser discards typed values; server records only that a submission occurred; isolated from Eduvos IdP.",
    "High",
    "Mitigated",
)
T_REPUD = threat(
    "Weak forensic attribution of participant actions",
    "Repudiation",
    "Anonymised codes mean researchers cannot prove which natural person produced an outcome. "
    "Server event timestamps support study accountability only.",
    "Accepted by ethics design. Admin createdBy/approvedBy UIDs cover researcher actions in part.",
    "Low",
    "Open",
)


def context_diagram() -> dict:
    participant = actor(
        "Participant",
        40,
        80,
        160,
        80,
        2,
        "Unauthenticated learner using a tokenised campaign link or the public quiz.",
        threats=[T_TOKEN],
    )
    researcher = actor(
        "Researcher / administrator",
        40,
        280,
        180,
        90,
        3,
        "Signs in with Firebase Auth. Access gated by the admin custom claim.",
        extra_data={"providesAuthentication": True},
        threats=[T_ADMIN],
    )
    system = process(
        "Phishing Awareness\nSimulator",
        380,
        160,
        180,
        140,
        4,
        "Web app on Firebase Hosting, Python Cloud Functions, and Firestore. "
        "Delivers simulated phishing, records outcomes, quiz, and aggregate reporting.",
        threats=[T_DOS, T_CREDS, T_CONTENT],
    )
    gcp = actor(
        "Google Cloud /\nFirebase",
        720,
        170,
        170,
        100,
        5,
        "Hosting, Auth, Functions, Firestore. Platform identity and encryption at rest.",
        out_of_scope=True,
        reason_out_of_scope="Platform operated by Google; in-scope is application config and data only.",
    )
    tb = boundary_box(
        "TB4: Public internet vs Firebase Hosting (HTTPS)",
        20,
        40,
        230,
        370,
        -1,
        "Untrusted browsers. TLS terminates at Firebase Hosting.",
    )
    cells = [
        tb,
        text_block(
            "Context DFD: Phishing Awareness Simulator (Eduvos study)\n"
            "STRIDE / CIA. Out of scope: live Eduvos mail and identity systems.",
            380,
            20,
            420,
            70,
            1,
        ),
        participant,
        researcher,
        system,
        gcp,
        flow(
            "Tokenised scenario / quiz (HTTPS)",
            participant["id"],
            system["id"],
            10,
            "Participant opens /s.html?t=TOKEN or /quiz.html. Crosses TB1 and TB4.",
            threats=[T_TOKEN_DISC, T_HTTPS],
            vertices=[{"x": 260, "y": 120}],
        ),
        flow(
            "Admin sign-in and dashboard (HTTPS)",
            researcher["id"],
            system["id"],
            11,
            "Firebase Auth session plus admin claim. Crosses TB2 and TB4.",
            threats=[T_EOP],
            vertices=[{"x": 250, "y": 280}],
        ),
        flow(
            "Managed cloud services",
            system["id"],
            gcp["id"],
            12,
            "Hosting, callable/HTTP functions, Firestore Admin SDK. Crosses TB3 inside GCP.",
            public=False,
            vertices=[{"x": 640, "y": 230}],
        ),
    ]
    return {
        "id": 0,
        "title": "Context diagram",
        "description": "System context for the phishing awareness simulator. Trust boundary TB4 is the public internet versus Firebase Hosting.",
        "diagramType": "STRIDE",
        "thumbnail": "./public/content/images/thumbnail.stride.jpg",
        "version": "2.3.0",
        "cells": cells,
    }


def level1_diagram() -> dict:
    # Trust boxes first (behind)
    tb4 = boundary_box(
        "TB4: Public internet vs Hosting",
        10,
        10,
        250,
        820,
        -4,
        "Participant and researcher browsers on the public internet. HTTPS/HSTS at Hosting.",
    )
    tb1 = boundary_box(
        "TB1: Participant vs Functions",
        280,
        10,
        280,
        430,
        -3,
        "Unauthenticated HTTP APIs: scenario, event, debrief, quiz-batch.",
    )
    tb2 = boundary_box(
        "TB2: Admin browser vs callables/rules",
        280,
        460,
        280,
        370,
        -3,
        "Authenticated dashboard and HTTPS callables. Admin claim required.",
    )
    tb3 = boundary_box(
        "TB3: Functions Admin SDK vs Firestore",
        590,
        10,
        280,
        820,
        -2,
        "Sensitive collections are client-denied. Writes via Admin SDK only.",
    )

    participant = actor(
        "Participant\n(browser)",
        40,
        80,
        170,
        90,
        2,
        "No Firebase Auth. Identity is the assignment token on the campaign link.",
        threats=[T_TOKEN],
    )
    researcher = actor(
        "Researcher /\nadministrator",
        40,
        560,
        170,
        90,
        3,
        "Firebase Auth user with admin custom claim.",
        extra_data={"providesAuthentication": True},
        threats=[T_ADMIN],
    )

    p1 = process(
        "P1 Scenario\ndelivery",
        330,
        30,
        150,
        90,
        4,
        "GET /api/scenario?t= TOKEN. Returns email content only. Records opened if campaign is running.",
        threats=[T_TOKEN, T_DOS],
    )
    p2 = process(
        "P2 Event\nrecording",
        330,
        140,
        150,
        90,
        5,
        "POST /api/event {token, type}. Never stores submitted form input. Ranked outcomes.",
        threats=[T_EVENT, T_CREDS, T_DOS],
    )
    p3 = process(
        "P3 Debrief",
        330,
        250,
        150,
        90,
        6,
        "GET /api/debrief?t= TOKEN. Returns indicators, tips, and recorded outcome after a response.",
        threats=[T_TOKEN_DISC],
    )
    p4 = process(
        "P4 Quiz batch",
        330,
        360,
        150,
        90,
        7,
        "GET /api/quiz-batch. Mixed live approved emails. Public quiz_live reads also exist.",
        threats=[T_QUIZ, T_QUIZ_TAMPER, T_DOS],
    )
    p5 = process(
        "P5 Admin\ncallables",
        330,
        500,
        150,
        100,
        8,
        "create/approve/retire scenarios, AI drafts, create/launch/complete campaigns, get links. _require_admin.",
        threats=[T_EOP, T_CONTENT],
    )
    p6 = process(
        "P6 Admin\ndashboard",
        330,
        640,
        150,
        100,
        9,
        "Static Hosting pages. requireAdmin(). Reads aggregates, daily_stats, scenarios, campaigns only.",
        threats=[T_ADMIN, T_EXPORT],
    )

    ds1 = store(
        "DS1 assignments",
        630,
        30,
        190,
        70,
        10,
        "Token, campaign, role, outcome. Client read/write denied.",
        extra_data={"isEncrypted": True},
        threats=[T_RULES],
    )
    ds2 = store(
        "DS2 events",
        630,
        120,
        190,
        70,
        11,
        "Raw event log (token, type, ts). Client denied.",
        extra_data={"isALog": True, "isEncrypted": True},
        threats=[T_RULES, T_REPUD],
    )
    ds3 = store(
        "DS3 participant_codes",
        630,
        210,
        190,
        70,
        12,
        "Anonymised codes. Identity map kept outside this system. Client denied.",
        extra_data={"isEncrypted": True},
        threats=[T_RULES],
    )
    ds4 = store(
        "DS4 aggregates /\ndaily_stats",
        630,
        300,
        190,
        80,
        13,
        "Pre-aggregated counts. Admin read only. Function writes only.",
        extra_data={"isEncrypted": True},
        threats=[T_EXPORT],
    )
    ds5 = store(
        "DS5 scenarios",
        630,
        400,
        190,
        70,
        14,
        "Library including pending_review. Admin read; create must start pending_review.",
        extra_data={"isEncrypted": True},
        threats=[T_CONTENT],
    )
    ds6 = store(
        "DS6 quiz_live",
        630,
        490,
        190,
        70,
        15,
        "Human-approved quiz emails. Public read, admin write.",
        extra_data={"isEncrypted": True},
        threats=[T_QUIZ],
    )
    ds7 = store(
        "DS7 Firebase Auth\n+ admin claims",
        630,
        580,
        190,
        80,
        16,
        "User accounts and custom claims. Claims are not stored as Firestore role documents.",
        extra_data={"storesCredentials": True, "isEncrypted": True},
        threats=[T_EOP],
    )
    ds8 = store(
        "DS8 campaigns",
        630,
        690,
        190,
        70,
        17,
        "Campaign metadata and counts. Admin read; writes via functions.",
        extra_data={"isEncrypted": True},
    )

    cells = [
        tb4,
        tb1,
        tb2,
        tb3,
        text_block(
            "L1 DFD (section 4.2). Red borders = open STRIDE threats.\n"
            "Flows: token APIs unauthenticated; admin path uses Auth + claim.",
            10,
            840,
            860,
            55,
            1,
        ),
        participant,
        researcher,
        p1,
        p2,
        p3,
        p4,
        p5,
        p6,
        ds1,
        ds2,
        ds3,
        ds4,
        ds5,
        ds6,
        ds7,
        ds8,
        flow("Open scenario ?t=", participant["id"], p1["id"], 20, "Crosses TB4 and TB1.", threats=[T_TOKEN, T_HTTPS]),
        flow("POST event", participant["id"], p2["id"], 21, "clicked / submitted / reported. No password body.", threats=[T_EVENT, T_CREDS]),
        flow("Load debrief", participant["id"], p3["id"], 22, "Indicators after response.", threats=[T_TOKEN_DISC]),
        flow("Start quiz", participant["id"], p4["id"], 23, "Public; labels included in JSON.", threats=[T_QUIZ]),
        flow("Email HTML only", p1["id"], ds1["id"], 24, "Lookup assignment; may mark opened.", public=False, protocol="Admin SDK"),
        flow("Read scenario body", p1["id"], ds5["id"], 25, "Withhold indicators.", public=False, protocol="Admin SDK"),
        flow("Update outcome +\nraw event", p2["id"], ds2["id"], 26, "Transactional rank + event doc.", public=False, protocol="Admin SDK"),
        flow("Increment aggregates", p2["id"], ds4["id"], 27, "Function-only writes.", public=False, protocol="Admin SDK"),
        flow("Outcome + indicators", p3["id"], ds5["id"], 28, "Debrief payload.", public=False, protocol="Admin SDK"),
        flow("Approved quiz items", p4["id"], ds6["id"], 29, "World-readable collection / function query.", public=False, protocol="Admin SDK / rules"),
        flow("Sign-in / claim", researcher["id"], ds7["id"], 30, "Firebase Auth. Crosses TB4 and TB2.", threats=[T_ADMIN]),
        flow("Author / approve /\nlaunch", researcher["id"], p5["id"], 31, "HTTPS callables.", threats=[T_EOP, T_CONTENT]),
        flow("Dashboard reads", researcher["id"], p6["id"], 32, "Client SDK limited by Firestore rules.", threats=[T_EXPORT]),
        flow("Write scenarios /\nassignments /\ncodes", p5["id"], ds5["id"], 33, "pending_review then approve copies to quiz_live.", public=False, protocol="Admin SDK"),
        flow("Launch tokens", p5["id"], ds1["id"], 34, "UUID assignment tokens.", public=False, protocol="Admin SDK", threats=[T_TOKEN]),
        flow("Campaign docs", p5["id"], ds8["id"], 35, "Draft / running / complete.", public=False, protocol="Admin SDK"),
        flow("Codes registry", p5["id"], ds3["id"], 36, "Anonymised codes only.", public=False, protocol="Admin SDK"),
        flow("Read aggregates", p6["id"], ds4["id"], 37, "No raw events.", public=False, protocol="Firestore rules"),
        flow("Read campaigns", p6["id"], ds8["id"], 38, "Metadata and counts.", public=False, protocol="Firestore rules"),
    ]
    return {
        "id": 1,
        "title": "Phishing simulator L1",
        "description": "Level-1 data flow from modelling documentation section 4.2: processes P1–P6, stores DS1–DS8, trust boundaries TB1–TB4, STRIDE threats.",
        "diagramType": "STRIDE",
        "thumbnail": "./public/content/images/thumbnail.stride.jpg",
        "version": "2.3.0",
        "cells": cells,
    }


def main() -> None:
    model = {
        "version": "2.3.0",
        "summary": {
            "title": "Phishing Awareness Simulator - STRIDE threat model",
            "owner": "Phishing Awareness Simulator research team",
            "description": (
                "Threat model of the Eduvos phishing-awareness simulator (Firebase Hosting, "
                "Python Cloud Functions, Firestore). Framework: STRIDE on a data-flow diagram, "
                "with CIA impact. Scope is the simulator and study environment, not live campus "
                "email or identity systems. Open this file in OWASP Threat Dragon 2.x."
            ),
            "id": 0,
        },
        "detail": {
            "contributors": [{"name": "Project researcher"}],
            "diagrams": [context_diagram(), level1_diagram()],
            "diagramTop": 2,
            "reviewer": "",
            "threatTop": 40,
        },
    }
    OUT.write_text(json.dumps(model, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

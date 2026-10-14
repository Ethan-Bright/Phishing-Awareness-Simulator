"""Create fake participant logins for testing the participant portal.

Creates a few demo accounts (student, lecturer, staff), one running demo
campaign per role with working links, and one closed link so the portal shows
both states. Safe to re-run: ids are fixed and existing tokens are reused.

Run scripts/seed.py first so the scenarios exist.

Usage:
    python scripts/seed_participants.py
    python scripts/seed_participants.py --password "SomethingElse1!"
    python scripts/seed_participants.py --remove      # delete all of it again

Demo data only. Remove it before a real study.
"""

import sys
import uuid
import argparse
from firebase_admin import auth, firestore
from _init import get_app
from set_participant import issue

DEFAULT_PASSWORD = "Participant123!"

# (email, display name, role, anonymised code)
DEMO_USERS = [
    ("student1@eduvos.example", "Thandi Mokoena", "student", "STU-DEMO01"),
    ("student2@eduvos.example", "Sipho Dlamini", "student", "STU-DEMO02"),
    ("lecturer1@eduvos.example", "Anika Naidoo", "lecturer", "LEC-DEMO01"),
    ("staff1@eduvos.example", "Pieter van Wyk", "staff", "STA-DEMO01"),
]

# role -> (campaign id, live scenario id, campaign name)
DEMO_CAMPAIGNS = {
    "student": ("demo_portal_student", "scn_password_student", "Portal demo - Password reset (Students)"),
    "lecturer": ("demo_portal_lecturer", "scn_ithelp_lecturer", "Portal demo - Mailbox verification (Lecturers)"),
    "staff": ("demo_portal_staff", "scn_m365_staff", "Portal demo - Microsoft 365 update (Staff)"),
}

# A closed link so the "Closed" state shows up. Points at a seed.py demo campaign.
CLOSED_LINK = ("STU-DEMO01", "demo_campaign_4", "NSFAS Funding Check - Students")


def seed(db, password):
    now = firestore.SERVER_TIMESTAMP

    for email, name, role, code in DEMO_USERS:
        issue(email, role, code, password, name)

    for role, (cid, sid, cname) in DEMO_CAMPAIGNS.items():
        scn = db.collection("scenarios").document(sid).get()
        if not scn.exists:
            print(f"Scenario {sid} not found. Run scripts/seed.py first.")
            sys.exit(1)
        s = scn.to_dict()
        codes = [code for _, _, r, code in DEMO_USERS if r == role]

        db.collection("campaigns").document(cid).set({
            "name": cname, "scenarioId": sid, "scenarioTitle": s.get("title"),
            "role": role, "category": s.get("category"), "round": 1,
            "status": "running", "participantCount": len(codes),
            "createdBy": "seed_participants", "createdAt": now, "launchedAt": now,
        })

        agg_ref = db.collection("aggregates").document(cid)
        if not agg_ref.get().exists:
            agg_ref.set({
                "campaignId": cid, "campaignName": cname, "scenarioId": sid,
                "scenarioTitle": s.get("title"), "role": role, "category": s.get("category"),
                "round": 1, "status": "running", "total": len(codes),
                "opened": 0, "clicked": 0, "submitted": 0, "reported": 0, "ignored": 0,
                "updatedAt": now,
            })

        for code in codes:
            link_ref = db.collection("participant_links").document(f"{code}_{cid}")
            existing = link_ref.get()
            token = (existing.to_dict() or {}).get("token") if existing.exists else None
            token = token or uuid.uuid4().hex

            db.collection("participant_codes").document(code).set({
                "code": code, "role": role, "createdAt": now,
            }, merge=True)
            assignment_ref = db.collection("assignments").document(token)
            if not assignment_ref.get().exists:
                assignment_ref.set({
                    "token": token, "campaignId": cid, "campaignName": cname,
                    "code": code, "role": role, "category": s.get("category"),
                    "scenarioId": sid, "round": 1, "outcome": "pending", "createdAt": now,
                })
            link_ref.set({
                "code": code, "campaignId": cid, "campaignName": cname,
                "token": token, "status": "running", "createdAt": now,
            })
        print(f"Campaign {cid}: {len(codes)} link(s).")

    code, cid, cname = CLOSED_LINK
    db.collection("participant_links").document(f"{code}_{cid}").set({
        "code": code, "campaignId": cid, "campaignName": cname,
        "token": "", "status": "completed", "createdAt": now,
    })

    print("\nDemo participant logins (password for all: %s)" % password)
    for email, name, role, code in DEMO_USERS:
        print(f"  {email:<28} {role:<9} {code:<11} {name}")
    print("\nSign in at /login.html. Remove with --remove before a real study.")


def remove(db):
    codes = [code for _, _, _, code in DEMO_USERS]
    for email, *_ in DEMO_USERS:
        try:
            user = auth.get_user_by_email(email)
            auth.delete_user(user.uid)
            print(f"Deleted user {email}.")
        except auth.UserNotFoundError:
            pass

    for code in codes:
        for doc in db.collection("participant_links").where("code", "==", code).stream():
            doc.reference.delete()
        db.collection("participant_codes").document(code).delete()

    for cid, _, _ in DEMO_CAMPAIGNS.values():
        for doc in db.collection("assignments").where("campaignId", "==", cid).stream():
            doc.reference.delete()
        db.collection("campaigns").document(cid).delete()
        db.collection("aggregates").document(cid).delete()
    print("Removed demo participants, links and demo portal campaigns.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--remove", action="store_true")
    parser.add_argument("--project", default=None)
    args = parser.parse_args()

    try:
        get_app(args.project)
    except Exception as exc:
        print("Could not authenticate with Firebase Admin SDK. See scripts/set_admin.py for setup.")
        print(f"\nDetails: {exc}")
        sys.exit(1)

    db = firestore.client()
    if args.remove:
        remove(db)
    else:
        seed(db, args.password)


if __name__ == "__main__":
    main()

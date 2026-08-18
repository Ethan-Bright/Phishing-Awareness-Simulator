"""Seed curated local scenarios and demo aggregate data.

Safe to re-run: it writes fixed document ids, so it overwrites rather than
duplicates. The demo campaigns/aggregates exist only to populate the dashboard;
delete them before a real study, or run with --no-demo.

Usage:
    python scripts/seed.py --project my-project-id
    python scripts/seed.py --no-demo
"""

import argparse
import datetime
from firebase_admin import firestore
from _init import get_app

TIPS = [
    "Open the portal yourself from a saved bookmark instead of clicking email links",
    "Check the sender's full email address, not just the display name",
    "Slow down when a message pressures you to act immediately",
    "Report anything suspicious using the Report Phishing button",
]

# ---- Curated, human-written scenario library (all live) ------------------- #
SCENARIOS = [
    {
        "id": "scn_eduvos_student",
        "role": "student", "category": "eduvos_portal", "status": "live",
        "title": "Eduvos Student Portal: confirm your details",
        "content": {
            "senderName": "Eduvos Student Portal",
            "senderEmail": "no-reply@eduvos-portal.co.za",
            "subject": "Action needed: confirm your student details to avoid suspension",
            "body": "Dear Student,\n\nWe detected unusual sign-in activity on your student account. "
                    "To protect your registration and results, sign in within 12 hours to confirm your "
                    "details. If you do not act, portal access will be suspended.\n\nSign in to confirm.",
            "ctaText": "Sign in to Student Portal",
            "landingType": "fake_login",
            "portalName": "Eduvos Student Portal",
            "indicators": [
                "Domain eduvos-portal.co.za mimics the real eduvos.com address",
                "Claims 'unusual activity' to create fear",
                "Short 12-hour deadline pressures a fast reaction",
                "Asks you to sign in through the email link, not the real site",
            ],
            "debrief": {
                "summary": "This spoofed the Eduvos Student Portal sign-in to capture your username and password.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_nsfas_student",
        "role": "student", "category": "nsfas", "status": "live",
        "title": "NSFAS allowance on hold",
        "content": {
            "senderName": "NSFAS Funding Office",
            "senderEmail": "funding@nsfas-verify.co.za",
            "subject": "Your NSFAS allowance is on hold - reconfirm banking now",
            "body": "Dear Student,\n\nYour NSFAS allowance for this term is on hold. To release your "
                    "payment you must reconfirm your banking and ID details within 24 hours, or the "
                    "allowance will be cancelled.\n\nReconfirm to release your payment.",
            "ctaText": "Reconfirm my banking details",
            "landingType": "link",
            "portalName": "NSFAS",
            "indicators": [
                "Look-alike domain nsfas-verify.co.za, not the official nsfas.org.za",
                "Threatens loss of funding to force fast action",
                "Requests banking and ID details via an email link",
                "Generic greeting instead of your name",
            ],
            "debrief": {
                "summary": "This imitated an NSFAS funding notice to harvest banking and identity details.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_m365_staff",
        "role": "staff", "category": "it_helpdesk", "status": "live",
        "title": "Microsoft 365 update required",
        "content": {
            "senderName": "Eduvos IT Helpdesk",
            "senderEmail": "helpdesk@eduvos-support.net",
            "subject": "Microsoft 365 update required - re-authenticate today",
            "body": "Hello,\n\nA mandatory Microsoft 365 update is being applied to staff accounts. "
                    "You must re-authenticate today to keep access to email and shared drives. "
                    "Accounts not verified will be locked.\n\nRe-authenticate now.",
            "ctaText": "Re-authenticate my account",
            "landingType": "fake_login",
            "portalName": "Microsoft 365",
            "indicators": [
                "Sender domain eduvos-support.net is not the real eduvos.com",
                "Impersonates internal IT support",
                "Uses a lock-out threat to trigger a login on a fake page",
                "Vague 'mandatory update' with no ticket reference",
            ],
            "debrief": {
                "summary": "A fake IT helpdesk message used an update scare to push you to a spoofed Microsoft login.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_password_student",
        "role": "student", "category": "it_helpdesk", "status": "live",
        "title": "Password reset required",
        "content": {
            "senderName": "Eduvos IT Helpdesk",
            "senderEmail": "support@eduvos-helpdesk.com",
            "subject": "Your password expires today - reset now",
            "body": "Hello,\n\nThe password for your student account expires today. Reset it now to "
                    "avoid losing access to your email and learning portal.\n\nReset your password.",
            "ctaText": "Reset my password",
            "landingType": "fake_login",
            "portalName": "Eduvos Account",
            "indicators": [
                "Domain eduvos-helpdesk.com is not the official eduvos.com",
                "Same-day expiry deadline creates urgency",
                "Password reset routed through the email, not the real portal",
            ],
            "debrief": {
                "summary": "A password-expiry scare pushed you to a fake reset page to capture your login.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_hr_staff",
        "role": "staff", "category": "eduvos_portal", "status": "live",
        "title": "HR policy update - acknowledgement required",
        "content": {
            "senderName": "Eduvos HR",
            "senderEmail": "hr@eduvos-hr.co.za",
            "subject": "New HR policy - acknowledge within 48 hours",
            "body": "Dear Colleague,\n\nA new HR leave policy takes effect this week. All staff must "
                    "read and acknowledge it within 48 hours through the staff portal.\n\nAcknowledge now.",
            "ctaText": "Open the staff portal",
            "landingType": "link",
            "portalName": "Eduvos Staff Portal",
            "indicators": [
                "Domain eduvos-hr.co.za is not the real eduvos.com",
                "Deadline pressure to acknowledge quickly",
                "Link text does not match the real portal address",
            ],
            "debrief": {
                "summary": "This posed as an HR policy notice to lure staff to a spoofed portal login.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_invoice_sales",
        "role": "sales", "category": "eduvos_portal", "status": "live",
        "title": "Invoice - action required",
        "content": {
            "senderName": "Accounts Payable",
            "senderEmail": "accounts@eduvos-billing.co.za",
            "subject": "Invoice overdue - action required to avoid account hold",
            "body": "Hi,\n\nAn invoice linked to your client account is overdue. Review and confirm the "
                    "payment details today to avoid a hold on the account.\n\nReview the invoice.",
            "ctaText": "Review the invoice",
            "landingType": "link",
            "portalName": "Eduvos Billing",
            "indicators": [
                "Domain eduvos-billing.co.za is not the official eduvos.com",
                "Financial urgency to force a quick click",
                "Unexpected invoice with no prior context",
            ],
            "debrief": {
                "summary": "A fake overdue-invoice notice tried to get you to a spoofed billing login.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_ithelp_lecturer",
        "role": "lecturer", "category": "it_helpdesk", "status": "live",
        "title": "IT helpdesk: mailbox verification",
        "content": {
            "senderName": "Eduvos IT Helpdesk",
            "senderEmail": "helpdesk@eduvos-support.net",
            "subject": "Mailbox over quota - verify to keep sending grades",
            "body": "Hello,\n\nYour mailbox is over quota. Verify your account now to keep sending "
                    "grade submissions and class emails. Unverified mailboxes will be suspended.\n\nVerify now.",
            "ctaText": "Verify my mailbox",
            "landingType": "fake_login",
            "portalName": "Eduvos Mail",
            "indicators": [
                "Sender domain eduvos-support.net is not the real eduvos.com",
                "Quota scare tied to your teaching work",
                "Verification routed to a fake login page",
            ],
            "debrief": {
                "summary": "A quota warning from a fake helpdesk pushed you to a spoofed mailbox login.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_security_consultant",
        "role": "consultant", "category": "it_helpdesk", "status": "live",
        "title": "Security alert: new sign-in detected",
        "content": {
            "senderName": "Eduvos Security",
            "senderEmail": "alerts@eduvos-secure.net",
            "subject": "Security alert: new sign-in to your account",
            "body": "Hello,\n\nWe detected a new sign-in to your partner account from an unrecognised "
                    "device. If this was not you, secure your account immediately.\n\nSecure my account.",
            "ctaText": "Secure my account",
            "landingType": "fake_login",
            "portalName": "Eduvos Partner Portal",
            "indicators": [
                "Domain eduvos-secure.net is not the real eduvos.com",
                "Alarm about a strange sign-in to provoke a fast click",
                "'Secure account' link leads to a fake login",
            ],
            "debrief": {
                "summary": "A fake security alert used alarm to route you to a spoofed partner login.",
                "tips": TIPS,
            },
        },
    },
    # A couple awaiting human review (shows the review queue in the UI).
    {
        "id": "scn_draft_ai_student",
        "role": "student", "category": "nsfas", "status": "pending_review", "aiGenerated": True,
        "title": "[AI draft] NSFAS: residence funding confirmation pending",
        "content": {
            "senderName": "NSFAS Residence Office",
            "senderEmail": "residence@nsfas-fund.co.za",
            "subject": "Residence funding confirmation pending",
            "body": "Dear Student,\n\nYour residence funding is pending confirmation. Confirm your "
                    "details within 24 hours to secure your placement.\n\nConfirm now.",
            "ctaText": "Confirm residence funding",
            "landingType": "link",
            "portalName": "NSFAS",
            "indicators": [
                "Look-alike domain nsfas-fund.co.za",
                "24-hour deadline pressure",
                "Requests confirmation via email link",
            ],
            "debrief": {"summary": "Draft NSFAS residence scam pending human review.", "tips": TIPS},
        },
    },
    {
        "id": "scn_draft_lecturer",
        "role": "lecturer", "category": "eduvos_portal", "status": "pending_review", "aiGenerated": False,
        "title": "Academic portal: grade submission deadline",
        "content": {
            "senderName": "Eduvos Academic Office",
            "senderEmail": "academic@eduvos-portal.co.za",
            "subject": "Grade submission portal closing tonight",
            "body": "Dear Lecturer,\n\nThe grade submission portal closes tonight. Sign in now to "
                    "submit outstanding grades before the deadline.\n\nSign in to submit.",
            "ctaText": "Sign in to submit grades",
            "landingType": "fake_login",
            "portalName": "Eduvos Academic Portal",
            "indicators": [
                "Domain eduvos-portal.co.za mimics eduvos.com",
                "Tonight deadline creates urgency",
                "Sign-in routed through the email",
            ],
            "debrief": {"summary": "Draft academic portal spoof pending human review.", "tips": TIPS},
        },
    },
]

# ---- Demo campaigns + aggregates (dashboard only) ------------------------- #
# (scenario_id, name, status, total, clicked, submitted, reported, ignored, opened)
DEMO = [
    ("scn_m365_staff",         "Microsoft 365 Update - Staff",    "completed", 50, 6, 6, 18, 20, 0),
    ("scn_password_student",   "Password Reset - Students",       "completed", 50, 5, 3, 15, 27, 0),
    ("scn_hr_staff",           "HR Policy Update - Staff",        "completed", 50, 3, 2, 10, 35, 0),
    ("scn_nsfas_student",      "NSFAS Funding Check - Students",  "completed", 60, 8, 5, 12, 35, 0),
    ("scn_ithelp_lecturer",    "Mailbox Verify - Lecturers",      "completed", 40, 4, 2, 9, 25, 0),
    ("scn_invoice_sales",      "Invoice - Action Required",       "running",   45, 4, 3, 9, 0, 12),
    ("scn_security_consultant","Security Alert - Consultants",    "draft",     30, 0, 0, 0, 0, 0),
]


def run(project: str, demo: bool):
    get_app(project)
    db = firestore.client()
    now = firestore.SERVER_TIMESTAMP

    for s in SCENARIOS:
        doc = dict(s)
        sid = doc.pop("id")
        doc.setdefault("aiGenerated", False)
        doc["createdBy"] = "seed"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        if doc["status"] == "live":
            doc["approvedBy"] = "seed"
            doc["approvedAt"] = now
        db.collection("scenarios").document(sid).set(doc)
    print(f"Seeded {len(SCENARIOS)} scenarios.")

    if not demo:
        print("Skipped demo campaigns/aggregates (--no-demo).")
        return

    scn_by_id = {s["id"]: s for s in SCENARIOS}
    for i, (sid, name, status, total, clicked, submitted, reported, ignored, opened) in enumerate(DEMO):
        s = scn_by_id[sid]
        cid = f"demo_campaign_{i+1}"
        db.collection("campaigns").document(cid).set({
            "name": name, "scenarioId": sid, "scenarioTitle": s["title"],
            "role": s["role"], "category": s["category"], "round": 1,
            "status": status, "participantCount": total,
            "createdBy": "seed", "createdAt": now,
        })
        if status != "draft":
            db.collection("aggregates").document(cid).set({
                "campaignId": cid, "campaignName": name, "scenarioId": sid,
                "scenarioTitle": s["title"], "role": s["role"], "category": s["category"],
                "round": 1, "status": status, "total": total,
                "opened": opened, "clicked": clicked, "submitted": submitted,
                "reported": reported, "ignored": ignored, "updatedAt": now,
            })
    print(f"Seeded {len(DEMO)} demo campaigns.")

    # Daily stats over the last ~6 weeks for the time-series chart.
    today = datetime.date.today()
    points = [
        (35, 12, 4), (40, 5, 8), (30, 3, 6), (50, 6, 10),
        (45, 7, 9), (38, 4, 7), (42, 5, 8), (48, 8, 11),
    ]
    for idx, (sent, clicks, reports) in enumerate(points):
        d = today - datetime.timedelta(days=(len(points) - 1 - idx) * 5)
        db.collection("daily_stats").document(d.isoformat()).set({
            "date": d.isoformat(), "sent": sent, "clicks": clicks, "reports": reports,
        })
    print(f"Seeded {len(points)} daily-stat points.")
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None)
    parser.add_argument("--no-demo", action="store_true")
    args = parser.parse_args()
    run(args.project, demo=not args.no_demo)

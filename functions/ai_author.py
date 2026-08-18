"""Offline, template-based scenario draft generator.

This is intentionally NOT a live LLM call. It assembles a structured draft
from role- and category-specific building blocks so drafts can be produced
without any external service and without per-participant generation.

Every draft it returns is marked as needing human review before it can go
live. To plug in a local/offline model instead, replace `build_draft` with a
call to your reviewed model and keep the same return shape.
"""

import random

ROLE_CONTEXT = {
    "student": {
        "portal": "Eduvos Student Portal",
        "audience": "students",
        "hook": "your registration and results",
    },
    "staff": {
        "portal": "Eduvos Staff Portal",
        "audience": "staff members",
        "hook": "your payroll and HR records",
    },
    "lecturer": {
        "portal": "Eduvos Academic Portal",
        "audience": "lecturers",
        "hook": "your class lists and grade submissions",
    },
    "sales": {
        "portal": "Eduvos CRM",
        "audience": "the sales team",
        "hook": "your leads and commission statement",
    },
    "consultant": {
        "portal": "Eduvos Partner Portal",
        "audience": "consultants",
        "hook": "your contract and invoice details",
    },
}

BASE_INDICATORS = [
    "Sender address does not use an official eduvos.com domain",
    "Creates urgency and a short deadline to pressure a quick response",
    "Generic greeting instead of your name",
    "Link text does not match the real destination",
    "Asks you to sign in or confirm details through the email link",
]

BASE_TIPS = [
    "Open the portal yourself from a bookmark instead of clicking email links",
    "Check the sender's full email address, not just the display name",
    "Slow down when a message pressures you to act immediately",
    "Report anything suspicious using the Report Phishing button",
]


def build_draft(role: str, category: str, notes: str = "") -> dict:
    ctx = ROLE_CONTEXT.get(role, ROLE_CONTEXT["student"])
    note_line = f"\n\nContext note for reviewer: {notes}" if notes else ""

    if category == "nsfas":
        subject = "Action required: NSFAS funding confirmation pending"
        sender_name = "NSFAS Funding Office"
        sender_email = "funding@nsfas-verify.co.za"
        body = (
            f"Dear {ctx['audience'].rstrip('s').title()},\n\n"
            "Our records show your NSFAS funding for this term is on hold. "
            "To avoid your allowance being cancelled you must reconfirm your banking "
            "and student details within 24 hours.\n\n"
            "Confirm now to keep your funding active." + note_line
        )
        cta = "Reconfirm my funding"
        indicators = [
            "Uses a look-alike domain (nsfas-verify.co.za), not the official nsfas.org.za",
            "Threatens loss of funding to force fast action",
            "Requests banking details through an email link",
        ] + random.sample(BASE_INDICATORS, 2)
        summary = "This copied the look and urgency of an NSFAS funding notice to harvest banking and login details."
    elif category == "it_helpdesk":
        subject = "IT Helpdesk: mailbox password expires today"
        sender_name = "Eduvos IT Helpdesk"
        sender_email = "helpdesk@eduvos-support.net"
        body = (
            f"Hello,\n\n"
            f"This is the Eduvos IT Helpdesk. The password for {ctx['audience']} accounts "
            "expires today. To keep access to email and " + ctx["hook"] + ", verify your "
            "account now. Accounts not verified will be locked.\n\n"
            "Verify your account to continue." + note_line
        )
        cta = "Verify my account"
        indicators = [
            "Sender domain eduvos-support.net is not the real eduvos.com",
            "Impersonates internal IT support",
            "Password-expiry threat used to trigger a login on a fake page",
        ] + random.sample(BASE_INDICATORS, 2)
        summary = "A fake IT helpdesk message used a password-expiry scare to push you to a spoofed login page."
    else:  # eduvos_portal
        subject = f"{ctx['portal']}: confirm your details to avoid suspension"
        sender_name = ctx["portal"]
        sender_email = "no-reply@eduvos-portal.co.za"
        body = (
            f"Dear {ctx['audience'].rstrip('s').title()},\n\n"
            f"We detected unusual activity on {ctx['hook']}. For your security, "
            f"sign in to the {ctx['portal']} within 12 hours to confirm your details, "
            "otherwise access will be suspended.\n\n"
            "Sign in to confirm." + note_line
        )
        cta = f"Sign in to {ctx['portal']}"
        indicators = [
            "Domain eduvos-portal.co.za mimics the real eduvos.com portal",
            "Claims 'unusual activity' to create fear",
            "Directs you to sign in through the email rather than the real site",
        ] + random.sample(BASE_INDICATORS, 2)
        summary = f"This spoofed the {ctx['portal']} sign-in to capture your username and password."

    # De-duplicate indicators while keeping order.
    seen = set()
    indicators = [i for i in indicators if not (i in seen or seen.add(i))]

    return {
        "title": f"[AI draft] {subject}",
        "content": {
            "senderName": sender_name,
            "senderEmail": sender_email,
            "subject": subject,
            "body": body,
            "ctaText": cta,
            "landingType": "fake_login" if category != "nsfas" else "link",
            "portalName": ctx["portal"],
            "indicators": indicators,
            "debrief": {
                "summary": summary,
                "tips": BASE_TIPS,
            },
        },
    }

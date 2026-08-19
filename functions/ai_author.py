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

LEGIT_TIPS = [
    "Official senders use the organisation's real domain (eduvos.com, nsfas.org.za)",
    "Legitimate messages rarely demand urgent action or threaten account loss",
    "Real IT, HR and funding teams never ask for your password or banking details by email",
    "When unsure, verify through the official website or phone the department yourself",
]


def _build_legit_draft(ctx: dict, category: str, titled: str, note_line: str) -> dict:
    """Legitimate counterpart drafts: same topics as the phishing templates but
    with the real domain, no urgency, and no credential request. Their
    "indicators" are legitimacy cues shown in the debrief."""
    if category == "nsfas":
        subject = "NSFAS allowance payment dates for this term"
        sender_name = "NSFAS"
        sender_email = "noreply@nsfas.org.za"
        body = (
            f"Dear {titled},\n\n"
            "Allowance payments for this term will be processed on the last Friday of "
            "each month. No action is required from you. You can view your payment "
            "history any time by signing in to myNSFAS - type my.nsfas.org.za directly "
            "into your browser.\n\n"
            "If you have questions, contact your campus financial aid office." + note_line
        )
        indicators = [
            "Sender uses the official nsfas.org.za domain",
            "No urgency, deadline or threat of losing funding",
            "Does not ask for banking, ID or login details",
            "Tells you to type the official address yourself instead of clicking a link",
        ]
        summary = "A genuine informational NSFAS notice: official domain, no urgency, no request for details."
    elif category == "it_helpdesk":
        subject = "Planned maintenance: email unavailable Saturday 02:00-04:00"
        sender_name = "Eduvos IT Services"
        sender_email = "ithelpdesk@eduvos.com"
        body = (
            "Hello,\n\n"
            "Scheduled maintenance will take place this Saturday between 02:00 and 04:00. "
            f"Email and {ctx['hook']} may be briefly unavailable during this window. "
            "No action is required - your account and password are not affected.\n\n"
            "Reference: change ticket MNT-2214. Queries: log a ticket on the IT service desk." + note_line
        )
        indicators = [
            "Sender uses the official eduvos.com domain",
            "No action requested and nothing to click or sign in to",
            "Includes a specific change ticket reference you can verify",
            "States clearly that your password is not affected",
        ]
        summary = "A genuine maintenance notice: official domain, a verifiable ticket number, and no request to click or sign in."
    else:  # eduvos_portal
        subject = f"{ctx['portal']}: scheduled update notice"
        sender_name = "Eduvos Student Services"
        sender_email = "studentservices@eduvos.com"
        body = (
            f"Dear {titled},\n\n"
            f"The {ctx['portal']} will receive a scheduled update this weekend. "
            "Sign in as usual through the official website or your saved bookmark - "
            "there is no deadline and nothing further you need to do.\n\n"
            "If you cannot access your account afterwards, visit the campus IT office." + note_line
        )
        indicators = [
            "Sender uses the official eduvos.com domain",
            "Informational only - no deadline, threat or pressure",
            "Directs you to sign in the usual way, not through an email link",
            "Offers an in-person verification route for problems",
        ]
        summary = f"A genuine {ctx['portal']} notice. It never asks you to click a link or confirm details."

    return {
        "title": f"[AI draft - legit] {subject}",
        "isPhishing": False,
        "content": {
            "senderName": sender_name,
            "senderEmail": sender_email,
            "subject": subject,
            "body": body,
            "ctaText": "",
            "landingType": "link",
            "portalName": ctx["portal"],
            "indicators": indicators,
            "debrief": {
                "summary": summary,
                "tips": LEGIT_TIPS,
            },
        },
    }


def build_draft(role: str, category: str, notes: str = "", email_type: str = "phishing") -> dict:
    ctx = ROLE_CONTEXT.get(role, ROLE_CONTEXT["student"])
    note_line = f"\n\nContext note for reviewer: {notes}" if notes else ""

    if email_type == "legit":
        audience_title = ctx["audience"].rstrip("s").title()
        return _build_legit_draft(ctx, category, audience_title, note_line)

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
        "isPhishing": True,
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

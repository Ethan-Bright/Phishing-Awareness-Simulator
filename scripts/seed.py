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

LEGIT_TIPS = [
    "Official senders use the organisation's real domain (eduvos.com, nsfas.org.za)",
    "Legitimate messages rarely demand urgent action or threaten account loss",
    "Real IT, HR and funding teams never ask for your password or banking details by email",
    "When unsure, verify through the official website or phone the department yourself",
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
    # ---- Legitimate (non-phishing) scenarios for discrimination training ---- #
    # These mirror the phishing categories so users learn to tell real notices
    # from spoofs, not just to report everything. isPhishing: False.
    {
        "id": "scn_legit_nsfas_dates",
        "role": "student", "category": "nsfas", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "medium",
        "title": "[Legit] NSFAS allowance payment dates",
        "content": {
            "senderName": "NSFAS",
            "senderEmail": "noreply@nsfas.org.za",
            "subject": "NSFAS allowance payment dates for this term",
            "body": "Dear Student,\n\nAllowance payments for this term will be processed on the last "
                    "Friday of each month. No action is required from you. You can view your payment "
                    "history any time by signing in to myNSFAS - type my.nsfas.org.za directly into "
                    "your browser.\n\nIf you have questions, contact your campus financial aid office.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "myNSFAS",
            "indicators": [
                "Sender uses the official nsfas.org.za domain",
                "No urgency, deadline or threat of losing funding",
                "Does not ask for banking, ID or login details",
                "Tells you to type the official address yourself instead of clicking a link",
            ],
            "debrief": {
                "summary": "This was a genuine informational notice. Official domain, no urgency, no request for details.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    {
        "id": "scn_legit_it_maintenance",
        "role": "staff", "category": "it_helpdesk", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "medium",
        "title": "[Legit] Planned maintenance: email offline Saturday",
        "content": {
            "senderName": "Eduvos IT Services",
            "senderEmail": "ithelpdesk@eduvos.com",
            "subject": "Planned maintenance: email unavailable Saturday 02:00-04:00 (ref MNT-2214)",
            "body": "Hello,\n\nScheduled maintenance will take place this Saturday between 02:00 and "
                    "04:00. Email and shared drives will be briefly unavailable during this window. "
                    "No action is required - your account and password are not affected.\n\n"
                    "Reference: change ticket MNT-2214. Queries: log a ticket on the IT service desk.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "Eduvos IT Service Desk",
            "indicators": [
                "Sender uses the official eduvos.com domain",
                "No action requested and nothing to click or sign in to",
                "Includes a specific change ticket reference you can verify",
                "States clearly that your password is not affected",
            ],
            "debrief": {
                "summary": "A genuine maintenance notice: official domain, a verifiable ticket number, and no request to click or sign in.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    {
        "id": "scn_legit_results_release",
        "role": "student", "category": "eduvos_portal", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "easy",
        "title": "[Legit] Semester results release date",
        "content": {
            "senderName": "Eduvos Student Services",
            "senderEmail": "studentservices@eduvos.com",
            "subject": "Semester results will be released on 15 December",
            "body": "Dear Student,\n\nSemester results will be available on the Student Portal from "
                    "15 December. Sign in as usual through the official website or your saved "
                    "bookmark to view them. There is no deadline and nothing further you need to do."
                    "\n\nIf you cannot access your account, visit the campus IT office with your "
                    "student card.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "Eduvos Student Portal",
            "indicators": [
                "Sender uses the official eduvos.com domain",
                "Informational only - no deadline, threat or pressure",
                "Directs you to sign in the usual way, not through an email link",
                "Offers an in-person verification route for problems",
            ],
            "debrief": {
                "summary": "A genuine notice about results. It never asks you to click a link or confirm details.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    {
        "id": "scn_legit_hr_policy",
        "role": "staff", "category": "eduvos_portal", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "easy",
        "title": "[Legit] Updated leave policy on the intranet",
        "content": {
            "senderName": "Eduvos Human Resources",
            "senderEmail": "hr@eduvos.com",
            "subject": "Updated leave policy now available on the intranet",
            "body": "Dear Colleague,\n\nThe updated leave policy has been published on the staff "
                    "intranet under HR > Policies. Please read it when convenient. Your line manager "
                    "will cover the key changes in the next team meeting.\n\nQuestions can go to "
                    "your HR business partner.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "Eduvos Staff Intranet",
            "indicators": [
                "Sender uses the official eduvos.com domain",
                "No acknowledgement deadline or account threat",
                "Points to a known internal location instead of an email link",
                "Offers a human follow-up channel (manager, HR partner)",
            ],
            "debrief": {
                "summary": "A genuine HR notice: no urgency, no sign-in link, and a verifiable internal location.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    {
        "id": "scn_legit_timetable_lecturer",
        "role": "lecturer", "category": "eduvos_portal", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "hard",
        "title": "[Legit] Exam venue change for INF201",
        "content": {
            "senderName": "Eduvos Academic Office",
            "senderEmail": "academicoffice@eduvos.com",
            "subject": "Venue change: INF201 exam moves to Hall B",
            "body": "Dear Lecturer,\n\nPlease note the INF201 exam on 20 November moves from Hall A "
                    "to Hall B. The invigilation roster on the Academic Portal has been updated - "
                    "you can check it next time you sign in as usual.\n\nContact the exams office "
                    "on ext. 2145 with any questions.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "Eduvos Academic Portal",
            "indicators": [
                "Sender uses the official eduvos.com domain",
                "Specific, verifiable details (module code, date, venue, extension)",
                "No link to click and no request to sign in through the email",
                "A phone extension you can call to confirm",
            ],
            "debrief": {
                "summary": "A genuine operational notice with verifiable specifics and no credential request.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    {
        "id": "scn_legit_password_window",
        "role": "student", "category": "it_helpdesk", "status": "live",
        "isPhishing": False, "useInQuiz": True, "difficulty": "hard",
        "title": "[Legit] Annual password change window",
        "content": {
            "senderName": "Eduvos IT Services",
            "senderEmail": "ithelpdesk@eduvos.com",
            "subject": "Password change window: 1-14 September (ref MNT-3301)",
            "body": "Hello,\n\nCampus accounts will enter the annual password-change window from 1 to 14 "
                    "September. You can update your password the next time you sign in on campus, or through "
                    "the Student Portal bookmark you already use. We will not send a reset link in email.\n\n"
                    "Reference: MNT-3301. If you are locked out, visit the IT desk with your student card.",
            "ctaText": "",
            "landingType": "link",
            "portalName": "Eduvos Account",
            "indicators": [
                "Sender uses the official eduvos.com domain",
                "Tells you not to expect a reset link in email",
                "Change happens on campus or via a saved bookmark, not this message",
                "Includes a ticket reference and an in-person fallback",
            ],
            "debrief": {
                "summary": "A genuine IT notice. Official domain, no reset link, and it warns you that password changes do not come by email.",
                "tips": LEGIT_TIPS,
            },
        },
    },
    # Harder phishing for the quiz. Same topics as the legit set, but the tell
    # is a near-miss domain or a quiet credential ask, not shouting urgency.
    {
        "id": "scn_quiz_subdomain_it",
        "role": "staff", "category": "it_helpdesk", "status": "live",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard",
        "title": "[Quiz] IT licence review via extra TLD",
        "content": {
            "senderName": "Eduvos IT Services",
            "senderEmail": "ithelpdesk@eduvos.com.licence-review.net",
            "subject": "Microsoft 365 licence review - ticket LIC-4419",
            "body": "Hello,\n\nFinance has asked us to confirm Microsoft 365 licence assignments before the "
                    "new billing cycle. Please open the review form when you have a moment and confirm the "
                    "apps listed against your account. This is a routine check; your mailbox will stay online "
                    "in the meantime.\n\nTicket LIC-4419 is logged on the service desk.",
            "ctaText": "Open licence review",
            "landingType": "fake_login",
            "portalName": "Microsoft 365",
            "indicators": [
                "Address is ithelpdesk@eduvos.com.licence-review.net - everything after eduvos.com is an attacker domain",
                "Calm, ticket-style wording hides the credential ask",
                "The button still sends you to sign in through the email",
                "Display name matches IT, which is why the full address matters",
            ],
            "debrief": {
                "summary": "The display name and ticket number look internal, but the address sits on licence-review.net, not eduvos.com.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_quiz_typosquat_portal",
        "role": "student", "category": "eduvos_portal", "status": "live",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard",
        "title": "[Quiz] Results notice with lookalike domain",
        "content": {
            "senderName": "Eduvos Student Services",
            "senderEmail": "studentservices@eduv0s.com",
            "subject": "Semester results are now available on the Student Portal",
            "body": "Dear Student,\n\nSemester results have been released. You can view them on the Student "
                    "Portal. If a module mark looks wrong, log a query with your campus assessments office "
                    "during the usual five-day window.\n\nUse the button below if you do not have the portal "
                    "bookmarked.",
            "ctaText": "View my results",
            "landingType": "fake_login",
            "portalName": "Eduvos Student Portal",
            "indicators": [
                "Domain is eduv0s.com with a zero, not eduvos.com",
                "Tone matches a real results notice, so the address is the main tell",
                "Offers a portal button in the email instead of a saved bookmark",
                "Asks you to sign in through that button",
            ],
            "debrief": {
                "summary": "A polished results notice from eduv0s.com (zero instead of o). The real Student Services address uses eduvos.com.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_quiz_nsfas_suffix",
        "role": "student", "category": "nsfas", "status": "live",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard",
        "title": "[Quiz] NSFAS payment advice with suffix domain",
        "content": {
            "senderName": "NSFAS",
            "senderEmail": "noreply@nsfas.org.za.payments-desk.co.za",
            "subject": "Allowance payment processed - confirm beneficiary details",
            "body": "Dear Student,\n\nYour term allowance has been processed. Please confirm that the "
                    "beneficiary account on file still belongs to you so that the next cycle is not delayed. "
                    "You can also view the schedule on myNSFAS when you next sign in.\n\nNo penalty applies "
                    "if you confirm later this week.",
            "ctaText": "Confirm beneficiary details",
            "landingType": "link",
            "portalName": "myNSFAS",
            "indicators": [
                "Address is nsfas.org.za.payments-desk.co.za - the real domain ends at nsfas.org.za",
                "Asks you to confirm banking details through the email",
                "Wording is polite and mentions myNSFAS to look official",
                "A real NSFAS notice would not harvest account numbers from a link",
            ],
            "debrief": {
                "summary": "Looks like NSFAS, but the mailbox lives on payments-desk.co.za. The real org address stops at nsfas.org.za.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_quiz_shared_doc",
        "role": "lecturer", "category": "eduvos_portal", "status": "live",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard",
        "title": "[Quiz] Shared grade sheet",
        "content": {
            "senderName": "Eduvos Academic Office",
            "senderEmail": "sharing@eduvos-files.net",
            "subject": "A grade sheet was shared with you: INF201 exam marks",
            "body": "Dear Lecturer,\n\nThe assessments office shared 'INF201 exam marks.xlsx' with your "
                    "account. Open the file to comment before the marks meeting on Thursday. Access is limited "
                    "to the module team.\n\nIf you were not expecting this, you can ignore the share.",
            "ctaText": "Open shared file",
            "landingType": "fake_login",
            "portalName": "Eduvos Files",
            "indicators": [
                "Sender domain eduvos-files.net is not eduvos.com",
                "Shared-document bait is a common way to harvest a login",
                "A real share would appear in your official OneDrive or email from @eduvos.com",
                "The 'ignore if unexpected' line is copied from real file-share notices",
            ],
            "debrief": {
                "summary": "A fake file-share notice. The address is on eduvos-files.net, and opening it still asks you to sign in.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_quiz_hr_intranet",
        "role": "staff", "category": "eduvos_portal", "status": "live",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard",
        "title": "[Quiz] HR policy with hyphenated domain",
        "content": {
            "senderName": "Eduvos Human Resources",
            "senderEmail": "hr@edu-vos.com",
            "subject": "Leave policy update now on the intranet",
            "body": "Dear Colleague,\n\nThe leave policy has been revised and is on the staff intranet under "
                    "HR > Policies. Please read it before your next team meeting. Line managers will cover "
                    "the changes in the usual briefing slot.\n\nQuestions can go to your HR business partner.",
            "ctaText": "Open HR > Policies",
            "landingType": "link",
            "portalName": "Eduvos Staff Intranet",
            "indicators": [
                "Address is hr@edu-vos.com with a hyphen, not hr@eduvos.com",
                "Body copies a real HR notice almost word for word",
                "The button still leaves the email instead of naming a known intranet path only",
                "Display name is correct, which is why you have to read the full address",
            ],
            "debrief": {
                "summary": "Almost identical to a genuine HR mail, except the domain is edu-vos.com. Real HR uses eduvos.com.",
                "tips": TIPS,
            },
        },
    },
    {
        "id": "scn_draft_quiz_payroll",
        "role": "staff", "category": "eduvos_portal", "status": "pending_review",
        "isPhishing": True, "useInQuiz": True, "difficulty": "hard", "aiGenerated": True,
        "title": "[AI draft] Payroll: confirm bank detail on file",
        "content": {
            "senderName": "Eduvos Payroll",
            "senderEmail": "payroll@eduvos.com.pay-office.co.za",
            "subject": "Payslip run Friday - confirm bank detail on file",
            "body": "Hello,\n\nPayroll is preparing Friday's run. Please confirm the bank detail we have on "
                    "file so your salary is not held. This takes about a minute.\n\nYou can also raise a "
                    "ticket with HR if the detail has not changed.",
            "ctaText": "Confirm bank detail",
            "landingType": "link",
            "portalName": "Eduvos Payroll",
            "indicators": [
                "Address sits on pay-office.co.za after eduvos.com",
                "Asks for bank confirmation via email",
                "Mentions a real payroll rhythm to sound internal",
            ],
            "debrief": {
                "summary": "Draft payroll phish pending human review. Extra TLD on the sender address.",
                "tips": TIPS,
            },
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
        doc.setdefault("isPhishing", True)
        doc.setdefault("useInQuiz", False)
        doc.setdefault("difficulty", "medium")
        doc["createdBy"] = "seed"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        if doc["status"] == "live":
            doc["approvedBy"] = "seed"
            doc["approvedAt"] = now
        db.collection("scenarios").document(sid).set(doc)
        if doc.get("status") == "live" and doc.get("useInQuiz"):
            c = doc.get("content") or {}
            debrief = c.get("debrief") or {}
            db.collection("quiz_live").document(sid).set({
                "isPhishing": doc.get("isPhishing") is not False,
                "difficulty": doc.get("difficulty") or "medium",
                "content": {
                    "senderName": c.get("senderName") or "",
                    "senderEmail": c.get("senderEmail") or "",
                    "subject": c.get("subject") or "",
                    "body": c.get("body") or "",
                    "ctaText": c.get("ctaText") or "",
                },
                "verdict": debrief.get("summary") or "",
                "indicators": c.get("indicators") or [],
            })
        else:
            db.collection("quiz_live").document(sid).delete()
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

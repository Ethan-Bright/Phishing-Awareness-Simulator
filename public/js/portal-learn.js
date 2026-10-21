import { requireParticipant } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { escapeHtml, ROLE_LABELS } from "./utils.js";
import { adminPreviewBanner } from "./portal-common.js";

const { claims, isAdmin } = await requireParticipant();
const page = mountShell({
  variant: "participant",
  active: "portal-learn",
  title: "Learning materials",
  subtitle: "Short guides on spotting and reporting phishing."
});

const MODULES = [
  {
    title: "What phishing is",
    intro: "Phishing is a message that pretends to be from someone you trust so you'll hand over a password, money or personal details, or open something harmful.",
    points: [
      "Most phishing arrives by email, but SMS, WhatsApp and phone calls are common too.",
      "Attackers copy real logos, names and wording. Looking official proves nothing.",
      "The goal is almost always one of three things: your login, your money, or access to your device."
    ]
  },
  {
    title: "Red flags to check every time",
    intro: "Before you click, pause and run through these.",
    points: [
      "Sender address: read the full address, not the display name. eduv0s.com, edu-vos.com and eduvos.com.licence-review.net are all fake.",
      "Urgency or threats: \"within 12 hours\", \"account suspended\", \"allowance cancelled\".",
      "Requests for credentials or banking details through a link.",
      "Generic greetings like \"Dear Student\" combined with a request to act.",
      "Links whose real address (hover or long-press) doesn't match the organisation.",
      "Unexpected attachments, invoices or shared files you weren't expecting."
    ]
  },
  {
    title: "Lookalike domains",
    intro: "The most reliable tell is the domain, the part after the @. Read it right to left from the last dot.",
    points: [
      "Real: someone@eduvos.com. Fake: someone@eduvos.com.payments-desk.co.za (the real domain is payments-desk.co.za).",
      "Swapped characters: 0 for o, rn for m, l for I.",
      "Extra words: eduvos-portal, eduvos-support, eduvos-hr. None of these are eduvos.com.",
      "NSFAS uses nsfas.org.za. Anything else claiming to be NSFAS is suspect."
    ]
  },
  {
    title: "What to do if you're unsure",
    intro: "You don't have to decide alone.",
    points: [
      "Don't click. Open the site yourself from a bookmark or by typing the address.",
      "Contact the sender through a channel you already trust, like the official phone number or the IT desk.",
      "Report it. Reporting a real email by mistake costs nothing. Missing a phish can cost a lot."
    ]
  },
  {
    title: "If you already clicked",
    intro: "Act quickly. It's not about blame.",
    points: [
      "If you entered a password, change it straight away from the real site, and anywhere else you reuse it.",
      "Tell IT immediately so they can check your account and warn others.",
      "If you shared banking details, call your bank using the number on your card.",
      "Turn on multi-factor authentication where it's offered."
    ]
  }
];

const ROLE_TIPS = {
  student: [
    "NSFAS will never ask you to reconfirm banking details through an email link.",
    "Results, registration and timetable notices come from @eduvos.com. Sign in through your saved bookmark.",
    "Be wary of job offers, bursaries or \"easy money\" messages that ask for your ID number."
  ],
  lecturer: [
    "Shared grade sheets and \"mailbox over quota\" warnings are popular lures. Open files from OneDrive or the LMS directly.",
    "Grade submission deadlines are announced through official channels, not urgent sign-in links.",
    "Students' personal details are valuable to attackers. Never send them in reply to an unexpected request."
  ],
  staff: [
    "HR and payroll will never ask you to confirm bank details via a link. Check the staff intranet yourself.",
    "IT maintenance notices from the real team include a ticket number and never ask for your password.",
    "Invoice and supplier payment changes should always be verified by phone."
  ],
  sales: [
    "Overdue invoices from unfamiliar addresses are a common lure. Verify with accounts before acting.",
    "Be careful with \"updated banking details\" from clients or suppliers. Confirm by phone.",
    "Don't open attachments from unknown prospects without checking the sender."
  ],
  consultant: [
    "\"New sign-in detected\" alerts are often fake. Check your account by going to the portal yourself.",
    "Partner portals should be reached via bookmark, not email links.",
    "Client documents shared from unknown domains should be confirmed first."
  ]
};

function moduleCard(m) {
  return `
  <div class="card p-6">
    <h2 class="text-base font-semibold text-slate-900">${escapeHtml(m.title)}</h2>
    <p class="mt-1 text-sm text-slate-500">${escapeHtml(m.intro)}</p>
    <ul class="mt-4 space-y-2 text-sm text-slate-700">
      ${m.points.map((p) => `
      <li class="flex items-start gap-2">
        <svg class="mt-0.5 h-4 w-4 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${escapeHtml(p)}</span>
      </li>`).join("")}
    </ul>
  </div>`;
}

const roleKeys = Object.keys(ROLE_TIPS);
const ordered = claims.role && ROLE_TIPS[claims.role]
  ? [claims.role, ...roleKeys.filter((r) => r !== claims.role)]
  : roleKeys;

const roleCards = ordered.map((r, i) => `
  <details class="card p-5" ${i === 0 && claims.role ? "open" : ""}>
    <summary class="cursor-pointer text-sm font-semibold text-slate-900">
      ${escapeHtml(ROLE_LABELS[r])}${r === claims.role ? ` <span class="pill pill-blue ml-2">Your role</span>` : ""}
    </summary>
    <ul class="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
      ${ROLE_TIPS[r].map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
    </ul>
  </details>`).join("");

page.innerHTML = `
  <div class="space-y-6">
    ${isAdmin ? adminPreviewBanner() : ""}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      ${MODULES.map(moduleCard).join("")}
    </div>
    <div>
      <h2 class="mb-3 text-base font-semibold text-slate-900">Tips by role</h2>
      <div class="space-y-3">${roleCards}</div>
    </div>
    <div class="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <div class="text-sm font-semibold text-slate-900">Ready to test yourself?</div>
        <div class="text-xs text-slate-500">Put this into practice with a quiz.</div>
      </div>
      <a href="/portal-quizzes" class="btn-primary">Go to quizzes</a>
    </div>
  </div>`;

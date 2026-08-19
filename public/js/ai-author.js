/** Scenario drafts: Gemini first, template fallback if the model is unavailable. */

import { getGeminiModel, parseJsonFromModel } from "./gemini.js";

const ROLE_CONTEXT = {
  student: {
    portal: "Eduvos Student Portal",
    audience: "students",
    hook: "your registration and results"
  },
  staff: {
    portal: "Eduvos Staff Portal",
    audience: "staff members",
    hook: "your payroll and HR records"
  },
  lecturer: {
    portal: "Eduvos Academic Portal",
    audience: "lecturers",
    hook: "your class lists and grade submissions"
  },
  sales: {
    portal: "Eduvos CRM",
    audience: "the sales team",
    hook: "your leads and commission statement"
  },
  consultant: {
    portal: "Eduvos Partner Portal",
    audience: "consultants",
    hook: "your contract and invoice details"
  }
};

const BASE_INDICATORS = [
  "Sender address does not use an official eduvos.com domain",
  "Creates urgency and a short deadline to pressure a quick response",
  "Generic greeting instead of your name",
  "Link text does not match the real destination",
  "Asks you to sign in or confirm details through the email link"
];

const BASE_TIPS = [
  "Open the portal yourself from a bookmark instead of clicking email links",
  "Check the sender's full email address, not just the display name",
  "Slow down when a message pressures you to act immediately",
  "Report anything suspicious using the Report Phishing button"
];

const LEGIT_TIPS = [
  "Official senders use the organisation's real domain (eduvos.com, nsfas.org.za)",
  "Legitimate messages rarely demand urgent action or threaten account loss",
  "Real IT, HR and funding teams never ask for your password or banking details by email",
  "When unsure, verify through the official website or phone the department yourself"
];

function sample(list, n) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export const VALID_ROLES = Object.keys(ROLE_CONTEXT);
export const VALID_CATEGORIES = ["eduvos_portal", "nsfas", "it_helpdesk"];
export const VALID_EMAIL_TYPES = ["phishing", "legit"];

// Legitimate counterpart drafts: same topics as the phishing templates, but
// with the real domain, no urgency, and no credential request. Their
// "indicators" are legitimacy cues shown in the debrief.
function buildLegitDraft(ctx, category, titled, noteLine) {
  let subject;
  let senderName;
  let senderEmail;
  let body;
  let indicators;
  let summary;

  if (category === "nsfas") {
    subject = "NSFAS allowance payment dates for this term";
    senderName = "NSFAS";
    senderEmail = "noreply@nsfas.org.za";
    body =
      `Dear ${titled},\n\n` +
      "Allowance payments for this term will be processed on the last Friday of " +
      "each month. No action is required from you. You can view your payment " +
      "history any time by signing in to myNSFAS - type my.nsfas.org.za directly " +
      "into your browser.\n\n" +
      "If you have questions, contact your campus financial aid office." + noteLine;
    indicators = [
      "Sender uses the official nsfas.org.za domain",
      "No urgency, deadline or threat of losing funding",
      "Does not ask for banking, ID or login details",
      "Tells you to type the official address yourself instead of clicking a link"
    ];
    summary = "A genuine informational NSFAS notice: official domain, no urgency, no request for details.";
  } else if (category === "it_helpdesk") {
    subject = "Planned maintenance: email unavailable Saturday 02:00-04:00";
    senderName = "Eduvos IT Services";
    senderEmail = "ithelpdesk@eduvos.com";
    body =
      "Hello,\n\n" +
      "Scheduled maintenance will take place this Saturday between 02:00 and 04:00. " +
      `Email and ${ctx.hook} may be briefly unavailable during this window. ` +
      "No action is required - your account and password are not affected.\n\n" +
      "Reference: change ticket MNT-2214. Queries: log a ticket on the IT service desk." + noteLine;
    indicators = [
      "Sender uses the official eduvos.com domain",
      "No action requested and nothing to click or sign in to",
      "Includes a specific change ticket reference you can verify",
      "States clearly that your password is not affected"
    ];
    summary = "A genuine maintenance notice: official domain, a verifiable ticket number, and no request to click or sign in.";
  } else {
    subject = `${ctx.portal}: scheduled update notice`;
    senderName = "Eduvos Student Services";
    senderEmail = "studentservices@eduvos.com";
    body =
      `Dear ${titled},\n\n` +
      `The ${ctx.portal} will receive a scheduled update this weekend. ` +
      "Sign in as usual through the official website or your saved bookmark - " +
      "there is no deadline and nothing further you need to do.\n\n" +
      "If you cannot access your account afterwards, visit the campus IT office." + noteLine;
    indicators = [
      "Sender uses the official eduvos.com domain",
      "Informational only - no deadline, threat or pressure",
      "Directs you to sign in the usual way, not through an email link",
      "Offers an in-person verification route for problems"
    ];
    summary = `A genuine ${ctx.portal} notice. It never asks you to click a link or confirm details.`;
  }

  return {
    title: `[AI draft - legit] ${subject}`,
    isPhishing: false,
    content: {
      senderName,
      senderEmail,
      subject,
      body,
      ctaText: "",
      landingType: "link",
      portalName: ctx.portal,
      indicators,
      debrief: {
        summary,
        tips: LEGIT_TIPS
      }
    }
  };
}

export function buildDraft(role, category, notes = "", emailType = "phishing") {
  const ctx = ROLE_CONTEXT[role] || ROLE_CONTEXT.student;
  const noteLine = notes ? `\n\nContext note for reviewer: ${notes}` : "";
  const audienceTitle = ctx.audience.replace(/s$/, "");
  const titled = audienceTitle.charAt(0).toUpperCase() + audienceTitle.slice(1);

  if (emailType === "legit") {
    return buildLegitDraft(ctx, category, titled, noteLine);
  }

  let subject;
  let senderName;
  let senderEmail;
  let body;
  let cta;
  let indicators;
  let summary;

  if (category === "nsfas") {
    subject = "Action required: NSFAS funding confirmation pending";
    senderName = "NSFAS Funding Office";
    senderEmail = "funding@nsfas-verify.co.za";
    body =
      `Dear ${titled},\n\n` +
      "Our records show your NSFAS funding for this term is on hold. " +
      "To avoid your allowance being cancelled you must reconfirm your banking " +
      "and student details within 24 hours.\n\n" +
      "Confirm now to keep your funding active." + noteLine;
    cta = "Reconfirm my funding";
    indicators = [
      "Uses a look-alike domain (nsfas-verify.co.za), not the official nsfas.org.za",
      "Threatens loss of funding to force fast action",
      "Requests banking details through an email link",
      ...sample(BASE_INDICATORS, 2)
    ];
    summary = "This copied the look and urgency of an NSFAS funding notice to harvest banking and login details.";
  } else if (category === "it_helpdesk") {
    subject = "IT Helpdesk: mailbox password expires today";
    senderName = "Eduvos IT Helpdesk";
    senderEmail = "helpdesk@eduvos-support.net";
    body =
      "Hello,\n\n" +
      `This is the Eduvos IT Helpdesk. The password for ${ctx.audience} accounts ` +
      "expires today. To keep access to email and " + ctx.hook + ", verify your " +
      "account now. Accounts not verified will be locked.\n\n" +
      "Verify your account to continue." + noteLine;
    cta = "Verify my account";
    indicators = [
      "Sender domain eduvos-support.net is not the real eduvos.com",
      "Impersonates internal IT support",
      "Password-expiry threat used to trigger a login on a fake page",
      ...sample(BASE_INDICATORS, 2)
    ];
    summary = "A fake IT helpdesk message used a password-expiry scare to push you to a spoofed login page.";
  } else {
    subject = `${ctx.portal}: confirm your details to avoid suspension`;
    senderName = ctx.portal;
    senderEmail = "no-reply@eduvos-portal.co.za";
    body =
      `Dear ${titled},\n\n` +
      `We detected unusual activity on ${ctx.hook}. For your security, ` +
      `sign in to the ${ctx.portal} within 12 hours to confirm your details, ` +
      "otherwise access will be suspended.\n\n" +
      "Sign in to confirm." + noteLine;
    cta = `Sign in to ${ctx.portal}`;
    indicators = [
      "Domain eduvos-portal.co.za mimics the real eduvos.com portal",
      "Claims 'unusual activity' to create fear",
      "Directs you to sign in through the email rather than the real site",
      ...sample(BASE_INDICATORS, 2)
    ];
    summary = `This spoofed the ${ctx.portal} sign-in to capture your username and password.`;
  }

  return {
    title: `[AI draft] ${subject}`,
    isPhishing: true,
    content: {
      senderName,
      senderEmail,
      subject,
      body,
      ctaText: cta,
      landingType: category === "nsfas" ? "link" : "fake_login",
      portalName: ctx.portal,
      indicators: unique(indicators),
      debrief: {
        summary,
        tips: BASE_TIPS
      }
    }
  };
}

const DRAFT_SYSTEM = `You write training emails for an Eduvos (South Africa) phishing-awareness simulator.

Return ONLY valid JSON with this shape:
{
  "title": "short internal title for reviewers",
  "isPhishing": true,
  "content": {
    "senderName": "",
    "senderEmail": "",
    "subject": "",
    "body": "",
    "ctaText": "",
    "landingType": "link",
    "portalName": "",
    "indicators": ["cue 1", "cue 2", "cue 3"],
    "debrief": { "summary": "one sentence", "tips": ["tip 1", "tip 2", "tip 3"] }
  }
}

Rules:
- Official domains only for legitimate mail: eduvos.com and nsfas.org.za.
- Phishing may use lookalike domains, extra TLDs, or attacker subdomains. Never use a real eduvos.com or nsfas.org.za address on phishing.
- landingType is "fake_login" or "link". Legit emails use "link" and usually an empty ctaText.
- For legit emails, indicators are legitimacy cues. For phishing, they are the tells a learner should notice.
- No real people's private data. No real banking numbers. Simulations only.
- Body is a plain-text email, 80 to 180 words.`;

function difficultyGuide(level, emailType) {
  if (emailType === "legit") {
    return level === "hard"
      ? "HARD legit: the message can be time-sensitive or operationally important, but the domain is official, there is no credential/banking harvest, and it tells the reader to use a known portal or phone extension instead of an email link."
      : "Legit: calm, official domain, no password/banking request, no fake login button.";
  }
  if (level === "hard") {
    return `HARD phishing (make this the default for quiz training):
- Do not rely on shouting, ALL CAPS, or "act in 12 hours or your account dies".
- Use a near-miss domain: extra hyphen, digit/letter swap, extra TLD (eduvos.com.helpdesk-verify.net), or a lookalike like eduv0s.com / eduvos.co.
- Display name can look official. The address is the tell.
- Body should read like a real internal or government email: ticket numbers, module codes, polite tone.
- One or two subtle tells only. A careful reader should need to inspect the sender address and the ask.
- The harmful ask is still there: click a link, "confirm" banking, or sign in through the email.`;
  }
  if (level === "easy") {
    return "EASY phishing: obvious lookalike domain, generic greeting, clear urgency/threat, and a sign-in or confirm button.";
  }
  return "MEDIUM phishing: mixed tells. Domain is wrong, but the wording is fairly professional.";
}

export async function generateScenarioDraft({
  role,
  category,
  notes = "",
  emailType = "phishing",
  difficulty = "hard",
  useInQuiz = false
}) {
  const ctx = ROLE_CONTEXT[role] || ROLE_CONTEXT.student;
  const isPhishing = emailType !== "legit";

  try {
    const model = await getGeminiModel("admin-drafts", {
      systemInstruction: DRAFT_SYSTEM,
      temperature: 0.85,
      maxOutputTokens: 1400
    });
    const prompt = [
      `Write one ${isPhishing ? "PHISHING" : "LEGITIMATE"} training email.`,
      `Role: ${role} (${ctx.audience}). Category: ${category}. Portal context: ${ctx.portal}, ${ctx.hook}.`,
      `Difficulty: ${difficulty}.`,
      difficultyGuide(difficulty, emailType),
      useInQuiz
        ? "This is for a discrimination quiz (phish vs legit), so make phishing and legit examples close enough that the learner has to inspect the sender."
        : "This may be used in a campaign inbox simulation.",
      notes ? `Reviewer notes: ${notes}` : "",
      "Set isPhishing correctly. Fill every JSON field."
    ].filter(Boolean).join("\n");

    const result = await model.generateContent(prompt);
    const draft = parseJsonFromModel(result.response.text());
    const content = draft.content || {};
    return {
      title: String(draft.title || `[AI draft] ${content.subject || "Untitled"}`).slice(0, 140),
      isPhishing,
      content: {
        senderName: content.senderName || "",
        senderEmail: content.senderEmail || "",
        subject: content.subject || "",
        body: content.body || "",
        ctaText: content.ctaText || "",
        landingType: content.landingType === "fake_login" ? "fake_login" : "link",
        portalName: content.portalName || ctx.portal,
        indicators: Array.isArray(content.indicators) ? content.indicators.filter(Boolean) : [],
        debrief: {
          summary: content.debrief?.summary || "",
          tips: Array.isArray(content.debrief?.tips) ? content.debrief.tips.filter(Boolean) : []
        }
      }
    };
  } catch (err) {
    console.warn("Gemini draft failed, using template fallback.", err);
    return buildDraft(role, category, notes, emailType);
  }
}

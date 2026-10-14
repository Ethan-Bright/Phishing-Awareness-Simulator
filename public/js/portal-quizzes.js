import { requireParticipant } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchQuizPool, QUIZ_BATCH } from "./portal-api.js";
import { icons } from "./icons.js";
import { DIFFICULTY_LABELS } from "./utils.js";
import { adminPreviewBanner } from "./portal-common.js";

const { isAdmin } = await requireParticipant();
const page = mountShell({
  variant: "participant",
  active: "portal-quizzes",
  title: "Quizzes",
  subtitle: "Every quiz uses human-approved emails only."
});

const pool = await fetchQuizPool();
const phish = pool.filter((i) => i.isPhishing !== false).length;
const legit = pool.length - phish;
const byLevel = (lvl) => pool.filter((i) => (i.difficulty || "medium") === lvl).length;
const batchReady = phish >= QUIZ_BATCH.phishing && legit >= QUIZ_BATCH.legit;

function quizCard({ title, text, count, href, ready, tint, note }) {
  return `
  <div class="card flex flex-col p-5">
    <div class="stat-icon ${tint} mb-3">${icons.shieldCheck}</div>
    <div class="text-base font-semibold text-slate-900">${title}</div>
    <p class="mt-1 flex-1 text-sm text-slate-500">${text}</p>
    <div class="mt-3 text-xs text-slate-400">${count} email${count === 1 ? "" : "s"}</div>
    ${ready
      ? `<a href="${href}" class="btn-primary mt-4">Start</a>`
      : `<button class="btn-secondary mt-4" disabled>Not available yet</button>
         <p class="mt-2 text-xs text-slate-400">${note || "No approved emails yet."}</p>`}
  </div>`;
}

const cards = [
  quizCard({
    title: "Phish or Legit? (quick batch)",
    text: "A random mix of phishing and real emails. Feedback after each one, then an AI coach to talk it through.",
    count: QUIZ_BATCH.phishing + QUIZ_BATCH.legit,
    href: "/quiz.html?from=portal",
    ready: batchReady,
    tint: "bg-blue-50 text-blue-600",
    note: `Needs ${QUIZ_BATCH.phishing} phishing and ${QUIZ_BATCH.legit} legit approved emails (have ${phish} and ${legit}).`
  }),
  quizCard({
    title: "Full practice set",
    text: "Every approved quiz email, in random order. Good for a thorough run-through.",
    count: pool.length,
    href: "/quiz.html?mode=all&from=portal",
    ready: pool.length > 0,
    tint: "bg-emerald-50 text-emerald-600"
  }),
  ...["easy", "medium", "hard"].map((lvl) => quizCard({
    title: `${DIFFICULTY_LABELS[lvl]} emails only`,
    text: lvl === "hard"
      ? "Near-miss domains and calm wording. The tells are subtle."
      : lvl === "easy"
        ? "Clear examples to warm up with."
        : "Typical everyday phishing and real notices.",
    count: byLevel(lvl),
    href: `/quiz.html?mode=all&difficulty=${lvl}&from=portal`,
    ready: byLevel(lvl) > 0,
    tint: lvl === "hard" ? "bg-red-50 text-red-600" : lvl === "easy" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
  }))
];

page.innerHTML = `
  <div class="space-y-6">
    ${isAdmin ? adminPreviewBanner() : ""}
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">${cards.join("")}</div>
    <p class="text-center text-xs text-slate-400">Quiz scores stay in your browser. They are not saved or shared with anyone.</p>
  </div>`;

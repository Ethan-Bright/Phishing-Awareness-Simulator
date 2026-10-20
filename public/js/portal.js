import { requireParticipant } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { icons } from "./icons.js";
import { ROLE_LABELS, escapeHtml } from "./utils.js";
import { adminPreviewBanner } from "./portal-common.js";

const { user, claims, isAdmin } = await requireParticipant();
const page = mountShell({
  variant: "participant",
  active: "portal",
  title: "Home",
  subtitle: "Quizzes, learning materials and how this training works."
});

const name = user.displayName || user.email?.split("@")[0] || "there";

// Simulated phishing emails arrive unannounced, so the portal never lists them.
const trainingCard = `
<div class="card p-5">
  <h2 class="mb-3 text-base font-semibold text-slate-900">How this training works</h2>
  <ul class="space-y-2 text-sm text-slate-600">
    <li>You may receive simulated phishing emails at any time, without warning. They look like real messages.</li>
    <li>Treat every unexpected email the way you would in real life. If it looks suspicious, report it.</li>
    <li>If you do click one, you'll see a short explanation of the warning signs straight away. Nobody is singled out.</li>
    <li>Results are only ever reported as group totals, never per person.</li>
  </ul>
</div>`;

function shortcut(href, tint, icon, title, text) {
  return `
  <a href="${href}" class="card block p-5 transition hover:border-brand-500 hover:shadow-md">
    <div class="stat-icon ${tint} mb-3">${icon}</div>
    <div class="text-sm font-semibold text-slate-900">${title}</div>
    <div class="mt-1 text-xs text-slate-500">${text}</div>
  </a>`;
}

page.innerHTML = `
  <div class="space-y-6">
    ${isAdmin ? adminPreviewBanner() : ""}
    <div class="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <div class="text-lg font-semibold text-slate-900">Welcome, ${escapeHtml(name)}</div>
        <div class="mt-1 text-sm text-slate-500">Thanks for taking part in phishing awareness training.</div>
      </div>
      <div class="flex items-center gap-2">
        ${claims.role ? `<span class="pill pill-blue">${escapeHtml(ROLE_LABELS[claims.role] || claims.role)}</span>` : ""}
        ${claims.code ? `<span class="pill pill-gray font-mono">${escapeHtml(claims.code)}</span>` : ""}
      </div>
    </div>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">${trainingCard}</div>
      <div class="card p-5">
        <h2 class="mb-3 text-base font-semibold text-slate-900">Spotted something suspicious?</h2>
        <ul class="space-y-2 text-sm text-slate-600">
          <li>Don't click links or open attachments.</li>
          <li>Use the <strong>Report phishing</strong> button instead of replying.</li>
          <li>Check the sender's full address, not just the name.</li>
          <li>If unsure, contact the department directly using details you already trust.</li>
        </ul>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
      ${shortcut("/portal-quizzes.html", "bg-blue-50 text-blue-600", icons.shieldCheck, "Take a quiz", "Practise telling phishing from real email.")}
      ${shortcut("/portal-learn.html", "bg-emerald-50 text-emerald-600", icons.book, "Learning materials", "Red flags, common scams and how to report.")}
      ${shortcut("/portal-stats.html", "bg-purple-50 text-purple-600", icons.reports, "Company stats", "How the organisation is doing overall.")}
    </div>
  </div>`;

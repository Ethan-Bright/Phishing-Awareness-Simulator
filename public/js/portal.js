import { requireParticipant } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchMyLinks } from "./portal-api.js";
import { icons } from "./icons.js";
import { ROLE_LABELS, escapeHtml, fmtDate } from "./utils.js";
import { adminPreviewBanner } from "./portal-common.js";

const { user, claims, isAdmin } = await requireParticipant();
const page = mountShell({
  variant: "participant",
  active: "portal",
  title: "Home",
  subtitle: "Your training activities, quizzes and learning materials."
});

const name = user.displayName || user.email?.split("@")[0] || "there";
const links = isAdmin ? [] : await fetchMyLinks(claims.code);
const open = links.filter((l) => l.status === "running");
const closed = links.filter((l) => l.status !== "running");

function linkRow(l) {
  const isOpen = l.status === "running";
  return `
  <li class="flex items-center justify-between gap-4 border-t border-slate-100 py-3 first:border-t-0">
    <div class="min-w-0">
      <div class="truncate text-sm font-medium text-slate-800">${escapeHtml(l.campaignName || "Training activity")}</div>
      <div class="text-xs text-slate-400">Assigned ${fmtDate(l.createdAt)}</div>
    </div>
    ${isOpen
      ? `<a href="/s.html?t=${encodeURIComponent(l.token)}" target="_blank" rel="noopener" class="btn-primary shrink-0 px-3 py-1.5 text-xs">${icons.link}<span>Open</span></a>`
      : `<span class="pill pill-gray shrink-0">Closed</span>`}
  </li>`;
}

const campaignsCard = `
<div class="card p-5">
  <div class="mb-1 flex items-center justify-between">
    <h2 class="text-base font-semibold text-slate-900">My campaigns</h2>
    <span class="text-xs text-slate-400">${open.length} open</span>
  </div>
  <p class="mb-3 text-xs text-slate-500">Activities your organisation has assigned to you. Each link is personal, so don't share it.</p>
  ${links.length
    ? `<ul>${[...open, ...closed].map(linkRow).join("")}</ul>`
    : `<p class="py-6 text-center text-sm text-slate-400">${isAdmin ? "Admin accounts have no assigned campaigns." : "Nothing assigned to you right now."}</p>`}
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
      <div class="lg:col-span-2">${campaignsCard}</div>
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

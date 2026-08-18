import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchCampaigns, fetchAggregates } from "./api.js";
import { ROLE_LABELS, pct, escapeHtml, engaged } from "./utils.js";

await requireAdmin();
const page = mountShell({
  active: "participants",
  title: "Participants",
  subtitle: "Anonymised participant codes. Aggregate only — no individual profiles by design."
});

const [campaigns, aggregates] = await Promise.all([fetchCampaigns(), fetchAggregates()]);

const roles = ["student", "staff", "lecturer", "sales", "consultant"];
function roleStats(r) {
  const aggs = aggregates.filter((a) => a.role === r);
  const reached = campaigns.filter((c) => c.role === r).reduce((x, c) => x + (c.participantCount || 0), 0);
  return {
    reached,
    total: aggs.reduce((x, a) => x + (a.total || 0), 0),
    clicked: aggs.reduce((x, a) => x + engaged(a), 0),
    reported: aggs.reduce((x, a) => x + (a.reported || 0), 0),
    ignored: aggs.reduce((x, a) => x + (a.ignored || 0), 0)
  };
}

const notice = `
<div class="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
  <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  <div>
    Participants are tracked only by anonymised code, grouped by role. Individual click/report history is
    <strong>not shown</strong> and cannot be queried from this dashboard. The code&#8594;person mapping is stored
    separately from response data, per the ethics application.
  </div>
</div>`;

const cards = roles.map((r) => {
  const s = roleStats(r);
  return `
  <div class="card p-5">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-slate-900">${ROLE_LABELS[r]}</h3>
      <span class="text-2xl font-bold text-slate-900">${s.reached}</span>
    </div>
    <div class="mt-1 text-xs text-slate-400">participants reached</div>
    <div class="mt-4 space-y-2 text-sm">
      <div class="flex justify-between"><span class="text-slate-500">Click rate</span><span class="font-medium text-red-600">${pct(s.clicked, s.total)}</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Report rate</span><span class="font-medium text-emerald-600">${pct(s.reported, s.total)}</span></div>
      <div class="flex justify-between"><span class="text-slate-500">Ignored</span><span class="font-medium text-slate-700">${pct(s.ignored, s.total)}</span></div>
    </div>
  </div>`;
}).join("");

page.innerHTML = `${notice}<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">${cards}</div>`;

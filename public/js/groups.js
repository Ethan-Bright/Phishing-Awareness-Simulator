import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchCampaigns, fetchAggregates } from "./api.js";
import { ROLE_LABELS, pct, escapeHtml, engaged } from "./utils.js";

await requireAdmin();
const page = mountShell({
  active: "groups",
  title: "Groups",
  subtitle: "Role-based delivery groups. Scenarios are targeted by these roles."
});

const [campaigns, aggregates] = await Promise.all([fetchCampaigns(), fetchAggregates()]);
const roles = ["student", "staff", "lecturer", "sales", "consultant"];

const cards = roles.map((r) => {
  const camps = campaigns.filter((c) => c.role === r);
  const aggs = aggregates.filter((a) => a.role === r);
  const total = aggs.reduce((x, a) => x + (a.total || 0), 0);
  const clicked = aggs.reduce((x, a) => x + engaged(a), 0);
  const reported = aggs.reduce((x, a) => x + (a.reported || 0), 0);
  return `
  <div class="card p-5">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="font-semibold text-slate-900">${ROLE_LABELS[r]}</h3>
      <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${camps.length} campaign${camps.length === 1 ? "" : "s"}</span>
    </div>
    <div class="grid grid-cols-3 gap-3 text-center">
      <div class="rounded-lg bg-slate-50 p-3"><div class="text-lg font-bold text-slate-900">${total}</div><div class="text-xs text-slate-500">responses</div></div>
      <div class="rounded-lg bg-slate-50 p-3"><div class="text-lg font-bold text-red-600">${pct(clicked, total)}</div><div class="text-xs text-slate-500">click</div></div>
      <div class="rounded-lg bg-slate-50 p-3"><div class="text-lg font-bold text-emerald-600">${pct(reported, total)}</div><div class="text-xs text-slate-500">report</div></div>
    </div>
    <div class="mt-4">
      <div class="mb-1 text-xs font-medium uppercase text-slate-400">Campaigns</div>
      <ul class="space-y-1 text-sm text-slate-600">
        ${camps.slice(0, 5).map((c) => `<li class="truncate">• ${escapeHtml(c.name)}</li>`).join("") || `<li class="text-slate-400">None yet</li>`}
      </ul>
    </div>
  </div>`;
}).join("");

page.innerHTML = `<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">${cards}</div>`;

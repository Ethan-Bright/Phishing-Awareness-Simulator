import { requireParticipant } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchCompletedAggregates, fetchDailyStats, MIN_COHORT } from "./portal-api.js";
import { icons } from "./icons.js";
import { ROLE_LABELS, pct, engaged, fmtDate } from "./utils.js";
import { adminPreviewBanner } from "./portal-common.js";

const { isAdmin } = await requireParticipant();
const page = mountShell({
  variant: "participant",
  active: "portal-stats",
  title: "Company stats",
  subtitle: "Organisation-wide results from completed campaigns. Aggregate only."
});

const [aggregates, daily] = await Promise.all([fetchCompletedAggregates(), fetchDailyStats()]);

const sum = (k) => aggregates.reduce((a, d) => a + (d[k] || 0), 0);
const total = sum("total");
const clicked = aggregates.reduce((a, d) => a + engaged(d), 0);
const reported = sum("reported");
const ignored = sum("ignored");

function statCard(icon, tint, label, value, sub) {
  return `
  <div class="card p-5">
    <div class="flex items-start justify-between">
      <div>
        <div class="text-sm text-slate-500">${label}</div>
        <div class="mt-1 text-3xl font-bold text-slate-900">${value}</div>
        <div class="mt-1 text-xs text-slate-400">${sub}</div>
      </div>
      <div class="stat-icon ${tint}">${icon}</div>
    </div>
  </div>`;
}

const roleRows = Object.keys(ROLE_LABELS).map((r) => {
  const rows = aggregates.filter((a) => a.role === r);
  const t = rows.reduce((x, a) => x + (a.total || 0), 0);
  if (t < MIN_COHORT) return "";
  const cl = rows.reduce((x, a) => x + engaged(a), 0);
  const rp = rows.reduce((x, a) => x + (a.reported || 0), 0);
  return `
  <div>
    <div class="mb-1 flex items-center justify-between text-sm">
      <span class="font-medium text-slate-700">${ROLE_LABELS[r]}</span>
      <span class="text-slate-500">report ${pct(rp, t)} · click ${pct(cl, t)}</span>
    </div>
    <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div class="h-full bg-emerald-500" style="width:${(rp / t) * 100}%"></div>
      <div class="h-full bg-red-400" style="width:${(cl / t) * 100}%"></div>
    </div>
  </div>`;
}).join("");

page.innerHTML = `
  <div class="space-y-6">
    ${isAdmin ? adminPreviewBanner() : ""}
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      ${statCard(icons.campaigns, "bg-blue-50 text-blue-600", "Campaigns completed", aggregates.length, "Across the organisation")}
      ${statCard(icons.shieldCheck, "bg-emerald-50 text-emerald-600", "Report rate", pct(reported, total), "Higher is better")}
      ${statCard(icons.cursorClick, "bg-red-50 text-red-600", "Click rate", pct(clicked, total), "Lower is better")}
      ${statCard(icons.participants, "bg-amber-50 text-amber-600", "Ignored", pct(ignored, total), "Didn't act either way")}
    </div>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="card p-5">
        <h2 class="mb-1 text-base font-semibold text-slate-900">By role</h2>
        <p class="mb-4 text-xs text-slate-400">Green is reported, red is clicked. Groups under ${MIN_COHORT} people are hidden.</p>
        <div class="space-y-4">${roleRows || `<p class="text-sm text-slate-400">No data yet.</p>`}</div>
      </div>
      <div class="card p-5">
        <h2 class="mb-4 text-base font-semibold text-slate-900">Click rate over time</h2>
        ${daily.length ? `<canvas id="clickChart" height="140"></canvas>` : `<p class="text-sm text-slate-400">No data yet.</p>`}
      </div>
    </div>
    <p class="text-center text-xs text-slate-400">These numbers never identify individuals. Your own results are not shown to anyone.</p>
  </div>`;

const Chart = window.Chart;
if (Chart && daily.length) {
  new Chart(document.getElementById("clickChart"), {
    type: "line",
    data: {
      labels: daily.map((d) => fmtDate(d.date)),
      datasets: [{
        data: daily.map((d) => (d.sent ? Math.round((d.clicks / d.sent) * 1000) / 10 : 0)),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#2563eb"
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => v + "%" }, grid: { color: "#f1f5f9" }, beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
}

import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchCampaigns, fetchAggregates, fetchDailyStats } from "./api.js";
import { icons } from "./icons.js";
import { ROLE_LABELS, STATUS_PILL, pct, escapeHtml, fmtDate, engaged } from "./utils.js";

await requireAdmin();
const page = mountShell({
  active: "dashboard",
  title: "Dashboard",
  subtitle: "Overview of phishing simulations and awareness (aggregate only)"
});

const [campaigns, aggregates, daily] = await Promise.all([
  fetchCampaigns(),
  fetchAggregates(),
  fetchDailyStats()
]);

const sum = (k) => aggregates.reduce((a, d) => a + (d[k] || 0), 0);
const totalAssigned = sum("total");
const totalClickedOnly = sum("clicked");
const totalSubmitted = sum("submitted");
const totalClicked = totalClickedOnly + totalSubmitted; // engaged with the link
const totalReported = sum("reported");
const totalIgnored = sum("ignored");
const totalOpened = sum("opened");
const participantsReached = campaigns.reduce((a, c) => a + (c.participantCount || 0), 0);

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

const cards = `
<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
  ${statCard(icons.campaigns, "bg-blue-50 text-blue-600", "Campaigns", campaigns.length, "Total campaigns")}
  ${statCard(icons.participants, "bg-emerald-50 text-emerald-600", "Participants reached", participantsReached, "Across all campaigns")}
  ${statCard(icons.cursorClick, "bg-purple-50 text-purple-600", "Click rate", pct(totalClicked, totalAssigned), "Average")}
  ${statCard(icons.shieldCheck, "bg-amber-50 text-amber-600", "Report rate", pct(totalReported, totalAssigned), "Average")}
</div>`;

// Recent campaigns table
const recentRows = campaigns.slice(0, 6).map((c) => {
  const agg = aggregates.find((a) => a.campaignId === c.id) || {};
  const total = agg.total || 0;
  return `
  <tr class="border-t border-slate-100">
    <td class="py-3 pr-4 font-medium text-slate-800">${escapeHtml(c.name)}</td>
    <td class="py-3 pr-4"><span class="pill ${STATUS_PILL[c.status] || "pill-gray"}">${c.status}</span></td>
    <td class="py-3 pr-4 text-slate-600">${total}</td>
    <td class="py-3 pr-4 text-slate-600">${engaged(agg)}</td>
    <td class="py-3 pr-4 text-slate-600">${agg.reported || 0}</td>
    <td class="py-3 pr-4 text-slate-600">${pct(engaged(agg), total)}</td>
    <td class="py-3 text-slate-600">${pct(agg.reported || 0, total)}</td>
  </tr>`;
}).join("");

const recentCampaigns = `
<div class="card p-5">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-base font-semibold text-slate-900">Recent Campaigns</h2>
    <a href="/campaigns.html" class="text-sm font-medium text-brand-600 hover:text-brand-700">View all</a>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wide text-slate-400">
          <th class="pb-2 pr-4 font-medium">Campaign</th>
          <th class="pb-2 pr-4 font-medium">Status</th>
          <th class="pb-2 pr-4 font-medium">Sent</th>
          <th class="pb-2 pr-4 font-medium">Clicked</th>
          <th class="pb-2 pr-4 font-medium">Reported</th>
          <th class="pb-2 pr-4 font-medium">Click rate</th>
          <th class="pb-2 font-medium">Report rate</th>
        </tr>
      </thead>
      <tbody>${recentRows || `<tr><td colspan="7" class="py-6 text-center text-slate-400">No campaigns yet.</td></tr>`}</tbody>
    </table>
  </div>
</div>`;

const clickChartCard = `
<div class="card p-5">
  <h2 class="mb-4 text-base font-semibold text-slate-900">Click Rate Over Time</h2>
  <canvas id="clickChart" height="120"></canvas>
</div>`;

const outcomeCard = `
<div class="card p-5">
  <h2 class="mb-4 text-base font-semibold text-slate-900">Outcome Distribution</h2>
  <div class="flex items-center gap-6">
    <div class="relative h-44 w-44 shrink-0">
      <canvas id="outcomeChart"></canvas>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div class="text-2xl font-bold text-slate-900">${totalAssigned}</div>
        <div class="text-xs text-slate-400">responses</div>
      </div>
    </div>
    <div class="flex-1 space-y-3 text-sm">
      ${legendRow("bg-red-400", "Clicked link", totalClickedOnly, totalAssigned)}
      ${legendRow("bg-red-700", "Submitted credentials", totalSubmitted, totalAssigned)}
      ${legendRow("bg-emerald-500", "Reported", totalReported, totalAssigned)}
      ${legendRow("bg-amber-400", "Ignored", totalIgnored, totalAssigned)}
      ${legendRow("bg-slate-300", "Opened, no action yet", totalOpened, totalAssigned)}
    </div>
  </div>
</div>`;

function legendRow(dot, label, n, total) {
  return `
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2"><span class="h-3 w-3 rounded-sm ${dot}"></span><span class="text-slate-600">${label}</span></div>
    <div class="font-medium text-slate-800">${pct(n, total)} <span class="text-slate-400">(${n})</span></div>
  </div>`;
}

// Aggregate trends by role
const roleKeys = ["student", "staff", "lecturer", "sales", "consultant"];
const roleRows = roleKeys.map((r) => {
  const rows = aggregates.filter((a) => a.role === r);
  const t = rows.reduce((x, a) => x + (a.total || 0), 0);
  const cl = rows.reduce((x, a) => x + engaged(a), 0);
  const rp = rows.reduce((x, a) => x + (a.reported || 0), 0);
  if (!t) return "";
  return `
  <div>
    <div class="mb-1 flex items-center justify-between text-sm">
      <span class="font-medium text-slate-700">${ROLE_LABELS[r]}</span>
      <span class="text-slate-500">click ${pct(cl, t)} · report ${pct(rp, t)}</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div class="h-full bg-brand-500" style="width:${t ? (cl / t) * 100 : 0}%"></div>
    </div>
  </div>`;
}).join("");

const roleCard = `
<div class="card p-5">
  <h2 class="mb-4 text-base font-semibold text-slate-900">Trends by Role</h2>
  <div class="space-y-4">${roleRows || `<p class="text-sm text-slate-400">No data yet.</p>`}</div>
</div>`;

// System overview cards from daily stats (this month)
const now = new Date();
const monthly = daily.filter((d) => {
  const dt = new Date(d.date);
  return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
});
const mSent = monthly.reduce((a, d) => a + (d.sent || 0), 0);
const mClicks = monthly.reduce((a, d) => a + (d.clicks || 0), 0);
const mReports = monthly.reduce((a, d) => a + (d.reports || 0), 0);
const debriefRate = pct(totalClicked + totalReported, totalAssigned);

const systemOverview = `
<div class="card p-5">
  <h2 class="mb-4 text-base font-semibold text-slate-900">System Overview</h2>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    ${miniCard("bg-blue-50 text-blue-600", icons.mail, "Links sent (this month)", mSent)}
    ${miniCard("bg-emerald-50 text-emerald-600", icons.cursorClick, "Total clicks (this month)", mClicks)}
    ${miniCard("bg-purple-50 text-purple-600", icons.flag, "Total reports (this month)", mReports)}
    ${miniCard("bg-amber-50 text-amber-600", icons.shieldCheck, "Debrief completion", debriefRate)}
  </div>
</div>`;

function miniCard(tint, icon, label, value) {
  return `
  <div class="rounded-xl bg-slate-50 p-4">
    <div class="stat-icon ${tint} mb-3">${icon}</div>
    <div class="text-2xl font-bold text-slate-900">${value}</div>
    <div class="text-xs text-slate-500">${label}</div>
  </div>`;
}

page.innerHTML = `
  <div class="space-y-6">
    ${cards}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      ${recentCampaigns}
      ${clickChartCard}
    </div>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      ${outcomeCard}
      ${roleCard}
    </div>
    ${systemOverview}
  </div>`;

// ---- Charts ----
const Chart = window.Chart;
if (Chart) {
  const ctx = document.getElementById("clickChart");
  new Chart(ctx, {
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

  new Chart(document.getElementById("outcomeChart"), {
    type: "doughnut",
    data: {
      labels: ["Clicked link", "Submitted credentials", "Reported", "Ignored", "Opened, no action yet"],
      datasets: [{
        data: [totalClickedOnly, totalSubmitted, totalReported, totalIgnored, totalOpened],
        backgroundColor: ["#f87171", "#b91c1c", "#10b981", "#fbbf24", "#cbd5e1"],
        borderWidth: 0
      }]
    },
    options: { cutout: "72%", plugins: { legend: { display: false } } }
  });
}

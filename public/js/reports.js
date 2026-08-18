import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { fetchAggregates } from "./api.js";
import { ROLE_LABELS, CATEGORY_LABELS, pct, escapeHtml, toast, engaged } from "./utils.js";

await requireAdmin();
const page = mountShell({
  active: "reports",
  title: "Reports",
  subtitle: "Aggregate trends by role, scenario, category and round. No individual data."
});

const aggregates = await fetchAggregates();
let fRole = "all";
let fCategory = "all";
let fRound = "all";

function filtered() {
  return aggregates.filter((a) =>
    (fRole === "all" || a.role === fRole) &&
    (fCategory === "all" || a.category === fCategory) &&
    (fRound === "all" || String(a.round) === fRound));
}

function groupBy(rows, key, labels) {
  const map = {};
  rows.forEach((r) => {
    const k = r[key] ?? "unknown";
    map[k] = map[k] || { total: 0, clicked: 0, reported: 0, ignored: 0 };
    map[k].total += r.total || 0;
    map[k].clicked += engaged(r);
    map[k].reported += r.reported || 0;
    map[k].ignored += r.ignored || 0;
  });
  return Object.entries(map).map(([k, v]) => ({ key: k, label: (labels && labels[k]) || k, ...v }));
}

let roleChart, catChart;

function render() {
  const rows = filtered();
  const rounds = [...new Set(aggregates.map((a) => a.round).filter(Boolean))].sort();

  const sel = (id, val, options) => `
    <select id="${id}" class="input w-auto">
      <option value="all">All</option>
      ${options.map((o) => `<option value="${o.v}" ${String(val) === String(o.v) ? "selected" : ""}>${o.l}</option>`).join("")}
    </select>`;

  page.innerHTML = `
    <div class="mb-5 flex flex-wrap items-end gap-4">
      <div><label class="label">Role</label>${sel("fx-role", fRole, Object.entries(ROLE_LABELS).map(([v, l]) => ({ v, l })))}</div>
      <div><label class="label">Category</label>${sel("fx-cat", fCategory, Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ v, l })))}</div>
      <div><label class="label">Round</label>${sel("fx-round", fRound, rounds.map((r) => ({ v: r, l: "Round " + r })))}</div>
      <button id="csv" class="btn-secondary ml-auto">Export CSV (aggregate)</button>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="card p-5"><h2 class="mb-4 text-base font-semibold text-slate-900">By role</h2><canvas id="roleChart" height="140"></canvas></div>
      <div class="card p-5"><h2 class="mb-4 text-base font-semibold text-slate-900">By scenario category</h2><canvas id="catChart" height="140"></canvas></div>
    </div>

    <div class="card mt-6 p-5">
      <h2 class="mb-4 text-base font-semibold text-slate-900">Detail (aggregate rows)</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs uppercase text-slate-400">
            <th class="pb-2 pr-4">Campaign</th><th class="pb-2 pr-4">Role</th><th class="pb-2 pr-4">Category</th>
            <th class="pb-2 pr-4">Round</th><th class="pb-2 pr-4">Total</th><th class="pb-2 pr-4">Clicked</th>
            <th class="pb-2 pr-4">Submitted</th><th class="pb-2 pr-4">Reported</th><th class="pb-2 pr-4">Ignored</th><th class="pb-2 pr-4">Click%</th><th class="pb-2">Report%</th>
          </tr></thead>
          <tbody>${rows.map((r) => `
            <tr class="border-t border-slate-100">
              <td class="py-2 pr-4 text-slate-700">${escapeHtml(r.campaignName || "")}</td>
              <td class="py-2 pr-4">${ROLE_LABELS[r.role] || r.role}</td>
              <td class="py-2 pr-4">${CATEGORY_LABELS[r.category] || r.category}</td>
              <td class="py-2 pr-4">${r.round ?? "-"}</td>
              <td class="py-2 pr-4">${r.total || 0}</td>
              <td class="py-2 pr-4">${engaged(r)}</td>
              <td class="py-2 pr-4">${r.submitted || 0}</td>
              <td class="py-2 pr-4">${r.reported || 0}</td>
              <td class="py-2 pr-4">${r.ignored || 0}</td>
              <td class="py-2 pr-4">${pct(engaged(r), r.total || 0)}</td>
              <td class="py-2">${pct(r.reported || 0, r.total || 0)}</td>
            </tr>`).join("") || `<tr><td colspan="11" class="py-6 text-center text-slate-400">No data for these filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("fx-role").addEventListener("change", (e) => { fRole = e.target.value; render(); });
  document.getElementById("fx-cat").addEventListener("change", (e) => { fCategory = e.target.value; render(); });
  document.getElementById("fx-round").addEventListener("change", (e) => { fRound = e.target.value; render(); });
  document.getElementById("csv").addEventListener("click", () => exportCsv(rows));

  drawCharts(rows);
}

function drawCharts(rows) {
  const Chart = window.Chart;
  if (!Chart) return;
  if (roleChart) roleChart.destroy();
  if (catChart) catChart.destroy();

  const byRole = groupBy(rows, "role", ROLE_LABELS);
  roleChart = new Chart(document.getElementById("roleChart"), {
    type: "bar",
    data: {
      labels: byRole.map((r) => r.label),
      datasets: [
        { label: "Click %", data: byRole.map((r) => r.total ? +(r.clicked / r.total * 100).toFixed(1) : 0), backgroundColor: "#ef4444" },
        { label: "Report %", data: byRole.map((r) => r.total ? +(r.reported / r.total * 100).toFixed(1) : 0), backgroundColor: "#10b981" }
      ]
    },
    options: { scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + "%" } } } }
  });

  const byCat = groupBy(rows, "category", CATEGORY_LABELS);
  catChart = new Chart(document.getElementById("catChart"), {
    type: "bar",
    data: {
      labels: byCat.map((r) => r.label),
      datasets: [
        { label: "Click %", data: byCat.map((r) => r.total ? +(r.clicked / r.total * 100).toFixed(1) : 0), backgroundColor: "#f59e0b" },
        { label: "Report %", data: byCat.map((r) => r.total ? +(r.reported / r.total * 100).toFixed(1) : 0), backgroundColor: "#2563eb" }
      ]
    },
    options: { indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { callback: (v) => v + "%" } } } }
  });
}

function exportCsv(rows) {
  const header = ["campaign", "role", "category", "round", "total", "opened", "clicked", "reported", "ignored", "click_rate", "report_rate"];
  const lines = rows.map((r) => [
    `"${(r.campaignName || "").replace(/"/g, '""')}"`,
    r.role, r.category, r.round ?? "",
    r.total || 0, r.opened || 0, r.clicked || 0, r.reported || 0, r.ignored || 0,
    pct(r.clicked || 0, r.total || 0), pct(r.reported || 0, r.total || 0)
  ].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `phishsim-aggregate-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast("CSV exported (aggregate only)", "success");
}

render();

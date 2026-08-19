import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import {
  fetchCampaigns,
  fetchScenarios,
  fetchAggregates,
  callCreateCampaign,
  callLaunchCampaign,
  callCompleteCampaign,
  callGetCampaignLinks
} from "./api.js";
import { icons } from "./icons.js";
import {
  ROLE_LABELS,
  CATEGORY_LABELS,
  STATUS_PILL,
  pct,
  escapeHtml,
  fmtDate,
  toast,
  openModal,
  engaged
} from "./utils.js";

await requireAdmin();
const page = mountShell({
  active: "campaigns",
  title: "Campaigns",
  subtitle: "Deliver role-based scenarios to anonymised participant codes."
});

let campaigns = [];
let scenarios = [];
let aggregates = [];

function row(c) {
  const agg = aggregates.find((a) => a.campaignId === c.id) || {};
  const total = agg.total || c.participantCount || 0;
  return `
  <tr class="border-t border-slate-100">
    <td class="py-3 pr-4">
      <div class="font-medium text-slate-800">${escapeHtml(c.name)}</div>
      <div class="text-xs text-slate-400">${escapeHtml(c.scenarioTitle || "")}</div>
    </td>
    <td class="py-3 pr-4"><span class="rounded bg-slate-100 px-2 py-0.5 text-xs">${ROLE_LABELS[c.role] || c.role}</span></td>
    <td class="py-3 pr-4"><span class="pill ${STATUS_PILL[c.status] || "pill-gray"}">${c.status}</span></td>
    <td class="py-3 pr-4 text-slate-600">${total}</td>
    <td class="py-3 pr-4 text-slate-600">${pct(engaged(agg), total)}</td>
    <td class="py-3 pr-4 text-slate-600">${pct(agg.reported || 0, total)}</td>
    <td class="py-3 text-right">
      <div class="flex justify-end gap-2">
        ${c.status === "draft" ? `<button class="btn-primary px-3 py-1.5 text-xs" data-launch="${c.id}">Launch</button>` : ""}
        ${c.status === "running" ? `<button class="btn-secondary px-3 py-1.5 text-xs" data-complete="${c.id}">Complete</button>` : ""}
        <button class="btn-secondary px-3 py-1.5 text-xs" data-links="${c.id}">Links</button>
      </div>
    </td>
  </tr>`;
}

function render() {
  page.innerHTML = `
    <div class="mb-5 flex items-center justify-end">
      <button id="new-btn" class="btn-primary">${icons.plus}<span>New campaign</span></button>
    </div>
    <div class="card p-5">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-slate-400">
              <th class="pb-2 pr-4 font-medium">Campaign</th>
              <th class="pb-2 pr-4 font-medium">Role</th>
              <th class="pb-2 pr-4 font-medium">Status</th>
              <th class="pb-2 pr-4 font-medium">Participants</th>
              <th class="pb-2 pr-4 font-medium">Click rate</th>
              <th class="pb-2 pr-4 font-medium">Report rate</th>
              <th class="pb-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>${campaigns.map(row).join("") || `<tr><td colspan="7" class="py-8 text-center text-slate-400">No campaigns yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("new-btn").addEventListener("click", newModal);
  page.querySelectorAll("[data-launch]").forEach((b) => b.addEventListener("click", () => launch(b.dataset.launch)));
  page.querySelectorAll("[data-complete]").forEach((b) => b.addEventListener("click", () => complete(b.dataset.complete)));
  page.querySelectorAll("[data-links]").forEach((b) => b.addEventListener("click", () => showLinks(b.dataset.links)));
}

function newModal() {
  // Campaigns measure phishing outcomes (clicked/submitted/reported), so
  // legitimate training scenarios are excluded. Those are used in the quiz.
  const live = scenarios.filter((s) => s.status === "live" && s.isPhishing !== false);
  if (!live.length) {
    return openModal("New campaign", `<p class="text-sm text-slate-600">You need at least one <strong>live</strong> phishing scenario first. Create and approve one on the Scenarios page.</p>`);
  }
  const opts = live.map((s) =>
    `<option value="${s.id}">${escapeHtml(s.title)} — ${ROLE_LABELS[s.role]} / ${CATEGORY_LABELS[s.category]}</option>`).join("");

  const m = openModal("New campaign", `
    <div class="space-y-4">
      <div><label class="label">Campaign name</label><input id="c-name" class="input" placeholder="e.g. Registration round 1 — Students" /></div>
      <div><label class="label">Scenario (live only)</label><select id="c-scn" class="input">${opts}</select></div>
      <div><label class="label">Round number</label><input id="c-round" type="number" min="1" value="1" class="input" /></div>
      <div>
        <label class="label">Participant codes</label>
        <textarea id="c-codes" class="input h-28" placeholder="One anonymised code per line, e.g. STU-0001"></textarea>
        <p class="mt-1 text-xs text-slate-400">Or leave blank and set a count below to auto-generate codes.</p>
      </div>
      <div><label class="label">Auto-generate count (if no codes above)</label><input id="c-count" type="number" min="0" value="0" class="input" /></div>
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button data-close class="btn-secondary">Cancel</button>
      <button id="save" class="btn-primary">Create campaign</button>
    </div>`);
  m.body.querySelector("[data-close]").addEventListener("click", m.close);
  m.body.querySelector("#save").addEventListener("click", async () => {
    const name = document.getElementById("c-name").value.trim();
    const scenarioId = document.getElementById("c-scn").value;
    const round = parseInt(document.getElementById("c-round").value, 10) || 1;
    const codes = document.getElementById("c-codes").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const count = parseInt(document.getElementById("c-count").value, 10) || 0;
    if (!name) return toast("Name is required", "error");
    if (!codes.length && !count) return toast("Add participant codes or a count", "error");
    try {
      await callCreateCampaign({ name, scenarioId, round, participantCodes: codes, autoCount: count });
      toast("Campaign created as draft", "success");
      m.close();
      await reload();
    } catch (e) { toast(e.message || "Failed", "error"); }
  });
}

async function launch(id) {
  if (!confirm("Launch this campaign? Links become active for distribution.")) return;
  try { await callLaunchCampaign({ campaignId: id }); toast("Campaign launched", "success"); await reload(); }
  catch (e) { toast(e.message || "Failed", "error"); }
}

async function complete(id) {
  if (!confirm("Complete this campaign? Remaining non-responders are logged as 'ignored'.")) return;
  try { await callCompleteCampaign({ campaignId: id }); toast("Campaign completed", "success"); await reload(); }
  catch (e) { toast(e.message || "Failed", "error"); }
}

async function showLinks(id) {
  const m = openModal("Distribution links", `<p class="text-sm text-slate-500">Loading...</p>`, { wide: true });
  try {
    const res = await callGetCampaignLinks({ campaignId: id });
    const items = res.data.links || [];
    const origin = location.origin;
    const rows = items.map((l) => {
      const url = `${origin}/s.html?t=${l.token}`;
      return `
      <tr class="border-t border-slate-100">
        <td class="py-2 pr-4 font-mono text-xs text-slate-700">${escapeHtml(l.code)}</td>
        <td class="py-2 pr-4"><span class="pill ${STATUS_PILL[l.outcome] || "pill-gray"}">${l.outcome}</span></td>
        <td class="py-2"><div class="flex items-center gap-2">
          <input readonly value="${url}" class="input py-1 text-xs" />
          <button class="btn-secondary px-2 py-1 text-xs" data-copy="${escapeHtml(url)}">Copy</button>
        </div></td>
      </tr>`;
    }).join("");
    m.body.innerHTML = `
      <p class="mb-3 text-sm text-slate-500">Distribute one link per participant code through your own approved channel.
      The code&#8594;person mapping is kept separate from this system.</p>
      <div class="max-h-[55vh] overflow-y-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs uppercase text-slate-400"><th class="pb-2 pr-4">Code</th><th class="pb-2 pr-4">Outcome</th><th class="pb-2">Link</th></tr></thead>
          <tbody>${rows || `<tr><td class="py-4 text-slate-400" colspan="3">No links. Launch the campaign first.</td></tr>`}</tbody>
        </table>
      </div>`;
    m.body.querySelectorAll("[data-copy]").forEach((b) =>
      b.addEventListener("click", () => { navigator.clipboard.writeText(b.dataset.copy); toast("Link copied", "success"); }));
  } catch (e) {
    m.body.innerHTML = `<p class="text-sm text-red-600">${escapeHtml(e.message || "Failed to load links")}</p>`;
  }
}

async function reload() {
  [campaigns, scenarios, aggregates] = await Promise.all([fetchCampaigns(), fetchScenarios(), fetchAggregates()]);
  render();
}

await reload();

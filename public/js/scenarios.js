import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import {
  fetchScenarios,
  callCreateScenario,
  callGenerateAiDraft,
  callApproveScenario,
  callDenyScenario,
  callRetireScenario
} from "./api.js";
import { icons } from "./icons.js";
import {
  ROLE_LABELS,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  STATUS_PILL,
  escapeHtml,
  fmtDate,
  toast,
  openModal
} from "./utils.js";

await requireAdmin();
const QUIZ_MODE = location.pathname.endsWith("/quiz-library.html");
const page = mountShell({
  active: QUIZ_MODE ? "quiz-library" : "scenarios",
  title: QUIZ_MODE ? "Quiz library" : "Scenarios",
  subtitle: QUIZ_MODE
    ? "Phish-or-legit emails for the training quiz. Every draft needs human review before learners can see it."
    : "Role-based campaign scenarios. AI drafts require human review before going live."
});

let scenarios = [];
let filter = "all";

function roleOptions(selected) {
  return Object.entries(ROLE_LABELS)
    .map(([k, v]) => `<option value="${k}" ${k === selected ? "selected" : ""}>${v}</option>`)
    .join("");
}
function categoryOptions(selected) {
  return Object.entries(CATEGORY_LABELS)
    .map(([k, v]) => `<option value="${k}" ${k === selected ? "selected" : ""}>${v}</option>`)
    .join("");
}

function needsReviewStatus(status) {
  return status === "pending_review" || status === "draft";
}

function isLegit(s) {
  return s.isPhishing === false;
}

function isQuizItem(s) {
  return s.useInQuiz === true;
}

function typePill(s) {
  return isLegit(s)
    ? `<span class="pill pill-green">Legit</span>`
    : `<span class="pill pill-red">Phishing</span>`;
}

function card(s) {
  const c = s.content || {};
  const needsReview = needsReviewStatus(s.status);
  const indicators = (c.indicators || []).slice(0, 3)
    .map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const diff = s.difficulty || "medium";
  return `
  <div class="card flex flex-col p-5">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="pill ${STATUS_PILL[s.status] || "pill-gray"}">${s.status.replace("_", " ")}</span>
          ${typePill(s)}
          ${isQuizItem(s) ? `<span class="pill pill-blue">Quiz</span>` : ""}
          <span class="pill pill-gray">${DIFFICULTY_LABELS[diff] || diff}</span>
          ${s.aiGenerated ? `<span class="pill pill-purple">AI draft</span>` : ""}
        </div>
        <h3 class="mt-2 font-semibold text-slate-900">${escapeHtml(s.title)}</h3>
      </div>
    </div>
    <div class="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
      <span class="rounded bg-slate-100 px-2 py-0.5">${ROLE_LABELS[s.role] || s.role}</span>
      <span class="rounded bg-slate-100 px-2 py-0.5">${CATEGORY_LABELS[s.category] || s.category}</span>
      <span class="rounded bg-slate-100 px-2 py-0.5">${(c.landingType || "link") === "fake_login" ? "Fake login" : "Link click"}</span>
    </div>
    <p class="mb-3 line-clamp-2 text-sm text-slate-600"><span class="font-medium">Subject:</span> ${escapeHtml(c.subject || "")}</p>
    ${indicators ? `<ul class="mb-4 list-inside list-disc space-y-0.5 text-xs text-slate-500">${indicators}</ul>` : ""}
    <div class="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
      <span class="text-xs text-slate-400">${fmtDate(s.createdAt)}</span>
      <div class="flex flex-wrap justify-end gap-2">
        <button class="btn-secondary px-3 py-1.5 text-xs" data-view="${s.id}">View</button>
        ${needsReview
          ? `<button class="btn-danger px-3 py-1.5 text-xs" data-deny="${s.id}">Deny</button>
             <button class="btn-primary px-3 py-1.5 text-xs" data-approve="${s.id}">Approve &amp; go live</button>` : ""}
        ${s.status === "live"
          ? `<button class="btn-secondary px-3 py-1.5 text-xs" data-retire="${s.id}">Retire</button>` : ""}
      </div>
    </div>
  </div>`;
}

function render() {
  const pool = QUIZ_MODE ? scenarios.filter(isQuizItem) : scenarios;
  const counts = {
    all: pool.length,
    pending_review: pool.filter((s) => needsReviewStatus(s.status)).length,
    live: pool.filter((s) => s.status === "live").length,
    denied: pool.filter((s) => s.status === "denied").length,
    retired: pool.filter((s) => s.status === "retired").length
  };
  const tab = (key, label) => `
    <button data-filter="${key}" class="rounded-lg px-3 py-1.5 text-sm font-medium ${
      filter === key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }">${label} <span class="ml-1 opacity-70">${counts[key] ?? ""}</span></button>`;

  const list = pool.filter((s) => {
    if (filter === "all") return true;
    if (filter === "pending_review") return needsReviewStatus(s.status);
    return s.status === filter;
  });

  const liveQuiz = scenarios.filter((s) => s.status === "live" && isQuizItem(s));
  const livePhish = liveQuiz.filter((s) => s.isPhishing !== false).length;
  const liveLegit = liveQuiz.filter((s) => s.isPhishing === false).length;

  page.innerHTML = `
    ${QUIZ_MODE ? `
    <div class="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      Learners only see emails that are <strong>live</strong> and marked for the quiz.
      Right now that is <strong>${livePhish}</strong> phishing and <strong>${liveLegit}</strong> legit
      (need 5 phishing and 4 legit). Drafts stay hidden until you approve them.
      <a href="/quiz.html" class="ml-2 font-medium text-brand-600 hover:underline">Preview the quiz</a>
    </div>` : ""}
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1 rounded-xl bg-white p-1 shadow-card">
        ${tab("all", "All")}
        ${tab("pending_review", "Needs review")}
        ${tab("live", "Live")}
        ${tab("denied", "Denied")}
        ${tab("retired", "Retired")}
      </div>
      <div class="flex gap-2">
        <button id="ai-btn" class="btn-secondary">${icons.sparkles}<span>AI draft</span></button>
        <button id="new-btn" class="btn-primary">${icons.plus}<span>${QUIZ_MODE ? "New quiz email" : "New scenario"}</span></button>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      ${list.map(card).join("") || `<div class="col-span-full card p-10 text-center text-slate-400">${QUIZ_MODE ? "No quiz emails here yet. Generate a draft or add one, then approve it." : "No scenarios here yet."}</div>`}
    </div>`;

  page.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => { filter = b.dataset.filter; render(); }));
  page.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => viewScenario(b.dataset.view)));
  page.querySelectorAll("[data-approve]").forEach((b) =>
    b.addEventListener("click", () => approve(b.dataset.approve)));
  page.querySelectorAll("[data-deny]").forEach((b) =>
    b.addEventListener("click", () => deny(b.dataset.deny)));
  page.querySelectorAll("[data-retire]").forEach((b) =>
    b.addEventListener("click", () => retire(b.dataset.retire)));
  document.getElementById("ai-btn").addEventListener("click", aiModal);
  document.getElementById("new-btn").addEventListener("click", newModal);
}

function viewScenario(id) {
  const s = scenarios.find((x) => x.id === id);
  const c = s.content || {};
  const body = `
    <div class="space-y-4 text-sm">
      <div class="flex flex-wrap gap-2">
        <span class="pill ${STATUS_PILL[s.status]}">${s.status.replace("_", " ")}</span>
        ${typePill(s)}
        <span class="pill pill-gray">${ROLE_LABELS[s.role]}</span>
        <span class="pill pill-gray">${CATEGORY_LABELS[s.category]}</span>
        ${s.aiGenerated ? `<span class="pill pill-purple">AI generated</span>` : ""}
        ${isQuizItem(s) ? `<span class="pill pill-blue">Quiz</span>` : ""}
        <span class="pill pill-gray">${DIFFICULTY_LABELS[s.difficulty] || s.difficulty || "Medium"}</span>
      </div>
      <div class="rounded-lg border border-slate-200">
        <div class="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          From: ${escapeHtml(c.senderName || "")} &lt;${escapeHtml(c.senderEmail || "")}&gt;
        </div>
        <div class="px-4 py-2 text-sm font-medium text-slate-800">${escapeHtml(c.subject || "")}</div>
        <div class="whitespace-pre-wrap px-4 py-3 text-sm text-slate-700">${escapeHtml(c.body || "")}</div>
        <div class="px-4 pb-4"><span class="btn-primary pointer-events-none">${escapeHtml(c.ctaText || "Open")}</span></div>
      </div>
      <div>
        <div class="mb-1 font-semibold text-slate-800">${isLegit(s) ? "Legitimacy cues" : "Phishing indicators present"}</div>
        <ul class="list-inside list-disc space-y-1 text-slate-600">
          ${(c.indicators || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>None listed</li>"}
        </ul>
      </div>
      <div>
        <div class="mb-1 font-semibold text-slate-800">Debrief shown after response</div>
        <p class="text-slate-600">${escapeHtml(c.debrief?.summary || "")}</p>
        <ul class="mt-1 list-inside list-disc space-y-1 text-slate-600">
          ${(c.debrief?.tips || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>
    </div>`;
  openModal(s.title, body, { wide: true });
}

function formFields(v = {}) {
  const c = v.content || {};
  const legit = v.isPhishing === false;
  const diff = v.difficulty || (QUIZ_MODE ? "hard" : "medium");
  return `
  <div class="space-y-4">
    <div><label class="label">Title</label><input id="f-title" class="input" value="${escapeHtml(v.title || "")}" /></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label">Role</label><select id="f-role" class="input">${roleOptions(v.role)}</select></div>
      <div><label class="label">Category</label><select id="f-cat" class="input">${categoryOptions(v.category)}</select></div>
    </div>
    <div><label class="label">Type</label>
      <select id="f-type" class="input">
        <option value="phishing" ${legit ? "" : "selected"}>Phishing simulation</option>
        <option value="legit" ${legit ? "selected" : ""}>Legitimate email (training control)</option>
      </select>
      <p class="mt-1 text-xs text-slate-400">Legit emails train users to recognise real messages. For them, list legitimacy cues under Indicators.</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="label">Difficulty</label>
        <select id="f-diff" class="input">
          <option value="easy" ${diff === "easy" ? "selected" : ""}>Easy</option>
          <option value="medium" ${diff === "medium" ? "selected" : ""}>Medium</option>
          <option value="hard" ${diff === "hard" ? "selected" : ""}>Hard</option>
        </select>
      </div>
      <div class="flex items-end pb-2">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input id="f-quiz" type="checkbox" class="h-4 w-4" ${v.useInQuiz || QUIZ_MODE ? "checked" : ""} />
          Use in training quiz
        </label>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label">Sender name</label><input id="f-sname" class="input" value="${escapeHtml(c.senderName || "")}" /></div>
      <div><label class="label">Sender email (spoofed)</label><input id="f-semail" class="input" value="${escapeHtml(c.senderEmail || "")}" /></div>
    </div>
    <div><label class="label">Subject</label><input id="f-subject" class="input" value="${escapeHtml(c.subject || "")}" /></div>
    <div><label class="label">Body</label><textarea id="f-body" class="input h-32">${escapeHtml(c.body || "")}</textarea></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="label">Call-to-action text</label><input id="f-cta" class="input" value="${escapeHtml(c.ctaText || "")}" /></div>
      <div><label class="label">Landing page</label>
        <select id="f-landing" class="input">
          <option value="link" ${c.landingType === "link" ? "selected" : ""}>Link click only</option>
          <option value="fake_login" ${c.landingType === "fake_login" ? "selected" : ""}>Fake login (input discarded)</option>
        </select>
      </div>
    </div>
    <div><label class="label">Indicators (one per line)</label><textarea id="f-ind" class="input h-24">${escapeHtml((c.indicators || []).join("\n"))}</textarea></div>
    <div><label class="label">Debrief summary</label><textarea id="f-debrief" class="input h-20">${escapeHtml(c.debrief?.summary || "")}</textarea></div>
    <div><label class="label">Debrief tips (one per line)</label><textarea id="f-tips" class="input h-20">${escapeHtml((c.debrief?.tips || []).join("\n"))}</textarea></div>
  </div>`;
}

function collectForm() {
  const lines = (id) => document.getElementById(id).value.split("\n").map((s) => s.trim()).filter(Boolean);
  return {
    title: document.getElementById("f-title").value.trim(),
    role: document.getElementById("f-role").value,
    category: document.getElementById("f-cat").value,
    isPhishing: document.getElementById("f-type").value !== "legit",
    useInQuiz: document.getElementById("f-quiz").checked,
    difficulty: document.getElementById("f-diff").value,
    content: {
      senderName: document.getElementById("f-sname").value.trim(),
      senderEmail: document.getElementById("f-semail").value.trim(),
      subject: document.getElementById("f-subject").value.trim(),
      body: document.getElementById("f-body").value,
      ctaText: document.getElementById("f-cta").value.trim(),
      landingType: document.getElementById("f-landing").value,
      indicators: lines("f-ind"),
      debrief: {
        summary: document.getElementById("f-debrief").value.trim(),
        tips: lines("f-tips")
      }
    }
  };
}

function newModal() {
  const m = openModal(QUIZ_MODE ? "New quiz email" : "New scenario", formFields({
    useInQuiz: QUIZ_MODE,
    difficulty: QUIZ_MODE ? "hard" : "medium"
  }) + `
    <div class="mt-6 flex justify-end gap-2">
      <button data-close class="btn-secondary">Cancel</button>
      <button id="save-scn" class="btn-primary">Save as pending review</button>
    </div>`, { wide: true });
  m.body.querySelector("[data-close]").addEventListener("click", m.close);
  m.body.querySelector("#save-scn").addEventListener("click", async () => {
    const data = collectForm();
    if (!data.title) return toast("Title is required", "error");
    try {
      await callCreateScenario(data);
      toast("Scenario saved for review", "success");
      m.close();
      await reload();
    } catch (e) { toast(e.message || "Failed to save", "error"); }
  });
}

function aiModal() {
  const m = openModal("AI-assisted draft", `
    <p class="mb-4 text-sm text-slate-500">
      Uses the same Gemini model as the quiz coach. Nothing goes live automatically:
      every draft lands in <strong>Needs review</strong> for a human to check before learners or campaigns can use it.
    </p>
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">Role</label><select id="ai-role" class="input">${roleOptions("student")}</select></div>
        <div><label class="label">Category</label><select id="ai-cat" class="input">${categoryOptions("eduvos_portal")}</select></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">Type</label>
          <select id="ai-type" class="input">
            <option value="phishing" selected>Phishing simulation</option>
            <option value="legit">Legitimate email (training control)</option>
          </select>
        </div>
        <div><label class="label">Difficulty</label>
          <select id="ai-diff" class="input">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard" ${QUIZ_MODE ? "selected" : ""}>Hard</option>
          </select>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input id="ai-quiz" type="checkbox" class="h-4 w-4" ${QUIZ_MODE ? "checked" : ""} />
        Use in training quiz (after approval)
      </label>
      <div><label class="label">Context / notes (optional)</label>
        <textarea id="ai-notes" class="input h-24" placeholder="e.g. calm Microsoft licence renewal, lookalike domain, no ALL CAPS"></textarea></div>
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button data-close class="btn-secondary">Cancel</button>
      <button id="gen-btn" class="btn-primary">${icons.sparkles}<span>Generate draft</span></button>
    </div>`);
  m.body.querySelector("[data-close]").addEventListener("click", m.close);
  m.body.querySelector("#gen-btn").addEventListener("click", async () => {
    const btn = m.body.querySelector("#gen-btn");
    btn.disabled = true; btn.textContent = "Generating...";
    try {
      await callGenerateAiDraft({
        role: document.getElementById("ai-role").value,
        category: document.getElementById("ai-cat").value,
        notes: document.getElementById("ai-notes").value.trim(),
        emailType: document.getElementById("ai-type").value,
        useInQuiz: document.getElementById("ai-quiz").checked,
        difficulty: document.getElementById("ai-diff").value
      });
      toast("Draft created. Review it before going live.", "success");
      m.close();
      filter = "pending_review";
      await reload();
    } catch (e) {
      console.error(e);
      toast(e.details || e.message || "Generation failed", "error");
      btn.disabled = false;
      btn.textContent = "Generate draft";
    }
  });
}

async function approve(id) {
  if (!confirm(QUIZ_MODE
    ? "Confirm this quiz email has been human-reviewed and can be shown to learners?"
    : "Confirm this scenario has been human-reviewed and is safe to go live?")) return;
  try {
    await callApproveScenario({ scenarioId: id });
    toast("Scenario is now live", "success");
    await reload();
  } catch (e) { toast(e.message || "Failed", "error"); }
}

async function deny(id) {
  if (!confirm("Deny this draft? It will not go live.")) return;
  try {
    await callDenyScenario({ scenarioId: id });
    toast("Draft denied", "success");
    await reload();
  } catch (e) { toast(e.message || "Failed", "error"); }
}

async function retire(id) {
  try {
    await callRetireScenario({ scenarioId: id });
    toast("Scenario retired", "success");
    await reload();
  } catch (e) { toast(e.message || "Failed", "error"); }
}

async function reload() {
  scenarios = await fetchScenarios();
  render();
}

await reload();

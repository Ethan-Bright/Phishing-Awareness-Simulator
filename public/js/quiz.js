import { escapeHtml } from "./utils.js";
import { createCoach } from "./quiz-chat.js";
import { db } from "./firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const root = document.getElementById("root");

const PHISH_COUNT = 5;
const LEGIT_COUNT = 4;

let batch = [];
let index = 0;
let answers = []; // { item, saidPhishing, correct }

function intro(notice) {
  batch = [];
  index = 0;
  answers = [];
  root.innerHTML = `
  <div class="flex min-h-screen items-center justify-center p-6">
    <div class="card w-full max-w-xl p-8">
      <div class="mb-4 flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900">Phish or Legit?</h1>
          <p class="text-sm text-slate-500">Phishing awareness training quiz</p>
        </div>
      </div>
      ${notice ? `<p class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">${escapeHtml(notice)}</p>` : ""}
      <p class="mb-3 text-sm text-slate-600">
        You will go through <strong>${PHISH_COUNT + LEGIT_COUNT} emails</strong>, one at a time.
        Some are phishing. Some are real, everyday messages. For each one, decide:
        would you <strong>report it</strong> or <strong>trust it</strong>?
      </p>
      <ul class="mb-6 list-inside list-disc space-y-1 text-sm text-slate-600">
        <li>Check the sender's full email address, not just the name</li>
        <li>Watch for lookalike domains, extra words after .com, and quiet requests to sign in</li>
        <li>You get feedback after every email, and a score at the end</li>
      </ul>
      <button id="start" class="btn-primary w-full">Start the quiz</button>
      <p class="mt-4 text-center text-xs text-slate-400">Training exercise. Only human-approved emails are used. No emails shown here are real messages.</p>
    </div>
  </div>`;
  document.getElementById("start").addEventListener("click", startQuiz);
}

async function startQuiz() {
  const btn = document.getElementById("start");
  btn.disabled = true;
  btn.textContent = "Loading emails...";
  try {
    let next = null;
    try {
      const res = await fetch("/api/quiz-batch");
      const data = await res.json();
      if (data.ok && Array.isArray(data.batch) && data.batch.length) next = data.batch;
    } catch (_) { /* fall through to the approved quiz_live collection */ }

    if (!next) next = await loadApprovedBatch();

    if (!next) {
      const live = await loadApprovedPool();
      const haveP = live.filter((i) => i.isPhishing).length;
      const haveL = live.filter((i) => !i.isPhishing).length;
      intro(`The quiz is not ready yet. An admin needs to approve at least ${PHISH_COUNT} phishing and ${LEGIT_COUNT} legit emails in the Quiz library (currently ${haveP} phishing, ${haveL} legit).`);
      return;
    }
    batch = next;
    index = 0;
    answers = [];
    question();
  } catch (_) {
    intro("Could not load the quiz. Check that the app is running and try again.");
  }
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickPool(items, n) {
  const hard = items.filter((i) => i.difficulty === "hard");
  const easy = items.filter((i) => i.difficulty === "easy");
  const medium = items.filter((i) => i.difficulty !== "hard" && i.difficulty !== "easy");
  return [...shuffle(hard), ...shuffle(medium), ...shuffle(easy)].slice(0, n);
}

async function loadApprovedPool() {
  const snap = await getDocs(collection(db, "quiz_live"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadApprovedBatch() {
  const live = await loadApprovedPool();
  const phish = live.filter((i) => i.isPhishing);
  const legit = live.filter((i) => !i.isPhishing);
  if (phish.length < PHISH_COUNT || legit.length < LEGIT_COUNT) return null;
  return shuffle([...pickPool(phish, PHISH_COUNT), ...pickPool(legit, LEGIT_COUNT)]);
}

function progressBar() {
  const done = index;
  const total = batch.length;
  const pctW = Math.round((done / total) * 100);
  return `
    <div class="mb-4">
      <div class="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>Email ${index + 1} of ${total}</span>
        <span>${answers.filter((a) => a.correct).length} correct so far</span>
      </div>
      <div class="h-1.5 w-full rounded-full bg-slate-200">
        <div class="h-1.5 rounded-full bg-brand-600" style="width:${pctW}%"></div>
      </div>
    </div>`;
}

function emailCard(item) {
  const c = item.content;
  return `
    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="border-b border-slate-100 px-6 py-4">
        <div class="text-lg font-semibold text-slate-900">${escapeHtml(c.subject)}</div>
        <div class="mt-2 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            ${escapeHtml((c.senderName || "?")[0].toUpperCase())}
          </div>
          <div class="text-sm">
            <div class="font-medium text-slate-800">${escapeHtml(c.senderName)}</div>
            <div class="text-slate-400">&lt;${escapeHtml(c.senderEmail)}&gt;</div>
          </div>
        </div>
      </div>
      <div class="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-slate-700">${escapeHtml(c.body)}</div>
      ${c.ctaText ? `<div class="px-6 pb-6"><span class="btn-primary pointer-events-none opacity-90">${escapeHtml(c.ctaText)}</span></div>` : ""}
    </div>`;
}

function question() {
  const item = batch[index];
  root.innerHTML = `
  <div class="mx-auto max-w-2xl px-4 py-8">
    ${progressBar()}
    ${emailCard(item)}
    <div class="mt-4 grid grid-cols-2 gap-3">
      <button id="report" class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        Report phishing
      </button>
      <button id="trust" class="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        Looks legit
      </button>
    </div>
    <p class="mt-4 text-center text-xs text-slate-400">Training exercise. Links and buttons in the email are not active.</p>
  </div>`;

  document.getElementById("report").addEventListener("click", () => answer(true));
  document.getElementById("trust").addEventListener("click", () => answer(false));
}

function answer(saidPhishing) {
  const item = batch[index];
  const correct = saidPhishing === item.isPhishing;
  answers.push({ item, saidPhishing, correct });
  feedback(item, saidPhishing, correct);
}

function feedback(item, saidPhishing, correct) {
  const last = index === batch.length - 1;
  const banner = correct
    ? `<div class="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Correct. ${item.isPhishing ? "You caught the phish." : "You recognised a real message."}</div>`
    : `<div class="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${item.isPhishing ? "Missed. This one was phishing." : "False alarm. This message was legitimate."}</div>`;

  root.innerHTML = `
  <div class="mx-auto max-w-2xl px-4 py-8">
    ${progressBar()}
    ${banner}
    <div class="card p-6">
      <p class="mb-3 text-sm font-medium text-slate-800">${escapeHtml(item.verdict)}</p>
      <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        ${item.isPhishing ? "What gave it away" : "Signs it was genuine"}
      </div>
      <ul class="list-inside list-disc space-y-1 text-sm text-slate-600">
        ${(item.indicators || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
      </ul>
    </div>
    <details class="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <summary class="cursor-pointer font-medium text-slate-700">Show the email again</summary>
      <div class="mt-3">${emailCard(item)}</div>
    </details>
    <button id="next" class="btn-primary mt-4 w-full">${last ? "See my results" : "Next email"}</button>
  </div>`;

  document.getElementById("next").addEventListener("click", () => {
    index += 1;
    if (index >= batch.length) results();
    else question();
  });
}

function results() {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const caught = answers.filter((a) => a.item.isPhishing && a.saidPhishing).length;
  const missed = answers.filter((a) => a.item.isPhishing && !a.saidPhishing).length;
  const trusted = answers.filter((a) => !a.item.isPhishing && !a.saidPhishing).length;
  const falseAlarms = answers.filter((a) => !a.item.isPhishing && a.saidPhishing).length;
  const pctScore = Math.round((correct / total) * 100);

  const message =
    missed > 0
      ? "Focus area: you trusted at least one phishing email. Always check the sender's domain before acting."
      : falseAlarms > 0
        ? "You caught every phish, but flagged real mail too. Look for official domains and the absence of urgency before reporting."
        : "Perfect. You told every phish from every real message.";

  const stat = (label, value, cls) => `
    <div class="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div class="text-2xl font-bold ${cls}">${value}</div>
      <div class="mt-1 text-xs text-slate-500">${label}</div>
    </div>`;

  const recapRow = (a) => `
    <li class="flex items-start gap-3 border-t border-slate-100 py-3 first:border-t-0">
      <span class="mt-0.5 ${a.correct ? "text-emerald-600" : "text-red-600"}">
        ${a.correct
          ? `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
          : `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`}
      </span>
      <div class="min-w-0">
        <div class="truncate text-sm font-medium text-slate-800">${escapeHtml(a.item.content.subject)}</div>
        <div class="text-xs text-slate-500">
          ${a.item.isPhishing ? "Phishing" : "Legitimate"} - you said ${a.saidPhishing ? "report" : "legit"}
        </div>
      </div>
    </li>`;

  root.innerHTML = `
  <div class="mx-auto max-w-2xl px-4 py-8">
    <div class="card p-8 text-center">
      <div class="text-sm font-medium uppercase tracking-wide text-slate-400">Your score</div>
      <div class="mt-1 text-5xl font-bold text-slate-900">${correct}/${total}</div>
      <div class="mt-1 text-sm text-slate-500">${pctScore}% correct</div>
      <p class="mx-auto mt-4 max-w-md text-sm text-slate-600">${message}</p>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${stat("Phish caught", caught, "text-emerald-600")}
      ${stat("Phish missed", missed, missed ? "text-red-600" : "text-slate-300")}
      ${stat("Legit trusted", trusted, "text-emerald-600")}
      ${stat("False alarms", falseAlarms, falseAlarms ? "text-amber-600" : "text-slate-300")}
    </div>
    <div class="card mt-4 p-6">
      <h2 class="mb-2 text-sm font-semibold text-slate-800">Email recap</h2>
      <ul>${answers.map(recapRow).join("")}</ul>
    </div>
    <div class="card mt-4 p-6">
      <div class="mb-1 flex items-center gap-2">
        <svg viewBox="0 0 24 24" class="h-5 w-5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8L4 10.7l6.1 1.9L12 18.4l1.9-5.8L20 10.7l-6.1-1.9z"/></svg>
        <h2 class="text-sm font-semibold text-slate-800">Ask the AI coach</h2>
      </div>
      <p class="mb-3 text-xs text-slate-500">
        Ask anything about the emails in this batch or how to spot phishing.
        Chats are not saved. Do not enter personal information.
      </p>
      <div id="chat-log" class="mb-3 max-h-80 space-y-3 overflow-y-auto"></div>
      <form id="chat-form" class="flex gap-2">
        <input id="chat-input" class="input flex-1" type="text" autocomplete="off" maxlength="500"
          placeholder="e.g. Why was the NSFAS email fake?" />
        <button type="submit" id="chat-send" class="btn-primary px-4">Send</button>
      </form>
    </div>
    <button id="retry" class="btn-primary mt-4 w-full">Try another batch</button>
    <p class="mt-4 text-center text-xs text-slate-400">A new attempt draws a fresh random mix of emails.</p>
  </div>`;

  document.getElementById("retry").addEventListener("click", intro);
  mountChat();
}

function mountChat() {
  const coach = createCoach(answers);
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const send = document.getElementById("chat-send");

  function bubble(text, who) {
    const wrap = document.createElement("div");
    wrap.className = who === "user" ? "flex justify-end" : "flex justify-start";
    wrap.innerHTML = `
      <div class="${who === "user"
        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm text-white"
        : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm text-slate-700"}">${escapeHtml(text)}</div>`;
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  bubble(`Nice work finishing the batch. Ask me about any email you saw, why it was phishing or legit, or how to stay safe in a real inbox.`, "coach");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = "";
    bubble(text, "user");
    const pending = bubble("Thinking...", "coach");
    send.disabled = true;
    try {
      const reply = await coach.ask(text);
      pending.remove();
      bubble(reply, "coach");
    } catch (err) {
      console.error(err);
      pending.remove();
      bubble("Sorry, I could not reach the coach right now. Your results above still have all the indicators for each email.", "coach");
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
}

intro();

import { escapeHtml } from "./utils.js";

const root = document.getElementById("root");
const params = new URLSearchParams(location.search);
const token = params.get("t");

function invalid(msg) {
  root.innerHTML = `
    <div class="flex min-h-screen items-center justify-center p-6">
      <div class="card max-w-md p-8 text-center">
        <h1 class="text-lg font-semibold text-slate-900">Link unavailable</h1>
        <p class="mt-2 text-sm text-slate-500">${escapeHtml(msg)}</p>
      </div>
    </div>`;
}

async function recordEvent(type) {
  try {
    await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type })
    });
  } catch (_) { /* best effort; do not block the flow */ }
}

function goDebrief() {
  location.href = `/debrief.html?t=${encodeURIComponent(token)}`;
}

function renderEmail(s) {
  const c = s.content || {};
  root.innerHTML = `
  <div class="mx-auto max-w-2xl px-4 py-8">
    <div class="mb-3 flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-2">
      <span class="text-xs font-medium text-slate-400">Inbox</span>
      <button id="report" class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        Report phishing
      </button>
    </div>
    <div class="rounded-b-xl border border-slate-200 bg-white">
      <div class="border-b border-slate-100 px-6 py-4">
        <div class="text-lg font-semibold text-slate-900">${escapeHtml(c.subject || "(no subject)")}</div>
        <div class="mt-2 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            ${escapeHtml((c.senderName || "?")[0].toUpperCase())}
          </div>
          <div class="text-sm">
            <div class="font-medium text-slate-800">${escapeHtml(c.senderName || "")}</div>
            <div class="text-slate-400">&lt;${escapeHtml(c.senderEmail || "")}&gt;</div>
          </div>
        </div>
      </div>
      <div class="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-slate-700">${escapeHtml(c.body || "")}</div>
      <div class="px-6 pb-8">
        <button id="cta" class="btn-primary">${escapeHtml(c.ctaText || "Continue")}</button>
      </div>
    </div>
    <p class="mt-4 text-center text-xs text-slate-400">Awareness simulation. This message is not from a real organisation.</p>
  </div>`;

  document.getElementById("report").addEventListener("click", async () => {
    await recordEvent("reported");
    goDebrief();
  });
  document.getElementById("cta").addEventListener("click", async () => {
    await recordEvent("clicked");
    if ((c.landingType || "link") === "fake_login") renderFakeLogin(s);
    else goDebrief();
  });
}

function renderFakeLogin(s) {
  const c = s.content || {};
  root.innerHTML = `
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 to-navy-950 p-6">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center text-white">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
          <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="text-lg font-semibold">${escapeHtml(c.portalName || "Student Portal")}</div>
        <div class="text-xs text-slate-400">Sign in to continue</div>
      </div>
      <form id="login" class="card p-6">
        <div class="mb-4">
          <label class="label">Username / Student number</label>
          <input class="input" type="text" autocomplete="off" required />
        </div>
        <div class="mb-4">
          <label class="label">Password</label>
          <input class="input" type="password" autocomplete="off" required />
        </div>
        <button type="submit" class="btn-primary w-full">Sign in</button>
      </form>
      <p class="mt-4 text-center text-xs text-slate-400">Awareness simulation. Do not enter real credentials.</p>
    </div>
  </div>`;

  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    // Never read, never send, never store the entered values. Just log that
    // a submission happened, then discard by resetting the form.
    e.target.reset();
    await recordEvent("submitted");
    goDebrief();
  });
}

async function start() {
  if (!token) return invalid("This link is missing its access token.");
  try {
    const res = await fetch(`/api/scenario?t=${encodeURIComponent(token)}`);
    if (!res.ok) return invalid("This link is not valid or has expired.");
    const data = await res.json();
    if (!data.ok) return invalid(data.error || "This link is not valid.");
    renderEmail(data.scenario);
  } catch (_) {
    invalid("Could not load this message. Please try again later.");
  }
}

start();

import { escapeHtml } from "./utils.js";

const root = document.getElementById("root");
const token = new URLSearchParams(location.search).get("t");

function shell(inner) {
  root.innerHTML = `<div class="mx-auto max-w-2xl px-4 py-10">${inner}</div>`;
}

async function start() {
  if (!token) return shell(`<div class="card p-8 text-center text-slate-500">Missing token.</div>`);
  let data;
  try {
    const res = await fetch(`/api/debrief?t=${encodeURIComponent(token)}`);
    data = await res.json();
  } catch (_) {
    return shell(`<div class="card p-8 text-center text-slate-500">Could not load debrief.</div>`);
  }
  if (!data.ok) return shell(`<div class="card p-8 text-center text-slate-500">${escapeHtml(data.error || "Not available")}</div>`);

  const c = data.content || {};
  const outcome = data.outcome || "clicked";
  const banner = {
    reported: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Well spotted.", msg: "You reported this as phishing. That's exactly the right move." },
    submitted: { cls: "border-red-200 bg-red-50 text-red-800", title: "This was a phishing simulation.", msg: "You entered details on a fake login page. In a real attack those credentials would now be stolen. Nothing you typed was saved here." },
    clicked: { cls: "border-amber-200 bg-amber-50 text-amber-800", title: "This was a phishing simulation.", msg: "You clicked the link. In a real attack this is the moment things go wrong. Here's what to watch for." }
  }[outcome] || { cls: "border-amber-200 bg-amber-50 text-amber-800", title: "This was a phishing simulation.", msg: "Here's what to watch for." };

  const indicators = (c.indicators || []).map((i) => `
    <li class="flex items-start gap-2">
      <svg class="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <span>${escapeHtml(i)}</span>
    </li>`).join("");

  const tips = (c.debrief?.tips || []).map((t) => `
    <li class="flex items-start gap-2">
      <svg class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${escapeHtml(t)}</span>
    </li>`).join("");

  shell(`
    <div class="mb-4 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
      <div>
        <div class="font-semibold text-slate-900">Security Awareness</div>
        <div class="text-xs text-slate-400">Post-response debrief</div>
      </div>
    </div>

    <div class="rounded-xl border ${banner.cls} p-5">
      <div class="text-base font-semibold">${banner.title}</div>
      <p class="mt-1 text-sm">${banner.msg}</p>
    </div>

    <div class="card mt-6 p-6">
      <h2 class="text-base font-semibold text-slate-900">What gave it away</h2>
      <p class="mt-1 text-sm text-slate-500">${escapeHtml(c.debrief?.summary || "")}</p>
      <ul class="mt-4 space-y-2 text-sm text-slate-700">${indicators || "<li>No indicators listed.</li>"}</ul>
    </div>

    ${tips ? `<div class="card mt-6 p-6">
      <h2 class="text-base font-semibold text-slate-900">How to stay safe</h2>
      <ul class="mt-4 space-y-2 text-sm text-slate-700">${tips}</ul>
    </div>` : ""}

    <div class="mt-6 text-center text-xs text-slate-400">
      Your response is recorded for aggregate research statistics only. No individual profile is created.
    </div>`);
}

start();

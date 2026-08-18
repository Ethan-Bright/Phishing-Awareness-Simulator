import { requireAdmin } from "./auth-guard.js";
import { mountShell } from "./layout.js";
import { auth } from "./firebase-init.js";

const user = await requireAdmin();
const page = mountShell({
  active: "settings",
  title: "Settings",
  subtitle: "System configuration and data-governance summary."
});

function panel(title, rows) {
  return `
  <div class="card p-6">
    <h2 class="mb-4 text-base font-semibold text-slate-900">${title}</h2>
    <dl class="space-y-3 text-sm">${rows}</dl>
  </div>`;
}
function rowKV(k, v) {
  return `<div class="flex items-start justify-between gap-4"><dt class="text-slate-500">${k}</dt><dd class="text-right font-medium text-slate-800">${v}</dd></div>`;
}

const badge = (ok, txt) =>
  `<span class="pill ${ok ? "pill-green" : "pill-amber"}">${txt}</span>`;

page.innerHTML = `
<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  ${panel("Account", `
    ${rowKV("Signed in as", user.email)}
    ${rowKV("Role", badge(true, "Administrator"))}
    ${rowKV("Project", location.hostname)}
  `)}

  ${panel("Data governance", `
    ${rowKV("Reporting mode", badge(true, "Aggregate only"))}
    ${rowKV("Individual risk profiles", badge(true, "Disabled by design"))}
    ${rowKV("Credential capture", badge(true, "Never stored — input discarded"))}
    ${rowKV("Identity mapping", "Kept separate from response data")}
    ${rowKV("Retention", "5 years, encrypted (per ethics application)")}
  `)}

  ${panel("Security & isolation", `
    ${rowKV("Transport", badge(true, "HTTPS enforced"))}
    ${rowKV("Real Eduvos systems", badge(true, "No connection"))}
    ${rowKV("Authentication scope", "This system only, isolated")}
    ${rowKV("Access control", "Firebase Auth admin claim + Firestore rules")}
  `)}

  ${panel("Scenario governance", `
    ${rowKV("AI generation", "Offline drafts only")}
    ${rowKV("Human review", badge(true, "Required before live"))}
    ${rowKV("Delivery", "Shareable links / tokens")}
    ${rowKV("Channels", "Web only (email/SMS/voice out of scope)")}
  `)}
</div>

<div class="card mt-6 p-6 text-sm text-slate-600">
  <h2 class="mb-2 text-base font-semibold text-slate-900">Granting admin access</h2>
  <p>Admin rights are controlled by a Firebase custom claim, not stored in the database. To grant access to a new researcher, run the helper script:</p>
  <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">python scripts/set_admin.py new.researcher@eduvos.example</pre>
  <p class="mt-3">The account must exist in Firebase Authentication first. The user signs out and back in for the claim to take effect.</p>
</div>`;

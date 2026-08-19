import { icons } from "./icons.js";
import { auth } from "./firebase-init.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/index.html", icon: icons.dashboard },
  { key: "campaigns", label: "Campaigns", href: "/campaigns.html", icon: icons.campaigns },
  { key: "scenarios", label: "Scenarios", href: "/scenarios.html", icon: icons.scenarios },
  { key: "participants", label: "Participants", href: "/participants.html", icon: icons.participants },
  { key: "groups", label: "Groups", href: "/groups.html", icon: icons.groups },
  { key: "reports", label: "Reports", href: "/reports.html", icon: icons.reports },
  { key: "quiz-library", label: "Quiz library", href: "/quiz-library.html", icon: icons.shieldCheck },
  { key: "settings", label: "Settings", href: "/settings.html", icon: icons.settings }
];

function sidebarHTML(active) {
  const items = NAV.map(
    (n) => `
    <a href="${n.href}" class="nav-item ${n.key === active ? "active" : ""}">
      ${n.icon}<span>${n.label}</span>
    </a>`
  ).join("");

  return `
  <aside class="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-white">
    <div class="flex items-center gap-3 px-5 py-5">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">${icons.shield}</div>
      <div class="leading-tight">
        <div class="text-base font-semibold">PhishSim Pro</div>
        <div class="text-xs text-slate-400">Security Awareness</div>
      </div>
    </div>
    <nav class="mt-2 flex-1 space-y-1 px-3">${items}</nav>
    <div class="border-t border-white/10 p-3">
      <div class="flex items-center gap-3 rounded-lg px-2 py-2">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold" id="shell-avatar">A</div>
        <div class="min-w-0 flex-1 leading-tight">
          <div class="truncate text-sm font-medium" id="shell-user-name">Admin</div>
          <div class="truncate text-xs text-slate-400" id="shell-user-email">&nbsp;</div>
        </div>
        <button id="shell-logout" title="Sign out" class="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">${icons.logout}</button>
      </div>
    </div>
  </aside>`;
}

function topbarHTML(title, subtitle) {
  return `
  <header class="flex items-start justify-between px-8 pt-7">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">${title}</h1>
      <p class="mt-1 text-sm text-slate-500">${subtitle || ""}</p>
    </div>
    <button class="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
      ${icons.bell}
      <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
    </button>
  </header>`;
}

// Builds the full app shell into #app and returns the #page container.
export function mountShell({ active, title, subtitle }) {
  const appEl = document.getElementById("app");
  appEl.innerHTML = `
    ${sidebarHTML(active)}
    <div class="ml-64 flex min-h-screen flex-1 flex-col bg-slate-50">
      ${topbarHTML(title, subtitle)}
      <main id="page" class="flex-1 px-8 py-6"></main>
      <footer class="px-8 py-4 text-center text-xs text-slate-400">
        &copy; ${new Date().getFullYear()} PhishSim Pro (Eduvos research use). Aggregate-only reporting. No real credentials stored.
      </footer>
    </div>`;

  const user = auth.currentUser;
  if (user) {
    const name = user.displayName || user.email?.split("@")[0] || "Admin";
    document.getElementById("shell-user-name").textContent = name;
    document.getElementById("shell-user-email").textContent = user.email || "";
    document.getElementById("shell-avatar").textContent = (name[0] || "A").toUpperCase();
  }

  document.getElementById("shell-logout").addEventListener("click", async () => {
    await signOut(auth);
    location.href = "/login.html";
  });

  return document.getElementById("page");
}

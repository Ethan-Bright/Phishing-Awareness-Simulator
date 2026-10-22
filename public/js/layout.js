import { icons } from "./icons.js";
import { auth } from "./firebase-init.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const ADMIN_NAV = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: icons.dashboard },
  { key: "campaigns", label: "Campaigns", href: "/campaigns", icon: icons.campaigns },
  { key: "scenarios", label: "Scenarios", href: "/scenarios", icon: icons.scenarios },
  { key: "participants", label: "Participants", href: "/participants", icon: icons.participants },
  { key: "groups", label: "Groups", href: "/groups", icon: icons.groups },
  { key: "reports", label: "Reports", href: "/reports", icon: icons.reports },
  { key: "quiz-library", label: "Quiz library", href: "/quiz-library", icon: icons.shieldCheck },
  { key: "settings", label: "Settings", href: "/settings", icon: icons.settings }
];

const PARTICIPANT_NAV = [
  { key: "portal", label: "Home", href: "/portal", icon: icons.dashboard },
  { key: "portal-quizzes", label: "Quizzes", href: "/portal-quizzes", icon: icons.shieldCheck },
  { key: "portal-learn", label: "Learning", href: "/portal-learn", icon: icons.book },
  { key: "portal-stats", label: "Company stats", href: "/portal-stats", icon: icons.reports }
];

function userMenuItems(variant) {
  if (variant === "participant") return "";
  return `
          <a href="/settings" role="menuitem" class="user-menu-item">
            ${icons.settings}<span>Settings</span>
          </a>
          <a href="/portal" role="menuitem" class="user-menu-item">
            ${icons.participants}<span>Participant view</span>
          </a>`;
}

function sidebarHTML(active, variant) {
  const nav = variant === "participant" ? PARTICIPANT_NAV : ADMIN_NAV;
  const items = nav.map(
    (n) => `
    <a href="${n.href}" class="nav-item ${n.key === active ? "active" : ""}">
      ${n.icon}<span>${n.label}</span>
    </a>`
  ).join("");

  // Fixed sidebar on lg+. Below that it is an off-canvas drawer toggled from
  // the top bar (see mountShell).
  return `
  <div id="shell-backdrop" class="fixed inset-0 z-20 hidden bg-slate-900/50 lg:hidden"></div>
  <aside id="shell-sidebar" class="fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-white transition-transform duration-200 lg:translate-x-0">
    <div class="flex items-center gap-3 px-5 py-5">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">${icons.shield}</div>
      <div class="leading-tight">
        <div class="text-base font-semibold">PhishSim Pro</div>
        <div class="text-xs text-slate-400">${variant === "participant" ? "Participant portal" : "Security Awareness"}</div>
      </div>
      <button type="button" id="shell-close" class="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu">
        <span class="block h-5 w-5">${icons.close}</span>
      </button>
    </div>
    <nav class="mt-2 flex-1 space-y-1 px-3">${items}</nav>
    <div class="border-t border-white/10 p-3">
      <div class="relative">
        <div id="shell-user-menu" role="menu" aria-labelledby="shell-user-btn" class="absolute bottom-full left-0 right-0 z-30 mb-2 hidden overflow-hidden rounded-lg border border-white/10 bg-navy-800 py-1 shadow-lg">
          ${userMenuItems(variant)}
          <button type="button" id="shell-logout" role="menuitem" class="user-menu-item">
            ${icons.logout}<span>Sign out</span>
          </button>
        </div>
        <button type="button" id="shell-user-btn" class="user-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="shell-user-menu">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold" id="shell-avatar">A</div>
          <div class="min-w-0 flex-1 leading-tight">
            <div class="truncate text-sm font-medium" id="shell-user-name">Admin</div>
            <div class="truncate text-xs text-slate-400" id="shell-user-email">&nbsp;</div>
          </div>
          <span class="user-chevron">${icons.chevronDown}</span>
        </button>
      </div>
    </div>
  </aside>`;
}

function topbarHTML(title, subtitle) {
  return `
  <header class="flex items-start justify-between gap-3 px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
    <div class="flex min-w-0 items-start gap-3">
      <button type="button" id="shell-open" class="mt-0.5 shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu" aria-controls="shell-sidebar" aria-expanded="false">
        <span class="block h-6 w-6">${icons.menu}</span>
      </button>
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">${title}</h1>
        <p class="mt-1 text-sm text-slate-500">${subtitle || ""}</p>
      </div>
    </div>
    <button class="relative shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
      ${icons.bell}
      <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
    </button>
  </header>`;
}

// Builds the full app shell into #app and returns the #page container.
// variant: "admin" (default) or "participant". The participant variant has no
// admin links; access is still enforced by claims and Firestore rules.
export function mountShell({ active, title, subtitle, variant = "admin" }) {
  const appEl = document.getElementById("app");
  appEl.innerHTML = `
    ${sidebarHTML(active, variant)}
    <div class="flex min-h-screen w-full min-w-0 flex-1 flex-col bg-slate-50 lg:ml-64">
      ${topbarHTML(title, subtitle)}
      <main id="page" class="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div class="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
          <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            ${Array(4).fill(`<div class="card h-24"></div>`).join("")}
          </div>
          <div class="card h-72"></div>
        </div>
      </main>
      <footer class="px-4 py-4 text-center text-xs text-slate-400 sm:px-8">
        &copy; ${new Date().getFullYear()} PhishSim Pro (Eduvos research use). Aggregate-only reporting. No real credentials stored.
      </footer>
    </div>`;

  const user = auth.currentUser;
  if (user) {
    const name = user.displayName || user.email?.split("@")[0] || (variant === "participant" ? "Participant" : "Admin");
    document.getElementById("shell-user-name").textContent = name;
    document.getElementById("shell-user-email").textContent = user.email || "";
    document.getElementById("shell-avatar").textContent = (name[0] || "A").toUpperCase();
  }

  const userBtn = document.getElementById("shell-user-btn");
  const userMenu = document.getElementById("shell-user-menu");

  function setUserMenuOpen(open) {
    userMenu.classList.toggle("hidden", !open);
    userBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  userBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setUserMenuOpen(userMenu.classList.contains("hidden"));
  });

  userMenu.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => setUserMenuOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !userMenu.classList.contains("hidden")) {
      setUserMenuOpen(false);
      userBtn.focus();
    }
  });

  document.getElementById("shell-logout").addEventListener("click", async () => {
    await signOut(auth);
    location.href = "/login";
  });

  // Mobile drawer (no-op on lg+ where the sidebar is always visible).
  const sidebar = document.getElementById("shell-sidebar");
  const backdrop = document.getElementById("shell-backdrop");
  const openBtn = document.getElementById("shell-open");

  function setDrawerOpen(open) {
    sidebar.classList.toggle("-translate-x-full", !open);
    backdrop.classList.toggle("hidden", !open);
    openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("overflow-hidden", open);
    if (!open) setUserMenuOpen(false);
  }

  openBtn.addEventListener("click", (event) => { event.stopPropagation(); setDrawerOpen(true); });
  document.getElementById("shell-close").addEventListener("click", () => setDrawerOpen(false));
  backdrop.addEventListener("click", () => setDrawerOpen(false));
  sidebar.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("hidden")) setDrawerOpen(false);
  });
  // If the viewport grows past lg while the drawer is open, drop the lock.
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => { if (e.matches) setDrawerOpen(false); });

  return document.getElementById("page");
}

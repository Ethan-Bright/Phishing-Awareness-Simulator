export const ROLE_LABELS = {
  student: "Student",
  staff: "Staff",
  lecturer: "Lecturer",
  sales: "Sales",
  consultant: "Consultant"
};

export const CATEGORY_LABELS = {
  eduvos_portal: "Eduvos portal spoof",
  nsfas: "NSFAS-style scam",
  it_helpdesk: "Fake IT helpdesk"
};

export const STATUS_PILL = {
  draft: "pill-gray",
  pending_review: "pill-amber",
  approved: "pill-blue",
  live: "pill-green",
  running: "pill-blue",
  completed: "pill-green",
  retired: "pill-gray"
};

export function pct(n, d) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

// A "submitted" outcome is a click that went further (entered fake creds),
// so anyone who submitted also counts as having clicked the malicious link.
export function engaged(a) {
  return (a.clicked || 0) + (a.submitted || 0);
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

let toastTimer;
export function toast(msg, kind = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "fixed bottom-6 right-6 z-50 hidden rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg";
    document.body.appendChild(el);
  }
  el.className = `fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
    kind === "error" ? "bg-red-600" : kind === "success" ? "bg-emerald-600" : "bg-slate-800"
  }`;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className += " hidden"; }, 3200);
}

// Minimal modal helper. Returns { close }.
export function openModal(title, bodyHTML, { wide = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4";
  wrap.innerHTML = `
    <div class="card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
        <button data-close class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">&#10005;</button>
      </div>
      <div id="modal-body">${bodyHTML}</div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector("[data-close]").addEventListener("click", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  return { el: wrap, body: wrap.querySelector("#modal-body"), close };
}

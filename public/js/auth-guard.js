import { auth } from "./firebase-init.js";
import { onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function deny(message) {
  document.body.innerHTML = `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div class="card max-w-md p-8 text-center">
        <h1 class="text-lg font-semibold text-slate-900">Access denied</h1>
        <p class="mt-2 text-sm text-slate-500">${message}</p>
        <a href="/login.html" class="btn-primary mt-6">Back to sign in</a>
      </div>
    </div>`;
}

// Resolves with the signed-in admin user, or redirects to /login.html.
// Admin access is gated by the `admin` custom claim set server-side.
export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = "/login.html";
        return;
      }
      const token = await getIdTokenResult(user, true);
      if (token.claims.participant) {
        location.href = "/portal.html";
        return;
      }
      if (!token.claims.admin) {
        deny(`This account is not authorised for the admin dashboard.
          Ask an administrator to grant the <code class="rounded bg-slate-100 px-1">admin</code> role, then sign in again.`);
        return;
      }
      resolve(user);
    });
  });
}

// Resolves with { user, claims, isAdmin } for participant pages.
// Participants are gated by the `participant` claim, issued only by an admin
// script. Admins may open the portal as a read-only preview.
export function requireParticipant() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = "/login.html";
        return;
      }
      const token = await getIdTokenResult(user, true);
      const claims = token.claims;
      if (!claims.participant && !claims.admin) {
        deny("This account has not been issued participant access. Contact your administrator.");
        return;
      }
      resolve({ user, claims, isAdmin: Boolean(claims.admin) });
    });
  });
}

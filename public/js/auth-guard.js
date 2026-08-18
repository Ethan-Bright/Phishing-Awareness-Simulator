import { auth } from "./firebase-init.js";
import { onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
      if (!token.claims.admin) {
        document.body.innerHTML = `
          <div class="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div class="card max-w-md p-8 text-center">
              <h1 class="text-lg font-semibold text-slate-900">Access denied</h1>
              <p class="mt-2 text-sm text-slate-500">This account is not authorised for the admin dashboard.
              Ask an administrator to grant the <code class="rounded bg-slate-100 px-1">admin</code> role, then sign in again.</p>
              <a href="/login.html" class="btn-primary mt-6">Back to sign in</a>
            </div>
          </div>`;
        return;
      }
      resolve(user);
    });
  });
}

import { auth } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.getElementById("login-form");
const errEl = document.getElementById("login-error");
const btn = document.getElementById("login-btn");

// Admins land on the dashboard, participants on their portal.
function homeFor(claims) {
  if (claims.admin) return "/dashboard.html";
  if (claims.participant) return "/portal.html";
  return null;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const token = await getIdTokenResult(user);
  const home = homeFor(token.claims);
  if (home) location.href = home;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Signing in...";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await getIdTokenResult(cred.user, true);
    const home = homeFor(token.claims);
    if (!home) {
      await signOut(auth);
      errEl.textContent = "This account has not been issued access. Contact your administrator.";
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Sign in";
      return;
    }
    location.href = home;
  } catch (err) {
    errEl.textContent = "Sign in failed. Check your email and password.";
    errEl.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

import { auth } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.getElementById("login-form");
const errEl = document.getElementById("login-error");
const btn = document.getElementById("login-btn");

// If already signed in as admin, skip the form.
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const token = await getIdTokenResult(user);
  if (token.claims.admin) location.href = "/index.html";
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
    if (!token.claims.admin) {
      errEl.textContent = "This account is not authorised as an admin.";
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Sign in";
      return;
    }
    location.href = "/index.html";
  } catch (err) {
    errEl.textContent = "Sign in failed. Check your email and password.";
    errEl.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

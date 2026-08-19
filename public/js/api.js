import { auth, db, functions } from "./firebase-init.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { generateScenarioDraft, VALID_ROLES, VALID_CATEGORIES } from "./ai-author.js";

function requireAdminUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  return user;
}

export async function callCreateScenario(data) {
  const user = requireAdminUser();
  const title = (data.title || "").trim();
  const role = data.role;
  const category = data.category;
  if (!title) throw new Error("Title required.");
  if (!VALID_ROLES.includes(role)) throw new Error("Invalid role.");
  if (!VALID_CATEGORIES.includes(category)) throw new Error("Invalid category.");

  const ref = await addDoc(collection(db, "scenarios"), {
    title,
    role,
    category,
    content: data.content || {},
    status: "pending_review",
    aiGenerated: Boolean(data.aiGenerated),
    isPhishing: data.isPhishing !== false,
    useInQuiz: Boolean(data.useInQuiz),
    difficulty: data.difficulty === "easy" || data.difficulty === "hard" ? data.difficulty : "medium",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { data: { ok: true, id: ref.id } };
}

export async function callGenerateAiDraft({ role, category, notes, emailType, useInQuiz, difficulty }) {
  if (!VALID_ROLES.includes(role) || !VALID_CATEGORIES.includes(category)) {
    throw new Error("Invalid role or category.");
  }
  const draft = await generateScenarioDraft({
    role,
    category,
    notes: notes || "",
    emailType: emailType === "legit" ? "legit" : "phishing",
    difficulty: difficulty || (useInQuiz ? "hard" : "medium"),
    useInQuiz: Boolean(useInQuiz)
  });
  return callCreateScenario({
    title: draft.title,
    role,
    category,
    content: draft.content,
    aiGenerated: true,
    isPhishing: draft.isPhishing,
    useInQuiz: Boolean(useInQuiz),
    difficulty: difficulty || (useInQuiz ? "hard" : "medium")
  });
}

export async function callApproveScenario({ scenarioId }) {
  const user = requireAdminUser();
  if (!scenarioId) throw new Error("scenarioId required.");
  await updateDoc(doc(db, "scenarios", scenarioId), {
    status: "live",
    approvedBy: user.uid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await publishQuizLive(scenarioId);
  return { data: { ok: true } };
}

export async function callDenyScenario({ scenarioId }) {
  const user = requireAdminUser();
  if (!scenarioId) throw new Error("scenarioId required.");
  await updateDoc(doc(db, "scenarios", scenarioId), {
    status: "denied",
    deniedBy: user.uid,
    deniedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await deleteDoc(doc(db, "quiz_live", scenarioId)).catch(() => {});
  return { data: { ok: true } };
}

export async function callRetireScenario({ scenarioId }) {
  requireAdminUser();
  if (!scenarioId) throw new Error("scenarioId required.");
  await updateDoc(doc(db, "scenarios", scenarioId), {
    status: "retired",
    updatedAt: serverTimestamp()
  });
  await deleteDoc(doc(db, "quiz_live", scenarioId)).catch(() => {});
  return { data: { ok: true } };
}

// Campaign actions still need Cloud Functions (Blaze plan).
export const callCreateCampaign   = httpsCallable(functions, "create_campaign");
export const callLaunchCampaign   = httpsCallable(functions, "launch_campaign");
export const callCompleteCampaign = httpsCallable(functions, "complete_campaign");
export const callGetCampaignLinks = httpsCallable(functions, "get_campaign_links");

// ---- Firestore reads (aggregate + metadata only; enforced by rules) ----
export async function fetchScenarios() {
  const snap = await getDocs(query(collection(db, "scenarios"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchCampaigns() {
  const snap = await getDocs(query(collection(db, "campaigns"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAggregates() {
  const snap = await getDocs(collection(db, "aggregates"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchDailyStats() {
  const snap = await getDocs(query(collection(db, "daily_stats"), orderBy("date", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { where };

function quizLivePayload(id, s) {
  const c = s.content || {};
  const debrief = c.debrief || {};
  return {
    isPhishing: s.isPhishing !== false,
    difficulty: s.difficulty || "medium",
    content: {
      senderName: c.senderName || "",
      senderEmail: c.senderEmail || "",
      subject: c.subject || "",
      body: c.body || "",
      ctaText: c.ctaText || ""
    },
    verdict: debrief.summary || "",
    indicators: c.indicators || []
  };
}

async function publishQuizLive(id) {
  const snap = await getDoc(doc(db, "scenarios", id));
  if (!snap.exists()) return;
  const s = snap.data();
  if (s.status === "live" && s.useInQuiz) {
    await setDoc(doc(db, "quiz_live", id), quizLivePayload(id, s));
  } else {
    await deleteDoc(doc(db, "quiz_live", id)).catch(() => {});
  }
}

export async function fetchQuizLive() {
  const snap = await getDocs(collection(db, "quiz_live"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

import { db, functions } from "./firebase-init.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ---- Callable Cloud Functions (admin only, verified server-side) ----
export const callCreateScenario   = httpsCallable(functions, "create_scenario");
export const callGenerateAiDraft  = httpsCallable(functions, "generate_ai_draft");
export const callApproveScenario  = httpsCallable(functions, "approve_scenario");
export const callRetireScenario   = httpsCallable(functions, "retire_scenario");
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

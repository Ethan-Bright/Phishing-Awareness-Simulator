import { db } from "./firebase-init.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Reads available to a participant. Firestore rules reject anything wider,
// so each query must carry the same filter the rule checks.

export async function fetchCompletedAggregates() {
  const snap = await getDocs(query(collection(db, "aggregates"), where("status", "==", "completed")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchDailyStats() {
  const snap = await getDocs(query(collection(db, "daily_stats"), orderBy("date", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchQuizPool() {
  const snap = await getDocs(collection(db, "quiz_live"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Matches quiz.js: a mixed batch needs this many approved emails of each kind.
export const QUIZ_BATCH = { phishing: 5, legit: 4 };

// Roles with fewer people than this are hidden from company stats so a small
// group's result can't be traced back to individuals.
export const MIN_COHORT = 5;

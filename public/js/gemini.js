/**
 * Shared Gemini (Firebase AI Logic) helper.
 *
 * Used by the quiz coach and by the admin draft generator. Nothing here
 * writes to Firestore. Chat history for the coach stays in memory only.
 */

import { firebaseConfig } from "./firebase-config.js";

export const GEMINI_SDK_VERSION = "12.17.1";
export const GEMINI_MODEL = "gemini-3.7-flash";

const apps = new Map();

export async function getGeminiModel(appName, options = {}) {
  const [{ initializeApp }, { getAI, getGenerativeModel, GoogleAIBackend }] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${GEMINI_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${GEMINI_SDK_VERSION}/firebase-ai.js`)
  ]);

  if (!apps.has(appName)) {
    apps.set(appName, initializeApp(firebaseConfig, appName));
  }
  const ai = getAI(apps.get(appName), { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || 1200,
      temperature: options.temperature ?? 0.7
    },
    ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {})
  });
}

export function parseJsonFromModel(text) {
  const trimmed = String(text || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(trimmed);
}

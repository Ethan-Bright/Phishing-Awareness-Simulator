/**
 * Shared Gemini (Firebase AI Logic) helper.
 *
 * Used by the quiz coach and by the admin draft generator. Nothing here
 * writes to Firestore. Chat history for the coach stays in memory only.
 */

import { firebaseConfig, APP_CHECK_SITE_KEY } from "./firebase-config.js";

export const GEMINI_SDK_VERSION = "12.17.1";
export const GEMINI_MODEL = "gemini-3.7-flash";

const apps = new Map();

export async function getGeminiModel(appName, options = {}) {
  const base = `https://www.gstatic.com/firebasejs/${GEMINI_SDK_VERSION}`;
  const [{ initializeApp }, { getAI, getGenerativeModel, GoogleAIBackend }, appCheckSdk] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-ai.js`),
    APP_CHECK_SITE_KEY ? import(`${base}/firebase-app-check.js`) : null
  ]);

  if (!apps.has(appName)) {
    const app = initializeApp(firebaseConfig, appName);
    if (appCheckSdk) {
      appCheckSdk.initializeAppCheck(app, {
        provider: new appCheckSdk.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
    apps.set(appName, app);
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

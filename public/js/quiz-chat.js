/**
 * Post-quiz AI coach, powered by Firebase AI Logic (Gemini Developer API).
 *
 * Privacy: nothing is persisted anywhere by this app. The chat history lives
 * in a ChatSession object in browser memory and is gone when the page closes.
 * Messages are processed by the Gemini API to generate replies, but this app
 * never writes them to Firestore, storage, or logs.
 */

import { getGeminiModel } from "./gemini.js";

function batchSummary(answers) {
  return answers.map((a, i) => {
    const c = a.item.content;
    return [
      `Email ${i + 1}: "${c.subject}" from ${c.senderName} <${c.senderEmail}>`,
      `  Actually: ${a.item.isPhishing ? "PHISHING" : "LEGITIMATE"}`,
      `  User answered: ${a.saidPhishing ? "report phishing" : "looks legit"} (${a.correct ? "correct" : "wrong"})`,
      `  Key signs: ${(a.item.indicators || []).join("; ")}`
    ].join("\n");
  }).join("\n\n");
}

/**
 * Create a coach for one completed batch. Returns { ask(text) -> Promise<string> }.
 * All state is in memory only.
 */
export function createCoach(answers) {
  const correct = answers.filter((a) => a.correct).length;
  const systemInstruction = `You are a friendly, encouraging phishing-awareness coach embedded in a training quiz called "Phish or Legit?" at Eduvos.

The user just finished a batch of ${answers.length} simulated emails and scored ${correct}/${answers.length}. Here is the full batch with their answers:

${batchSummary(answers)}

Rules:
- Only discuss this quiz, the emails in it, phishing, and email/online safety. If asked about anything else, politely steer back in one sentence.
- Keep answers short and plain: 2 to 6 sentences, no markdown headings or long lists.
- Refer to emails by their subject line so the user knows which one you mean.
- Never ask for, repeat, or encourage sharing of personal information, real passwords, or real account details.
- All emails in the quiz were simulations; none were real messages.
- Be honest about mistakes the user made, but constructive.`;

  let chatPromise = null;

  async function getChat() {
    if (!chatPromise) {
      chatPromise = getGeminiModel("quiz-ai", {
        systemInstruction,
        maxOutputTokens: 500,
        temperature: 0.6
      }).then((model) => model.startChat());
    }
    return chatPromise;
  }

  return {
    async ask(text) {
      const chat = await getChat();
      const result = await chat.sendMessage(text);
      return result.response.text();
    }
  };
}

/**
 * AI coach for the quiz results and the campaign debrief, powered by
 * Firebase AI Logic (Gemini Developer API).
 *
 * Privacy: nothing is persisted anywhere by this app. The chat history lives
 * in a ChatSession object in browser memory and is gone when the page closes.
 * Messages are processed by the Gemini API to generate replies, but this app
 * never writes them to Firestore, storage, or logs.
 */

import { getGeminiModel } from "./gemini.js";
import { escapeHtml } from "./utils.js";

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

  return coachFromInstruction(systemInstruction);
}

const OUTCOME_TEXT = {
  reported: "reported it as phishing (the right move)",
  submitted: "clicked the link and entered details on the fake login page",
  clicked: "clicked the link in the email"
};

/**
 * Create a coach for one campaign scenario debrief. `content` is the
 * /api/debrief payload content; `outcome` is the recorded response.
 */
export function createScenarioCoach(content, outcome) {
  const tips = content.debrief?.tips || [];
  const systemInstruction = `You are a friendly, encouraging phishing-awareness coach on the debrief page of an Eduvos phishing simulation.

The user just received this simulated phishing email:
  Subject: "${content.subject || "unknown"}"
  From: ${content.senderName || "unknown"} <${content.senderEmail || "unknown"}>
  Summary: ${content.debrief?.summary || "none"}
  Warning signs: ${(content.indicators || []).join("; ") || "none listed"}
${tips.length ? `  Safety tips: ${tips.join("; ")}` : ""}

The user ${OUTCOME_TEXT[outcome] || "responded to the email"}.

Rules:
- Only discuss this email, phishing, and email/online safety. If asked about anything else, politely steer back in one sentence.
- Keep answers short and plain: 2 to 6 sentences, no markdown headings or long lists.
- Never ask for, repeat, or encourage sharing of personal information, real passwords, or real account details.
- The email was a simulation. Nothing the user typed on the fake page was saved.
- Do not blame or shame the user. If they clicked or submitted, explain what to look for next time. If they reported it, reinforce what they did right.
- If the user is worried they entered a real password, tell them it was not stored, but changing it is a good habit if they reuse it elsewhere.`;

  return coachFromInstruction(systemInstruction);
}

function coachFromInstruction(systemInstruction) {
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

/** Markup for the coach card. Pair with mountChat(). */
export function chatCard({ intro, placeholder }) {
  return `
    <div class="card mt-4 p-6">
      <div class="mb-1 flex items-center gap-2">
        <svg viewBox="0 0 24 24" class="h-5 w-5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8L4 10.7l6.1 1.9L12 18.4l1.9-5.8L20 10.7l-6.1-1.9z"/></svg>
        <h2 class="text-sm font-semibold text-slate-800">Ask the AI coach</h2>
      </div>
      <p class="mb-3 text-xs text-slate-500">
        ${intro}
        Chats are not saved. Do not enter personal information.
      </p>
      <div id="chat-log" class="mb-3 max-h-80 space-y-3 overflow-y-auto"></div>
      <form id="chat-form" class="flex gap-2">
        <input id="chat-input" class="input flex-1" type="text" autocomplete="off" maxlength="500"
          placeholder="${escapeHtml(placeholder)}" />
        <button type="submit" id="chat-send" class="btn-primary px-4">Send</button>
      </form>
    </div>`;
}

export function mountChat(coach, { greeting, fallback }) {
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const send = document.getElementById("chat-send");

  function bubble(text, who) {
    const wrap = document.createElement("div");
    wrap.className = who === "user" ? "flex justify-end" : "flex justify-start";
    wrap.innerHTML = `
      <div class="${who === "user"
        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm text-white"
        : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm text-slate-700"}">${escapeHtml(text)}</div>`;
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  bubble(greeting, "coach");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = "";
    bubble(text, "user");
    const pending = bubble("Thinking...", "coach");
    send.disabled = true;
    try {
      const reply = await coach.ask(text);
      pending.remove();
      bubble(reply, "coach");
    } catch (err) {
      console.error(err);
      pending.remove();
      bubble(fallback, "coach");
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
}

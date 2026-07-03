/**
 * Aspen Spas — AI Proxy (Cloud Function, Node 20)
 * ------------------------------------------------
 * The Anthropic API key lives ONLY here (server-side). TECH-TICKETS sends the
 * request body; this function adds the key and forwards to Anthropic.
 * No more pasting keys per device, nothing sensitive in localStorage.
 *
 * DEPLOY (Nela — one time, ~10 min):
 *   1. cd ~/Documents && mkdir aspen-ai-proxy && cd aspen-ai-proxy
 *   2. firebase init functions        (pick the tech-tickets-a9485 project,
 *                                      JavaScript, no ESLint, install deps)
 *   3. Replace functions/index.js with THIS file.
 *   4. Set the secret (never in code):
 *        firebase functions:secrets:set ANTHROPIC_KEY
 *        (paste the sk-ant-... key when prompted)
 *   5. firebase deploy --only functions
 *   6. Copy the printed URL (…cloudfunctions.net/aiProxy) into
 *      TECH-TICKETS → Admin → AI card → "AI proxy URL" → Save proxy.
 *      Then you can Clear the per-device API keys — they're no longer used.
 *
 * SECURITY NOTES:
 *   - CORS restricted to the GitHub Pages origin below — edit if the app moves.
 *   - Model allow-list + max_tokens cap: the proxy can't be abused for other
 *     models or giant generations even if the URL leaks.
 *   - Basic per-instance rate limit (60 req/min) as a cost fuse.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_KEY");

// ── EDIT ME if the app's URL changes ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://aspenservices.github.io",
];
const ALLOWED_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5"];
const MAX_TOKENS_CAP = 1500;

// crude per-instance rate limiter (resets when the instance recycles)
let winStart = Date.now(), winCount = 0;
function rateLimited() {
  const now = Date.now();
  if (now - winStart > 60000) { winStart = now; winCount = 0; }
  return ++winCount > 60;
}

exports.aiProxy = onRequest(
  { secrets: [ANTHROPIC_KEY], region: "us-central1", cors: false, maxInstances: 2 },
  async (req, res) => {
    const origin = req.headers.origin || "";
    const okOrigin = ALLOWED_ORIGINS.includes(origin);
    if (okOrigin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (!okOrigin) return res.status(403).json({ error: { message: "Origin not allowed" } });
    if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });
    if (rateLimited()) return res.status(429).json({ error: { message: "Rate limit — try again in a minute" } });

    try {
      const body = req.body || {};
      if (!ALLOWED_MODELS.includes(body.model)) {
        return res.status(400).json({ error: { message: "Model not allowed: " + body.model } });
      }
      body.max_tokens = Math.min(Number(body.max_tokens) || 500, MAX_TOKENS_CAP);

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      console.error("[aiProxy]", e);
      return res.status(500).json({ error: { message: "Proxy error: " + e.message } });
    }
  }
);

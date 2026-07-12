// BlackBook Relay Server v3.1
// Uses native fetch (Node 18+) — no node-fetch dependency needed.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "BlackBook Relay Online", version: "3.1.0" });
});

app.post("/solve", async (req, res) => {
  // Optional auth check
  if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { image, model } = req.body;
  if (!image) {
    return res.status(400).json({ error: "No image provided" });
  }
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: "Server not configured with OPENAI_API_KEY" });
  }

  const systemPrompt = `You are BlackBook, a silent academic assistant analyzing a screenshot.

Find any academic question visible and answer it.

Response rules:
- Answer ONLY with the final answer. No preamble.
- Math: clean notation, ^ for powers, sqrt() for roots.
- Multiple choice: option letter + brief reason.
- Short-answer: ≤2 sentences.
- Multiple questions: number each on a new line.
- If no academic question: respond exactly — No question found
- Plain text only. No markdown.`;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: model || "gpt-5-mini",
        max_tokens: 600,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: "high",
                },
              },
              { type: "text", text: "What is the answer to the academic question(s) visible?" },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      console.error("OpenAI error:", openaiRes.status, errData);
      return res.status(openaiRes.status).json({
        error: errData?.error?.message || `OpenAI error ${openaiRes.status}`,
      });
    }

    const data = await openaiRes.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || "No question found";

    res.json({ answer });

  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BlackBook Relay running on port ${PORT}`);
});

module.exports = app;
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json({ limit: "6mb" }));
const PROVIDER = (process.env.PROVIDER || "anthropic").toLowerCase(); // "anthropic" | "openai"
const MODEL = process.env.MODEL || (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-sonnet-5-5");
const anthropic = PROVIDER === "anthropic" ? new Anthropic() : null; // ANTHROPIC_API_KEY
const openai = PROVIDER === "openai" ? new OpenAI() : null;         // OPENAI_API_KEY

const SYSTEM = `You help people in India reuse waste. Identify the object and reply with ONLY JSON:
{"item":"short name","material":"main material","reuse":"one creative upcycle idea","recycle":"how/where to recycle responsibly","sell":"resale idea or say not worth reselling","donate":"who would want it","search":{"recycle":"maps query","donate":"maps query"}}
Each text value under 20 words. If the image has no clear object, set "item" to "Unknown" and explain in "reuse".`;

// naive in-memory rate limit: 20 req/min per IP
const hits = new Map();
app.use("/api", (req, res, next) => {
  const k = req.ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 60000);
  if (arr.length >= 20) return res.status(429).json({ error: "Too many requests" });
  arr.push(now); hits.set(k, arr); next();
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { image, text } = req.body || {};
    if (!image && !text) return res.status(400).json({ error: "image or text required" });
    const prompt = text ? `Item: ${String(text).slice(0, 200)}` : "Identify this item.";
    if (image && !/^data:image\/\w+;base64,.+$/.test(image)) return res.status(400).json({ error: "bad image" });
    let raw;
    if (PROVIDER === "openai") {
      const content = [{ type: "text", text: prompt }];
      if (image) content.push({ type: "image_url", image_url: { url: image } });
      const r = await openai.chat.completions.create({
        model: MODEL, max_tokens: 500, response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content }],
      });
      raw = r.choices[0].message.content;
    } else {
      const content = [];
      if (image) {
        const [, mt, data] = /^data:(image\/\w+);base64,(.+)$/.exec(image);
        content.push({ type: "image", source: { type: "base64", media_type: mt, data } });
      }
      content.push({ type: "text", text: prompt });
      const r = await anthropic.messages.create({
        model: MODEL, max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content }],
      });
      raw = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    }
    res.json(JSON.parse(raw.replace(/```json|```/g, "").trim()));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// serve built client in production
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");
app.use(express.static(dist));
app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(process.env.PORT || 3001, () => console.log("API on", process.env.PORT || 3001));

import { Router } from "express";
import { runChat, type ChatMessage } from "../services/chat.ts";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  try {
    const messages: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (messages.length === 0) return res.status(400).json({ error: "No messages provided." });
    const result = await runChat(messages);
    res.json(result);
  } catch (err: any) {
    console.error("[chat] failed:", err);
    res.status(500).json({ error: err?.message ?? "Chat failed." });
  }
});

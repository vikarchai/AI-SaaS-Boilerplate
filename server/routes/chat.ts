import type { Express } from "express";
import { z } from "zod";
import { isLlmConfigured } from "../../config/env.js";
import { llmService } from "../services/llm.service.js";
import { asyncHandler } from "../middleware/error-handler.js";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1),
    }),
  ),
  provider: z.enum(["openai", "anthropic"]).optional(),
  model: z.string().optional(),
});

export function registerChatRoutes(app: Express): void {
  app.post(
    "/api/chat",
    asyncHandler(async (req, res) => {
      if (!isLlmConfigured()) {
        res.status(503).json({
          error: "LLM not configured",
          hint: "Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY in .env",
        });
        return;
      }
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      try {
        for await (const text of llmService.streamChat(parsed.data.messages, {
          provider: parsed.data.provider,
          model: parsed.data.model,
        })) {
          res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream failed";
        res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
      } finally {
        res.end();
      }
    }),
  );
}

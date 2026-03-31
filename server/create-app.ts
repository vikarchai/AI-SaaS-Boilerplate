import fs from "node:fs/promises";
import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import express, { type Express } from "express";
import {
  env,
  isAuthConfigured,
  isDatabaseConfigured,
  isLlmConfigured,
  isStripeConfigured,
} from "../config/env.js";
import { asyncHandler, errorHandler } from "./middleware/error-handler.js";
import { fetchStripePlanOffers } from "./services/stripe-plans.service.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerStripeWebhook } from "./api/webhooks/stripe.js";
import { getAuth } from "./services/auth.js";

export async function createApp(): Promise<Express> {
  const app = express();
  const isProd = env.NODE_ENV === "production";
  const apiOnly = isProd && !env.SERVE_CLIENT;

  const projectRoot = path.resolve(
    import.meta.dirname,
    isProd ? "../.." : "..",
  );
  const clientDir = path.join(projectRoot, "client");
  const distDir = path.join(clientDir, "dist");

  registerStripeWebhook(app);

  // Better Auth must run BEFORE `express.json()` — see
  // https://www.better-auth.com/docs/integrations/express
  app.all("/api/auth/*", (req, res) => {
    const auth = getAuth();
    if (!auth) {
      console.error(
        "[api/auth] Auth not configured: set DATABASE_URL, BETTER_AUTH_SECRET (16+ chars), BETTER_AUTH_URL in .env",
      );
      res.status(503).json({
        error: "Auth not configured",
        hint: "Set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL in .env",
      });
      return;
    }
    void toNodeHandler(auth as Parameters<typeof toNodeHandler>[0])(req, res);
  });

  app.use(express.json());

  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      let stripeSubscriptionDefaultPrice = false;
      if (isStripeConfigured()) {
        const offers = await fetchStripePlanOffers();
        stripeSubscriptionDefaultPrice = offers.length > 0;
      }
      res.json({
        ok: true,
        env: isProd ? "production" : "development",
        database: isDatabaseConfigured(),
        auth: isAuthConfigured(),
        googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        stripe: isStripeConfigured(),
        stripeSubscriptionDefaultPrice,
        llm: isLlmConfigured(),
      });
    }),
  );

  registerChatRoutes(app);
  registerAdminRoutes(app);
  registerBillingRoutes(app);

  if (apiOnly) {
    app.use((req, res) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(404).type("text/plain").send("Not found");
    });
  } else {
    await mountFrontend(app, { projectRoot, clientDir, distDir, isProd });
  }

  app.use(errorHandler);
  return app;
}

async function mountFrontend(
  app: Express,
  opts: { projectRoot: string; clientDir: string; distDir: string; isProd: boolean },
): Promise<void> {
  const { projectRoot, clientDir, distDir, isProd } = opts;
  if (isProd) {
    app.use(express.static(distDir, { index: false }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    try {
      const templatePath = path.join(clientDir, "index.html");
      let html = await fs.readFile(templatePath, "utf-8");
      html = await vite.transformIndexHtml(req.originalUrl, html);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

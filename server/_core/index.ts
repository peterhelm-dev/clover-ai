import "dotenv/config";
import express from "express";
import { initSentry, sentryErrorHandler } from "./sentry";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { rateLimit } from "express-rate-limit";
import { registerStorageProxy } from "./storageProxy";
import { registerStripeWebhook } from "./stripeWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
/** General API: 300 requests per minute per IP */
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: () => process.env.NODE_ENV === "test",
});

/** AI endpoints (nutrition, healthInsights): 30 requests per minute per IP */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait a moment before trying again." },
  skip: () => process.env.NODE_ENV === "test",
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize Sentry before anything else so all errors are captured
  initSentry();

  const app = express();
  // Railway (and most PaaS hosts) put the app behind a reverse proxy that
  // sets X-Forwarded-For. Without this, express-rate-limit refuses to trust
  // that header (correctly, as a spoofing precaution) and throws on every
  // request instead of rate-limiting by real client IP.
  app.set("trust proxy", 1);
  const server = createServer(app);

  // Legacy domains: 301-redirect any visitor arriving via an old hostname
  // straight to the canonical one, preserving path/query. Needed because
  // clover-farm-production.up.railway.app was already shared (e.g. on a
  // resume) before the app moved to clover-ai.up.railway.app — this must
  // run before literally anything else so it also covers Stripe webhooks,
  // the API, and static assets, not just page loads.
  const LEGACY_HOSTS = ["clover-farm-production.up.railway.app"];
  const CANONICAL_HOST = "clover-ai.up.railway.app";
  app.use((req, res, next) => {
    if (LEGACY_HOSTS.includes(req.hostname)) {
      res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
      return;
    }
    next();
  });

  // Register Stripe webhook BEFORE express.json() middleware
  registerStripeWebhook(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);

  // Rate limiting — AI routes first (more restrictive), then general
  app.use("/api/trpc/nutrition", aiLimiter);
  app.use("/api/trpc/healthInsights", aiLimiter);
  app.use("/api/trpc", generalApiLimiter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production (Railway, etc.) the platform assigns PORT and routes to it
  // directly — binding to anything else breaks the proxy. Only auto-pick a
  // free port for local dev convenience.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(err => {
  console.error(err);
  process.exit(1);
});

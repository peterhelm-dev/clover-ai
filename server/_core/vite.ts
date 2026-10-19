import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { applyDocumentUrls } from "../public-url";

export async function setupVite(app: Express, server: Server, appUrl: string) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const html = applyDocumentUrls(page, appUrl, url);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, appUrl: string) {
  // The bundled server lives in dist/index.js, so the client build is ./public.
  // `tsx server/_core/index.ts` is two levels up from that. Pick whichever exists
  // so a development NODE_ENV on Railway still serves the production files.
  const candidates = [
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "../..", "dist", "public"),
  ];
  const distPath = candidates.find(dir => fs.existsSync(dir)) ?? candidates[0];
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  const indexTemplate = fs.existsSync(indexPath)
    ? fs.readFileSync(indexPath, "utf-8")
    : null;

  // index: false so "/" is rewritten below with the canonical URL instead of
  // the on-disk shell, which only knows the homepage.
  app.use(express.static(distPath, { index: false }));

  app.use("*", (req, res) => {
    if (!indexTemplate) {
      res.status(500).send("Client build is missing.");
      return;
    }
    const html = applyDocumentUrls(indexTemplate, appUrl, req.originalUrl);
    res
      .status(200)
      .set({ "Content-Type": "text/html; charset=utf-8" })
      .send(html);
  });
}

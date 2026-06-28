import dotenv from "dotenv";
// override:true makes the .env file authoritative over any stale/placeholder
// OPENAI_API_KEY left in the shell environment.
dotenv.config({ override: true });
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initSchema } from "./db/db.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { observationsRouter } from "./routes/observations.ts";
import { reportsRouter } from "./routes/reports.ts";
import { projectsRouter } from "./routes/projects.ts";
import { chatRouter } from "./routes/chat.ts";
import { UPLOAD_DIR } from "./utils/files.ts";
import { getAiProvider } from "./services/ai/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

initSchema();
getAiProvider(); // logs which provider is active at startup

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, provider: getAiProvider().name }));
app.use("/api/dashboard", dashboardRouter);
app.use("/api/observations", observationsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/chat", chatRouter);
app.use("/uploads", express.static(UPLOAD_DIR));

// Serve the built frontend in production (web/dist), if present.
const webDist = join(__dirname, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(join(webDist, "index.html")));
}

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`HSE pilot server listening on http://localhost:${PORT}`);
});

import express from "express";
import "./common/middleware/async-errors.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./routes/admin.js";
import collegeRoutes from "./modules/colleges/college.routes.js";
import internRoutes from "./routes/intern.js";
import collegeCoordinatorRoutes from "./routes/collegeCoordinator.js";
import mentorRoutes from "./routes/mentor.js";
import notificationRoutes from "./routes/notifications.js";
import publicRoutes from "./routes/public.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { q } from "./common/database/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("combined"));
  // Only credential attempts count. Reads such as /auth/me run on every page view, and a whole
  // college lab can share one IP address.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT || 300),
    skip: (req) => req.method === "GET",
  });
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/admin", collegeRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/college-coordinator", collegeCoordinatorRoutes);
  app.use("/api/intern", internRoutes);
  app.use("/api/mentor", mentorRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use(
    "/api/public",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }),
    publicRoutes,
  );
  app.get("/api/health", async (_req, res) => {
    const checkedAt = new Date().toISOString();
    try {
      await q("SELECT 1");
      res.json({ ok: true, database: "up", time: checkedAt });
    } catch {
      res.status(503).json({ ok: false, database: "down", time: checkedAt });
    }
  });
  app.use(errorHandler);
  return app;
}

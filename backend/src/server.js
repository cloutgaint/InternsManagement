import "./common/config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./routes/admin.js";
import internRoutes from "./routes/intern.js";
import mentorRoutes from "./routes/mentor.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { startTaskReleaseScheduler } from "./services/taskReleaseScheduler.js";
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));
app.use(
  "/api/auth",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }),
  authRoutes,
);
app.use("/api/admin", adminRoutes);
app.use("/api/intern", internRoutes);
app.use("/api/mentor", mentorRoutes);
app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);
app.use(errorHandler);
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`GAINT Intern API on ${port}`);
  startTaskReleaseScheduler();
});

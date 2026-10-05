import { Router } from "express";
import { auth } from "../../common/security/auth.middleware.js";
import * as controller from "./auth.controller.js";
import { registrationUpload } from "./auth.upload.js";

const router = Router();
router.get("/colleges", controller.listColleges);
router.post(
  "/register",
  registrationUpload.fields([
    { name: "proofFiles", maxCount: 2 },
    { name: "photo", maxCount: 1 },
  ]),
  controller.register,
);
router.post("/login", controller.login);
router.post("/mfa/setup", controller.setupMfa);
router.post("/mfa/verify", controller.verifyMfa);
router.get("/me", auth, controller.me);

export default router;

import { Router } from "express";
import { auth, permit } from "../../common/security/auth.middleware.js";
import * as controller from "./college.controller.js";

const router = Router();
router.use(auth, permit("ADMIN", "SUPER_ADMIN"));
router.get("/colleges", controller.list);
router.post("/colleges", controller.create);
router.patch("/colleges/:id", controller.update);

export default router;

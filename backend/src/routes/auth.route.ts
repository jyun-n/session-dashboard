import { Router } from "express";
import { loginHandler } from "../controllers/auth.controller.js";
import { authLoginLimiter } from "../middleware/rateLimiter.js";

export const authRouter = Router();

authRouter.post("/login", authLoginLimiter, loginHandler);
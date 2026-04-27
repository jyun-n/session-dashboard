import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  getAccountsHandler,
  createAccountHandler,
  updateAccountHandler,
  resetPasswordHandler,
  deleteAccountHandler,
  getAllLoginLogsHandler,
} from "../controllers/accounts.controller.js";

export const accountsRouter = Router();

// 모든 accounts API는 ADMIN만 접근 가능
accountsRouter.use(authenticate, requireAdmin);

accountsRouter.get("/", getAccountsHandler);
accountsRouter.get("/logs", getAllLoginLogsHandler);
accountsRouter.post("/", createAccountHandler);
accountsRouter.patch("/:id/password", resetPasswordHandler);
accountsRouter.patch("/:id", updateAccountHandler);
accountsRouter.delete("/:id", deleteAccountHandler);
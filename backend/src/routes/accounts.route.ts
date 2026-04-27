import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  getAccountsHandler,
  createAccountHandler,
  resetPasswordHandler,
  deleteAccountHandler,
  updateAccountHandler,
  getAllLoginLogsHandler,
} from "../controllers/accounts.controller.js";

export const accountsRouter = Router();

accountsRouter.use(authenticate, requireAdmin);

accountsRouter.get("/logs/all", getAllLoginLogsHandler);
accountsRouter.get("/", getAccountsHandler);
accountsRouter.post("/", createAccountHandler);
accountsRouter.patch("/:id", updateAccountHandler);
accountsRouter.patch("/:id/password", resetPasswordHandler);
accountsRouter.delete("/:id", deleteAccountHandler);
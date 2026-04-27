import { Router } from "express";
import { healthRouter }  from "./health.route.js";
import { authRouter }    from "./auth.route.js";
import { accountsRouter } from "./accounts.route.js";
import { collectRouter } from "./collect.route.js";
import { dashboardRouter } from "./dashboard.route.js";

export const apiRouter = Router();

apiRouter.use("/health",   healthRouter);
apiRouter.use("/auth",     authRouter);
apiRouter.use("/accounts", accountsRouter);
apiRouter.use("/collect",  collectRouter);
apiRouter.use("/dashboard", dashboardRouter);
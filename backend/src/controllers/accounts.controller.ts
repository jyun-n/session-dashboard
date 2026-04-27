import type { RequestHandler } from "express";
import { z } from "zod";
import * as accountsService from "../services/accounts.service.js";

export const getAccountsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const accounts = await accountsService.getAccounts();
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
};

const createSchema = z.object({
  empNo:    z.string().regex(/^\d+$/, "사번은 숫자만 입력해주세요."),
  dept:     z.string().min(1, "소속을 입력해주세요."),
  position: z.string().min(1, "직책을 입력해주세요."),
  name:     z.string().min(1, "성명을 입력해주세요."),
  loginId:  z.string().min(1, "아이디를 입력해주세요."),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
  role:     z.enum(["ADMIN", "USER"]).default("USER"),
});

export const createAccountHandler: RequestHandler = async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const account = await accountsService.createAccount(data);
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
};

const updateSchema = z.object({
  dept:     z.string().min(1, "소속을 입력해주세요."),
  position: z.string().min(1, "직책을 입력해주세요."),
});

export const updateAccountHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);
    const result = await accountsService.updateAccount(id, data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
});

export const resetPasswordHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const result = await accountsService.resetPassword(id, newPassword);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export const deleteAccountHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = deleteSchema.parse(req.body);
    const result = await accountsService.deleteAccount(id, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getAllLoginLogsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const logs = await accountsService.getAllLoginLogs();
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};

import { initialMockAccounts } from "./mockData";

const STORAGE_KEY = "mockAccounts";
const DELETE_SECRET = "022610";

function initializeAccounts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMockAccounts));
  }
}

function readAccounts() {
  initializeAccounts();
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function writeAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export async function getAccounts() {
  return readAccounts();
}

export async function resetAccountPassword(accountId, newPassword) {
  const accounts = readAccounts();
  const updatedAccounts = accounts.map((account) =>
    account.id === accountId
      ? { ...account, password: newPassword }
      : account
  );

  writeAccounts(updatedAccounts);

  return {
    success: true,
    message: "비밀번호가 변경되었습니다.",
  };
}

export async function deleteAccount(accountId, secret) {
  if (secret !== DELETE_SECRET) {
    return {
      success: false,
      message: "탈퇴 비밀번호가 올바르지 않습니다.",
    };
  }

  const accounts = readAccounts();
  const updatedAccounts = accounts.filter((account) => account.id !== accountId);

  writeAccounts(updatedAccounts);

  return {
    success: true,
    message: "계정이 탈퇴 처리되었습니다.",
  };
}

export async function createAccount(newAccount) {
  const accounts = readAccounts();

  const existsId = accounts.some((account) => account.id === newAccount.id);
  if (existsId) {
    return {
      success: false,
      message: "이미 존재하는 아이디입니다.",
    };
  }

  const existsEmpNo = accounts.some(
    (account) => account.empNo === newAccount.empNo
  );
  if (existsEmpNo) {
    return {
      success: false,
      message: "이미 존재하는 사번입니다.",
    };
  }

  const nextNo =
    accounts.length > 0 ? Math.max(...accounts.map((a) => a.no)) + 1 : 1;

  const createdAccount = {
    ...newAccount,
    no: nextNo,
  };

  const updatedAccounts = [...accounts, createdAccount];
  writeAccounts(updatedAccounts);

  return {
    success: true,
    message: "계정이 생성되었습니다.",
    account: createdAccount,
  };
}
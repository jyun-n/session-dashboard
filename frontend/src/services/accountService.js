const API_URL = "http://localhost:4000/api";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getAccounts() {
  const res = await fetch(`${API_URL}/accounts`, {
    headers: getHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    return [];
  }

  return data.data;
}

export async function createAccount(newAccount) {
  const res = await fetch(`${API_URL}/accounts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      empNo: newAccount.empNo,
      dept: newAccount.dept,
      position: newAccount.position,
      name: newAccount.name,
      loginId: newAccount.id,       // 프론트의 id → loginId
      password: newAccount.password,
      role: newAccount.role?.toUpperCase() ?? "USER",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "계정 생성에 실패했습니다.",
    };
  }

  return {
    success: true,
    message: "계정이 생성되었습니다.",
    account: data.data,
  };
}

export async function updateAccount(accountId, { dept, position }) {
  const res = await fetch(`${API_URL}/accounts/${accountId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ dept, position }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "회원 정보 수정에 실패했습니다.",
    };
  }

  return {
    success: true,
    message: "회원 정보가 수정되었습니다.",
    account: data.data,
  };
}

export async function resetAccountPassword(accountId, newPassword) {
  const res = await fetch(`${API_URL}/accounts/${accountId}/password`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ newPassword }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "비밀번호 변경에 실패했습니다.",
    };
  }

  return {
    success: true,
    message: "비밀번호가 변경되었습니다.",
  };
}

export async function getAllLoginLogs() {
  const res = await fetch(`${API_URL}/accounts/logs`, {
    headers: getHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "로그를 불러오지 못했습니다.",
    };
  }

  return {
    success: true,
    logs: data.data,
  };
}

export async function deleteAccount(accountId, secret) {
  const res = await fetch(`${API_URL}/accounts/${accountId}`, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ password: secret }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "계정 탈퇴에 실패했습니다.",
    };
  }

  return {
    success: true,
    message: "계정이 탈퇴 처리되었습니다.",
  };
}
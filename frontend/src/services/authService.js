const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function login({ userId, password }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: userId, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: data.message || "아이디 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  return {
    success: true,
    token: data.data.token,
    user: {
      id: data.data.account.id,
      role: data.data.account.role.toLowerCase(), // ADMIN → admin
      name: data.data.account.name,
      dept: data.data.account.dept,
      position: data.data.account.position,
    },
  };
}

export function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("auth", JSON.stringify(user));
}

export function getAuth() {
  const user = localStorage.getItem("auth");
  return user ? JSON.parse(user) : null;
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("auth");
}
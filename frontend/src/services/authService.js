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
      id:       data.data.account.id,
      role:     data.data.account.role.toLowerCase(),
      name:     data.data.account.name,
      dept:     data.data.account.dept,
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

// JWT의 payload(exp)를 디코드해서 만료 여부 확인.
// 서명 검증은 하지 않음 — 서버 인증의 사전 차단용일 뿐, 실제 검증은 백엔드가 한다.
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

// 401 응답 시 자동 로그아웃 후 로그인 페이지로 이동
export function handleUnauthorized() {
  clearAuth();
  window.location.href = "/login";
}
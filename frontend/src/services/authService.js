export async function login({ userId, password }) {
  if (userId === "admin" && password === "admintest") {
    return {
      success: true,
      user: {
        id: "admin",
        role: "admin",
        name: "관리자",
      },
    };
  }

  if (userId === "jyun" && password === "jyuntest") {
    return {
      success: true,
      user: {
        id: "jyun",
        role: "user",
        name: "이지윤",
      },
    };
  }

  return {
    success: false,
    message: "아이디 또는 비밀번호가 올바르지 않습니다.",
  };
}

export function saveAuth(user) {
  localStorage.setItem("mockAuth", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("mockAuth");
}
import { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import { getToken, isTokenValid, handleUnauthorized } from "./services/authService";

const TOKEN_CHECK_INTERVAL_MS = 10_000;

export default function App() {
  useEffect(() => {
    // 토큰 만료 시각이 지나면 사용자 활동 여부와 무관하게 자동 로그아웃.
    const id = setInterval(() => {
      if (getToken() && !isTokenValid()) {
        handleUnauthorized();
      }
    }, TOKEN_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return <AppRouter />;
}

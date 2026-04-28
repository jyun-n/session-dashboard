import { Navigate } from "react-router-dom";
import { isTokenValid, clearAuth, getAuth } from "../services/authService";

export default function AdminRoute({ children }) {
  if (!isTokenValid()) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  const auth = getAuth();
  if (auth?.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

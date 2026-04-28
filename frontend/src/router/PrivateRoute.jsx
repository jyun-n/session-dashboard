import { Navigate } from "react-router-dom";
import { isTokenValid, clearAuth } from "../services/authService";

export default function PrivateRoute({ children }) {
  if (!isTokenValid()) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return children;
}

import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const auth = JSON.parse(localStorage.getItem("auth") || "null");

  if (!auth || auth.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
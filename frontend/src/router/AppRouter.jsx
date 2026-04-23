import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import AdminAccountPage from "../pages/AdminAccountPage";
import UserDashboardPage from "../pages/UserDashboardPage";
import AdminRoute from "./AdminRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin/accounts"
        element={
          <AdminRoute>
            <AdminAccountPage />
          </AdminRoute>
        }
      />
      <Route path="/dashboard" element={<UserDashboardPage />} />
    </Routes>
  );
}
import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<DashboardPage />} />
      <Route path="/app/documents/:id" element={<WorkspacePage />} />
      <Route path="/app/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { WorkspacePage } from "@/pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<DashboardPage />} />
      <Route path="/app/documents/:id" element={<WorkspacePage />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

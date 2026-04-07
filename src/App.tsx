import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ResumesPage } from "@/pages/ResumesPage";
import { NewResumePage } from "@/pages/NewResumePage";
import { ResumeViewerPage } from "@/pages/ResumeViewerPage";
import { ExperiencePage } from "@/pages/career/ExperiencePage";
import { EducationPage } from "@/pages/career/EducationPage";
import { SkillsPage } from "@/pages/career/SkillsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { PrintPage } from "@/pages/PrintPage";

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected dashboard routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/resumes" element={<ResumesPage />} />
            <Route path="/resumes/new" element={<NewResumePage />} />
            <Route path="/resumes/:resumeId" element={<ResumeViewerPage />} />
            <Route path="/career/experience" element={<ExperiencePage />} />
            <Route path="/career/education" element={<EducationPage />} />
            <Route path="/career/skills" element={<SkillsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Print route (no sidebar) */}
          <Route
            path="/resumes/:resumeId/print"
            element={
              <ProtectedRoute>
                <PrintPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

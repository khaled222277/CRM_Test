import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute, PublicOnlyRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { ContactDetailPage } from "@/pages/ContactDetailPage";
import { ContactFormPage } from "@/pages/ContactFormPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DealDetailPage } from "@/pages/DealDetailPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TasksPage } from "@/pages/TasksPage";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />

        <Route path="/contacts" element={<ContactsPage />} />
        {/* Declared before /contacts/:id so "new" is not read as an id. */}
        <Route path="/contacts/new" element={<ContactFormPage mode="create" />} />
        <Route path="/contacts/:id" element={<ContactDetailPage />} />
        <Route path="/contacts/:id/edit" element={<ContactFormPage mode="edit" />} />

        <Route path="/tasks" element={<TasksPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

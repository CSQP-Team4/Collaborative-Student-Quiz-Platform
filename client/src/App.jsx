import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import { ROLES, homeFor } from './auth/roles';
import HealthPage from './pages/HealthPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import QuizAttemptPage from './pages/QuizAttemptPage';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import InstructorDashboard from './pages/dashboards/InstructorDashboard';
import StudentDashboard from './pages/dashboards/StudentDashboard';
import StudentProgressPage from './pages/StudentProgressPage';
import ClassAnalyticsPage from './pages/ClassAnalyticsPage';
import './App.css';

// "/" sends logged-in users to their role's dashboard, everyone else to login.
function HomeRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') {
    return (
      <p className="page-status" role="status">
        Loading…
      </p>
    );
  }
  return <Navigate to={homeFor(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/health" element={<HealthPage />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/progress"
        element={
          <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
            <StudentProgressPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz/:quizId"
        element={
          <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.ADMIN]}>
            <QuizAttemptPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor"
        element={
          <ProtectedRoute allowedRoles={[ROLES.INSTRUCTOR]}>
            <InstructorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/analytics"
        element={
          <ProtectedRoute allowedRoles={[ROLES.INSTRUCTOR, ROLES.ADMIN]}>
            <ClassAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

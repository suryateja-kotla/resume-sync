import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login          from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import ChangePassword from './pages/ChangePassword'
import HRDashboard    from './pages/HRDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — no auth required */}
          <Route path="/login"          element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />

          {/* Semi-protected — must be logged in but can have mustChangePassword=true */}
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Fully protected routes */}
          <Route
            path="/hr-dashboard"
            element={
              <ProtectedRoute requiredRole="HR">
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoute requiredRole="EMPLOYEE">
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

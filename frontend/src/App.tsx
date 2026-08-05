import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute, { homeFor } from './components/ProtectedRoute'
import Login from './pages/Login'
import HRDashboard from './pages/HRDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import HrResumeView from './pages/HrResumeView'

/** Sends each persona to their own dashboard. Used for "/" and for any
 *  unmatched path, so nobody lands on a route their role cannot render. */
function RoleHome() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(user.role)} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* The only public route. Password reset / change pages are gone —
              credentials are managed entirely by Entra ID now. */}
          <Route path="/login" element={<Login />} />

          {/* The OIDC callback redirects here after a successful sign-in. */}
          <Route path="/" element={<RoleHome />} />

          <Route
            path="/hr-dashboard"
            element={
              <ProtectedRoute requires="HR">
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          {/* Target of the Excel export's "Open Resume" hyperlinks — renders
              the docx in-browser instead of forcing a file download. */}
          <Route
            path="/hr/resume/:employeeId"
            element={
              <ProtectedRoute requires="HR">
                <HrResumeView />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<RoleHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

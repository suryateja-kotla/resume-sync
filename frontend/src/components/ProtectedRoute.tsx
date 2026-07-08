import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: React.ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user } = useAuth()

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Logged in but must change password — only allow the change-password page
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  // Logged in but wrong role for this route
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'HR' ? '/hr-dashboard' : '/employee-dashboard'} replace />
  }

  return <>{children}</>
}

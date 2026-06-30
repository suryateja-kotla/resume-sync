import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: React.ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'HR' ? '/hr-dashboard' : '/employee-dashboard'} replace />
  }

  return <>{children}</>
}

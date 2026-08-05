import { Navigate } from 'react-router-dom'
import { useAuth, Role } from '../context/AuthContext'

interface Props {
  children: React.ReactNode
  /** Minimum persona required. Omit for any signed-in user. */
  requires?: 'HR' | 'ADMIN'
}

/** Landing page for a role — used for redirects so nobody is ever sent to a
 *  route they cannot see, which would bounce them straight back. */
export function homeFor(role: Role): string {
  return role === 'EMPLOYEE' ? '/employee-dashboard' : '/hr-dashboard'
}

export default function ProtectedRoute({ children, requires }: Props) {
  const { user, loading, isAdmin, isHR } = useAuth()

  // Must wait for the initial /auth/me to settle. Without this the first
  // render sees user === null and redirects a perfectly valid session to
  // /login before the request has even returned.
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#64748b', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // This is a UX guard, not a security control — it decides what to render,
  // not what the caller may fetch. Every route behind it is independently
  // enforced by the backend (get_current_user / require_hr / require_admin),
  // so bypassing this in devtools reveals an empty page, not data.
  if (requires === 'ADMIN' && !isAdmin) return <Navigate to={homeFor(user.role)} replace />
  if (requires === 'HR' && !isHR) return <Navigate to={homeFor(user.role)} replace />

  return <>{children}</>
}

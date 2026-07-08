import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { HRMetrics } from '../../types/hr'

export default function MetricsSection() {
  const [metrics, setMetrics] = useState<HRMetrics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/hr/metrics')
      if (data.status === 'success') setMetrics(data.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  if (loading || !metrics) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading metrics...</p>
        </div>
      </div>
    )
  }

  const activityMax = Math.max(
    metrics.activity.uploads_last_7d,
    metrics.activity.updates_last_7d,
    metrics.activity.invites_last_7d,
    1,
  )

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Employees', value: metrics.overview.total_employees, sub: 'in system',
              bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700',
              icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4',
            },
            {
              label: 'Resumes Uploaded', value: metrics.overview.total_with_resume,
              sub: `${metrics.overview.coverage_pct}% coverage`,
              bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700',
              icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            },
            {
              label: 'Pending Resumes', value: metrics.overview.pending_resumes, sub: 'no resume yet',
              bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700',
              icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
            },
            {
              label: 'Uploads (30 days)', value: metrics.activity.uploads_last_30d,
              sub: `${metrics.activity.uploads_last_7d} this week`,
              bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700',
              icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
            },
          ].map(card => (
            <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-5`}>
              <div className={`w-9 h-9 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center mb-3`}>
                <svg className={`w-5 h-5 ${card.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <p className={`text-3xl font-bold ${card.text}`}>{card.value}</p>
              <p className="text-gray-500 text-xs font-medium mt-0.5">{card.label}</p>
              <p className="text-gray-400 text-xs mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Coverage ring + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex items-center gap-6">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke="#2563eb" strokeWidth="3"
                  strokeDasharray={`${metrics.overview.coverage_pct} ${100 - metrics.overview.coverage_pct}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{metrics.overview.coverage_pct}%</span>
                <span className="text-gray-400 text-xs">covered</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Resume Coverage</h3>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Uploaded</span>
                  <span className="font-medium text-green-600">{metrics.overview.total_with_resume}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${metrics.overview.coverage_pct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Pending</span>
                  <span className="font-medium text-amber-600">{metrics.overview.pending_resumes}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${100 - metrics.overview.coverage_pct}%` }} />
                </div>
              </div>
              <p className="text-gray-400 text-xs pt-1">
                {metrics.overview.total_with_resume} of {metrics.overview.total_employees} employees
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Activity — Last 7 Days</h3>
            <div className="space-y-4">
              {[
                { label: 'Resume Uploads',  value: metrics.activity.uploads_last_7d,  color: 'bg-blue-500' },
                { label: 'Profile Updates', value: metrics.activity.updates_last_7d,  color: 'bg-violet-500' },
                { label: 'Invites Sent',    value: metrics.activity.invites_last_7d,  color: 'bg-teal-500' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{row.label}</span>
                    <span className="font-semibold text-gray-700">{row.value}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all duration-700`}
                      style={{ width: `${(row.value / activityMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skill distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-5">Skill Distribution</h3>
          {metrics.skill_distribution.length === 0 ? (
            <p className="text-gray-400 text-sm">No skill data available yet.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const maxCount = Math.max(...metrics.skill_distribution.map(s => s.count), 1)
                return metrics.skill_distribution.map(s => (
                  <div key={s.skill} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 font-medium w-32 truncate flex-shrink-0">{s.skill}</span>
                    <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg transition-all duration-700 flex items-center"
                        style={{ width: `${Math.max((s.count / maxCount) * 100, 8)}%` }}
                      >
                        <span className="text-white text-xs font-semibold pl-2.5 whitespace-nowrap">{s.count}</span>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* Recent activity feed */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Recent Activity</h3>
          {metrics.recent_feed.length === 0 ? (
            <p className="text-gray-400 text-sm">No recent activity.</p>
          ) : (
            <div className="space-y-1">
              {metrics.recent_feed.map((ev, i) => {
                const eventMeta: Record<string, { label: string; dot: string }> = {
                  RESUME_UPLOAD:         { label: 'uploaded a resume',     dot: 'bg-blue-500' },
                  PROFILE_UPDATED:       { label: 'updated their profile', dot: 'bg-violet-500' },
                  SKILL_PROFILE_UPDATED: { label: 'updated skill profile', dot: 'bg-teal-500' },
                  INVITE_SENT:           { label: 'invite sent',           dot: 'bg-amber-500' },
                }
                const meta = eventMeta[ev.event_type] ?? { label: ev.event_type, dot: 'bg-gray-400' }
                const time = ev.timestamp
                  ? new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : ''
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <span className="text-gray-700 text-sm font-medium truncate">{ev.employee_id || ev.actor}</span>
                    <span className="text-gray-400 text-sm">{meta.label}</span>
                    <span className="ml-auto text-gray-400 text-xs whitespace-nowrap flex-shrink-0">{time}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

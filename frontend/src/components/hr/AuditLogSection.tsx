import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { AuditEvent, AUDIT_EVENT_TYPES, AUDIT_EVENT_LABELS, AUDIT_EVENT_COLORS } from '../../types/hr'

const PAGE_SIZE = 25

export default function AuditLogSection() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLog(1)
  }, [])

  const fetchAuditLog = async (
    p: number,
    overrides?: { eventType?: string; dateFrom?: string; dateTo?: string }
  ) => {
    const eventType = overrides?.eventType ?? eventTypeFilter
    const from = overrides?.dateFrom ?? dateFrom
    const to = overrides?.dateTo ?? dateTo

    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: p, page_size: PAGE_SIZE }
      if (eventType) params.event_type = eventType
      if (from) params.date_from = new Date(from).toISOString()
      if (to) params.date_to = new Date(to + 'T23:59:59').toISOString()
      const { data } = await api.get('/hr/audit-log', { params })
      if (data.status === 'success') {
        setEvents(data.events)
        setTotal(data.total)
        setPage(p)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const applyFilters = () => fetchAuditLog(1)

  const clearFilters = () => {
    setEventTypeFilter('')
    setDateFrom('')
    setDateTo('')
    fetchAuditLog(1, { eventType: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Filter bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={e => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
            >
              <option value="">All Events</option>
              {AUDIT_EVENT_TYPES.map(t => (
                <option key={t} value={t}>{AUDIT_EVENT_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
            />
          </div>
          <button onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            Apply
          </button>
          <button onClick={clearFilters} className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition">
            Clear
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No audit events found</h3>
            <p className="text-gray-400 text-sm">Events will appear here as employees and HR use the system.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm">{total} total event{total !== 1 ? 's' : ''}</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {events.map(ev => (
                <div key={ev._id}>
                  <button
                    onClick={() => setExpandedId(expandedId === ev._id ? null : ev._id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50/60 transition"
                  >
                    <span className="text-gray-400 text-xs whitespace-nowrap w-40 flex-shrink-0">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${AUDIT_EVENT_COLORS[ev.event_type] || 'bg-gray-100 text-gray-700'}`}>
                      {AUDIT_EVENT_LABELS[ev.event_type] || ev.event_type}
                    </span>
                    <span className="text-gray-700 text-sm truncate flex-shrink-0 w-32">{ev.actor}</span>
                    {ev.employee_id && ev.employee_id !== ev.actor && (
                      <span className="text-gray-400 text-xs truncate">→ {ev.employee_id}</span>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${expandedId === ev._id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedId === ev._id && (
                    <div className="px-5 pb-4 pt-1 bg-gray-50/40">
                      <pre className="text-xs text-gray-600 bg-white border border-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => fetchAuditLog(page - 1)}
                  disabled={page <= 1}
                  className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 px-3 py-1.5 rounded-lg transition"
                >
                  ← Previous
                </button>
                <span className="text-xs text-gray-400">
                  Page {page} of {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => fetchAuditLog(page + 1)}
                  disabled={page >= Math.ceil(total / PAGE_SIZE)}
                  className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 px-3 py-1.5 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

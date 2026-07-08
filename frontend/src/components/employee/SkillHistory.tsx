import { SectionCard, SectionHead } from './ui'
import { SkillHistoryEntry } from '../../types/employee'

interface Props {
  history: SkillHistoryEntry[]
}

export default function SkillHistory({ history }: Props) {
  if (!history || history.length === 0) return null

  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        title="Skill History"
      />
      <div className="px-5 py-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <th className="pb-2 text-left">Skill</th>
              <th className="pb-2 text-left">Exp</th>
              <th className="pb-2 text-left">Designation</th>
              <th className="pb-2 text-left">From</th>
              <th className="pb-2 text-left">To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {history.map((h, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2.5 font-semibold text-gray-800 text-xs">{h.skill}</td>
                <td className="py-2.5 text-gray-500 text-xs">{h.skill_exp} yrs</td>
                <td className="py-2.5 text-gray-500 text-xs">{h.designation || '—'}</td>
                <td className="py-2.5 text-gray-500 text-xs tabular-nums">
                  {h.from ? new Date(h.from).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="py-2.5 text-gray-500 text-xs tabular-nums">
                  {h.to ? new Date(h.to).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

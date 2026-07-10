import { SiDocker, SiSelenium, SiApachespark, SiPandas, SiFigma, SiTensorflow, SiReact, SiAngular, SiDotnet, SiLaravel } from 'react-icons/si'
import { FaJava } from 'react-icons/fa'

const SKILL_META: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'React': {
    bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700',
    icon: <SiReact className="w-6 h-6" />,
  },
  'Angular': {
    bg: 'bg-red-50 border-red-200', text: 'text-red-700',
    icon: <SiAngular className="w-6 h-6" />,
  },
  '.NET': {
    bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700',
    icon: <SiDotnet className="w-6 h-6" />,
  },
  '.NET Full Stack': {
    bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700',
    icon: <SiDotnet className="w-6 h-6" />,
  },
  'Java': {
    bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700',
    icon: <FaJava className="w-6 h-6" />,
  },
  'Java Full Stack': {
    bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',
    icon: <FaJava className="w-6 h-6" />,
  },
  'DevOps': {
    bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700',
    icon: <SiDocker className="w-6 h-6" />,
  },
  'AI': {
    bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700',
    icon: <SiTensorflow className="w-6 h-6" />,
  },
  'Automation Testing': {
    bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700',
    icon: <SiSelenium className="w-6 h-6" />,
  },
  'PHP & Laravel': {
    bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700',
    icon: <SiLaravel className="w-6 h-6" />,
  },
  'Data Engineering': {
    bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700',
    icon: <SiApachespark className="w-6 h-6" />,
  },
  'Data Analysis': {
    bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700',
    icon: <SiPandas className="w-6 h-6" />,
  },
  'UI/UX': {
    bg: 'bg-pink-50 border-pink-200', text: 'text-pink-700',
    icon: <SiFigma className="w-6 h-6" />,
  },
  'Technical Writing': {
    bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700',
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
  'BA': {
    bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700',
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  'PO': {
    bg: 'bg-lime-50 border-lime-200', text: 'text-lime-700',
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  },
  'IT': {
    bg: 'bg-stone-50 border-stone-200', text: 'text-stone-700',
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  'Other': {
    bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600',
    icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
  },
}

const DEFAULT_SKILL_META = {
  bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700',
  icon: <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
}

export function getSkillMeta(skill: string) {
  return SKILL_META[skill] ?? DEFAULT_SKILL_META
}

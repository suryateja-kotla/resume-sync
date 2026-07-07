import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

type Section = 'search' | 'new-employees' | 'skill-dashboard' | 'employee-list' | 'talent-pool' | 'audit-log' | 'metrics'

interface Candidate {
  employee_id: string
  name: string
  email: string
  currentRole: string
  skills: string[]
  experience: number
  resume_path?: string
  isOnBench?: boolean
}

interface Message {
  id: number
  type: 'user' | 'assistant'
  text?: string
  candidates?: Candidate[]
  excel_filename?: string
  loading?: boolean
}

interface NewEmployee {
  employee_id: string
  name: string
  email: string
  department?: string
}

interface SkillRack {
  skill: string
  employee_count: number
}

interface SkillEmployee {
  employee_id: string
  name: string
  email: string
  current_designation: string
  current_skill: string
  total_exp: number
  current_skill_exp: number
  primary_skill?: string
  secondary_skill?: string
}

interface SkillSummaryRow {
  employee_id: string
  name: string
  email: string
  current_designation: string
  current_skill: string
  total_exp: number | string
  current_skill_exp: number | string
  resume_path?: string
}

interface AuditEvent {
  _id: string
  event_type: string
  actor: string
  employee_id: string | null
  timestamp: string
  payload: Record<string, unknown>
}

const AUDIT_EVENT_TYPES = [
  'LOGIN',
  'RESUME_UPLOAD',
  'PROFILE_UPDATED',
  'SKILL_PROFILE_UPDATED',
  'RESUME_REGENERATED',
  'MONTHLY_UPDATE_SUBMITTED',
  'NEW_EMPLOYEE_PROVISIONED',
  'INVITE_SENT',
  'EXCEL_REPORT_GENERATED',
  'EMPLOYEE_DELETED',
]

const AUDIT_EVENT_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  RESUME_UPLOAD: 'Resume Upload',
  PROFILE_UPDATED: 'Profile Updated',
  SKILL_PROFILE_UPDATED: 'Skill Profile Updated',
  RESUME_REGENERATED: 'Resume Regenerated',
  MONTHLY_UPDATE_SUBMITTED: 'Monthly Update Submitted',
  NEW_EMPLOYEE_PROVISIONED: 'New Employee Provisioned',
  INVITE_SENT: 'Invite Sent',
  EXCEL_REPORT_GENERATED: 'Excel Report Generated',
  EMPLOYEE_DELETED: 'Employee Deleted',
}

const AUDIT_EVENT_COLORS: Record<string, string> = {
  LOGIN: 'bg-slate-100 text-slate-700',
  RESUME_UPLOAD: 'bg-blue-50 text-blue-700',
  PROFILE_UPDATED: 'bg-violet-50 text-violet-700',
  SKILL_PROFILE_UPDATED: 'bg-violet-50 text-violet-700',
  RESUME_REGENERATED: 'bg-teal-50 text-teal-700',
  MONTHLY_UPDATE_SUBMITTED: 'bg-amber-50 text-amber-700',
  EMPLOYEE_DELETED: 'bg-red-50 text-red-700',
  NEW_EMPLOYEE_PROVISIONED: 'bg-green-50 text-green-700',
  INVITE_SENT: 'bg-blue-50 text-blue-700',
  EXCEL_REPORT_GENERATED: 'bg-emerald-50 text-emerald-700',
}

// Skill-specific icon + color configuration for the rack cards
const SKILL_META: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'React': {
    bg: 'bg-cyan-50 border-cyan-200',
    text: 'text-cyan-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 10.11c1.03 0 1.87.84 1.87 1.89 0 1-.84 1.85-1.87 1.85-1.03 0-1.87-.85-1.87-1.85 0-1.05.84-1.89 1.87-1.89M7.37 20c.63.38 2.01-.2 3.6-1.7-.52-.59-1.03-1.23-1.51-1.9a22.7 22.7 0 01-2.4-.36c-.51 2.14-.32 3.61.31 3.96m.71-5.74l-.29-.51c-.11.29-.22.58-.29.86.27.06.57.11.88.16l-.3-.51m6.54-.76l.81-1.5-.81-1.5c-.3-.53-.62-1-.91-1.47C13.17 9 12.6 9 12 9c-.6 0-1.17 0-1.71.03-.29.47-.61.94-.91 1.47L8.57 12l.81 1.5c.3.53.62 1 .91 1.47.54.03 1.11.03 1.71.03.6 0 1.17 0 1.71-.03.29-.47.61-.94.91-1.47M12 6.78c-.19.22-.39.45-.59.72h1.18c-.2-.27-.4-.5-.59-.72m0 10.44c.19-.22.39-.45.59-.72h-1.18c.2.27.4.5.59.72M16.62 4c-.62-.38-2 .2-3.59 1.7.52.59 1.03 1.23 1.51 1.9.82.08 1.63.2 2.4.36.51-2.14.32-3.61-.32-3.96m-.7 5.74l.29.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l.3.51m1.45-7.05c1.47.84 1.63 3.05 1.01 5.63 2.54.75 4.37 1.99 4.37 3.68 0 1.69-1.83 2.93-4.37 3.68.62 2.58.46 4.79-1.01 5.63-1.46.84-3.45-.12-5.37-1.95-1.92 1.83-3.91 2.79-5.38 1.95-1.46-.84-1.62-3.05-1-5.63C2.46 14.93.63 13.69.63 12c0-1.69 1.83-2.93 4.37-3.68C4.38 5.74 4.54 3.53 6 2.69c1.47-.84 3.46.12 5.38 1.95 1.92-1.83 3.91-2.79 5.37-1.95z"/>
      </svg>
    ),
  },
  'Angular': {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M9.93 12.645h4.134L11.996 7.74M11.996.009L.686 3.988l1.725 14.76 9.585 5.243 9.588-5.238L23.308 3.99 11.996.01zm7.058 18.297h-2.636l-1.42-3.501H8.995l-1.42 3.501H4.937l7.06-15.648 7.057 15.648z"/>
      </svg>
    ),
  },
  '.NET': {
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M24 8.77h-2.468v7.565h-1.425V8.77h-2.462V7.53H24zm-6.852 7.565h-4.821V7.53h4.68v1.24h-3.255v2.438h3.05v1.232h-3.05v2.647h3.396zm-6.708 0H8.882L4.78 9.863a2.896 2.896 0 01-.258-.51h-.036c.032.189.048.592.048 1.21v5.772H3.157V7.53h1.659l3.965 6.32c.167.261.275.442.323.54h.024c-.04-.233-.06-.629-.06-1.185V7.529h1.372zm-8.703-.693a.868.868 0 01-.869.868.868.868 0 01-.868-.868.868.868 0 01.868-.869.868.868 0 01.869.869z"/>
      </svg>
    ),
  },
  '.NET Full Stack': {
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M24 8.77h-2.468v7.565h-1.425V8.77h-2.462V7.53H24zm-6.852 7.565h-4.821V7.53h4.68v1.24h-3.255v2.438h3.05v1.232h-3.05v2.647h3.396zm-6.708 0H8.882L4.78 9.863a2.896 2.896 0 01-.258-.51h-.036c.032.189.048.592.048 1.21v5.772H3.157V7.53h1.659l3.965 6.32c.167.261.275.442.323.54h.024c-.04-.233-.06-.629-.06-1.185V7.529h1.372zm-8.703-.693a.868.868 0 01-.869.868.868.868 0 01-.868-.868.868.868 0 01.868-.869.868.868 0 01.869.869z"/>
      </svg>
    ),
  },
  'Java': {
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0 .001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0 .001.553.457 3.393.639"/>
      </svg>
    ),
  },
  'Java Full Stack': {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0 .001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0 .001.553.457 3.393.639"/>
      </svg>
    ),
  },
  'DevOps': {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185v-4.79a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v4.79c0 .102.083.186.185.186m-2.954-5.43h2.118a.186.186 0 00.186-.186V.185a.186.186 0 00-.186-.185H11.03a.185.185 0 00-.185.185v5.277c0 .102.083.186.185.186m-2.248 7.595h2.118a.186.186 0 00.186-.186v-2.09a.186.186 0 00-.186-.186H8.781a.185.185 0 00-.185.185v2.09c0 .103.083.187.185.187m-2.248-2.716h2.118a.186.186 0 00.186-.186v-4.79a.186.186 0 00-.186-.186H6.533a.185.185 0 00-.185.185v4.79c0 .102.083.186.185.186M0 11.62v2.714l5.432 3.16v2.35l-4.063 2.363L0 23.095v-2.233l2.754-1.599v-1.57L0 19.257v-2.233l2.754-1.6v-.88L0 16.107v-2.233l5.432-3.16v2.716L2.754 14.99v.88l2.678 1.557v2.714l-2.678 1.556v.88l2.678 1.556v2.716L0 23.614v-2.714l2.678-1.556v-1.57L0 16.217v-2.714l5.432-3.16v2.233L2.678 14.13v2.35l2.754 1.598V20.4l-2.754 1.598V24l5.432-3.16v-2.716L4.636 16.59v-.88L7.41 14.15V11.43L0 6.87v2.233l2.754 1.597v1.57L0 13.827v2.234L5.432 19.2v-2.714l-2.678-1.557V14.07L5.432 12.5V9.785L0 6.624v2.715l2.678 1.556v1.57L0 13.95z"/>
      </svg>
    ),
  },
  'AI': {
    bg: 'bg-violet-50 border-violet-200',
    text: 'text-violet-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  'Automation Testing': {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  'PHP & Laravel': {
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M23.642 5.43a.364.364 0 01.014.1v5.149c0 .135-.073.26-.189.326l-4.323 2.49v4.934a.378.378 0 01-.188.326L9.93 23.949a.316.316 0 01-.066.027.292.292 0 01-.066.016.39.39 0 01-.066-.016.287.287 0 01-.065-.027L.373 18.753A.378.378 0 01.185 18.427V2.712c0-.04.005-.08.014-.119a.348.348 0 01.037-.092c.014-.03.03-.057.05-.08a.309.309 0 01.063-.063.294.294 0 01.056-.026L4.902.02a.378.378 0 01.378 0l4.498 2.6A.376.376 0 019.965 2.95v4.933l3.56-2.055V.845a.378.378 0 01.19-.326L18.2.02a.378.378 0 01.378 0l4.498 2.6a.378.378 0 01.189.327v2.484z"/>
      </svg>
    ),
  },
  'Data Engineering': {
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  'Data Analysis': {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  'UI/UX': {
    bg: 'bg-pink-50 border-pink-200',
    text: 'text-pink-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  'Technical Writing': {
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  'BA': {
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  'PO': {
    bg: 'bg-lime-50 border-lime-200',
    text: 'text-lime-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  'IT': {
    bg: 'bg-stone-50 border-stone-200',
    text: 'text-stone-700',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  'Other': {
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-600',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
}

const DEFAULT_SKILL_META = {
  bg: 'bg-blue-50 border-blue-200',
  text: 'text-blue-700',
  icon: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
}

function getSkillMeta(skill: string) {
  return SKILL_META[skill] ?? DEFAULT_SKILL_META
}

// Skill badge color for the employee list table
const SKILL_BADGE: Record<string, string> = {
  'React': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'Angular': 'bg-red-50 text-red-700 border border-red-200',
  '.NET': 'bg-purple-50 text-purple-700 border border-purple-200',
  '.NET Full Stack': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'Java': 'bg-orange-50 text-orange-700 border border-orange-200',
  'Java Full Stack': 'bg-amber-50 text-amber-700 border border-amber-200',
  'DevOps': 'bg-slate-100 text-slate-700 border border-slate-200',
  'AI': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Automation Testing': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'PHP & Laravel': 'bg-rose-50 text-rose-700 border border-rose-200',
  'Data Engineering': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Data Analysis': 'bg-blue-50 text-blue-700 border border-blue-200',
  'UI/UX': 'bg-pink-50 text-pink-700 border border-pink-200',
  'Technical Writing': 'bg-gray-100 text-gray-700 border border-gray-200',
  'BA': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'PO': 'bg-lime-50 text-lime-700 border border-lime-200',
  'IT': 'bg-stone-50 text-stone-700 border border-stone-200',
  'Other': 'bg-gray-100 text-gray-600 border border-gray-200',
}

function getSkillBadgeClass(skill?: string) {
  if (!skill) return 'bg-gray-100 text-gray-400 border border-gray-200'
  return SKILL_BADGE[skill] ?? 'bg-blue-50 text-blue-700 border border-blue-200'
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const palettes: { tag: string; glow: string }[] = [
    { tag: 'bg-blue-100 text-blue-700',    glow: 'shadow-[0_0_8px_2px_rgba(59,130,246,0.35)]'  },
    { tag: 'bg-violet-100 text-violet-700', glow: 'shadow-[0_0_8px_2px_rgba(139,92,246,0.35)]' },
    { tag: 'bg-emerald-100 text-emerald-700', glow: 'shadow-[0_0_8px_2px_rgba(16,185,129,0.35)]' },
    { tag: 'bg-amber-100 text-amber-700',   glow: 'shadow-[0_0_8px_2px_rgba(245,158,11,0.35)]'  },
    { tag: 'bg-rose-100 text-rose-700',     glow: 'shadow-[0_0_8px_2px_rgba(244,63,94,0.35)]'   },
    { tag: 'bg-teal-100 text-teal-700',     glow: 'shadow-[0_0_8px_2px_rgba(20,184,166,0.35)]'  },
  ]

  return (
    <div className="relative bg-white rounded-xl p-4 border border-blue-100 shadow-[0_0_16px_4px_rgba(59,130,246,0.12)] hover:shadow-[0_0_24px_6px_rgba(59,130,246,0.22)] transition-shadow duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-50/60 via-white to-violet-50/40 pointer-events-none" />
      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{candidate.name || candidate.employee_id}</h3>
          <a href={`mailto:${candidate.email}`} className="text-blue-500 text-sm hover:underline">
            {candidate.email}
          </a>
          <p className="text-gray-400 text-xs mt-0.5">ID: {candidate.employee_id}</p>
        </div>
        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(59,130,246,0.3)]">
          {candidate.currentRole}
        </span>
        {candidate.isOnBench && (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(16,185,129,0.3)]">
            On Bench
          </span>
        )}
      </div>
      <div className="relative flex flex-wrap gap-1.5">
        {palettes && null /* suppress unused warning */}
      </div>
    </div>
  )
}

export default function HRDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('search')

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      type: 'assistant',
      text: "Hi! I'm your HR assistant. Ask me to find candidates — e.g. \"Find candidates with 2+ years Java experience\"",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgId = useRef(1)

  // New Employees section
  const [newEmployees, setNewEmployees] = useState<NewEmployee[]>([])
  const [newEmployeesLoading, setNewEmployeesLoading] = useState(false)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sent' | 'error'>>({})

  const [manualEmailInput, setManualEmailInput] = useState('')
  const [manualSending, setManualSending] = useState(false)
  const [manualResults, setManualResults] = useState<{ email: string; status: 'sent' | 'error'; message?: string }[]>([])

  // Skill Dashboard section
  const [skillRacks, setSkillRacks] = useState<SkillRack[]>([])
  const [skillRacksLoading, setSkillRacksLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillEmployees, setSkillEmployees] = useState<SkillEmployee[]>([])
  const [skillEmployeesLoading, setSkillEmployeesLoading] = useState(false)
  const [skillExcelGenerating, setSkillExcelGenerating] = useState(false)
  const [skillExpFilter, setSkillExpFilter] = useState<string>('')

  const EXP_FILTER_OPTIONS = [
    { value: '', label: 'All Experience' },
    { value: '1', label: '1+ yrs' },
    { value: '2', label: '2+ yrs' },
    { value: '3', label: '3+ yrs' },
    { value: '5', label: '5+ yrs' },
    { value: '8', label: '8+ yrs' },
  ]

  // Employee List section — sourced from employee_skill_summary
  const [allEmployees, setAllEmployees] = useState<SkillSummaryRow[]>([])
  const [allEmployeesLoading, setAllEmployeesLoading] = useState(false)
  const [allEmployeesCount, setAllEmployeesCount] = useState(0)
  const [allExcelGenerating, setAllExcelGenerating] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SkillSummaryRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Talent Pool section
  const [benchEmployees, setBenchEmployees] = useState<SkillEmployee[]>([])
  const [benchLoading, setBenchLoading] = useState(false)

  // Metrics section
  interface HRMetrics {
    overview: { total_employees: number; total_with_resume: number; pending_resumes: number; coverage_pct: number; bench_count: number }
    activity: { uploads_last_7d: number; updates_last_7d: number; invites_last_7d: number; uploads_last_30d: number }
    skill_distribution: { skill: string; count: number }[]
    recent_feed: { event_type: string; actor: string; employee_id: string | null; timestamp: string }[]
  }
  const [metrics, setMetrics] = useState<HRMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Audit Log section
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState('')
  const [auditDateFrom, setAuditDateFrom] = useState('')
  const [auditDateTo, setAuditDateTo] = useState('')
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)
  const AUDIT_PAGE_SIZE = 25

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Fetch bench count on mount so sidebar badge is visible immediately
    fetchBenchEmployees()
  }, [])

  useEffect(() => {
    if (section === 'new-employees' && newEmployees.length === 0) fetchNewEmployees()
    if (section === 'skill-dashboard' && skillRacks.length === 0) fetchSkillRacks()
    if (section === 'employee-list' && allEmployees.length === 0) fetchAllEmployees()
    if (section === 'talent-pool' && benchEmployees.length === 0) fetchBenchEmployees()
    if (section === 'audit-log' && auditEvents.length === 0) fetchAuditLog(1)
    if (section === 'metrics' && !metrics) fetchMetrics()
  }, [section])

  const fetchNewEmployees = async () => {
    setNewEmployeesLoading(true)
    try {
      const { data } = await api.get('/hr/new-employees')
      if (data.status === 'success') setNewEmployees(data.data)
    } catch { /* ignore */ }
    finally { setNewEmployeesLoading(false) }
  }

  const sendInvite = async (email: string) => {
    setSendingInvite(email)
    try {
      const { data } = await api.post('/hr/send-resume-invite', { email, actor_email: user?.email })
      setInviteStatus(prev => ({ ...prev, [email]: data.status === 'success' ? 'sent' : 'error' }))
    } catch {
      setInviteStatus(prev => ({ ...prev, [email]: 'error' }))
    } finally {
      setSendingInvite(null)
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const sendManualInvites = async () => {
    const emails = Array.from(
      new Set(
        manualEmailInput
          .split(/[\n,;]+/)
          .map(e => e.trim())
          .filter(Boolean)
      )
    )
    if (emails.length === 0 || manualSending) return

    setManualSending(true)
    const results: { email: string; status: 'sent' | 'error'; message?: string }[] = []

    for (const email of emails) {
      if (!emailRegex.test(email)) {
        results.push({ email, status: 'error', message: 'Invalid email format' })
        continue
      }
      try {
        const { data } = await api.post('/hr/send-resume-invite', { email, actor_email: user?.email })
        results.push({
          email,
          status: data.status === 'success' ? 'sent' : 'error',
          message: data.status !== 'success' ? data.message : undefined,
        })
      } catch {
        results.push({ email, status: 'error', message: 'Request failed' })
      }
    }

    setManualResults(results)
    setManualSending(false)
    if (results.every(r => r.status === 'sent')) setManualEmailInput('')
  }

  const fetchBenchEmployees = async () => {
    setBenchLoading(true)
    try {
      const { data } = await api.get('/hr/bench-employees')
      if (data.status === 'success') setBenchEmployees(data.data)
    } catch { /* ignore */ }
    finally { setBenchLoading(false) }
  }

  const fetchSkillRacks = async () => {
    setSkillRacksLoading(true)
    try {
      const { data } = await api.get('/hr/skill-summary')
      if (data.status === 'success') setSkillRacks(data.data)
    } catch { /* ignore */ }
    finally { setSkillRacksLoading(false) }
  }

  const openSkillRack = async (skill: string) => {
    setSelectedSkill(skill)
    setSkillExpFilter('')
    await fetchSkillEmployees(skill, '')
  }

  const fetchSkillEmployees = async (skill: string, minExp: string) => {
    setSkillEmployeesLoading(true)
    try {
      const params: Record<string, string> = { skill }
      if (minExp) params.min_skill_exp = minExp
      const { data } = await api.get('/hr/skill-employees', { params })
      if (data.status === 'success') setSkillEmployees(data.data)
    } catch { /* ignore */ }
    finally { setSkillEmployeesLoading(false) }
  }

  const handleSkillExpFilterChange = (minExp: string) => {
    setSkillExpFilter(minExp)
    if (selectedSkill) fetchSkillEmployees(selectedSkill, minExp)
  }

  const closeSkillRack = () => {
    setSelectedSkill(null)
    setSkillEmployees([])
    setSkillExpFilter('')
  }

  const downloadExcel = (filename: string) => {
    window.open(`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(filename)}`, '_blank')
  }

  const generateSkillExcel = async () => {
    if (!selectedSkill || skillExcelGenerating) return
    setSkillExcelGenerating(true)
    try {
      const params: Record<string, string> = { skill: selectedSkill }
      if (skillExpFilter) params.min_skill_exp = skillExpFilter
      if (user?.email) params.actor_email = user.email
      const { data } = await api.get('/hr/skill-employees-excel', { params })
      if (data.status === 'success' && data.excel_filename) downloadExcel(data.excel_filename)
    } catch { /* ignore */ }
    finally { setSkillExcelGenerating(false) }
  }

  const fetchAllEmployees = async () => {
    setAllEmployeesLoading(true)
    try {
      const { data } = await api.get('/hr/skill-summary-employees')
      if (data.status === 'success') {
        setAllEmployees(data.data)
        setAllEmployeesCount(data.count)
      }
    } catch { /* ignore */ }
    finally { setAllEmployeesLoading(false) }
  }

  const generateAllEmployeesExcel = async () => {
    if (allExcelGenerating) return
    setAllExcelGenerating(true)
    try {
      const { data } = await api.get('/hr/all-employees-excel', { params: user?.email ? { actor_email: user.email } : {} })
      if (data.status === 'success' && data.excel_filename) downloadExcel(data.excel_filename)
    } catch { /* ignore */ }
    finally { setAllExcelGenerating(false) }
  }

  const filteredEmployees = allEmployees
    .filter(emp => {
      if (!employeeSearch.trim()) return true
      const q = employeeSearch.toLowerCase()
      return (
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.current_skill?.toLowerCase().includes(q) ||
        emp.current_designation?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', 'en', { numeric: true }))

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/hr/employee/${deleteTarget.employee_id}`, {
        params: user?.email ? { actor_email: user.email } : {},
      })
      setAllEmployees(prev => prev.filter(e => e.employee_id !== deleteTarget.employee_id))
      setAllEmployeesCount(prev => prev - 1)
    } catch { /* ignore */ }
    finally {
      setDeleteLoading(false)
      setDeleteTarget(null)
    }
  }

  const fetchAuditLog = async (
    page: number,
    overrides?: { eventType?: string; dateFrom?: string; dateTo?: string }
  ) => {
    const eventType = overrides?.eventType ?? auditEventTypeFilter
    const dateFrom = overrides?.dateFrom ?? auditDateFrom
    const dateTo = overrides?.dateTo ?? auditDateTo

    setAuditLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: AUDIT_PAGE_SIZE }
      if (eventType) params.event_type = eventType
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString()
      if (dateTo) params.date_to = new Date(dateTo + 'T23:59:59').toISOString()
      const { data } = await api.get('/hr/audit-log', { params })
      if (data.status === 'success') {
        setAuditEvents(data.events)
        setAuditTotal(data.total)
        setAuditPage(page)
      }
    } catch { /* ignore */ }
    finally { setAuditLoading(false) }
  }

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const { data } = await api.get('/hr/metrics')
      if (data.status === 'success') setMetrics(data.data)
    } catch { /* ignore */ }
    finally { setMetricsLoading(false) }
  }

  const applyAuditFilters = () => fetchAuditLog(1)

  const clearAuditFilters = () => {
    setAuditEventTypeFilter('')
    setAuditDateFrom('')
    setAuditDateTo('')
    fetchAuditLog(1, { eventType: '', dateFrom: '', dateTo: '' })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sendMessage = async () => {
    const query = input.trim()
    if (!query || loading) return
    setInput('')

    const userMsg: Message = { id: msgId.current++, type: 'user', text: query }
    const loadingMsg: Message = { id: msgId.current++, type: 'assistant', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const { data } = await api.post('/search-candidates', { query })
      const status: string = data.status || 'error'
      const candidates: Candidate[] = data.candidates || []
      const excel_filename: string | undefined = data.excel_filename || undefined
      const agent_message: string | undefined = data.message
      const isTextReply = status === 'text' || status === 'pending_confirmation'

      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? {
                ...m,
                loading: false,
                text: isTextReply || agent_message
                  ? agent_message
                  : (candidates.length === 0
                      ? 'No candidates found matching your query. Try different skills or experience range.'
                      : `Found ${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}:`),
                candidates: !isTextReply && candidates.length > 0 ? candidates : undefined,
                excel_filename: !isTextReply && candidates.length > 0 ? excel_filename : undefined,
              }
            : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, text: 'Something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">ResumeSync</span>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="space-y-1">
            {[
              { key: 'search' as Section, label: 'Candidate Search', icon: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' },
              { key: 'new-employees' as Section, label: 'New Employees', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
              { key: 'skill-dashboard' as Section, label: 'Skill Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h0' },
              { key: 'employee-list' as Section, label: 'Employee List', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4' },
              { key: 'talent-pool' as Section, label: 'Talent Pool', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
              { key: 'metrics' as Section, label: 'Monitoring', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full flex items-center gap-3 text-left text-sm px-3 py-2.5 rounded-lg transition ${
                  section === s.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
                {s.label}
                {s.key === 'new-employees' && newEmployees.length > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {newEmployees.length}
                  </span>
                )}
                {s.key === 'talent-pool' && benchEmployees.length > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {benchEmployees.length}
                  </span>
                )}
              </button>
            ))}
            {/* Audit log — system-level, de-emphasised */}
            <button
              onClick={() => setSection('audit-log')}
              className={`w-full flex items-center gap-3 text-left text-xs px-3 py-2 rounded-lg transition mt-1 ${
                section === 'audit-log' ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              System Audit Log
            </button>
          </div>
        </div>

        <div className="p-6 flex-1">
          {section === 'search' && (
            <>
              <div className="mb-6">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">HR Assistant</p>
                <div className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-slate-300 text-sm font-medium">Active</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Search candidates by skills, experience, or job requirements using natural language.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">Quick Searches</p>
                <div className="space-y-1">
                  {[
                    'Python developers 3+ years',
                    'React frontend engineers',
                    'Java Spring Boot 2+ years',
                    'AWS cloud architects',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="w-full text-left text-slate-400 hover:text-white hover:bg-slate-800 text-xs px-3 py-2 rounded-lg transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {(user?.fullName || user?.email || 'H')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.fullName || 'HR User'}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800 text-sm px-3 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {section === 'search' && 'Candidate Search'}
              {section === 'new-employees' && 'New Employees'}
              {section === 'skill-dashboard' && 'Skill Dashboard'}
              {section === 'employee-list' && 'Employee List'}
              {section === 'talent-pool' && 'Talent Pool'}
              {section === 'audit-log' && 'Audit Log'}
              {section === 'metrics' && 'Monitoring'}
            </h1>
            <p className="text-gray-400 text-sm">
              {section === 'search' && 'Find talent using natural language queries'}
              {section === 'new-employees' && 'Send onboarding invites so new hires can upload their resume'}
              {section === 'skill-dashboard' && 'Click a skill rack to see which employees currently work in that stack'}
              {section === 'employee-list' && 'Skill profile directory — all employees from skill summary data'}
              {section === 'talent-pool' && 'Employees currently on bench and available for new project allocation'}
              {section === 'audit-log' && 'Track who changed what, and when, across the system'}
              {section === 'metrics' && 'Live resume coverage, skill distribution and recent activity'}
            </p>
          </div>
          {section === 'employee-list' && (
            <button
              onClick={generateAllEmployeesExcel}
              disabled={allEmployees.length === 0 || allExcelGenerating}
              className="bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition flex items-center gap-2 flex-shrink-0"
            >
              {allExcelGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Excel
                </>
              )}
            </button>
          )}
        </header>

        {/* ── Candidate Search ── */}
        {section === 'search' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'assistant' && (
                    <div className="flex items-start gap-3 max-w-3xl w-full">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        {msg.loading ? (
                          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 inline-flex items-center gap-2">
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                              ))}
                            </div>
                            <span className="text-gray-400 text-sm">Thinking...</span>
                          </div>
                        ) : (
                          <>
                            {msg.text && (
                              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 mb-3 text-gray-700 text-sm leading-relaxed">
                                {msg.text}
                              </div>
                            )}
                            {msg.candidates && msg.candidates.length > 0 && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {msg.candidates.map((c, i) => <CandidateCard key={i} candidate={c} />)}
                                </div>
                                {msg.excel_filename && (
                                  <a
                                    href={`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(msg.excel_filename)}`}
                                    download={msg.excel_filename}
                                    className="inline-flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm font-medium px-4 py-2 rounded-lg transition"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Excel Report
                                  </a>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.type === 'user' && (
                    <div className="max-w-lg">
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="bg-white border-t border-gray-100 px-6 py-4 flex-shrink-0">
              <div className="flex items-end gap-3 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='e.g. "Find candidates with 2+ years Java experience"'
                    rows={1}
                    className="w-full resize-none px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 text-sm leading-relaxed transition"
                    style={{ maxHeight: '120px' }}
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                    }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-400 text-xs text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}

        {/* ── New Employees ── */}
        {section === 'new-employees' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-1">Invite a New Employee</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Enter their Outlook email address. They'll receive a notification — once they click it, they can log in with their email and upload their resume.
                </p>
                <textarea
                  value={manualEmailInput}
                  onChange={e => setManualEmailInput(e.target.value)}
                  placeholder="name@sailssoftware.com&#10;You can paste multiple emails — one per line, or comma-separated"
                  rows={3}
                  className="w-full resize-none px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 text-sm leading-relaxed transition"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-gray-400 text-xs">
                    {manualEmailInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length} email(s) ready to send
                  </p>
                  <button
                    onClick={sendManualInvites}
                    disabled={!manualEmailInput.trim() || manualSending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                  >
                    {manualSending ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Invite{manualEmailInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
                {manualResults.length > 0 && (
                  <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
                    {manualResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                        r.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {r.status === 'sent'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />}
                        </svg>
                        <span className="truncate">{r.email}</span>
                        <span className="text-xs opacity-75 ml-auto flex-shrink-0">
                          {r.status === 'sent' ? 'Invite sent' : (r.message || 'Failed')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-500 text-sm font-medium mb-3">Pending in System (no resume yet)</p>
                {newEmployeesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : newEmployees.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                    <p className="text-gray-400 text-sm">
                      Everyone already in the system has uploaded a resume. Employees added to HR records without a resume will show up here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newEmployees.map(emp => {
                      const status = inviteStatus[emp.email]
                      return (
                        <div key={emp.employee_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {emp.name?.[0]?.toUpperCase() || 'E'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                              <p className="text-gray-500 text-xs truncate">{emp.email}</p>
                              <p className="text-gray-400 text-xs mt-0.5">
                                ID: {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {status === 'sent' ? (
                              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 text-sm font-medium px-4 py-2 rounded-xl">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Invite Sent
                              </span>
                            ) : (
                              <button
                                onClick={() => sendInvite(emp.email)}
                                disabled={sendingInvite === emp.email}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2"
                              >
                                {sendingInvite === emp.email ? (
                                  <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Send Invite
                                  </>
                                )}
                              </button>
                            )}
                            {status === 'error' && (
                              <p className="text-red-500 text-xs mt-1.5 text-right">Failed — try again</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Skill Dashboard ── */}
        {section === 'skill-dashboard' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {skillRacksLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading skill racks...</p>
                </div>
              </div>
            ) : skillRacks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No skill data yet</h3>
                <p className="text-gray-400 text-sm">Skill racks populate once employees have a Skill Profile filled in.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
                {skillRacks.map(rack => {
                  const meta = getSkillMeta(rack.skill)
                  const hasEmployees = rack.employee_count > 0
                  return (
                    <button
                      key={rack.skill}
                      onClick={() => hasEmployees && openSkillRack(rack.skill)}
                      disabled={!hasEmployees}
                      className={`group relative rounded-2xl p-5 border text-left transition-all duration-200 ${
                        hasEmployees
                          ? `${meta.bg} hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`
                          : 'bg-gray-50 border-gray-100 opacity-50 cursor-default'
                      }`}
                    >
                      {/* icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 ${
                        hasEmployees ? `${meta.text} bg-white shadow-sm group-hover:scale-110` : 'text-gray-400 bg-white'
                      }`}>
                        {meta.icon}
                      </div>

                      <p className={`font-semibold text-sm leading-tight mb-1 ${hasEmployees ? 'text-gray-800' : 'text-gray-400'}`}>
                        {rack.skill}
                      </p>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${hasEmployees ? meta.text : 'text-gray-300'}`}>
                          {rack.employee_count}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {rack.employee_count === 1 ? 'employee' : 'employees'}
                        </span>
                      </div>

                      {hasEmployees && (
                        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${meta.text.replace('text-', 'bg-').replace('-700', '-400')}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Employee List ── */}
        {section === 'employee-list' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {allEmployeesLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading employees...</p>
                </div>
              </div>
            ) : allEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No skill profiles yet</h3>
                <p className="text-gray-400 text-sm">Employees will appear here once they have filled in their Skill Profile.</p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-gray-800 whitespace-nowrap">
                      {filteredEmployees.length}
                      {filteredEmployees.length !== allEmployeesCount && ` of ${allEmployeesCount}`}
                      {' '}Employee{allEmployeesCount !== 1 ? 's' : ''}
                    </h2>
                  </div>
                  {/* Search */}
                  <div className="relative max-w-xs w-full">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      placeholder="Search name, skill, email…"
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 bg-white"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left bg-gray-50/80">
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">#</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Employee</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Designation</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Current Skill</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Total Exp</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Skill Exp</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Resume</th>
                          <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredEmployees.map((emp, idx) => (
                          <tr key={emp.employee_id} className="hover:bg-blue-50/30 transition-colors duration-100 group">
                            <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{idx + 1}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {emp.name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-800 truncate max-w-[160px]">{emp.name}</p>
                                  <p className="text-gray-400 text-xs truncate max-w-[160px]">{emp.email}</p>
                                  <p className="text-gray-300 text-xs">{emp.employee_id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap max-w-[180px] truncate">
                              {emp.current_designation || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {emp.current_skill ? (
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                                  {emp.current_skill}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {emp.total_exp !== '' && emp.total_exp !== undefined ? (
                                <span className="text-gray-700 font-medium">{emp.total_exp} <span className="text-gray-400 font-normal text-xs">yrs</span></span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {emp.current_skill_exp !== '' && emp.current_skill_exp !== undefined ? (
                                <span className="text-gray-700 font-medium">{emp.current_skill_exp} <span className="text-gray-400 font-normal text-xs">yrs</span></span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {emp.resume_path ? (
                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-100 text-xs font-medium px-2.5 py-1 rounded-full">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Uploaded
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium px-2.5 py-1 rounded-full">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <button
                                onClick={() => setDeleteTarget(emp)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                                title="Delete employee"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredEmployees.length === 0 && employeeSearch && (
                      <div className="py-12 text-center text-gray-400 text-sm">
                        No employees match "<span className="font-medium text-gray-600">{employeeSearch}</span>"
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Delete Confirm Modal ── */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Delete Employee</h3>
                  <p className="text-gray-400 text-xs">{deleteTarget.employee_id}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-1">
                Are you sure you want to delete <span className="font-semibold text-gray-800">{deleteTarget.name}</span>?
              </p>
              <p className="text-gray-400 text-xs mb-6">
                This will permanently remove their profile, resume data, skill summary, and generated DOCX. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Talent Pool ── */}
        {section === 'talent-pool' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {benchLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading talent pool...</p>
                </div>
              </div>
            ) : benchEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No one on bench right now</h3>
                <p className="text-gray-400 text-sm">Employees who mark themselves as available will appear here automatically.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold px-3 py-1.5 rounded-full">
                    {benchEmployees.length} available
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {benchEmployees.map(emp => (
                    <div
                      key={emp.employee_id}
                      className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-150"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                          <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline truncate block">{emp.email}</a>
                        </div>
                        <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                          {emp.employee_id}
                        </span>
                      </div>

                      {/* Skill fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <p className="text-gray-400 text-xs mb-0.5">Designation</p>
                          <p className="text-gray-700 font-medium text-xs truncate">{emp.current_designation || '—'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <p className="text-gray-400 text-xs mb-0.5">Current Skill</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                            {emp.current_skill || '—'}
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <p className="text-gray-400 text-xs mb-0.5">Total Exp</p>
                          <p className="text-gray-700 font-medium text-xs">{emp.total_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <p className="text-gray-400 text-xs mb-0.5">Skill Exp</p>
                          <p className="text-gray-700 font-medium text-xs">{emp.current_skill_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                        </div>
                        {emp.primary_skill && (
                          <div className="bg-gray-50 rounded-xl p-2.5">
                            <p className="text-gray-400 text-xs mb-0.5">Primary Skill</p>
                            <p className="text-gray-700 font-medium text-xs truncate">{emp.primary_skill}</p>
                          </div>
                        )}
                        {emp.secondary_skill && (
                          <div className="bg-gray-50 rounded-xl p-2.5">
                            <p className="text-gray-400 text-xs mb-0.5">Secondary Skill</p>
                            <p className="text-gray-700 font-medium text-xs truncate">{emp.secondary_skill}</p>
                          </div>
                        )}
                      </div>

                      {/* Bench badge */}
                      <div className="mt-3 pt-3 border-t border-amber-50 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        <span className="text-xs text-amber-600 font-medium">Available for allocation</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Monitoring / Metrics ── */}
        {section === 'metrics' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {metricsLoading || !metrics ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading metrics...</p>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-6">

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Employees',
                      value: metrics.overview.total_employees,
                      sub: 'in system',
                      bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700',
                      icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4',
                    },
                    {
                      label: 'Resumes Uploaded',
                      value: metrics.overview.total_with_resume,
                      sub: `${metrics.overview.coverage_pct}% coverage`,
                      bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700',
                      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                    },
                    {
                      label: 'Pending Resumes',
                      value: metrics.overview.pending_resumes,
                      sub: 'no resume yet',
                      bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700',
                      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                    },
                    {
                      label: 'Uploads (30 days)',
                      value: metrics.activity.uploads_last_30d,
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

                {/* Coverage ring + activity stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                  {/* Coverage ring */}
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

                  {/* Activity last 7 days */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 text-sm mb-4">Activity — Last 7 Days</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Resume Uploads',   value: metrics.activity.uploads_last_7d,  color: 'bg-blue-500',   max: Math.max(metrics.activity.uploads_last_7d, metrics.activity.updates_last_7d, metrics.activity.invites_last_7d, 1) },
                        { label: 'Profile Updates',  value: metrics.activity.updates_last_7d,  color: 'bg-violet-500', max: Math.max(metrics.activity.uploads_last_7d, metrics.activity.updates_last_7d, metrics.activity.invites_last_7d, 1) },
                        { label: 'Invites Sent',     value: metrics.activity.invites_last_7d,  color: 'bg-teal-500',   max: Math.max(metrics.activity.uploads_last_7d, metrics.activity.updates_last_7d, metrics.activity.invites_last_7d, 1) },
                      ].map(row => (
                        <div key={row.label}>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{row.label}</span>
                            <span className="font-semibold text-gray-700">{row.value}</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${row.color} rounded-full transition-all duration-700`}
                              style={{ width: `${(row.value / row.max) * 100}%` }}
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
                          RESUME_UPLOAD:          { label: 'uploaded a resume',       dot: 'bg-blue-500' },
                          PROFILE_UPDATED:        { label: 'updated their profile',   dot: 'bg-violet-500' },
                          SKILL_PROFILE_UPDATED:  { label: 'updated skill profile',   dot: 'bg-teal-500' },
                          INVITE_SENT:            { label: 'invite sent',             dot: 'bg-amber-500' },
                        }
                        const meta = eventMeta[ev.event_type] ?? { label: ev.event_type, dot: 'bg-gray-400' }
                        const time = ev.timestamp ? new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                        return (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className="text-gray-700 text-sm font-medium truncate">
                              {ev.employee_id || ev.actor}
                            </span>
                            <span className="text-gray-400 text-sm">{meta.label}</span>
                            <span className="ml-auto text-gray-400 text-xs whitespace-nowrap flex-shrink-0">{time}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── Audit Log ── */}
        {section === 'audit-log' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
                  <select
                    value={auditEventTypeFilter}
                    onChange={e => setAuditEventTypeFilter(e.target.value)}
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
                    type="date" value={auditDateFrom}
                    onChange={e => setAuditDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
                  />
                </div>
                <div className="min-w-[150px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date" value={auditDateTo}
                    onChange={e => setAuditDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
                  />
                </div>
                <button onClick={applyAuditFilters} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                  Apply
                </button>
                <button onClick={clearAuditFilters} className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition">
                  Clear
                </button>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No audit events found</h3>
                  <p className="text-gray-400 text-sm">Events will appear here as employees and HR use the system.</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-500 text-sm">{auditTotal} total event{auditTotal !== 1 ? 's' : ''}</p>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                    {auditEvents.map(ev => (
                      <div key={ev._id}>
                        <button
                          onClick={() => setExpandedAuditId(expandedAuditId === ev._id ? null : ev._id)}
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
                            className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${expandedAuditId === ev._id ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedAuditId === ev._id && (
                          <div className="px-5 pb-4 pt-1 bg-gray-50/40">
                            <pre className="text-xs text-gray-600 bg-white border border-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(ev.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {auditTotal > AUDIT_PAGE_SIZE && (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => fetchAuditLog(auditPage - 1)}
                        disabled={auditPage <= 1}
                        className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 px-3 py-1.5 rounded-lg transition"
                      >
                        ← Previous
                      </button>
                      <span className="text-xs text-gray-400">
                        Page {auditPage} of {Math.ceil(auditTotal / AUDIT_PAGE_SIZE)}
                      </span>
                      <button
                        onClick={() => fetchAuditLog(auditPage + 1)}
                        disabled={auditPage >= Math.ceil(auditTotal / AUDIT_PAGE_SIZE)}
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
        )}
      </main>

      {/* ── Skill Rack drill-down panel ── */}
      {selectedSkill && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={closeSkillRack} />
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {/* skill icon in panel */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getSkillMeta(selectedSkill).text} bg-gray-50 border ${getSkillMeta(selectedSkill).bg.replace('bg-', 'border-').split(' ')[1] ?? 'border-gray-100'}`}>
                    {getSkillMeta(selectedSkill).icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedSkill}</h2>
                    <p className="text-gray-400 text-sm mt-0.5">
                      {skillEmployeesLoading ? 'Loading…' : `${skillEmployees.length} employee${skillEmployees.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button onClick={closeSkillRack} className="text-gray-400 hover:text-gray-600 transition p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Filter by experience</label>
                  <select
                    value={skillExpFilter}
                    onChange={e => handleSkillExpFilterChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
                  >
                    {EXP_FILTER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-5">
                  <button
                    onClick={generateSkillExcel}
                    disabled={skillEmployees.length === 0 || skillExcelGenerating}
                    className="bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap"
                  >
                    {skillExcelGenerating ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Excel
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Employee list inside panel */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {skillEmployeesLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : skillEmployees.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-12">No employees match this filter.</p>
              ) : (
                <div className="space-y-3">
                  {skillEmployees.map(emp => (
                    <div
                      key={emp.employee_id}
                      className="bg-gray-50 hover:bg-white border border-gray-100 hover:border-blue-100 hover:shadow-sm rounded-2xl p-4 transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                          <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline">{emp.email}</a>
                        </div>
                        <span className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          {emp.employee_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Designation</p>
                          <p className="text-gray-700 font-medium text-sm truncate">{emp.current_designation || '—'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Current Skill</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                            {emp.current_skill || '—'}
                          </span>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Total Exp</p>
                          <p className="text-gray-700 font-medium text-sm">{emp.total_exp} <span className="text-gray-400 text-xs font-normal">yrs</span></p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Skill Exp</p>
                          <p className="text-gray-700 font-medium text-sm">{emp.current_skill_exp} <span className="text-gray-400 text-xs font-normal">yrs</span></p>
                        </div>
                        {emp.primary_skill && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-gray-400 text-xs mb-0.5">Primary Skill</p>
                            <p className="text-gray-700 font-medium text-sm truncate">{emp.primary_skill}</p>
                          </div>
                        )}
                        {emp.secondary_skill && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-gray-400 text-xs mb-0.5">Secondary Skill</p>
                            <p className="text-gray-700 font-medium text-sm truncate">{emp.secondary_skill}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

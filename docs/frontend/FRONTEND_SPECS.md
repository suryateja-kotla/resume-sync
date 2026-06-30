# Frontend Specifications — Resume Management & Employee Skills Portal

> **Tech Stack:** React 18 · TypeScript · Vite · React Router v6 · Axios · Tailwind CSS

---

## 1. Application Overview

Single-page application with two distinct portals:

| Portal | Route Prefix | Access |
|---|---|---|
| Employee Portal | `/employee-dashboard` | Employees (any non-HR email) |
| HR Portal | `/hr-dashboard` | HR users (role == "HR") |
| Monthly Update Form | `/monthly-update` | Public (token-gated) |
| Login | `/login` | Public |

---

## 2. Routing Structure

```
/
├── /login                          (public)
├── /monthly-update                 (public, token-gated)
├── /employee-dashboard             (protected: role == EMPLOYEE)
│   ├── Tab: My Profile
│   └── Tab: Upload Resume
└── /hr-dashboard                   (protected: role == HR)
    ├── Tab: Skill Racks
    ├── Tab: Candidate Search
    └── Tab: Reports
```

**Route guard:** `ProtectedRoute` component checks `AuthContext`. Redirects to `/login` if unauthenticated. Redirects to role-appropriate dashboard if wrong role tries to access the other portal.

---

## 3. Auth Context (`context/AuthContext.tsx`)

**Status:** Implemented

**State:**
```typescript
interface AuthUser {
  email: string;
  name: string;
  employee_id: string;
  role: "EMPLOYEE" | "HR";
}
```

**Methods:** `login(email)`, `logout()`  
**Persistence:** `localStorage` (survives page refresh)  
**API call:** `POST /api/login`

---

## 4. API Layer (`api/axios.ts`)

**Status:** Implemented  
**Base URL:** `http://localhost:8000/api` (env var: `VITE_API_BASE_URL`)

**Interceptors needed (missing):**
- Request: attach session token / email header if needed.
- Response: global 401 handler → redirect to `/login`.
- Response: global error toast notification.

---

## 5. Pages

---

### 5.1 Login Page (`pages/Login.tsx`)

**Status:** Implemented

**Layout:**
- Centered card with org logo.
- Single email input field.
- "Sign In" button.
- No password field (email-only auth).

**Behavior:**
1. Submit email → `POST /api/login`.
2. Store user in `AuthContext`.
3. Redirect: HR → `/hr-dashboard`, Employee → `/employee-dashboard`.
4. Show error message on invalid email.

**Validation:**
- Email format check (regex).
- Empty field check.
- API error display (e.g., "Email not found in system").

---

### 5.2 Employee Dashboard (`pages/EmployeeDashboard.tsx`)

**Status:** Implemented (core), some fields missing

#### Layout
```
┌─────────────────────────────────────────────────────┐
│  Header: Name · Designation · Last Updated · Logout  │
├──────────────┬──────────────────────────────────────┤
│  [My Profile]│  [Upload Resume]                     │  ← Tab bar
├──────────────┴──────────────────────────────────────┤
│                   Tab Content                        │
└─────────────────────────────────────────────────────┘
```

#### Tab 1: My Profile

**Sections (accordion-based):**

| Section | Fields | Edit Mode |
|---|---|---|
| Personal Info | Name, Email, Mobile, Designation, Department, Location, Joining Date, Total Exp, Relevant Exp | Yes |
| Professional Summary | Auto-generated paragraph | Read-only (edit via re-upload) |
| Technical Skills | Grouped by category; add/remove chips | Yes |
| Work Experience | Per-project accordion (Project, Client, Role, Dates, Domain, Team Size, Tech Stack, Responsibilities) | Yes |
| Education | Degree, University, Year | Yes |
| Certifications | Name, Provider, Date | Yes |
| Achievements | Free-text list | Yes |

**Missing fields (need to add):**
- Mobile number (currently not shown)
- Location / city field
- Relevant experience (separate from total)
- LinkedIn / portfolio URL

**Actions (top-right):**
- `Download Resume` → `GET /api/download-resume?email=...&format=docx`
- `Edit Profile` → toggles inline edit mode
- `Save Changes` → `PUT /api/employee-profile`

**Completion Indicator:**
- Circular progress badge showing `resume_completion_percentage` from backend.
- Color: red < 50%, amber 50–79%, green ≥ 80%.

**Version History Panel (missing):**
- Collapsible section at the bottom.
- Lists all versions with date and trigger.
- "Download Version" link per entry.
- Data from `GET /api/resume-versions?email=...`.

---

#### Tab 2: Upload Resume

**Status:** Implemented

**Layout:**
- Drag-and-drop zone (accepts PDF, DOCX, DOC).
- File size limit display (10 MB).
- Upload button.
- Progress indicator during processing (AI extraction can take 10–30 seconds).
- Result preview: shows extracted profile once done.

**Flow:**
1. Employee selects/drops file.
2. `POST /api/upload-resume` (multipart form).
3. Show spinner with status messages: "Extracting...", "Generating resume...".
4. On success: switch to "My Profile" tab with populated data.
5. On error: show error message with retry option.

**Accepted formats:** `.pdf`, `.docx`, `.doc`  
**Max size:** 10 MB (enforced client-side before upload)

---

### 5.3 HR Dashboard (`pages/HRDashboard.tsx`)

**Status:** Partially implemented (only Candidate Search tab exists)

#### Tab 1: Skill Racks (missing)

**Purpose:** Visual overview of all skills and headcount — primary HR landing view.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Skill Racks                          [Filter: All ▼]│
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Java    │  │  .NET    │  │  Python  │          │
│  │  18 emp  │  │  12 emp  │  │  9 emp   │          │
│  │ 14 proj  │  │  9 proj  │  │ 7 proj   │          │
│  │  4 bench │  │  3 bench │  │ 2 bench  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

- Grid of skill cards.
- Each card shows: skill name, total employees, on-project count, on-bench count.
- Click on card → opens slide-over panel (or navigates to filtered view) showing employee list for that skill.
- Data from `GET /api/hr/skill-summary`.

**Skill Employee Slide-Over Panel:**
- Triggered by clicking a skill card.
- Shows table: Name · Employee ID · Current Role · Total Exp · Skill Exp · Bench Status · Current Project.
- "Download Excel" button for filtered list.
- Data from `GET /api/hr/skill-employees?skill=Java`.

---

#### Tab 2: Candidate Search (Implemented)

**Layout:**
- Chat-style interface.
- Natural language query input at bottom.
- Conversation history with candidate result cards.
- Quick suggestion chips: "Show all bench resources", "Java developers with 5+ years", etc.

**Candidate Card fields:**
- Name, Employee ID, Designation, Dept, Current Role
- Total Experience, Bench Status badge
- Matching skills highlighted
- Email link

**Actions:**
- `Download Excel` → `GET /api/download-excel?skill=...` (with current search context as filters)

---

#### Tab 3: Reports (missing)

**Purpose:** Generate and download filtered Excel reports.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Generate Report                                     │
├─────────────────────────────────────────────────────┤
│  Filters:                                           │
│  Technology:   [___________▼]                       │
│  Department:   [___________▼]                       │
│  Location:     [___________▼]                       │
│  Experience:   [Min ___] to [Max ___] years         │
│  Bench Status: [ ] All  [x] Bench  [ ] Project      │
│  Joining Date: [From ____] [To ____]                │
│  Role:         [___________▼]                       │
│  Certification:[___________]                        │
│                                                     │
│  [Generate Report]   ← triggers download            │
└─────────────────────────────────────────────────────┘
```

- All filters are optional.
- `Generate Report` → `GET /api/download-excel?{query_params}` → browser download.
- Show loading spinner while report generates.
- Show employee count preview before download ("128 employees match these filters").

---

### 5.4 Monthly Update Form (`pages/MonthlyUpdateForm.tsx`)

**Status:** Missing — needs to be created

**Purpose:** Public page (no login required) that employees access from the monthly reminder email link.

**URL:** `/monthly-update?token={UUID}`

**Flow:**
1. On mount: `GET /api/monthly-update/verify-token?token={token}`.
2. If invalid/expired: show error message ("This link has expired. Contact HR.").
3. If valid: show pre-filled form with current employee data.

**Form Sections:**

| Section | Fields |
|---|---|
| Current Role | Text input (pre-filled) |
| Current Project | Project Name, Client, Role, Start Date, Tech Stack (chips), Domain |
| New Skills | Multi-select or chip input (add skills not already in profile) |
| New Certifications | Cert Name, Provider, Completion Date |
| Achievements | Free-text textarea (new achievements this period) |
| Technology Updates | Add/remove technologies from current project stack |

**Submission:**
- `POST /api/monthly-update` with `{ token, updates }`.
- Show success screen: "Your resume has been updated! Download updated resume."
- Show error screen with retry option.

---

## 6. Shared Components

### 6.1 `components/ProtectedRoute.tsx`
**Status:** Implemented  
Wraps role-specific routes. Checks `AuthContext.user` and `user.role`.

---

### 6.2 `components/Header.tsx` (missing)
- Org logo (left).
- Employee name + designation (center or right).
- Last updated date.
- Logout button → clears `AuthContext`, redirects to `/login`.

---

### 6.3 `components/SkillChip.tsx` (missing)
- Reusable chip for individual skill display.
- Props: `name`, `category`, `removable`, `onRemove`.
- Color-coded by category.

---

### 6.4 `components/FileUploadZone.tsx` (extract from EmployeeDashboard)
- Drag-and-drop area.
- Props: `onFileSelect`, `accept`, `maxSizeMB`.
- Client-side validation before upload.

---

### 6.5 `components/ProgressRing.tsx` (missing)
- SVG circular progress indicator.
- Props: `percentage`, `size`, `strokeWidth`.
- Used for resume completion %.

---

### 6.6 `components/Toast.tsx` / `context/ToastContext.tsx` (missing)
- Global notification system.
- Types: `success`, `error`, `info`, `warning`.
- Auto-dismiss after 4 seconds.
- Stacks multiple toasts.

---

### 6.7 `components/SlideOver.tsx` (missing)
- Right-side panel overlay.
- Used by HR Skill Rack for employee list.
- Props: `isOpen`, `onClose`, `title`, `children`.

---

### 6.8 `components/Spinner.tsx` (missing)
- Reusable loading indicator.
- Sizes: `sm`, `md`, `lg`.

---

### 6.9 `components/EmptyState.tsx` (missing)
- Generic empty state illustration + message.
- Props: `message`, `subtext`, `action` (optional button).

---

## 7. State Management

**Current approach:** React Context only (AuthContext).

**Additional contexts needed:**

### `context/ToastContext.tsx`
Global toast notification queue.

### `context/ProfileContext.tsx` (optional)
Cache employee profile data across tabs to avoid re-fetching on every tab switch.

```typescript
interface ProfileContextValue {
  profile: EmployeeProfile | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  updateProfile: (data: Partial<EmployeeProfile>) => Promise<void>;
}
```

---

## 8. TypeScript Interfaces

```typescript
// Auth
interface AuthUser {
  email: string;
  name: string;
  employee_id: string;
  role: "EMPLOYEE" | "HR";
}

// Skill
interface Skill {
  category: string;
  name: string;
  proficiency?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  years_of_experience?: number;
}

// Work Experience / Project
interface WorkExperience {
  project_name: string;
  client_name: string;
  role: string;
  domain: string;
  start_date: string;
  end_date: string | null;
  duration: string;
  team_size: number;
  technology_stack: string[];
  responsibilities: string[];
}

// Education
interface Education {
  degree: string;
  university: string;
  graduation_year: number;
}

// Certification
interface Certification {
  name: string;
  provider: string;
  completion_date: string;
}

// Employee Profile (full)
interface EmployeeProfile {
  employee_id: string;
  email: string;
  personal_info: PersonalInfo;
  professional_summary: string;
  skills: Skill[];
  work_experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  achievements: string[];
  resume_completion_percentage: number;
  version: number;
  last_updated: string;
}

interface PersonalInfo {
  name: string;
  email: string;
  mobile: string;
  designation: string;
  department: string;
  current_role: string;
  location: string;
  total_experience: number;
  relevant_experience: number;
  joining_date: string;
}

// HR - Skill Rack
interface SkillSummary {
  skill: string;
  category: string;
  total_employees: number;
  on_project: number;
  on_bench: number;
}

// HR - Candidate
interface Candidate {
  employee_id: string;
  name: string;
  email: string;
  designation: string;
  current_role: string;
  total_experience: number;
  bench_status: "BENCH" | "PROJECT";
  matching_skills: string[];
}

// Resume Version
interface ResumeVersion {
  version: number;
  generated_at: string;
  trigger: "UPLOAD" | "MONTHLY_UPDATE" | "MANUAL_EDIT";
}
```

---

## 9. API Service Functions (`api/`)

### `api/auth.ts`
```typescript
export const login = (email: string): Promise<AuthUser>
```

### `api/employee.ts`
```typescript
export const getProfile = (email: string): Promise<EmployeeProfile>
export const updateProfile = (email: string, data: Partial<EmployeeProfile>): Promise<EmployeeProfile>
export const uploadResume = (email: string, file: File): Promise<EmployeeProfile>
export const downloadResume = (email: string, format: "docx" | "pdf"): Promise<Blob>
export const getResumeVersions = (email: string): Promise<ResumeVersion[]>
```

### `api/hr.ts`
```typescript
export const getSkillSummary = (): Promise<SkillSummary[]>
export const getSkillEmployees = (skill: string): Promise<Candidate[]>
export const getEmployees = (filters: EmployeeFilters): Promise<PaginatedResult<Candidate>>
export const searchCandidates = (query: string, email: string): Promise<Candidate[]>
export const downloadExcel = (filters: ReportFilters): Promise<Blob>
```

### `api/monthlyUpdate.ts`
```typescript
export const verifyToken = (token: string): Promise<{ valid: boolean; employee: PersonalInfo }>
export const submitUpdate = (token: string, updates: MonthlyUpdatePayload): Promise<void>
```

---

## 10. Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=Resume Sync
VITE_MAX_UPLOAD_SIZE_MB=10
```

---

## 11. File Structure

```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── axios.ts             (implemented)
    │   ├── auth.ts              (needed)
    │   ├── employee.ts          (needed)
    │   ├── hr.ts                (needed)
    │   └── monthlyUpdate.ts     (needed)
    ├── context/
    │   ├── AuthContext.tsx      (implemented)
    │   ├── ToastContext.tsx     (needed)
    │   └── ProfileContext.tsx   (optional)
    ├── pages/
    │   ├── Login.tsx            (implemented)
    │   ├── EmployeeDashboard.tsx(implemented, partial)
    │   ├── HRDashboard.tsx      (implemented, partial)
    │   └── MonthlyUpdateForm.tsx(needed)
    ├── components/
    │   ├── ProtectedRoute.tsx   (implemented)
    │   ├── Header.tsx           (needed)
    │   ├── SkillChip.tsx        (needed)
    │   ├── FileUploadZone.tsx   (extract from dashboard)
    │   ├── ProgressRing.tsx     (needed)
    │   ├── Toast.tsx            (needed)
    │   ├── SlideOver.tsx        (needed)
    │   ├── Spinner.tsx          (needed)
    │   └── EmptyState.tsx       (needed)
    └── types/
        └── index.ts             (needed — all interfaces above)
```

---

## 12. Missing Implementations (Priority Order)

| Priority | Feature | Files |
|---|---|---|
| P0 | Monthly Update Form page + token verification | `pages/MonthlyUpdateForm.tsx`, `api/monthlyUpdate.ts` |
| P0 | Resume download button (DOCX/PDF) in Employee Dashboard | `api/employee.ts`, `pages/EmployeeDashboard.tsx` |
| P0 | Toast notification system | `context/ToastContext.tsx`, `components/Toast.tsx` |
| P1 | HR Skill Racks tab (cards + slide-over) | `pages/HRDashboard.tsx`, `components/SlideOver.tsx`, `api/hr.ts` |
| P1 | HR Reports tab with filter form | `pages/HRDashboard.tsx`, `api/hr.ts` |
| P1 | Resume version history panel in Employee Dashboard | `pages/EmployeeDashboard.tsx`, `api/employee.ts` |
| P1 | Resume completion percentage indicator | `components/ProgressRing.tsx`, `pages/EmployeeDashboard.tsx` |
| P1 | Missing profile fields (mobile, location, relevant exp, LinkedIn) | `pages/EmployeeDashboard.tsx` |
| P2 | Shared TypeScript types file | `types/index.ts` |
| P2 | API service abstraction (auth, employee, hr, monthlyUpdate) | `api/*.ts` |
| P2 | Axios interceptors (401 redirect, global error handling) | `api/axios.ts` |
| P2 | Shared Header component with logout | `components/Header.tsx` |
| P2 | SkillChip, Spinner, EmptyState components | `components/*.tsx` |
| P3 | Client-side form validation (react-hook-form or manual) | All form pages |
| P3 | FileUploadZone as standalone component | `components/FileUploadZone.tsx` |
| P3 | `.env` setup with `VITE_API_BASE_URL` | `.env.local` |

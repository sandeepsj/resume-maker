# V1 Implementation Plan

## Overview

This plan breaks down the Resume Maker v1 into phases, ordered by dependency. Each phase builds on the previous.

---

## Phase 1: Foundation (Week 1)

**Goal**: Working app skeleton with auth and DB.

### Tasks
- [x] Initialize Next.js project (App Router, TypeScript, Tailwind)
- [x] Initialize git repository
- [x] Write documentation (docs/ folder)
- [ ] Configure MongoDB Prisma schema
- [ ] Set up NextAuth.js with Google OAuth + Prisma adapter
- [ ] Implement auth middleware (protect dashboard routes)
- [ ] Create landing page (`/`) with Google sign-in button
- [ ] Create root layout and dashboard layout (sidebar + topnav shell)
- [ ] Set up shadcn/ui components (Button, Card, Input, Dialog, etc.)
- [ ] Create `src/lib/prisma.ts` singleton
- [ ] Create `src/lib/anthropic.ts` singleton
- [ ] Create `src/lib/utils.ts` (cn function)
- [ ] Set up `.env.example` with all required variables

### Deliverables
- User can sign in with Google
- Dashboard shell renders (empty state)
- DB connection verified

---

## Phase 2: Career History (Week 1-2)

**Goal**: Full CRUD for all career data.

### Tasks
- [ ] API routes: `/api/career/profile` (GET, PUT)
- [ ] API routes: `/api/career/experience` (GET, POST, PUT, DELETE)
- [ ] API routes: `/api/career/education` (GET, POST, PUT, DELETE)
- [ ] API routes: `/api/career/skills` (GET, POST, PUT, DELETE)
- [ ] `useCareerData` hook (React Query or SWR for data fetching)
- [ ] UserProfile form (headline, summary, contact, links)
- [ ] Experience list + ExperienceForm (add/edit/delete)
- [ ] Education list + EducationForm
- [ ] Skills manager (add/remove/categorize skills)
- [ ] Zod validation schemas for all career data
- [ ] Career section navigation (`/career/experience`, `/career/education`, `/career/skills`)

### Deliverables
- User can manage their complete career history

---

## Phase 3: Resume Generation (Week 2)

**Goal**: AI-powered resume creation from career data + job description.

### Tasks
- [ ] `ResumeContent` TypeScript type definitions (`src/types/resume.ts`)
- [ ] API route: `POST /api/resumes` (create shell)
- [ ] API route: `POST /api/ai/generate-resume` (streaming SSE)
- [ ] Prompt template: `src/prompts/generate-resume.ts`
- [ ] `useAIStream` hook (SSE consumer)
- [ ] `GenerateWizard` component (multi-step):
  - Step 1: Job details form
  - Step 2: Experience selection checkboxes
  - Step 3: Review and generate
  - Step 4: Streaming progress display
- [ ] `ResumeContent` component (renders ResumeContent JSON as styled HTML)
  - All sections with `data-section-key` attributes
- [ ] Resume detail page (`/resumes/[resumeId]`)
- [ ] Parse and save streamed JSON to database on completion

### Deliverables
- User can generate a tailored resume in ~15-30 seconds
- Resume content renders correctly in the viewer

---

## Phase 4: Resume History & Management (Week 2-3)

**Goal**: Resume list, management, basic editing.

### Tasks
- [ ] API route: `GET /api/resumes` (paginated list)
- [ ] API route: `GET /api/resumes/[resumeId]` (full resume)
- [ ] API route: `DELETE /api/resumes/[resumeId]`
- [ ] Dashboard page: resume cards grid (`/dashboard`)
- [ ] `ResumeCard` component (title, company, date, status badge)
- [ ] Resume list page (`/resumes`)
- [ ] `useResume` hook
- [ ] Resume status indicators (DRAFT, GENERATING, READY, EXPORTED)
- [ ] Empty state for new users (prompt to fill career history first)

### Deliverables
- All resumes visible in history
- User can navigate to and view any resume

---

## Phase 5: Inline Commenting & AI Edits (Week 3)

**Goal**: Text selection → comment → AI applies the change.

### Tasks
- [ ] `useTextSelection` hook (browser Selection API → sectionKey)
- [ ] `SelectionToolbar` component (floating toolbar on text select)
- [ ] `CommentPopover` component (textarea for change request)
- [ ] API route: `POST /api/resumes/[resumeId]/comments` (create comment)
- [ ] API route: `GET /api/resumes/[resumeId]/comments` (list)
- [ ] API route: `DELETE /api/resumes/[resumeId]/comments/[commentId]`
- [ ] `useComments` hook
- [ ] API route: `POST /api/ai/apply-comment` (streaming SSE)
- [ ] Prompt template: `src/prompts/apply-comment.ts`
- [ ] `CommentThread` sidebar component (list of all comments)
- [ ] `CommentBubble` indicators on commented text
- [ ] `ResumeVersion` snapshot creation before each AI edit
- [ ] `AIGeneratingOverlay` component (loading state during AI processing)
- [ ] Comment status flow: PENDING → PROCESSING → APPLIED / DISMISSED

### Deliverables
- User can select text, submit change request, AI applies it in real-time

---

## Phase 6: PDF Export (Week 3-4)

**Goal**: Download resumes as PDF.

### Tasks
- [ ] Choose export strategy: @react-pdf/renderer (simpler, no browser) vs Puppeteer
- [ ] Implement PDF generation in `src/lib/pdf.ts`
- [ ] API route: `POST /api/resumes/[resumeId]/export`
- [ ] Storage setup (local filesystem for dev, S3/cloud for prod)
- [ ] `ExportPanel` component (trigger + download link)
- [ ] Print-friendly CSS for resume rendering (if Puppeteer approach)
- [ ] Store `pdfUrl` on Resume record

### Deliverables
- User can download any resume as a PDF

---

## Phase 7: Polish & UX (Week 4)

**Goal**: Production-ready UI/UX.

### Tasks
- [ ] Responsive design (mobile-friendly dashboard and viewer)
- [ ] Error boundaries and graceful error states
- [ ] Loading skeletons for all data-fetching screens
- [ ] Toast notifications (success/error feedback)
- [ ] Keyboard shortcuts (basic)
- [ ] SEO meta tags for public pages
- [ ] Favicon and app icons
- [ ] Settings page (account info, delete account)
- [ ] Onboarding flow for new users (fill career profile prompt)

---

## Phase 8: Deployment (Week 4)

### Tasks
- [ ] Set up MongoDB Atlas cluster (if not already)
- [ ] Configure environment variables in deployment platform
- [ ] Deploy to Vercel (or self-hosted)
- [ ] Update Google OAuth redirect URIs for production domain
- [ ] `npx prisma db push` against production MongoDB
- [ ] Smoke test all features in production

---

## Future Phases (V2)

- Resume version history UI (revert to previous version)
- Multiple resume templates
- Cover letter generation
- LinkedIn profile import
- ATS score analysis
- Resume sharing (public links)
- Bulk export / resume comparison

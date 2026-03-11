# Product Requirements

## Vision

A personal, AI-powered resume builder that knows your entire career history and can tailor a professional resume for any job application in seconds. Unlike static resume editors, the AI understands both who you are and what the role needs.

## Users

Any user can sign up via Google OAuth. Each user has their own isolated workspace with their career profile, generated resumes, and history.

## Core Features

### 1. Google OAuth Authentication

- Users sign in via Google (no password required)
- Sessions persisted in database
- All data strictly scoped to authenticated user
- Protected routes redirect unauthenticated users to login

### 2. Career History Management

Users maintain a single source-of-truth profile that feeds all resume generation:

**Work Experience**
- Company, job title, location
- Start/end dates (or "current")
- Free-text description of responsibilities
- Key highlights / achievements (bullet-point style)
- Multiple entries, ordered by recency

**Education**
- Institution, degree, field of study
- Start/end dates
- GPA (optional)
- Honors, activities

**Skills**
- Skill name, category (Technical, Language, Soft, Tool, Framework, Certification)
- Proficiency level (Beginner → Expert)

**Personal Profile**
- Name, headline (e.g. "Senior Software Engineer")
- Professional summary (raw notes, AI will polish it per-resume)
- Contact: email, phone, location
- Links: LinkedIn, GitHub, portfolio

### 3. Tailored Resume Generation

- User pastes a job description + enters target role/company
- User selects which experiences to include (or uses all)
- AI generates a complete, tailored resume:
  - Summary rewritten to match the role
  - Experience bullets rewritten with strong action verbs, quantified results, JD-matching keywords
  - Skills grouped and filtered for relevance
  - ATS-optimized output
- Generation is streamed in real-time (user sees it being written)
- Generated resume stored as structured JSON

### 4. Resume History

- Every resume created is stored permanently
- List view shows: title, target company/role, creation date, status
- Users can view, edit, re-generate, or delete any past resume
- Full version history: every AI edit creates a snapshot (future: revert to previous version)

### 5. Inline AI Editing via Comments

- In the resume viewer, users can select any text (a bullet, a sentence, a phrase)
- A toolbar appears near the selection
- User types a change request: e.g. "Make this more concise" or "Add a metric here" or "Change tone to be more assertive"
- Comment is saved with precise location data (which section, which text, character offsets)
- User triggers AI to apply the edit
- AI receives the full resume + the specific comment and returns the updated resume JSON
- Only the targeted section changes — rest of resume is preserved
- A version snapshot is saved before every AI edit

### 6. Resume Export

- Users can export any resume as a PDF
- PDF generation server-side for consistent rendering
- Download link provided after generation

### 7. Resume Templates (Future)

- Multiple visual templates (modern, classic, minimal, creative)
- Template selected at resume creation time or switched later
- Template affects visual rendering only — underlying JSON content is template-agnostic

## Non-Functional Requirements

- **Performance**: AI streaming so users see output immediately, not wait for full response
- **Security**: All data scoped to authenticated user; no cross-user data access
- **Scalability**: Stateless API routes; database is single source of truth
- **Usability**: Clean, distraction-free UI with sensible defaults
- **Reliability**: Resume content always preserved before AI edits (version snapshots)

## Out of Scope (v1)

- Resume sharing / public links
- Collaboration / multi-user editing
- Custom template builder
- LinkedIn profile import
- ATS score analysis
- Cover letter generation (planned for v2)
- Version revert UI (snapshots are saved but revert UI is v2)

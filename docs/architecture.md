# Technical Architecture

## Technology Stack

| Technology | Version | Role |
|---|---|---|
| Next.js | 15.x (App Router) | Full-stack framework (server + client) |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety throughout |
| NextAuth.js | 5.x (Auth.js beta) | Google OAuth, session management |
| Mongoose | 8.x | MongoDB ODM / data modeling |
| MongoDB | 7.x | Primary database (Atlas or local) |
| Anthropic Claude SDK | latest | AI resume generation + editing |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui + Radix UI | latest | Accessible UI components |
| Zod | 3.x | Runtime validation / schema definition |
| React Hook Form | 7.x | Form state management |
| Lucide React | latest | Icon library |

## Project Structure

```
resume-maker/
├── prisma/
│   └── schema.prisma              # Database schema
├── docs/                          # This documentation
├── plans/                         # Implementation plans
├── public/                        # Static assets
└── src/
    ├── app/                       # Next.js App Router
    │   ├── layout.tsx             # Root layout
    │   ├── page.tsx               # Landing page
    │   ├── (auth)/                # Public auth routes
    │   │   └── login/
    │   ├── (dashboard)/           # Protected app routes
    │   │   ├── layout.tsx         # Dashboard shell (sidebar, nav)
    │   │   ├── dashboard/         # Home dashboard
    │   │   ├── career/            # Career history CRUD
    │   │   │   ├── experience/
    │   │   │   ├── education/
    │   │   │   └── skills/
    │   │   ├── resumes/           # Resume management
    │   │   │   ├── new/           # Create resume wizard
    │   │   │   └── [resumeId]/    # Resume viewer/editor
    │   │   └── settings/
    │   └── api/                   # API routes
    │       ├── auth/[...nextauth]/
    │       ├── career/
    │       │   ├── experience/[id]/
    │       │   ├── education/[id]/
    │       │   └── skills/[id]/
    │       ├── resumes/
    │       │   └── [resumeId]/
    │       │       ├── comments/[commentId]/
    │       │       └── export/
    │       └── ai/
    │           ├── generate-resume/
    │           └── apply-comment/
    ├── auth.ts                    # NextAuth.js configuration
    ├── middleware.ts              # Route protection
    ├── lib/
    │   ├── mongodb.ts             # Mongoose + MongoClient connection
    │   ├── models/                # Mongoose models
    │   │   ├── User.ts
    │   │   ├── UserProfile.ts
    │   │   ├── Experience.ts
    │   │   ├── Education.ts
    │   │   ├── Skill.ts
    │   │   ├── Resume.ts
    │   │   ├── ResumeVersion.ts
    │   │   └── Comment.ts
    ├── components/
    │   ├── ui/                    # shadcn/ui primitives
    │   ├── layout/                # Sidebar, TopNav, UserMenu
    │   ├── career/                # Career history forms/cards
    │   ├── resume/                # Resume viewer, editor, comments
    │   ├── ai/                    # AI status overlays
    │   └── shared/                # Shared utility components
    ├── hooks/
    │   ├── useTextSelection.ts    # Text selection detection
    │   ├── useComments.ts         # Comment CRUD
    │   ├── useResume.ts           # Resume data fetching
    │   ├── useCareerData.ts       # Career data fetching
    │   └── useAIStream.ts         # SSE streaming hook
    ├── lib/
    │   ├── prisma.ts              # Prisma client singleton
    │   ├── anthropic.ts           # Anthropic client singleton
    │   ├── auth.ts                # Auth helper utilities
    │   ├── pdf.ts                 # PDF generation
    │   ├── validations.ts         # Shared Zod schemas
    │   └── utils.ts               # cn() and general utils
    ├── prompts/
    │   ├── generate-resume.ts     # AI resume generation prompt
    │   └── apply-comment.ts       # AI inline edit prompt
    └── types/
        ├── resume.ts              # Resume content type definitions
        ├── career.ts              # Career history types
        └── comment.ts             # Comment types
```

## Data Flow

```
User Career Profile (DB)
  ├── UserProfile (contact, summary)
  ├── Experience[] (jobs, bullets)
  ├── Education[]
  └── Skills[]
        │
        ▼
  POST /api/ai/generate-resume
        │
        ├─ Fetch career data from DB
        ├─ Build prompt (prompts/generate-resume.ts)
        ├─ Call Anthropic API (streaming)
        └─ Stream JSON response to client
                │
                ▼
        Resume.content (JSON) ──► DB save
                │
                ▼
        ResumeContent.tsx renders HTML
                │
        User selects text ──► Comment created in DB
                │
                ▼
        POST /api/ai/apply-comment
                │
                ├─ Fetch resume + comment from DB
                ├─ Build prompt (prompts/apply-comment.ts)
                ├─ Call Anthropic API (streaming)
                └─ Update resume content + save version snapshot
```

## Authentication Architecture

- **Provider**: NextAuth.js v5 with Google OAuth
- **Adapter**: `@auth/prisma-adapter` stores sessions, accounts in PostgreSQL
- **Middleware**: `src/middleware.ts` protects all `/(dashboard)` and `/api` routes (except `/api/auth`)
- **Session strategy**: Database sessions (not JWT) for revocability

## API Design Principles

1. All API routes validate session via `auth()` from NextAuth
2. All database queries include `userId` filter — no cross-user data access possible
3. AI routes return `text/event-stream` for streaming responses
4. Zod validates all request bodies before processing
5. Errors return structured JSON: `{ error: string, code?: string }`

## AI Architecture

Two AI workflows, both using Anthropic Claude:

**Generation**: Full resume from career data + job description → streamed JSON
**Editing**: Surgical update of specific resume section based on user comment → streamed JSON

Both use:
- Structured JSON output (Claude instructed to return valid JSON only)
- Streaming via `createStream()` from Anthropic SDK
- Server-Sent Events (SSE) to stream to client
- Version snapshots before any modification

See [ai-workflows.md](./ai-workflows.md) for full prompt designs.

# Database Schema

## Database: MongoDB (via Prisma)

MongoDB is used as the primary database, accessed through Prisma ORM with the MongoDB connector. This gives us the flexibility of a document-oriented store (great for the flexible `Resume.content` JSON field) with the type safety of Prisma's generated client.

## Collections (Prisma Models)

### Auth Collections (NextAuth.js / Auth.js Prisma Adapter)

**Account** — OAuth provider accounts linked to a user
```
_id           String   (ObjectId)
userId        String
type          String
provider      String   (e.g. "google")
providerAccountId String
access_token  String?
refresh_token String?
expires_at    Int?
token_type    String?
scope         String?
id_token      String?
session_state String?
```

**Session** — Active user sessions
```
_id          String   (ObjectId)
sessionToken String   (unique)
userId       String
expires      DateTime
```

**VerificationToken** — Email verification (not used in Google-only auth, kept for adapter compatibility)
```
identifier String
token      String
expires    DateTime
```

### Core Collections

**User**
```
_id           String   (ObjectId)
name          String?
email         String?  (unique)
emailVerified DateTime?
image         String?
createdAt     DateTime
updatedAt     DateTime
```

**UserProfile** — Career profile and contact info
```
_id          String   (ObjectId)
userId       String   (unique, ref: User)
headline     String?  e.g. "Senior Software Engineer"
summary      String?  Raw professional summary (AI polishes per-resume)
phone        String?
location     String?
linkedinUrl  String?
githubUrl    String?
portfolioUrl String?
createdAt    DateTime
updatedAt    DateTime
```

**Experience** — Work history entries
```
_id         String    (ObjectId)
userId      String    (indexed, ref: User)
company     String
title       String
location    String?
startDate   DateTime
endDate     DateTime? (null if current role)
isCurrent   Boolean   default: false
description String    Free-text responsibilities
highlights  String[]  Key achievements / bullet points
createdAt   DateTime
updatedAt   DateTime
```

**Education**
```
_id         String    (ObjectId)
userId      String    (indexed, ref: User)
institution String
degree      String
field       String?
startDate   DateTime
endDate     DateTime?
gpa         String?
honors      String?
activities  String[]
createdAt   DateTime
updatedAt   DateTime
```

**Skill**
```
_id      String        (ObjectId)
userId   String        (indexed, ref: User)
name     String
category SkillCategory (TECHNICAL | LANGUAGE | SOFT | TOOL | FRAMEWORK | CERTIFICATION)
level    SkillLevel    (BEGINNER | INTERMEDIATE | ADVANCED | EXPERT)
createdAt DateTime
```

**Resume** — Generated resumes with full AI content
```
_id             String       (ObjectId)
userId          String       (indexed, ref: User)
title           String       User-given name e.g. "Stripe SWE 2025"
jobTitle        String?      Target job title
companyName     String?      Target company
jobDescription  String?      Full job description text
content         Json         ResumeContent (see ai-workflows.md for schema)
templateId      String       default: "modern"
status          ResumeStatus (DRAFT | GENERATING | READY | EXPORTED)
pdfUrl          String?      Storage URL after PDF export
pdfGeneratedAt  DateTime?
aiModel         String?      e.g. "claude-sonnet-4-6"
createdAt       DateTime
updatedAt       DateTime
```

**ResumeVersion** — Snapshot history before each AI edit
```
_id       String   (ObjectId)
resumeId  String   (indexed, ref: Resume)
content   Json     Full ResumeContent snapshot
changeLog String?  Description of what changed e.g. "Applied comment: rephrase bullet 2"
createdAt DateTime
```

**Comment** — Inline user comments linked to resume text selections
```
_id          String        (ObjectId)
resumeId     String        (indexed, ref: Resume)
sectionKey   String        e.g. "experience.0.bullets.2" or "summary"
selectedText String        The exact text the user selected
anchorOffset Int           Character offset in sectionKey text
focusOffset  Int
body         String        The user's change request
status       CommentStatus (PENDING | PROCESSING | APPLIED | DISMISSED)
aiResponse   String?       AI's explanation of what it changed
resolvedAt   DateTime?
createdAt    DateTime
updatedAt    DateTime
```

## Key Design Decisions

### Resume.content as JSON/Document
MongoDB is ideal here — the `Resume.content` field is a deeply nested JSON document (`ResumeContent` type) with arrays of experiences, bullets, skills etc. In MongoDB this is a natural document embed. Prisma's `Json` type maps directly.

### Embedded vs Referenced
- Career data (Experience, Education, Skill) are separate collections — they're the source of truth edited independently from resumes
- `ResumeContent` in `Resume.content` is a *copy* of relevant data, rewritten by AI — not a live reference. This means resumes don't change if career history is edited later.
- `ResumeVersion` snapshots the entire `content` JSON for full history

### Indexes
- `Experience.userId` — for fetching all experiences for a user
- `Education.userId` — same
- `Skill.userId` — same
- `Resume.userId` — for listing user's resumes
- `ResumeVersion.resumeId` — for listing versions of a resume
- `Comment.resumeId` — for listing comments on a resume

## MongoDB Connection

Uses MongoDB Atlas (cloud) or a local MongoDB instance.

```
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/resumemaker?retryWrites=true&w=majority"
```

Or local development:
```
DATABASE_URL="mongodb://localhost:27017/resumemaker"
```

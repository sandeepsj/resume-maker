# API Reference

All API routes require authentication. Unauthenticated requests return `401`.
All routes return `Content-Type: application/json` unless otherwise noted.
Error responses: `{ "error": "message" }`

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/[...nextauth]` | NextAuth.js handler |
| POST | `/api/auth/[...nextauth]` | NextAuth.js handler |

## Career History

### Experiences

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career/experience` | List all experiences |
| POST | `/api/career/experience` | Create experience |
| GET | `/api/career/experience/[id]` | Get single experience |
| PUT | `/api/career/experience/[id]` | Update experience |
| DELETE | `/api/career/experience/[id]` | Delete experience |

**POST/PUT `/api/career/experience`**
```json
{
  "company": "Acme Corp",
  "title": "Software Engineer",
  "location": "San Francisco, CA",
  "startDate": "2022-01-01T00:00:00Z",
  "endDate": null,
  "isCurrent": true,
  "description": "Built scalable APIs...",
  "highlights": [
    "Led migration to microservices, reducing latency by 40%",
    "Mentored 3 junior engineers"
  ]
}
```

**GET `/api/career/experience`** response:
```json
[
  {
    "id": "...",
    "company": "Acme Corp",
    "title": "Software Engineer",
    ...
  }
]
```

### Education

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career/education` | List all education entries |
| POST | `/api/career/education` | Create education entry |
| PUT | `/api/career/education/[id]` | Update education |
| DELETE | `/api/career/education/[id]` | Delete education |

**POST/PUT body:**
```json
{
  "institution": "MIT",
  "degree": "B.Sc.",
  "field": "Computer Science",
  "startDate": "2016-09-01T00:00:00Z",
  "endDate": "2020-05-01T00:00:00Z",
  "gpa": "3.8",
  "honors": "Magna Cum Laude",
  "activities": ["ACM Club", "Hackathon Organizer"]
}
```

### Skills

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career/skills` | List all skills |
| POST | `/api/career/skills` | Create skill |
| PUT | `/api/career/skills/[id]` | Update skill |
| DELETE | `/api/career/skills/[id]` | Delete skill |

**POST/PUT body:**
```json
{
  "name": "TypeScript",
  "category": "TECHNICAL",
  "level": "EXPERT"
}
```

### User Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career/profile` | Get user profile |
| PUT | `/api/career/profile` | Update user profile |

**PUT body:**
```json
{
  "headline": "Senior Software Engineer",
  "summary": "10 years building scalable web applications...",
  "phone": "+1 555 123 4567",
  "location": "San Francisco, CA",
  "linkedinUrl": "https://linkedin.com/in/...",
  "githubUrl": "https://github.com/..."
}
```

---

## Resumes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/resumes` | List all resumes (paginated) |
| POST | `/api/resumes` | Create empty resume record |
| GET | `/api/resumes/[resumeId]` | Get resume with content |
| PUT | `/api/resumes/[resumeId]` | Update resume metadata/content |
| DELETE | `/api/resumes/[resumeId]` | Delete resume |
| POST | `/api/resumes/[resumeId]/export` | Trigger PDF export |

**GET `/api/resumes`** query params:
- `page` (default: 1)
- `limit` (default: 20)

**GET `/api/resumes`** response:
```json
{
  "resumes": [
    {
      "id": "...",
      "title": "Stripe SWE 2025",
      "jobTitle": "Senior Software Engineer",
      "companyName": "Stripe",
      "status": "READY",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:05:00Z"
    }
  ],
  "total": 12,
  "page": 1
}
```

**POST `/api/resumes`** (create shell before generation):
```json
{
  "title": "Stripe SWE 2025",
  "jobTitle": "Senior Software Engineer",
  "companyName": "Stripe",
  "jobDescription": "We are looking for..."
}
```

**POST `/api/resumes/[resumeId]/export`** response:
```json
{
  "pdfUrl": "https://storage.example.com/resumes/xyz.pdf"
}
```

---

## Comments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/resumes/[resumeId]/comments` | List all comments |
| POST | `/api/resumes/[resumeId]/comments` | Create comment from text selection |
| PUT | `/api/resumes/[resumeId]/comments/[commentId]` | Update comment status |
| DELETE | `/api/resumes/[resumeId]/comments/[commentId]` | Delete comment |

**POST `/api/resumes/[resumeId]/comments`** body:
```json
{
  "sectionKey": "experience.0.bullets.2",
  "selectedText": "Led migration of monolithic architecture",
  "anchorOffset": 0,
  "focusOffset": 38,
  "body": "Make this more specific — add what technology we migrated to and the impact"
}
```

**GET `/api/resumes/[resumeId]/comments`** response:
```json
[
  {
    "id": "...",
    "sectionKey": "experience.0.bullets.2",
    "selectedText": "Led migration...",
    "body": "Make this more specific...",
    "status": "APPLIED",
    "aiResponse": "Added the specific migration target (Kubernetes microservices) and quantified the 40% latency reduction.",
    "createdAt": "..."
  }
]
```

---

## AI Routes

All AI routes return `Content-Type: text/event-stream`.

### Generate Resume
`POST /api/ai/generate-resume`

**Request:**
```json
{
  "resumeId": "...",
  "jobTitle": "Senior Software Engineer",
  "companyName": "Stripe",
  "jobDescription": "We are looking for...",
  "selectedExperienceIds": ["exp_1", "exp_2"]
}
```

**Stream events:**
```
data: {"type":"chunk","text":"{\n  \"header\": {"}
data: {"type":"chunk","text":"\n    \"name\": \"John Doe\""}
...
data: {"type":"done","resumeId":"..."}
```

### Apply Comment
`POST /api/ai/apply-comment`

**Request:**
```json
{
  "resumeId": "...",
  "commentId": "..."
}
```

**Stream events:**
```
data: {"type":"chunk","text":"{\n  \"updatedResume\": {"}
...
data: {"type":"done","explanation":"Added specific technology and quantified the impact metric."}
```

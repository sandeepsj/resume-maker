# AI Workflows

## Overview

The application uses Anthropic's Claude (claude-sonnet-4-6 by default) for two primary workflows:

1. **Full Resume Generation** — Creates a complete tailored resume from career history + job description
2. **Inline Comment Application** — Applies a user's specific change request to a targeted section of a resume

Both use streaming responses via Server-Sent Events (SSE) so users see output in real-time.

---

## Workflow 1: Full Resume Generation

### Trigger
User completes the "New Resume" wizard:
- Fills in job title, company name
- Pastes the job description
- Selects which experiences to include
- Clicks "Generate Resume"

### API Route
`POST /api/ai/generate-resume`

```json
Request body:
{
  "resumeId": "cuid",
  "jobTitle": "Senior Software Engineer",
  "companyName": "Stripe",
  "jobDescription": "We are looking for...",
  "selectedExperienceIds": ["exp_1", "exp_2"]
}
```

### Server Flow

```
1. Validate session (auth())
2. Validate request body (Zod)
3. Fetch from DB:
   - UserProfile (name, contact, headline, raw summary)
   - Experiences (filtered to selectedExperienceIds if provided)
   - Education (all)
   - Skills (all)
4. Set Resume.status = GENERATING
5. Build prompt from prompts/generate-resume.ts
6. Call anthropic.messages.stream()
7. Pipe stream to client via SSE (text/event-stream)
8. On stream end:
   - Parse complete JSON from accumulated text
   - Save to Resume.content
   - Set Resume.status = READY
   - Create ResumeVersion snapshot
```

### Prompt Design

**System prompt:**
```
You are an expert professional resume writer with deep knowledge of ATS optimization,
hiring practices, and effective resume writing. You will be given a person's career
history and a job description. Your task is to generate a tailored, professional resume
in a specific JSON format.

Rules:
- Only use information from the provided career history. Do not invent facts.
- Rewrite experience bullet points to use strong action verbs and quantify achievements.
- Mirror keywords and phrases from the job description naturally.
- Keep the tone professional and confident.
- The resume should be ATS-friendly.
- Return ONLY valid JSON matching the schema provided. No markdown, no explanation.
```

**User prompt structure:**
```
CAREER PROFILE:
Name: {name}
Headline: {headline}
Contact: {email} | {phone} | {location}
LinkedIn: {linkedinUrl}
GitHub: {githubUrl}
Raw Professional Summary: {profile.summary}

WORK EXPERIENCE:
[For each selected experience, ordered by start date desc]:
  {title} at {company} ({location})
  {startDate} - {endDate or "Present"}
  Description: {description}
  Key highlights:
    - {highlight1}
    - {highlight2}
    ...

EDUCATION:
[For each education]:
  {degree} in {field}, {institution}
  {startDate} - {endDate}
  GPA: {gpa}, Honors: {honors}

SKILLS:
Technical: {skills where category=TECHNICAL, joined by comma}
Languages: {skills where category=LANGUAGE}
Tools: {skills where category=TOOL}
Frameworks: {skills where category=FRAMEWORK}

TARGET JOB:
Title: {jobTitle}
Company: {companyName}
Job Description:
{jobDescription}

OUTPUT SCHEMA:
Return a JSON object with this exact structure:
{schema as pretty-printed JSON type definition}

Generate the tailored resume now:
```

### Resume JSON Schema (output)

```typescript
interface ResumeContent {
  header: {
    name: string
    headline: string
    email: string
    phone?: string
    location?: string
    linkedinUrl?: string
    githubUrl?: string
    portfolioUrl?: string
  }
  summary: string
  experience: Array<{
    id: string                    // Original Experience.id for traceability
    company: string
    title: string
    location?: string
    startDate: string             // "Jan 2022" format
    endDate: string               // "Present" or "Dec 2024"
    bullets: string[]
  }>
  education: Array<{
    id: string
    institution: string
    degree: string
    field?: string
    graduationDate: string
    gpa?: string
    honors?: string
  }>
  skills: Array<{
    category: string
    skills: string[]
  }>
  certifications?: Array<{
    name: string
    issuer: string
    date?: string
  }>
}
```

---

## Workflow 2: Inline Comment Application

### Trigger
User selects text in the rendered resume → types a change request in the comment popover → clicks "Apply AI Edit"

### API Route
`POST /api/ai/apply-comment`

```json
Request body:
{
  "resumeId": "cuid",
  "commentId": "cuid"
}
```

### Server Flow

```
1. Validate session
2. Fetch Resume and Comment from DB
3. Verify Resume.userId === session.user.id
4. Set Comment.status = PROCESSING
5. Build prompt from prompts/apply-comment.ts
6. Call anthropic.messages.stream()
7. Pipe stream to client via SSE
8. On stream end:
   - Parse JSON from response
   - Create ResumeVersion snapshot (save current content BEFORE edit)
   - Update Resume.content with new content
   - Set Comment.status = APPLIED
   - Set Comment.aiResponse = explanation from AI
```

### Prompt Design

**System prompt:**
```
You are editing a specific section of a professional resume based on a user's change request.
Your task is to make ONLY the requested change, leaving all other sections exactly as they are.

Rules:
- Make surgical, minimal edits. Only change what the user requested.
- Preserve the existing tone, style, and formatting of the rest of the resume.
- Keep bullet points in the same format (action verb, achievement, quantification).
- Do not add new information not present in the original.
- Return two things in your JSON response:
  1. The complete updated resume JSON (same schema as input)
  2. A brief explanation (1-2 sentences) of what you changed
- Return ONLY valid JSON. No markdown, no other text.
```

**User prompt structure:**
```
CURRENT RESUME JSON:
{JSON.stringify(resume.content, null, 2)}

EDIT REQUEST:
- Section: {comment.sectionKey}
  (e.g. "experience.0.bullets.2" = 3rd bullet of 1st experience)
- Selected text: "{comment.selectedText}"
- User's request: "{comment.body}"

Return a JSON object with this structure:
{
  "updatedResume": { ...complete ResumeContent JSON... },
  "explanation": "Brief description of what was changed"
}
```

### Text Selection System

The `useTextSelection` hook detects text selections within the resume viewer:

1. Attaches `mouseup` / `touchend` listeners to the resume container div
2. Reads `window.getSelection()` to get the selection range
3. Walks the DOM up from the anchor node to find the nearest element with `data-section-key` attribute
4. Extracts the `sectionKey` (e.g. `"experience.0.bullets.2"`) from that attribute
5. Returns: `{ selectedText, sectionKey, anchorOffset, focusOffset }`

Every text node in `ResumeContent.tsx` is wrapped in a span with:
```html
<span data-section-key="experience.0.bullets.2">
  Led migration of monolithic architecture to microservices...
</span>
```

This allows precise identification of which part of the resume was selected, enabling AI to know exactly what to change.

---

## Streaming Implementation

### Server Side (API route)

```typescript
// Pseudocode for streaming route
export async function POST(req: Request) {
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta") {
          const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
```

### Client Side (`useAIStream` hook)

```typescript
// Pseudocode for SSE consumer
const response = await fetch("/api/ai/generate-resume", { method: "POST", body });
const reader = response.body?.getReader();
let accumulated = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split("\n").filter(l => l.startsWith("data: "));

  for (const line of lines) {
    const data = line.replace("data: ", "");
    if (data === "[DONE]") { onComplete(accumulated); return; }
    const { text: chunk } = JSON.parse(data);
    accumulated += chunk;
    onChunk(accumulated);  // Update UI incrementally
  }
}
```

---

## Model Configuration

Default model: `claude-sonnet-4-6` (balances quality and speed)

- **Max tokens**: 4096 for generation, 2048 for comment edits
- **Temperature**: 0.3 for generation (consistent, professional), 0.1 for edits (precise)
- **Model stored**: `Resume.aiModel` records which model generated the resume (for debugging/reproducibility)

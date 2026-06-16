# Roadmap — Tasks model, resume matching & MCP connector

Tracking doc for a batch of related features. We ship these **one phase at a time**;
each phase below is independently shippable and ordered by dependency. Check items
off as we go.

Legend: **UI** = browser app, **MCP** = Claude.ai / MCP custom connector, **Both** = exposed in both.

---

## Background / current state

- Career data lives in Google Drive: `Resume Maker/career/experiences.json` (array of `ExperienceData`).
- Today an experience is a single blob: `description: string` + `highlights: string[]`
  (`src/types/career.ts`). There is no notion of discrete "tasks".
- Resume creation (`src/pages/NewResumePage.tsx`) lets the user pick whole experiences,
  then `buildGenerateResumePrompt` (`src/prompts/generate-resume.ts`) feeds `description`
  + all `highlights` to the model.
- Resume collection lives at `Resume Maker/resumes/{uuid}/resume.json`; listed in
  `ResumesPage`, read + commented in `ResumeViewer`.
- AI goes through the shared llm-proxy via `src/lib/ai-client.ts`. No backend in this repo.
- There is a `drive-mcp-connector` skill that builds a thin Cloudflare Worker on the shared
  `drive-mcp` core for exactly this kind of Drive-backed SPA — use it for the MCP phase.

---

## Phase 1 — Experience → tasks (sub-elements)  [foundational]

Restructure an experience so it holds a **summary** plus a list of discrete **tasks**.
Everything in Phases 2 & 4 depends on this.

**Data model** (`src/types/career.ts`):
```ts
export interface ExperienceTask {
  id: string;
  title: string;          // short label, e.g. "Built real-time ingestion pipeline"
  details?: string;       // optional longer description of the accomplishment
  skills?: string[];      // technologies/skills used — helps matching + keyword bolding
  isDefault?: boolean;    // included by default when creating a new resume (Phase 2)
}

export interface ExperienceData {
  // ...existing fields...
  description: string;     // now = summary of the overall role
  highlights: string[];    // LEGACY — keep for back-compat, migrate into tasks
  tasks: ExperienceTask[]; // NEW
}
```

- [x] **UI** Add `tasks` to the type + Drive read/write (`src/lib/google-drive.ts`).
- [x] **UI** Backward-compat migration on read (`normalizeExperience`): if `tasks` is empty
      and `highlights` has items, synthesize one task per highlight (`title = highlight`,
      `isDefault: true`, deterministic `legacy-{i}` ids). Non-destructive — `highlights` kept.
- [x] **UI** Experience editor: add/edit/reorder (▲▼)/delete tasks with title, optional
      details, skills (comma-separated), and an "include by default" checkbox; `description`
      relabelled "Role Summary".
- [x] Resolved: on save, tasks persist with real uuids (legacy ids regenerated) and
      `highlights` is written as a derived mirror of task titles so existing resume generation
      keeps working. **Remove the `highlights` mirror in Phase 2** once generation reads tasks.

## Phase 2 — Select tasks when building a resume + default selection  [depends on P1]

- [x] **UI** `NewResumePage` step 2: selected experiences expand to show task checkboxes
      (with per-experience All/None), pre-checked from `defaultTaskIds` (isDefault, else all).
- [x] **UI** `selectedTasks: Record<expId, Set<taskId>>` threaded into generation (also
      added to the undo snapshots).
- [x] **UI** `buildGenerateResumePrompt` now renders each role's **summary + selected tasks**
      (title + details + skills); `add-experience` prompt switched to tasks too. The legacy
      `highlights` mirror is gone — generation reads tasks, editor clears `highlights` on save.
- [x] **UI** "Save current selection as default" button → `saveDefaultTaskSelection` writes
      per-task `isDefault` back to `experiences.json`.
- [x] Regenerate flow (`ResumeViewer`) filters each experience to its default tasks
      (isDefault, fallback all).

## Phase 3 — Find best-fitting resume for a job description  [independent]

Given a pasted JD, rank the **existing** resume collection and surface the best fit.

**Design: keywords-as-vectors, AI for extraction only, ranking is deterministic.**
Every resume is pre-translated (once) into a list of **weighted keywords** ordered by their
importance *in that resume*, cached in a metadata file next to the resume. AI is used only to
*extract* keywords — from a resume (at create/update time) and from the JD (once per search).
The actual ranking is a plain, deterministic algorithm over the keyword vectors, so searching
the collection costs **one** AI call (the JD), not one per resume.

### Shared keyword extractor module  (`src/lib/keyword-extractor.ts`)

Used for both resumes and job descriptions, so the two are directly comparable.

```ts
interface WeightedKeyword {
  keyword: string;   // normalized: lowercased, trimmed, canonical form
  weight: number;    // importance IN-CONTEXT, 0..1, list sorted descending
}

// AI call (llm-proxy, strict JSON schema). Returns keywords ordered by how
// prominent/important each is in THIS text. A resume that foregrounds Java
// returns java with a high weight; one that mentions it in passing, a low weight.
extractKeywords(text: string, accessToken: string): Promise<WeightedKeyword[]>
```

- The weight must reflect **priority in the source text**, not mere presence — this is the
  whole point. The extractor prompt asks the model to rank keywords by importance and assign a
  normalized weight (or rank → weight), returning them sorted high→low.
- Normalize keywords (lowercase/trim; basic alias/synonym folding e.g. "JS"→"javascript" is a
  later enhancement) so resume and JD keywords line up.

### Deterministic scoring  (same module)

```ts
scoreResume(jd: WeightedKeyword[], resume: WeightedKeyword[]): number
rankResumes(jd: WeightedKeyword[], resumes: {id; keywords}[]): {id; score}[]  // sorted desc
```

- Score = weighted overlap: for each JD keyword `k`, contribute `jdWeight[k] * resumeWeight[k]`
  (resume weight 0 if absent). I.e. a **weighted dot product** of the two keyword vectors;
  consider cosine-normalizing by the resume vector to avoid favoring longer resumes.
- This satisfies the priority requirement: if the JD weights `java` very high, a resume that
  also weights `java` high yields a large product and ranks above a resume where `java` is
  present but low-priority (small product). Presence alone isn't enough — **aligned priority**
  wins.

### Tasks

- [x] **Both** `src/lib/keyword-extractor.ts`: `extractKeywords` (AI, weighted+sorted) +
      deterministic `scoreResume` / `rankResumes` (cosine over keyword vectors) + `hashText`.
      Pure/headless so the MCP tool (Phase 4) reuses it.
- [x] **UI** Keywords cached on `resume.json` (`keywords` + `keywordsHash` fields on
      `DriveResumeFile`); hash is over the flattened resume text so we re-extract only when
      content changes.
- [x] **Lazy** extraction (`ensureResumeKeywords` in `resume-matching.ts`): extracts+caches
      on first match; the content hash auto-invalidates after any edit, so no per-edit hooks
      are needed. (Proactive post-generation extraction skipped to avoid extra writes/latency;
      hash-staleness covers correctness.)
- [x] **Both** `findBestResume(jobDescription, accessToken, onProgress)` in
      `src/lib/resume-matching.ts`: 1 AI call for the JD → ensure/rank each READY resume →
      ranked results with score + matched keywords.
- [x] **UI** `FindBestMatch` modal (launched from `ResumesPage` "Find Best Match"): paste JD →
      ranked results with score + matched-keyword chips → click to open. Best fit is badged.
- [ ] Optional (deferred): deep-score the top candidate with the strict ATS rubric for a
      human-readable explanation.

**Open Qs (P3) — resolved:** weight scale = 0..1 assigned by the model, deduped keeping max;
ranking uses **cosine** (normalizes for resume length); canonicalization = lowercase/trim +
model-side alias folding (synonym dictionary deferred); metadata stored as **fields on
`resume.json`** (not a sidecar) so it rides the existing read/write/caching path.

## Phase 4 — MCP connector  [depends on P1 for experience/task tools]

Built as `apps/resume-maker-mcp` in the **`/media/extra/Developer/drive-mcp`** repo
(thin adapter on `@drive-mcp/core`; tree-shaped, uses `token()` + Drive helpers).
**The SPA is unchanged.** Code/tests/local-boot all pass; deployment is the user's
interactive GCP/Cloudflare step (see that app's `README.md`).

**Deployed:** `https://resume-maker-mcp.sandeepsj0000.workers.dev` (MCP endpoint `/mcp`).
Remaining: user sets `GOOGLE_CLIENT_SECRET`, adds the `…/callback` redirect URI to the GCP
OAuth client, and adds the connector in Claude.ai.

Tools (all implemented):
- [x] **MCP** `create_resume` — generate a JD-tailored resume from stored career data
      (experiences + default tasks) and return a deep link that opens it in the SPA
      (`https://sandeepsj.github.io/resume-maker/#/resumes/{id}`).
- [x] **MCP** `list_resumes` — browse the collection (metadata).
- [x] **MCP** `get_resume` — read a resume's content + comments.
- [x] **MCP** `add_comment` — add a PENDING comment to a resume section.
- [x] **MCP** `find_best_resume` — best-fit-by-JD (ports Phase 3 keyword matching; reuses
      cached `keywords`/`keywordsHash` on `resume.json`, extracts JD + any missing via llm-proxy).
- [x] **MCP** `add_experience` — create a new experience (summary + tasks).
- [x] **MCP** `add_tasks` — append tasks to an experience (the "populate tasks via MCP" ask).
- [x] **MCP** `get_career_overview` — experiences + task ids (the read side the write tools need).
- [x] Auth/storage: Google `drive.file` via the core; data shapes mirror the SPA exactly
      (`src/types.ts`) so both read/write compatible JSON.
- [ ] **User step:** deploy + connect (GCP OAuth client in the SPA's project, Cloudflare KV/
      deploy/secrets, add connector in Claude.ai) — see `apps/resume-maker-mcp/README.md`.

---

## Open questions (resolve before/within the relevant phase)

1. ~~Keep `highlights` forever as legacy, or migrate-and-drop on first task edit?~~
   **Resolved (P1):** lazy read-migration + a derived `highlights` mirror written on save;
   the mirror gets removed in P2 when generation switches to tasks.
2. Default selection granularity: per-task `isDefault` only, or also a named "default set"
   per target-role? Start with per-task `isDefault`. (P2)
3. ~~Matching at scale: single AI call vs. per-resume scoring?~~ **Resolved (P3):**
   AI extracts keywords only (once per resume, cached; once per JD per search); ranking is a
   deterministic weighted-dot-product over keyword vectors — no per-resume AI call.
4. MCP hosting: confirm the shared `drive-mcp` core + a new thin Worker per the skill. (P4)

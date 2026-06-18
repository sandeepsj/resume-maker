# MCP Connector

Lets an LLM (Claude.ai web, Gemini CLI/Enterprise) read your resumes & career data
and write back to the **same Google Drive files this app uses** — so you can create
resumes, populate experience tasks, add review comments, and find the best-fit resume
straight from a chat.

**The SPA needs zero changes for this.** The connector is a separate Cloudflare Worker
(a thin adapter on the shared `@drive-mcp/core`). Its code lives **outside this repo**:

- Code: `/media/extra/Developer/drive-mcp/apps/resume-maker-mcp` (see its `README.md`)
- Built per the `drive-mcp-connector` skill (tree-shaped app → `token()` + Drive helpers)

## Live deployment

- Worker: `https://resume-maker-mcp.sandeepsj0000.workers.dev`
- MCP endpoint (add this in Claude.ai): `https://resume-maker-mcp.sandeepsj0000.workers.dev/mcp`
- Auth: two OAuth layers — Claude ↔ Worker (handled by the core) and Worker ↔ Google
  (`drive.file` scope; refresh token stored in the grant, access tokens minted per call).

## Tools

Full CRUD over career data + resumes, grouped:

- **Experiences & tasks:** `get_career_overview`, `add_experience`, `update_experience`,
  `add_tasks`, `update_task`, `delete_task`, `delete_experience`
- **Profile, skills & education:** `get_profile`, `update_profile`, `add_skills`,
  `update_skill`, `delete_skill`, `add_education`, `update_education`, `delete_education`
- **Resumes:** `prepare_resume` + `save_resume` (create/refresh), `list_resumes`,
  `get_resume`, `delete_resume`, `add_comment`, `delete_comment`,
  `list_resume_texts` + `rank_resumes` (best-fit matching)

**The connector makes no LLM calls / needs no Anthropic key.** Since the MCP client is
already an LLM, generation is client-driven: `prepare_resume` returns the career data +
writing guidance + output schema, the client writes the resume JSON itself (no extra cost),
and `save_resume` stores it (pass a `resumeId` to refresh in place). It returns a deep link
`https://sandeepsj.github.io/resume-maker/#/resumes/{id}` that opens the resume in this app.
Matching works the same way: `list_resume_texts` → client extracts keyword vectors →
`rank_resumes` does the deterministic cosine ranking server-side.

(The **SPA** still generates via the shared llm-proxy — it has no LLM client in the browser.
Only the MCP path is keyless.)

## Setup / connect (one-time)

> ⚠️ The Google OAuth client MUST be in the **same GCP project** that owns the SPA's
> `VITE_GOOGLE_CLIENT_ID`. `drive.file` scope only sees files created by the same
> project — a different project can't see this app's `Resume Maker/` data.

1. **GCP** (that project): enable the Drive API; create an **OAuth client ID → Web
   application** named `resume-maker-mcp`; add redirect URI
   `https://resume-maker-mcp.sandeepsj0000.workers.dev/callback`; add yourself as a test user.
2. **Cloudflare secrets** (the worker is already deployed):
   ```bash
   cd /media/extra/Developer/drive-mcp/apps/resume-maker-mcp
   echo -n "<client-id>"     | npx wrangler secret put GOOGLE_CLIENT_ID
   echo -n "<client-secret>" | npx wrangler secret put GOOGLE_CLIENT_SECRET   # run in a real terminal
   openssl rand -hex 32      | npx wrangler secret put COOKIE_ENCRYPTION_KEY
   echo -n "<your-email>"    | npx wrangler secret put ALLOWED_EMAILS         # optional allowlist
   ```
3. **Claude.ai** → Settings → Connectors → Add custom connector →
   `https://resume-maker-mcp.sandeepsj0000.workers.dev/mcp` → approve → Google sign-in.

## Gotchas

- Re-run the consent flow (re-add the connector) if tools start failing with
  `invalid_grant` — testing-mode consent screens cap refresh tokens at ~7 days.
- Last-write-wins with the live app: if the SPA is open and saving while a tool writes,
  refresh the app after pushing from the LLM.

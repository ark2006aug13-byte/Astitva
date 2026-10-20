# 🧭 CareerPilot AI
### Your Autonomous Job Application Agent — *Upload once. Apply everywhere. Land faster.*

> **Team Astitva** · Track: AI/ML · Kritical Hacks × TinyFish AI
> **Verification status: 36/36 automated checks PASS (live Postgres)** — run `GET /api/verify`

CareerPilot AI is an end-to-end autonomous career agent. It ingests a live job
market into a central pool, matches users with explainable AI scores, tailors
resumes **without ever fabricating a skill**, submits applications through a
real headless browser (TinyFish AI) under a human approval gate, verifies every
submission with screenshot proof, and then keeps working after the apply —
detecting interview emails, building company-specific War Rooms, and sending
follow-ups — until the user is hired.

---

## ⚡ The Problem (30-second version)

| Reality | Number |
|---|---|
| Applications behind one offer | 50–100 |
| Manual form-filling per application | 30–45 min |
| Same personal data re-typed per form | 4–6× |
| Resumes filtered by ATS before a human sees them | ~75% |
| Application → interview conversion | ~2% |
| Feedback received on rejection | 0 |

Existing tools own fragments: mass-apply bots spam and get banned, resume
builders stop at the PDF, interview coaches start too late.
**Nobody owns the journey. CareerPilot does.**

---

## 🧠 The Solution — One Loop, Seven Agents

```
 USER: sign-in → resume → master profile → preferences → channels
   │
   ▼
┌────────────────────────── DAILY AGENT LOOP ──────────────────────────┐
│ ScoutAgent   ingest live job market into central pool (TinyFish)     │
│ MatchAgent   vector pre-filter → LLM re-score → explainable 0–100    │
│ TailorAgent  truthful resume + cover letter + A4 PDF (whitelist)     │
│ SubmitAgent  TinyFish headless browser fills real ATS-style forms    │
│ VerifyAgent  screenshot proof + confirmation id + tracker update     │
│ Sentinel     reads inbox: interview / rejection / offer / noise      │
│ PrepAgent    War Room: research, study plan, mock interview          │
└──────────────────────────────────────────────────────────────────────┘
   │  loop repeats per round → offer → (negotiation on roadmap)
```

**Four non-negotiable pillars**
1. **Quality over spam** — apply only above a user-set match threshold.
2. **Truthfulness** — the TailorAgent may only rephrase skills that exist in
   the parsed resume; a whitelist validator blocks hallucinations in code.
3. **Human-in-the-loop** — Copilot mode requires explicit approval per
   submission; Autopilot is opt-in, capped, audited, and kill-switchable.
4. **Proof, not promises** — every submission stores a screenshot +
   confirmation id; every AI action writes an audit log.

---

## 🏗️ System Architecture

```
┌────────────────────────── CLIENT (Next.js 15, light SaaS theme) ──────────────────────────┐
│ Dashboard · Job Queue · Job Detail · Resume Studio · Approval Center · Kanban · War Room  │
└───────────────────────────────────┬───────────────────────────────────────────────────────┘
                                    │ Server Actions / Route Handlers (zod-validated)
┌───────────────────────────────────▼───────────────────────────────────────────────────────┐
│ ORCHESTRATION: application state machine · cadence limiter · cron workers · audit logger  │
├───────────────┬───────────────────┬───────────────────┬───────────────────────────────────┤
│ INTELLIGENCE  │ AUTOMATION        │ DATA              │ SIGNALS                         │
│ Claude/GPT-4o │ TinyFish AI       │ Supabase Postgres │ Gmail API (or mock inbox)       │
│ (tailor,      │ (scrape, research,│ + Storage (PDFs,  │ Telegram / WhatsApp stubs       │
│  classify,    │  form-fill, proof)│  proofs)          │ Resend (optional real email)    │
│  research)    │                   │ Pinecone vectors  │                                 │
│ Embeddings    │                   │ Redis / in-mem    │                                 │
└───────────────┴───────────────────┴───────────────────┴───────────────────────────────────┘
Auth: Clerk (Google OAuth + phone OTP) · Hosting: Vercel (cron every 6h)
```

### Why a Centralized Job Pool (not per-user scraping)
ScoutAgent ingests the market on a schedule (every 6h, ≤60 TinyFish calls per
run) into one shared pool with canonical dedupe, closed-job detection, ghost
flagging and company enrichment. Matching then runs **entirely locally**:
Pinecone pre-filter → preference filters → LLM re-score of top-15 (cached 24h).
A runtime guard throws in dev if any TinyFish call is made during matching.

```
Per-user scraping:  100 users × 40 jobs  = 4,000 TinyFish calls/day
Central pool:       40 queries × 6 runs  =   240 TinyFish calls/day  (any # of users)
```
Bonus unlocked by the pool: **Market Intelligence** — median salary per role,
8-week hiring trend sparkline, hot-skills chips, similar-jobs neighbors.

---

## 🔁 End-to-End User Journey

1. **Sign in** (Google / phone OTP) → optional resume upload before entering.
2. **Onboarding wizard (≤5 min):** personal info · professional snapshot ·
   screening Q&A bank (AI-drafts essay answers from the resume for review) ·
   automation settings (Copilot/Autopilot, threshold slider default 80,
   daily cap default 5) · channel connect.
3. **Match queue:** jobs with score ring, band (`auto ≥80` / `gap 60–79` /
   `stretch <60`), matched vs missing skill chips, reasons, freshness badge.
4. **Tailor:** side-by-side diff modal, change log, cover letter, A4 PDF.
5. **Approve or Autopilot:** Approval Center streams live TinyFish events
   ("Filling personal info 12/47…") → proof screenshot appears on success.
6. **Track:** 6-column Kanban with proof thumbnails + audit timeline.
7. **Interview detected:** Sentinel classifies inbox (confidence ≥0.7) →
   War Room auto-builds: 8+ past questions, topic clusters, mixed resources
   (podcast/video/article/repo), interviewer intel, 1–7 day study plan
   (≤5 tasks/day), checklist, AI mock interview (score /10 + 3 tips).
8. **Outcomes:** rejection → 80-word feedback-request draft + skill appended
   to `learning_skills` + 90-day re-apply cooldown · silence → 70-word
   follow-up at day 14 · offer → offers table + celebration. Loop repeats.

---

## 🤖 Module Deep-Dives

### 1. Resume Intelligence & Truthful Tailoring
- `pdf-parse` / `mammoth` extraction → LLM structured parse → skill graph.
- `profiles.resume_skills` is the **single source of truth**.
- TailorAgent output is validated: any skill token absent from the whitelist
  → regenerate once → else `hallucination_blocked`.
- `ats_score = 0.7·keyword_coverage + 0.3·skill_coverage`, clamped 40–95
  (never a fake default).

### 2. Submission Engine (state machine)
```
draft → awaiting_approval ─approve→ submitting → submitted → confirmed
  │            │                        │   └→ failed → (retry×2) → manual_queue
  │            └─reject→ closed         └→ submitting_paused (OTP/CAPTCHA,
  └─autopilot≥threshold→ auto_approved ──────┘   10-min TTL) → /resume-input
Kill switch: autopilot→copilot converts pending auto_approved → awaiting_approval.
```
- Cadence limiter: `daily_cap` (default 5) → HTTP 429 `daily_cap_reached`.
- Duplicate guard: `UNIQUE(user_id, job_id)`; rejection sets `reapply_after=+90d`.
- Demo ATS portal (`/demo-portal`): Workday-style multi-step form; same engine
  and adapters target real portals in production. Confirmation `CONF-\d{6}`.

### 3. Sentinel + War Room + Follow-ups
- Classifier audit logs record model, tokens, method (`llm`|`fallback`);
  confidence <0.7 forces `other` — newsletters can never become interviews.
- War Room research audit logs record `tinyfish_live` vs `mock_fixture`;
  rebuild preserves completed tasks (idempotent).
- Follow-up worker: `CRON_SECRET` required (no dev fallback), ≤5 per run,
  idempotent, dispatch logged (`sent_to_provider` | `sent_to_console`).

---

## 🐟 TinyFish AI Integration Map

| # | Where | What TinyFish does |
|---|---|---|
| 1 | ScoutAgent ingestion | Scrape boards + career pages (JS-heavy), structured JD extraction |
| 2 | Company enrichment | Size / industry / tech stack per company (cached 30d) |
| 3 | SubmitAgent | Headless-browser form fill, resume upload, review-page stop, submit |
| 4 | VerifyAgent | Success screenshot + confirmation-id extraction |
| 5 | PrepAgent research | Past interview questions, blogs, podcasts, interviewer intel |
| 6 | Live validation | Pre-submit check that a posting is still open |

Budget guard: ≤60 calls per ingestion run; matching path uses **zero** calls.

---

## 🛡️ Safety, Ethics & Compliance

- Human approval gate (Copilot default) + immutable `audit_logs` per action.
- Autopilot: explicit opt-in, threshold + daily cap, instant proof ping,
  global kill switch.
- Truthfulness validator; change-log transparency before every approval.
- Anti-spam: cadence caps, randomized delays, 90-day cooldowns, ghost-job
  filtering — protects users *and* employers.
- RLS on all tables; cron endpoints secret-guarded; secrets never in client.
- ToS posture: user remains applicant of record; demo submissions run against
  our own sandbox portal.

---

## 🗄️ Data Model (Supabase)

`profiles · preferences · screening_answers · resumes · resume_versions ·
jobs · company_profiles · job_matches_cache · applications ·
approval_requests · application_events · follow_ups · notifications ·
emails_intake · interviews · study_plans · study_tasks · offers ·
demo_submissions · ingestion_runs · custom_scan_requests ·
classifier_audit_logs · research_audit_logs · email_dispatch_logs ·
audit_logs`

## 🔌 Key API Surface

| Route | Purpose |
|---|---|
| `POST /api/jobs/scan` · `GET /api/jobs` · `GET /api/jobs/[id]` | pool sync, matched queue, rich detail + market intel |
| `POST /api/jobs/deep-scan` | 1/day user-triggered niche scan (queued) |
| `POST /api/jobs/[id]/tailor` | truthful resume version + PDF + cover letter |
| `POST /api/applications/draft` · `/approve` · `/submit` · `/resume-input` | state machine + OTP resume |
| `GET /api/applications` · `/api/approvals` · `/api/notifications` | Kanban, gate, feed |
| `POST /api/interviews/sync` · `GET /api/interviews[/id]` · `/rebuild` · `/mock-feedback` | Sentinel + War Room |
| `GET /api/cron/ingest` · `GET /api/cron/follow-ups` | secret-guarded workers |
| `GET /api/verify` | **runs the full V1–V36 self-verification suite** |

---

## ✅ Proof It Works — Self-Verification (V1–V36)

`GET /api/verify` seeds users/jobs, then asserts the entire product:
tailoring whitelist (V3), approval gate (V4–V5), autopilot + audit (V6–V7),
duplicate/cap/kill-switch/reject guards (V8–V11), email classification (V13),
War Room content + readiness math (V14–V16), rejection loop + cooldown (V17),
offer tracking (V18), follow-up idempotency (V19), pool dedupe + closed
detection (V31–V32), zero-TinyFish matching + cache (V33–V34), market intel
(V35), fresh-match alerts (V36). **Current status: 36/36 PASS on live Postgres.**

---

## 🚀 Quickstart

```bash
git clone https://github.com/ark2006aug13-byte/Astitva.git && cd Astitva && npm install
cp .env.example .env.local        # fill keys below
psql -f supabase-schema.sql       # or: supabase db push
npm run dev                       # http://localhost:4000
curl http://localhost:4000/api/verify   # expect 36/36 PASS
```

| Env | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY` | ✅ | auth |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | ✅ | data + storage |
| `PINECONE_API_KEY` | ✅ | vectors |
| `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) | ✅ | intelligence |
| `TINYFISH_API_KEY` | ✅* | automation (*mock adapters without it) |
| `CRON_SECRET` | ✅ | workers (no fallback by design) |
| `RESEND_API_KEY`, `GMAIL_*`, `REDIS_URL` | optional | real email / inbox / limiter |

---

## 🗺️ Roadmap

Offer Negotiation Desk · Referral Booster · Skill-Gap Academy · Voice Career
Coach · B2B Outplacement Suite · multi-country expansion.

## 👥 Team Astitva

Aryan Raj (Resume Intelligence) · Saumya Verma (Match + Tailor) ·
Jayant Sharma (TinyFish Submit/Verify) · Harini Malla (Frontend + Approvals) ·
Sidh Kataria (Scout + War Room + Demo)

---

### ❓ Judge FAQ

**Won't users get banned?** Cadence caps, randomized human-like pacing,
90-day cooldowns, ghost-job filtering, and a human gate — plus TinyFish's
real-browser infra. Spam is architecturally impossible.
**Can the AI lie on a resume?** No — whitelist validator blocks any skill not
in the parsed resume; violations are logged and blocked.
**Is auto-apply reckless?** Opt-in, threshold-gated, capped, audited,
kill-switchable; every submit still produces user-visible proof.
**What if TinyFish/LLM goes down?** Matching runs on the local pool; ingestion
and research degrade to labeled fixtures; submissions retry then queue
manually. Nothing is silently lost.
**How do we know it works?** `/api/verify` — 36 automated end-to-end checks,
green on live Postgres, re-runnable by anyone, anytime.

*We don't stop at "application submitted". We stop at "offer accepted".*

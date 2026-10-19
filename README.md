# SentinelApply — Core Backend (Step A1 & A2)
Autonomous AI Job Application SaaS Backend Architecture powered by TinyFish Web Agents.

---

## 🏗️ Architecture & Tech Stack
- **Runtime:** Node.js (v20+) with TypeScript
- **Web Framework:** Express.js (Modular route & middleware structure)
- **Database & ORM:** Prisma ORM (SQLite for zero-friction local execution, 100% PostgreSQL ready)
- **Validation:** Zod schemas on all incoming request bodies, queries, and environments
- **Cryptography:** Native Node.js `crypto` (zero vulnerable external cryptographic dependencies)
  - CSPRNG 6-digit OTP generation (`crypto.randomInt`)
  - HMAC-SHA256 hashed OTP storage with `crypto.timingSafeEqual` constant-time verification
  - AES-256-GCM authenticated encryption for TinyFish credentials & session vault
  - SHA-256 checksums & magic byte signature inspection (`%PDF-` / `PK\x03\x04`)
  - Pure Node `crypto` HS256 JWT access (15m) + rotating refresh token (7d) sessions

---

## 📁 Project Structure
```
├── prisma/
│   └── schema.prisma                # Full database models: User, GuestResumeSession, Resume,
│                                    # OtpVerification, RefreshTokenSession, EncryptedVaultItem, SecurityAuditLog
├── src/
│   ├── app.ts                       # Express application factory & middleware setup
│   ├── server.ts                    # HTTP server listener & graceful shutdown handlers
│   ├── config/
│   │   └── env.ts                   # Strict environment variable validation with Zod
│   ├── lib/
│   │   ├── prisma.ts                # PrismaClient singleton instance
│   │   └── security/
│   │       ├── jwt.ts               # Access/Refresh/Guest JWT generator & verifiers
│   │       ├── otp-crypto.ts        # CSPRNG OTP generator, HMAC hasher, timingSafeEqual
│   │       ├── vault-crypto.ts      # AES-256-GCM vault encryption & decryption
│   │       ├── file-validator.ts    # Magic byte header inspection & 5MB size validator
│   │       └── rate-limiter.ts      # Sliding-window rate limiters with cooldown
│   ├── middleware/
│   │   ├── auth.middleware.ts       # Bearer token & cookie session hydration
│   │   ├── error.middleware.ts      # Global structured JSON error handler
│   │   └── validate.middleware.ts   # Zod body & query validator middleware
│   ├── routes/
│   │   ├── index.ts                 # Main API V1 router aggregation & /health
│   │   └── auth.routes.ts           # Complete Step A1 & A2 authentication routes
│   └── services/
│       ├── audit.service.ts         # SecurityAuditLog recorder
│       ├── resume-parser.service.ts # Skill preview & job opening match estimation
│       └── sms.service.ts           # SMS dispatch adapter (Dev preview & Twilio hook)
├── scripts/
│   └── verify-auth-flow.ts          # End-to-end integration test of Step A1 & A2
├── .env                             # Local configuration
└── package.json
```

---

## 🚀 Running the Project

### 1. Run Development Server
```bash
npm run dev
```
Server boots on `http://localhost:4000/api/v1` with hot-reloading.

### 2. Run Database Migrations
```bash
npm run db:push
```

### 3. Run Step A1 & A2 Verification Suite
```bash
npm run test:auth
```

---

## 📡 Core API Endpoints (Step A1 & A2)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/guest-resume` | Stage anonymous resume before signup (Magic bytes & SHA-256 validated). Returns `guestToken`. | ❌ No |
| `POST` | `/api/v1/auth/otp/send` | Dispatches 6-digit OTP (CSPRNG, HMAC-SHA256 stored). Includes dev OTP preview in development. | ❌ No |
| `POST` | `/api/v1/auth/otp/verify` | Verifies OTP (`timingSafeEqual`), creates user, **atomically binds staged guest resume** via transaction, and advances step to `A3_MASTER_PROFILE`. | ❌ No |
| `POST` | `/api/v1/auth/oauth/google` | Google OAuth token sync with atomic guest resume claim. | ❌ No |
| `POST` | `/api/v1/auth/clerk/webhook` | Webhook handler for Clerk user synchronization. | ❌ No |
| `POST` | `/api/v1/auth/resume/skip` | Allows user without resume to skip to `A3_MASTER_PROFILE` with `resumePending: true`. | ✅ Yes |
| `GET` | `/api/v1/auth/me` | Hydrates user profile, onboarding step, agent mode (`COPILOT`/`AUTOPILOT`), and primary resume. | ✅ Yes |
| `POST` | `/api/v1/auth/refresh` | Rotating refresh token exchange. Revokes old session and issues new token pair. | ❌ (Refresh Token) |
| `POST` | `/api/v1/auth/logout` | Revokes refresh token session and clears cookies. | ❌ / ✅ |
| `GET` | `/api/v1/health` | Health check endpoint. | ❌ No |

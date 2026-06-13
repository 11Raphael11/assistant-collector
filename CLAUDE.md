# CLAUDE.md — Vosool-Yar project rules (binding)

> این فایل قراردادِ واحدِ پروژه است. در هر مرحله/پرامپت، قبل از نوشتن کد آن را بخوان و دقیقاً رعایت کن.
> This file is the single source of truth. Read and obey it on EVERY step before writing code.

## WORKING LOOP (golden rule)
- Implement EXACTLY ONE build-prompt at a time. Do not jump ahead or implement future steps.
- After coding: run THAT step's tests. Only when GREEN, stop and report. Never proceed on red.
- Keep each module's internals behind its public interface; never change code outside the current step's scope.
- After finishing a step, EXPLAIN TO THE USER IN PERSIAN (فارسی): what was built, which files changed,
  how to run the tests, and confirm the Definition of Done is met.

## BILINGUAL RULE
- Code, file names, identifiers, tests, commit messages = English.
- All explanations addressed to the user = Persian (فارسی).

## TESTING DISCIPLINE
- Every step must have at least ONE happy-path test AND at least ONE edge-case/failure-mode test.
- Code -> test -> pass -> (git commit) -> next step.

---

# GLOBAL PROJECT CONTRACTS
> همهٔ مراحل، بدون استثنا، از این قراردادها ارث‌بری می‌کنند و باید آن‌ها را رعایت کنند.

> همهٔ مراحلِ بعدی، بدون استثنا، از این قراردادها ارث‌بری می‌کنند و باید آن‌ها را رعایت کنند.

### 1) Tech stack (نسخه‌های دقیق)

| Layer | Choice | Pinned version |
|---|---|---|
| Runtime | Node.js | `20.x (LTS)` |
| Package manager | pnpm | `9.x` |
| Full-stack framework | Next.js (App Router) | `15.x` |
| Language | TypeScript (`strict: true`) | `5.x` |
| ORM | Prisma | `5.x` |
| Database | PostgreSQL | `16.x` |
| Validation | Zod | `3.x` |
| Auth/session | HttpOnly cookie session (Lucia-style, hand-rolled) | — |
| Hashing | bcrypt | `5.x` |
| Logger | Pino | `9.x` |
| Jalali dates | jalaali-js | `1.x` |
| Excel parsing | `xlsx` (SheetJS, stream mode) | latest |
| Testing | Vitest | `2.x` |
| E2E | Playwright (smoke only, deploy phase) | `1.x` |
| Lint/format | ESLint + Prettier | latest |
| SMS | Kavenegar (primary) + Melipayamak (fallback) behind adapter | — |
| Payment | Zarinpal / IDPay per-business behind adapter | — |
| Object storage | Arvan (S3-compatible) behind adapter | — |
| Hosting | Liara (App + Postgres) | — |
| Monitoring | Pino + Telegram (day 1); GlitchTip + UptimeRobot (deploy) | — |

**حذف‌شده از MVP:** PDF/Playwright-render، Redis (به‌جایش الگوی Outbox روی Postgres + Advisory Lock).

### 2) Folder / file structure (target tree)

```text
vosool-yar/
├─ docker-compose.yml            # local Postgres only
├─ .env.example                  # always kept in sync
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/                       # Next.js App Router (UI + route handlers)
│  │  ├─ (auth)/                 # login, register
│  │  ├─ (dashboard)/            # protected business panel
│  │  ├─ pay/[token]/            # public payment page (no login)
│  │  ├─ portal/[token]/         # public customer portal (no login)
│  │  └─ api/
│  │     ├─ health/
│  │     ├─ cron/reminders/
│  │     ├─ cron/reconcile/
│  │     └─ payment/callback/
│  ├─ features/                  # one folder per feature; talk only via exported services
│  │  ├─ auth/
│  │  ├─ customers/
│  │  ├─ contracts/
│  │  ├─ installments/
│  │  ├─ imports/
│  │  ├─ ai/
│  │  ├─ dashboard/
│  │  ├─ messaging/              # sms + outbox + reminder engine + templates
│  │  ├─ payments/
│  │  ├─ portal/
│  │  ├─ settings/
│  │  └─ billing/                # plan, subscription, quota, sms-credit
│  ├─ server/
│  │  ├─ db.ts                   # Prisma singleton
│  │  ├─ repository.ts           # createRepository(businessId) tenant scope
│  │  ├─ session.ts
│  │  └─ rate-limit.ts
│  ├─ lib/                       # pure, side-effect-free utilities
│  │  ├─ result.ts  digits.ts  text.ts  phone.ts  money.ts
│  │  ├─ jalali.ts  time.ts  crypto.ts  validation.ts
│  │  ├─ env.ts  logger.ts  telegram.ts  sms-segments.ts
│  └─ providers/                 # external integrations behind interfaces
│     ├─ sms/  payment/  storage/  ai/
└─ tests/                        # cross-feature integration/e2e helpers
```

### 3) Naming conventions

- **Files:** `kebab-case.ts`; React components `PascalCase.tsx`; tests `<name>.test.ts` next to source.
- **Functions/vars:** `camelCase`; types/interfaces/enums `PascalCase`; constants `UPPER_SNAKE_CASE`.
- **Money fields:** always suffixed `Rial` (e.g. `amountRial`). **PII fields:** `<field>Enc`, `<field>Hash`, `<field>Last4`.
- **Server actions:** verb-first (`createCustomer`, `verifyOtp`). **Services** expose only intent-level methods, never raw Prisma.
- **Tests:** `describe('<unit>')` + `it('happy: ...')` and `it('edge: ...')`.

### 4) Testing

- **All tests:** `pnpm test`  •  **Single file/module:** `pnpm test src/lib/phone.test.ts` (or `pnpm test customers`).
- **Watch:** `pnpm test -- --watch`  •  **E2E (deploy phase only):** `pnpm test:e2e`.
- **Minimum per step:** ≥1 happy-path test **and** ≥1 edge/failure test (empty/invalid input, boundary, error path).
- Integration tests that hit the DB use a disposable schema against the local Postgres from `docker-compose`.

### 5) Code style / lint

- ESLint (`@typescript-eslint`, `next/core-web-vitals`) + Prettier. CI gate: `pnpm lint && pnpm typecheck && pnpm test`.
- **`any` is forbidden** — use `unknown` + a type-guard. No non-null `!` except in tests. No `console.log` in app code (use the Pino logger).

### 6) Module map (PUBLIC INTERFACES — the only surface other modules may use)

| Module | Public interface (stable) |
|---|---|
| `lib/result` | `Result<T>`, `ok()`, `err()`, `isOk()` |
| `lib/digits` | `toLatinDigits(s)` |
| `lib/text` | `normalizePersian(s)` |
| `lib/phone` | `normalizePhone(raw): Result<string>` |
| `lib/money` | `formatToman(rial)`, `rialToToman(r)`, `tomanToRial(t)` |
| `lib/jalali` | `toJalali()`, `toGregorian()`, `addJalaliMonths()` |
| `lib/time` | `nowTehran()`, `startOfDayTehran()`, `daysBetweenTehran()` |
| `lib/crypto` | `encryptPII(s)`, `decryptPII(b)`, `blindIndex(s)`, `last4(s)` |
| `lib/validation` | `zPersianDigits`, `parseOrError(schema, input)` |
| `lib/env` | `env` (typed, validated singleton) |
| `lib/logger` / `lib/telegram` | `logger`, `notifyTelegram(msg)` |
| `server/db` | `prisma` (singleton — used ONLY by repositories) |
| `server/repository` | `createRepository(businessId)` (auto tenant scope) |
| `server/session` | `createSession()`, `readSession()`, `destroySession()`, `rotateSession()` |
| `server/rate-limit` | `checkRateLimit(key, limit, windowSec): Result<void>` |
| `providers/sms` | `SmsProvider` interface, `getSmsSender()` |
| `providers/payment` | `PaymentProvider` interface, `getPaymentProvider(businessId)` |
| `providers/storage` | `StorageProvider` interface, `getStorage()` |
| `providers/ai` | `AiProvider` interface, `getAi()` (null when disabled) |
| `features/billing` | `SubscriptionGuard`, `QuotaGuard`, `SmsCreditGuard` |

**Rule:** a feature imports another feature ONLY through its exported service in `features/<x>/index.ts`. UI never imports `prisma`. Repositories are the only DB callers.

### 7) Mandatory layering & cross-cutting rules

- **Layering:** `UI → Server Action/Route → Service → Repository → DB`. UI never touches the DB directly.
- **Anti-IDOR (critical):** every query runs through `createRepository(businessId)` where `businessId` comes **only** from the session — never from URL/body. Public pages resolve scope from a server-validated token.
- **Validation:** every external input validated with Zod on **both** client and server; Persian/Arabic digits converted to Latin **before** Zod.
- **Money & dates:** amounts stored as **integer Rial**, displayed as Toman; conversion to gateway unit only at the gateway boundary. Dates stored **UTC**, displayed **Jalali**; day math uses `Asia/Tehran`.
- **PII & search:** mobile/national-id encrypted with **AES-256-GCM** (`xEnc`); uniqueness/search on **HMAC-SHA256 blind index** (`xHash`); `last4` for display/user search. Never query on the encrypted column.
- **Secrets:** only in `.env`; keep `.env.example` current; per-business gateway keys live **encrypted in the DB**, not in `.env`.
- **Idempotency everywhere it matters:** SMS (`idempotencyKey`), payments (`transactionId UNIQUE`), tokens (one-time-use).

### 8) Error handling & logging conventions

- Services return `Result<T>` (never throw for expected/validation failures). Only truly unexpected faults throw and are caught at the route boundary → mapped to a safe response.
- Every meaningful action logs structured context: `{ businessId, action, result, ... }` via Pino. No PII (no raw phone/national-id) in logs — log `phoneLast4` only.
- Critical failures (DLQ, provider down, cron failure, reconcile mismatch) additionally call `notifyTelegram()`.
- Known-bug coverage: each step writes the test for any bug it prevents (bug IDs referenced inline as `#N`).

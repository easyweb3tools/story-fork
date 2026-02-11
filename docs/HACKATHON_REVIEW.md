# Story-Fork Hackathon Review & Implementation Tasks

## Context

**Hackathon:** x402 Stacks Challenge (https://dorahacks.io/hackathon/x402-stacks/detail)
**Deadline:** 2026-02-16 23:59 UTC (4 days remaining from 2026-02-11)
**Prize:** $3,000 USD (single track, no sub-tracks)
**Competition:** 6 BUIDLs submitted, 100 registered hackers

**Hackathon Goal:** Drive adoption of x402-stacks, build functional MVPs using HTTP 402 + Stacks blockchain payments.

**Submission Requirements:**
1. Public GitHub repository with source code (DONE)
2. Working demo — hosted site, live API, or screencast (MISSING)
3. Video max 5 minutes explaining project + x402-stacks integration (MISSING)

**General Rules:**
- Must integrate x402-stacks and leverage HTTP 402 functionality
- All code must be open source
- No previously published or commercialized projects

---

## Current Project Status

Story-Fork is a decentralized branching fiction platform where readers pay STX micro-payments to unlock story branches and vote on narrative direction. The highest-funded branch becomes "Canon".

### What is already working

- x402 payment server-side logic: `src/lib/x402.ts` has `createPaymentRequired()`, `verifyPayment()`, `isPaymentEnabled()`
- Read endpoint with 402 paywall: `src/app/api/branches/[branchId]/read/route.ts`
- Vote endpoint with 402 paywall + Canon recalculation: `src/app/api/branches/[branchId]/vote/route.ts`
- Story/Branch CRUD: `src/app/api/stories/route.ts`, `src/app/api/branches/route.ts`
- Database schema: `prisma/schema.prisma` (Story, Branch, Payment models)
- Frontend pages: homepage (`src/app/page.tsx`), story detail (`src/app/story/[storyId]/page.tsx`)
- Components: `BranchNode.tsx`, `LuminousFlow.tsx`, `StoryCard.tsx`, `PaymentStatus.tsx`
- Docker full-stack deployment: `docker-compose.yml`
- Dev mode: when `SERVER_ADDRESS` env var is empty, content is free (no payment required)

### What is broken or missing

1. **Frontend has no STX wallet integration** — the browser cannot sign x402 payments
2. **AI Agent uses static templates instead of LLM** — `openclaw-skill/src/tools.ts` `generateBranchOptions()` just uses 3 hardcoded templates
3. **No demo video or working hosted demo for submission**

---

## Task 1: Integrate STX Wallet into Frontend

**Priority:** P0 (blocks demo recording)
**Files to modify:** `src/app/story/[storyId]/page.tsx`, `src/components/BranchNode.tsx`
**New files to create:** `src/lib/wallet.ts` (or similar)

### Problem

The frontend `handleRead()` and `handleVote()` in `src/app/story/[storyId]/page.tsx` (lines 57-123) currently:
1. Call the API without an `x-payment` header
2. Receive a 402 response
3. Simply retry the same request (which fails again if `SERVER_ADDRESS` is set)

There is no wallet connection, no payment signing, and no way for the user to actually pay STX.

### Required Changes

**Step 1: Add a wallet connection library**

Install the Stacks wallet SDK. The recommended package for Stacks web wallet integration is `@stacks/connect`:

```bash
npm install @stacks/connect @stacks/transactions @stacks/network
```

**Step 2: Create a wallet context/provider**

Create `src/lib/wallet.ts` (or `src/components/WalletProvider.tsx`) that:
- Provides a `connectWallet()` function that opens the Hiro/Leather wallet browser extension
- Stores the connected STX address in React state
- Provides a `signPayment(paymentRequirements)` function that:
  1. Takes the `paymentRequirements` object from the 402 response
  2. Constructs a STX transfer transaction to `paymentRequirements.payTo` for `paymentRequirements.maxAmountRequired` micro-STX
  3. Signs it with the connected wallet
  4. Returns the signed payload as a JSON string

**Step 3: Add "Connect Wallet" button to the UI**

Add a wallet connection button in the story page header or in `src/app/layout.tsx`. Show the connected STX address when connected.

**Step 4: Rewrite `handleRead()` and `handleVote()` in `src/app/story/[storyId]/page.tsx`**

Current broken flow (lines 57-87 for read, 89-123 for vote):

```typescript
// CURRENT (broken): just retries without payment
const res = await fetch(`/api/branches/${branchId}/read`);
if (res.status === 402) {
  const retryRes = await fetch(`/api/branches/${branchId}/read`);
  // This will fail again because no payment header is sent
}
```

Required flow:

```typescript
// REQUIRED: handle 402 by signing payment
const res = await fetch(`/api/branches/${branchId}/read`);
if (res.status === 402) {
  const data = await res.json();
  const paymentRequirements = data.paymentRequirements;
  // Sign payment with connected wallet
  const signedPayload = await signPayment(paymentRequirements);
  // Retry with signed payment in header
  const retryRes = await fetch(`/api/branches/${branchId}/read`, {
    headers: { "x-payment": JSON.stringify(signedPayload) }
  });
  if (retryRes.ok) { /* success */ }
}
```

Apply this pattern to both `handleRead()` and `handleVote()`.

### x402-stacks Payment Header Format

The server expects the `x-payment` header to contain a JSON string. The x402-stacks facilitator at `https://facilitator.stacksx402.com` performs:
- `POST /verify` — validates the signed payment payload against the payment requirements
- `POST /settle` — settles the transaction on-chain

Refer to the x402-stacks documentation at https://docs.x402stacks.xyz/ for the exact payload format the client must send in the `x-payment` header. The payload typically includes the signed STX transaction data that the facilitator can verify and settle.

### Verification

After implementation:
1. Set `SERVER_ADDRESS` to a testnet STX address in `.env`
2. Start the app, connect a Hiro/Leather wallet with testnet STX
3. Click "Read" on a locked branch — should prompt wallet for payment
4. After payment approval, branch content should unlock
5. Click "Vote" — should prompt wallet and record the vote
6. Canon badge should shift if the voted branch becomes highest-funded

---

## Task 2: Make OpenClaw Agent Generate Real LLM Content via Story-Fork API

**Priority:** P1 (significantly improves demo quality)
**Files to modify:** `openclaw-skill/src/tools.ts`, `openclaw-skill/src/server-api.ts`, `openclaw-skill/package.json`
**Reference:** `openclaw-skill/skills/story-fork/SKILL.md` (LLM narrative guidelines)

### Architecture Understanding

The OpenClaw agent is an **autonomous service** that runs independently alongside Story-Fork. It does NOT embed in the web app. The entire interaction happens through Story-Fork's REST API:

```
OpenClaw Agent                          Story-Fork Server
     │                                        │
     │  GET /api/stories?status=active         │
     │────────────────────────────────────────>│  (1) Fetch all active stories
     │  [{ id, title, branches: [...] }]       │
     │<────────────────────────────────────────│
     │                                        │
     │  GET /api/branches?storyId=xxx          │
     │────────────────────────────────────────>│  (2) Fetch full branch tree
     │  [{ id, isCanon, totalFunding, ... }]   │      (includes voting data)
     │<────────────────────────────────────────│
     │                                        │
     │  (3) Analyze: find leaves, read Canon   │
     │      path, check voting results         │
     │  (4) LLM generates new branches based   │
     │      on Canon context & vote data       │
     │                                        │
     │  POST /api/branches                     │
     │  { storyId, parentId, title,            │
     │    content, summary, generatedBy:"ai" } │
     │────────────────────────────────────────>│  (5) Push each new branch
     │  201 Created                            │
     │<────────────────────────────────────────│
     │                                        │
     │  (sleep 10 min, repeat)                 │
```

The feedback loop: **Readers vote (via x402 payments) → Canon shifts → Agent reads new Canon → Agent generates branches continuing the crowd-chosen direction → Readers vote again**.

### Problem

`openclaw-skill/src/tools.ts` lines 46-77, `generateBranchOptions()` uses 3 hardcoded static templates instead of calling an LLM:

```typescript
const templates = [
  { direction: "bold", adjective: "daring", action: "charges forward..." },
  { direction: "cautious", adjective: "careful", action: "takes a step back..." },
  { direction: "mysterious", adjective: "enigmatic", action: "discovers a hidden passage..." },
];
```

All branches sound identical and robotic. The `SKILL.md` has detailed narrative guidelines but is never used.

Also, the agent does NOT currently read the Canon path or voting data — it just finds leaves and generates generic content. It should trace `isCanon=true` branches from root to each leaf to understand the "official" storyline before generating continuations.

### Required Changes

**Step 1: Add an LLM client to the agent**

The `entrypoint.sh` already sets up AnyRouter config with these env vars:
- `ANYROUTER_BASE_URL` (default: `https://anyrouter.top`) — OpenAI-compatible API endpoint
- `ANYROUTER_API_KEY` (default: `sk-free`)
- `ANYROUTER_MODEL_ID` (default: `claude-opus-4-6`)

Add the `openai` npm package to `openclaw-skill/package.json` to use AnyRouter as an OpenAI-compatible provider:

```bash
cd openclaw-skill && npm install openai
```

Create an LLM client in `tools.ts`:

```typescript
import OpenAI from "openai";

const llm = new OpenAI({
  baseURL: process.env.ANYROUTER_BASE_URL || "https://anyrouter.top",
  apiKey: process.env.ANYROUTER_API_KEY || "sk-free",
});
const MODEL = process.env.ANYROUTER_MODEL_ID || "claude-opus-4-6";
```

**Step 2: Add a `traceCanonPath()` function**

The agent needs to understand the community-voted storyline before generating continuations. Add a function that traces the Canon path from root to a given leaf:

```typescript
function traceCanonPath(branches: Branch[], targetLeaf: Branch): Branch[] {
  // Build a map of id -> branch for quick lookup
  // Walk from targetLeaf up to root via parentId
  // Return the path from root to leaf
  // Along the way, note which branches are isCanon=true
}
```

This gives the LLM full context of the story readers have voted for.

**Step 3: Rewrite `generateBranchOptions()` to call LLM**

Replace the static template logic. The function should:
1. Accept the Canon path context (not just the immediate parent)
2. Build a prompt that includes:
   - Story title and description
   - The full Canon path narrative (root → ... → parent branch)
   - Voting data: `totalFunding` and `voteCount` for context on reader preferences
   - Guidelines from `SKILL.md` (third person, past tense, 200-500 words, cliffhanger endings, varied tones)
3. Call the LLM via the OpenAI-compatible client
4. Parse the JSON response into `{ title, content, summary }[]`
5. Fall back to existing static templates if LLM call fails

Example prompt structure:

```
You are a narrative AI for Story-Fork. Generate {n} branch options continuing from the current chapter.

Story: "{storyTitle}" — {storyDescription}

Canon path so far (the storyline readers voted for):
Chapter 1: "{chapter1.title}"
{chapter1.content}

Chapter 2: "{chapter2.title}" (funding: {totalFunding} μSTX, votes: {voteCount})
{chapter2.content}

[... more Canon chapters ...]

Current leaf chapter: "{leaf.title}"
{leaf.content}

Generate {2-3} distinct branch options. Each branch must:
- Continue naturally from the current chapter
- Be 200-500 words of narrative prose in third person, past tense
- End at a decision point or cliffhanger
- Feel meaningfully different from sibling branches (vary tone: bold, cautious, surprising)
- Include a 1-2 sentence summary teaser

Return a JSON array:
[{ "title": "3-5 word chapter title", "content": "full narrative text", "summary": "1-2 sentence teaser" }]
```

**Step 4: Add error handling and rate limiting**

- Wrap LLM calls in try/catch, fall back to static templates on failure
- Parse JSON safely (LLMs sometimes return malformed JSON — try extracting JSON from markdown code fences)
- Add a small delay between branches to avoid overwhelming the LLM API
- Log the prompt and response for debugging

### API Endpoints the Agent Uses

These already exist and work correctly. No server changes needed:

| Method | Endpoint | Used for | Response |
|--------|----------|----------|----------|
| `GET` | `/api/stories?status=active` | Fetch active stories with all branches | `[{ id, title, description, genre, status, branches: [...] }]` |
| `GET` | `/api/branches?storyId=xxx` | Fetch branch tree (nested, includes `isCanon`, `totalFunding`, `voteCount`) | `[{ id, parentId, title, content, isCanon, totalFunding, voteCount, children: [...] }]` |
| `POST` | `/api/branches` | Create a new branch | Body: `{ storyId, parentId, title, content, summary, generatedBy: "ai" }` → `201` |
| `POST` | `/api/stories` | Seed a new story with root branch | Body: `{ title, description, genre, rootBranch: { title, content, summary }, generatedBy: "ai" }` → `201` |
| `GET` | `/api/health` | Health check (used by `entrypoint.sh` to wait for server) | `200` |

The existing `server-api.ts` already wraps all of these. No changes needed unless you want to add new query parameters.

### Verification

After implementation:
1. Start Story-Fork server: `npm run dev`
2. Start the agent: `cd openclaw-skill && npx tsx src/tools.ts`
3. Agent should seed a demo story (if none exist), then generate branches
4. Generated branches should have varied, high-quality narrative prose (not template text)
5. Each sibling branch should feel genuinely different in tone and direction
6. Summaries should be compelling teasers that make readers want to pay to read
7. After users vote (changing Canon), the next agent cycle should generate branches that continue the new Canon direction

---

## Task 3: Polish & Bug Fixes

**Priority:** P2 (improves overall quality)

### 3a. Fix BigInt serialization warnings

Throughout the API routes, `BigInt` values are serialized via `toString()`. The current approach works but is manual. Ensure all API responses consistently handle BigInt fields.

### 3b. Root branch auto-reveal

In `src/app/story/[storyId]/page.tsx`, root branches (depth 0) are free but the frontend does not auto-reveal them. On page load, all depth-0 branches should be added to `revealedBranches` state automatically so their content is visible without clicking "Read".

Current code at line 53-55:
```typescript
useEffect(() => {
  fetchData();
}, [fetchData]);
```

After `fetchData()` resolves, iterate `branches` and add all depth-0 branch IDs to `revealedBranches`.

### 3c. Payment status UX

`src/components/PaymentStatus.tsx` shows a toast that auto-dismisses after 3 seconds. During wallet signing (which can take 10+ seconds), the toast may dismiss before the user completes the payment. Consider:
- Keep "pending" toast visible until resolved
- Only auto-dismiss "success" and "error" toasts

---

## Architecture Reference

```
src/                                    # Story-Fork Web App (Next.js)
├── app/
│   ├── api/
│   │   ├── stories/route.ts          # GET: list stories, POST: create story + root branch
│   │   ├── branches/route.ts         # GET: tree by storyId, POST: create branch
│   │   ├── branches/[branchId]/
│   │   │   ├── read/route.ts         # GET: x402-gated read (returns 402 or content)
│   │   │   └── vote/route.ts         # POST: x402-gated vote + canon recalculation
│   │   └── health/route.ts           # GET: health check
│   ├── story/[storyId]/page.tsx      # Story detail page (CLIENT COMPONENT)
│   ├── page.tsx                      # Homepage (SERVER COMPONENT)
│   └── layout.tsx                    # Root layout
├── components/
│   ├── LuminousFlow.tsx              # Recursive tree renderer
│   ├── BranchNode.tsx                # Branch card (read/vote buttons)
│   ├── StoryCard.tsx                 # Story list card
│   └── PaymentStatus.tsx             # Payment toast
├── lib/
│   ├── x402.ts                       # createPaymentRequired(), verifyPayment(), isPaymentEnabled()
│   ├── db.ts                         # Prisma client singleton
│   └── types.ts                      # TypeScript interfaces
└── styles/
    └── luminous-flow.css             # Animations

openclaw-skill/                        # OpenClaw AI Agent (standalone service)
├── src/
│   ├── tools.ts                      # Main loop: fetch stories → analyze Canon → generate via LLM → push branches
│   ├── server-api.ts                 # HTTP client wrapping Story-Fork REST API
│   └── types.ts                      # Story, Branch types
├── skills/story-fork/SKILL.md        # LLM narrative prompt & writing guidelines
├── openclaw.plugin.json              # OpenClaw plugin manifest (declares skills + tools)
├── entrypoint.sh                     # Docker entrypoint: init AnyRouter LLM config, wait for server health, start agent
├── package.json                      # Dependencies
└── Dockerfile

prisma/schema.prisma                  # Story, Branch, Payment models

System Interaction:
  - OpenClaw Agent reads data via: GET /api/stories, GET /api/branches?storyId=
  - OpenClaw Agent writes data via: POST /api/stories, POST /api/branches
  - Readers interact via: GET /api/branches/:id/read (x402), POST /api/branches/:id/vote (x402)
  - The feedback loop: readers vote → Canon shifts → agent reads new Canon → agent generates new branches → readers vote again

Key Environment Variables:
- DATABASE_URL          # PostgreSQL connection string
- SERVER_ADDRESS        # STX wallet address (empty = dev mode, free access)
- FACILITATOR_URL       # x402 facilitator (default: https://facilitator.stacksx402.com)
- NETWORK               # "testnet" or "mainnet"
- ANYROUTER_BASE_URL    # LLM provider URL for OpenClaw (default: https://anyrouter.top)
- ANYROUTER_API_KEY     # LLM API key (default: sk-free)
- ANYROUTER_MODEL_ID    # LLM model ID (default: claude-opus-4-6)
```

## x402 Payment Protocol Reference

The x402-stacks payment flow:

1. Client calls API endpoint without `x-payment` header
2. Server returns HTTP 402 with:
   - Response body: `{ error: "Payment Required", paymentRequirements: {...}, facilitatorUrl: "..." }`
   - Header: `X-Payment-Requirements: <JSON>`
   - Header: `X-Facilitator-URL: <URL>`
3. Client signs a STX payment matching the requirements
4. Client retries the same endpoint with `x-payment: <signed payload JSON>` header
5. Server calls facilitator `POST /verify` with `{ paymentPayload, paymentRequirements }`
6. If valid, server calls facilitator `POST /settle` to finalize on-chain
7. Server returns 200 with the requested content

PaymentRequirements object shape (from `src/lib/types.ts`):
```typescript
{
  scheme: "exact",
  network: "testnet",        // or "mainnet"
  maxAmountRequired: "10",   // micro-STX as string
  resource: "/api/branches/:id/read",
  description: "Read 'Chapter Title' - 10 microSTX",
  payTo: "<STX address>",
  asset: "STX",
  maxTimeoutSeconds: 60
}
```

x402-stacks documentation: https://docs.x402stacks.xyz/

---

## Summary of Priorities

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Task 1: STX wallet integration in frontend | Medium | Unblocks the entire demo — without this, the core x402 payment flow cannot be demonstrated |
| P1 | Task 2: OpenClaw agent LLM generation via Story-Fork API | Medium | Agent currently uses static templates; needs to call LLM and generate real narrative based on Canon path + voting data |
| P2 | Task 3: Polish & bug fixes | Low | Improves UX details |

After Task 1 and Task 2 are complete, record a 5-minute demo video showing:
1. Creating/browsing stories
2. Connecting STX wallet
3. Paying to read a locked branch (x402 flow)
4. Voting for a branch and watching Canon shift
5. AI agent generating new narrative branches

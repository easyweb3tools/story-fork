# Story-Fork

**Pay to Vote the Narrative** — A decentralized branching fiction platform powered by [x402-stacks](https://docs.x402stacks.xyz/) and the Stacks blockchain.

[中文文档](./README_CN.md) | [Live Demo](https://story.easyweb3.tools/)

---

## The Idea

What if readers didn't just consume stories — they **funded** the direction?

Story-Fork turns interactive fiction into a narrative economy. Readers pay micro-STX via the HTTP 402 protocol to unlock chapters and vote for their preferred plot direction. The highest-funded branch becomes **Canon** (the official storyline), and Canon shifts in real time as new votes arrive.

An autonomous AI agent (OpenClaw) continuously generates new branching options, ensuring the story never stops growing.

**This is the first application of x402 in the creative economy** — where micropayments don't just unlock content, they shape it.

## How It Works

```
  Reader pays STX          Canon shifts
  to unlock & vote         in real time
       │                        │
       ▼                        ▼
┌─────────────┐   x402    ┌───────────┐    settle    ┌──────────┐
│   Browser   │◄─────────►│  Next.js  │◄────────────►│ x402     │
│  + Wallet   │   402 ◄── │  Server   │  ──► verify  │Facilitator│
└─────────────┘   pay ──► └─────┬─────┘  ──► settle  └──────────┘
                                │                          │
                          ┌─────▼─────┐              ┌─────▼─────┐
                          │ PostgreSQL│              │  Stacks   │
                          │ (stories, │              │ Blockchain│
                          │  branches,│              │  (STX)    │
                          │  payments)│              └───────────┘
                          └─────┬─────┘
                                │
                          ┌─────▼─────┐
                          │ OpenClaw  │
                          │ AI Agent  │
                          │ (LLM loop)│
                          └───────────┘
```

### Step by Step

1. **Browse** — The homepage lists active stories. Click one to explore its branch tree.
2. **Read** — The root chapter is free. Child branches are locked behind a `10 uSTX` paywall.
3. **Pay** — Click "Read (10 uSTX)". Your wallet signs an STX transfer. The server verifies via the x402 facilitator and settles on-chain. Content unlocks.
4. **Vote** — Click "Vote (100 uSTX)" on your favorite branch. The payment is recorded and the branch's funding increases.
5. **Canon shifts** — After each vote the server recalculates: the sibling branch with the highest total funding becomes Canon.
6. **AI continues** — Every 10 minutes, the OpenClaw agent reads the current tree, follows the Canon path, and generates 2 new branching continuations (one per ideological direction) at each leaf node.

## x402 Payment Integration

Story-Fork is a native x402-stacks application. Every paid interaction follows the HTTP 402 protocol:

```
Client                          Server                      Facilitator
  │                               │                              │
  │  GET /branches/:id/read       │                              │
  │──────────────────────────────►│                              │
  │                               │                              │
  │  402 + PaymentRequirements    │                              │
  │◄──────────────────────────────│                              │
  │                               │                              │
  │  [wallet signs STX transfer]  │                              │
  │                               │                              │
  │  GET /branches/:id/read       │                              │
  │  x-payment: <signed payload>  │                              │
  │──────────────────────────────►│  POST /verify                │
  │                               │─────────────────────────────►│
  │                               │  ✓ valid                     │
  │                               │◄─────────────────────────────│
  │                               │  POST /settle                │
  │                               │─────────────────────────────►│
  │                               │  txHash                      │
  │                               │◄─────────────────────────────│
  │  200 + unlocked content       │                              │
  │◄──────────────────────────────│                              │
```

**Two paywall types:**

| Action | Price | What Happens |
|--------|-------|-------------|
| **Read** | 10 uSTX | Unlocks branch content; increments `readCount` and `totalFunding` |
| **Vote** | 100 uSTX | Funds a branch direction; increments `voteCount` and `totalFunding`; triggers Canon recalculation |

**Dev fallback:** When `SERVER_ADDRESS` is empty, all content is free (local dev mode).

## Canon Voting Mechanism

Canon is the "official" storyline — determined entirely by reader funding.

```
Parent Branch
    ├── Branch A  (totalFunding: 300 uSTX)  ← CANON ●
    ├── Branch B  (totalFunding: 150 uSTX)     alternative ○
    └── Branch C  (totalFunding:  50 uSTX)     alternative ○
```

After every vote payment:
1. Server fetches all sibling branches (same `parentId`)
2. The sibling with the highest `totalFunding` gets `isCanon = true`
3. All others get `isCanon = false`
4. Frontend re-renders: Canon branches show a blue indicator, alternatives show gray

Canon can shift at any time. A branch that was alternative can become Canon with a single large vote.

## AI Agent — OpenClaw

OpenClaw is an autonomous AI service that keeps the story growing:

```
┌─────────────────────────────────────────────┐
│               OpenClaw Loop (10 min)        │
│                                             │
│  1. GET /api/stories?status=active          │
│  2. GET /api/branches?storyId=<id>          │
│  3. Find leaf nodes (no children)           │
│  4. Trace Canon path for context            │
│  5. Call LLM → generate 2 continuations:    │
│     • Burn-Key Freedom direction            │
│     • Sovereign Takeover direction          │
│  6. POST /api/branches (new branches)       │
│  7. Sleep 10 minutes → repeat               │
└─────────────────────────────────────────────┘
```

- **Bilingual output:** Every generated branch has both Chinese and English fields
- **Ideological contrast:** Each fork presents two opposing worldviews — readers vote with STX to decide which becomes Canon
- **Paid-vote gate:** When `OPENCLAW_REQUIRE_PAID_VOTE=true`, the agent only generates continuations after a branch receives a paid vote signal
- **Auto-seed:** If no active stories exist, OpenClaw creates a default cyberpunk story

## Product Features

- **Bilingual stories (ZH/EN)**: Story and branch fields support Chinese + English
- **Fork-tree reading**: Root chapter free, child branches paywalled
- **Direction-based narrative**: Two ideological paths — Burn-Key Freedom vs Sovereign Takeover
- **Two paid actions**: Read (10 uSTX) and Vote (100 uSTX)
- **Vote history panel**: Recent vote payments with links to Hiro blockchain explorer
- **STX wallet integration**: Connect wallet + sign x402 payment payloads
- **OpenClaw AI loop**: Auto-seed, generate branches, bilingual content, ideological contrast
- **Paid-vote generation gate**: AI continues writing only after paid-vote signal
- **On-chain proof**: Every payment recorded with `txHash` verifiable on Stacks explorer

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | PostgreSQL 16 + Prisma 6.3 |
| Blockchain | Stacks (STX) via @stacks/connect + @stacks/transactions |
| Payments | x402-stacks (HTTP 402 protocol) |
| AI Agent | OpenClaw (autonomous service, OpenAI-compatible LLM) |
| Deployment | Docker Compose (app + db + agent) |

## Architecture

```
story-fork/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── stories/route.ts          # GET/POST stories
│   │   │   ├── branches/route.ts         # GET/POST branches (tree)
│   │   │   ├── branches/[branchId]/
│   │   │   │   ├── read/route.ts         # x402-gated reading
│   │   │   │   └── vote/route.ts         # x402-gated voting + canon recalc
│   │   │   ├── payments/route.ts         # Payment/vote history
│   │   │   └── health/route.ts
│   │   ├── story/[storyId]/page.tsx      # Story detail + branch tree
│   │   └── page.tsx                      # Homepage
│   ├── components/
│   │   ├── LuminousFlow.tsx              # Recursive branch tree
│   │   ├── BranchNode.tsx                # Branch card (read/vote)
│   │   └── PaymentStatus.tsx             # Payment toast
│   └── lib/
│       ├── x402.ts                       # x402 helpers (402/verify/settle)
│       ├── wallet.ts                     # Stacks wallet integration
│       ├── auth.ts                       # API key auth
│       ├── i18n.ts                       # Bilingual support
│       └── db.ts                         # Prisma client
├── prisma/schema.prisma                  # Story, Branch, Payment models
├── openclaw-skill/
│   ├── src/tools.ts                      # Agent main loop
│   ├── skills/story-fork/SKILL.md        # LLM narrative prompt
│   └── entrypoint.sh                     # Docker entrypoint
└── docker-compose.yml                    # Full-stack deployment
```

## Data Models

```
Story
  ├── id, title, titleEn, description, descriptionEn
  ├── genre, coverImage, status
  └── branches[] ──► Branch

Branch
  ├── id, storyId, parentId
  ├── title, titleEn, content, contentEn, summary, summaryEn
  ├── depth, orderIndex
  ├── readPrice (10), votePrice (100)
  ├── totalFunding, readCount, voteCount, isCanon
  ├── generatedBy ("ai" | null), prompt
  ├── children[] ──► Branch (tree structure)
  └── payments[] ──► Payment

Payment
  ├── id, branchId, type ("read" | "vote")
  ├── amount, payerAddress, txHash (unique)
  └── network, createdAt
```

## Quick Start

### 1) Local development

```bash
cd story-fork
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

### 2) Full stack with Docker

```bash
cd story-fork
docker compose up --build
```

Services:

- app: `http://localhost:3000`
- db: PostgreSQL in compose network
- openclaw: AI branch generation worker

### 3) Enable real payments

Set `SERVER_ADDRESS` in `.env`:

- Testnet address starts with `ST...`
- Mainnet address starts with `SP...`

If empty, app runs in free mode (no x402 gating).

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `SERVER_ADDRESS` | Receiver STX address for x402 | empty (free mode) |
| `FACILITATOR_URL` | x402 facilitator | `https://facilitator.stacksx402.com` |
| `FACILITATOR_TIMEOUT_MS` | Facilitator timeout (ms) | `8000` |
| `NETWORK` | `testnet` or `mainnet` | `testnet` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |
| `STORY_FORK_API_KEY` | Optional shared write key | empty |
| `OPENCLAW_REQUIRE_PAID_VOTE` | Generate only after paid vote | `true` |
| `ANYROUTER_BASE_URL` | OpenClaw LLM base URL | `https://anyrouter.top` |
| `ANYROUTER_API_KEY` | OpenClaw LLM key | `sk-free` |
| `ANYROUTER_MODEL_ID` | OpenClaw model | provider default |

Note: If `STORY_FORK_API_KEY` is set, use the **same value** in both app and OpenClaw.

## API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/stories` | List stories | none |
| `POST` | `/api/stories` | Create story + root branch | `x-api-key` |
| `GET` | `/api/branches?storyId=...` | Story branch tree | none |
| `POST` | `/api/branches` | Create branch | `x-api-key` |
| `GET` | `/api/branches/:id/read` | Read branch (x402) | x402 or free |
| `POST` | `/api/branches/:id/vote` | Vote branch (x402) | x402 or free |
| `GET` | `/api/payments?storyId=...&type=vote` | Payment history | none |
| `GET` | `/api/health` | Health check | none |

## Troubleshooting

- **Wallet conflict** (`Cannot redefine property: StacksProvider`): Disable one extension when both Xverse and Leather are installed.
- **402 loop in frontend**: Check `SERVER_ADDRESS`, `NETWORK`, and wallet network consistency.
- **Facilitator verify/settle failures**: Inspect app logs (`x402 verify request/response`) and compare request fields.

## License

MIT

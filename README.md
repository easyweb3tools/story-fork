# Story-Fork

**Pay to Vote the Narrative** — A decentralized branching fiction platform powered by [x402-stacks](https://docs.x402stacks.xyz/) and the Stacks blockchain.

[中文文档](./README_CN.md)

## Vision

Story-Fork reimagines interactive fiction by turning readers into narrative investors. On traditional platforms, readers passively consume stories. On Story-Fork, every reader holds economic power over the plot.

Stories branch into multiple paths at each chapter. Readers pay STX micro-payments to unlock and read branches, then vote with STX for the direction they want the story to take. The branch with the highest total funding becomes **Canon** — the "official" storyline. Alternative branches remain accessible but clearly marked as non-canon paths.

This creates a market-driven narrative where the crowd literally pays to shape the story. The HTTP 402 protocol makes payments seamless and programmable — no accounts, no sessions, just a request and a micro-payment.

### How x402 Powers Story-Fork

Story-Fork is built on the [x402-stacks](https://docs.x402stacks.xyz/) open payment standard, which leverages the HTTP `402 Payment Required` status code for native crypto payments:

1. A reader requests a locked story branch via the API
2. The server responds with `402 Payment Required`, including payment instructions (amount, asset, payee address)
3. The reader's client signs a payment with their STX wallet
4. The server verifies and settles the payment through the [x402-stacks facilitator](https://facilitator.stacksx402.com)
5. Upon successful payment, the full branch content is returned

Both **read** and **vote** actions are gated behind x402 paywalls, each with configurable micro-payment prices. This allows granular monetization — reading a branch might cost 10 μSTX while voting costs 100 μSTX.

## Features

- **Branching Narrative Tree** — Stories are structured as trees with multiple branches at each depth level, visualized as an interactive flow diagram
- **x402 Paywall Integration** — Read and vote actions are gated behind HTTP 402 micro-payments using STX on the Stacks blockchain
- **Dynamic Canon System** — The highest-funded branch among siblings automatically becomes Canon; Canon status shifts in real-time as votes accumulate
- **AI Story Agent (OpenClaw)** — An autonomous [OpenClaw](https://github.com/openclaw) agent that periodically fetches story data via Story-Fork's REST API, analyzes the Canon path and voting results, generates new narrative branches using LLM, and pushes them back through the API — forming a closed-loop AI-driven storytelling cycle
- **Dev Mode** — When no `SERVER_ADDRESS` is configured, all content is freely accessible for local development and testing
- **Docker Deployment** — Full-stack deployment with Docker Compose (PostgreSQL + Next.js app + AI agent)

## Architecture

```
story-fork/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── stories/route.ts       # GET/POST stories
│   │   │   ├── branches/route.ts      # GET/POST branches (tree builder)
│   │   │   ├── branches/[branchId]/
│   │   │   │   ├── read/route.ts      # x402-gated branch reading
│   │   │   │   └── vote/route.ts      # x402-gated voting + canon recalculation
│   │   │   └── health/route.ts        # Health check
│   │   ├── story/[storyId]/page.tsx   # Story detail page with branch tree
│   │   ├── page.tsx                   # Homepage — story listing
│   │   └── layout.tsx                 # Root layout
│   ├── components/
│   │   ├── LuminousFlow.tsx           # Branch tree visualization (recursive)
│   │   ├── BranchNode.tsx             # Individual branch card
│   │   ├── StoryCard.tsx              # Story listing card
│   │   └── PaymentStatus.tsx          # Payment toast notification
│   ├── lib/
│   │   ├── x402.ts                    # x402 payment helpers (402 response, verify, settle)
│   │   ├── db.ts                      # Prisma client singleton
│   │   └── types.ts                   # Shared TypeScript types
│   └── styles/
│       └── luminous-flow.css          # Custom animations
├── prisma/
│   └── schema.prisma                  # Database schema (Story, Branch, Payment)
├── openclaw-skill/                    # AI story agent
│   ├── src/
│   │   ├── tools.ts                   # Agent logic: find leaves, generate branches
│   │   ├── server-api.ts              # API client for Story-Fork server
│   │   └── types.ts                   # Agent type definitions
│   └── skills/story-fork/SKILL.md    # Agent skill definition
├── docker-compose.yml                 # Full-stack deployment
├── Dockerfile                         # Next.js production image
└── .env.example                       # Environment variable template
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (App Router) |
| Database | PostgreSQL 16 + Prisma ORM |
| Payments | x402-stacks (HTTP 402 + STX micro-payments) |
| AI Agent | OpenClaw skill (TypeScript) |
| Deployment | Docker Compose |

### Data Model

**Story** — A narrative with metadata (title, description, genre, status)

**Branch** — A node in the story tree with:
- `parentId` — Links to parent branch (null for root)
- `depth` / `orderIndex` — Position in the tree
- `readPrice` / `votePrice` — x402 payment amounts (in μSTX)
- `totalFunding` — Accumulated STX from reads + votes
- `voteCount` — Number of votes received
- `isCanon` — Whether this branch is the highest-funded among siblings

**Payment** — Record of each x402 transaction (type, amount, payer address, tx hash)

### x402 Payment Flow

```
Reader                    Story-Fork Server              x402 Facilitator
  │                              │                              │
  │  GET /api/branches/:id/read  │                              │
  │─────────────────────────────>│                              │
  │                              │                              │
  │  402 Payment Required        │                              │
  │  X-Payment-Requirements: ... │                              │
  │<─────────────────────────────│                              │
  │                              │                              │
  │  GET /api/branches/:id/read  │                              │
  │  X-Payment: {signed payload} │                              │
  │─────────────────────────────>│                              │
  │                              │  POST /verify                │
  │                              │─────────────────────────────>│
  │                              │  { isValid: true }           │
  │                              │<─────────────────────────────│
  │                              │  POST /settle                │
  │                              │─────────────────────────────>│
  │                              │  { transaction: "0x..." }    │
  │                              │<─────────────────────────────│
  │                              │                              │
  │  200 OK { branch content }   │                              │
  │<─────────────────────────────│                              │
```

### Canon Recalculation

When a vote is cast, the server:
1. Records the payment and increments the branch's `totalFunding` and `voteCount`
2. Queries all sibling branches (same `parentId`)
3. Sets `isCanon = true` on the branch with the highest `totalFunding`
4. Sets `isCanon = false` on all other siblings

This means Canon is dynamic — a well-funded underdog branch can overtake the current Canon at any time.

### AI Story Agent — The OpenClaw Loop

The AI agent is an [OpenClaw](https://github.com/openclaw) skill that runs as an independent service alongside the Story-Fork server. It does **not** embed any LLM logic directly — instead it acts as a bridge between the Story-Fork REST API and OpenClaw's LLM capabilities, forming an autonomous storytelling loop:

```
┌─────────────────────────────────────────────────────────────┐
│                   OpenClaw Agent (Skill)                     │
│                                                             │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ 1. FETCH │───>│ 2. ANALYZE    │───>│ 3. GENERATE      │  │
│  │          │    │               │    │                  │  │
│  │ Pull all │    │ Find leaves   │    │ OpenClaw invokes │  │
│  │ stories  │    │ Read Canon    │    │ LLM to create    │  │
│  │ & branch │    │ path & votes  │    │ 2-3 new branches │  │
│  │ trees    │    │ Decide where  │    │ per leaf node    │  │
│  │ via API  │    │ to grow       │    │                  │  │
│  └──────────┘    └───────────────┘    └────────┬─────────┘  │
│       ▲                                        │            │
│       │            ┌──────────────┐             │            │
│       └────────────│ 4. PUSH      │<────────────┘            │
│                    │              │                          │
│                    │ POST new     │                          │
│                    │ branches     │                          │
│                    │ back via API │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
         │                                    ▲
         │  GET /api/stories                  │  POST /api/branches
         │  GET /api/branches?storyId=        │
         ▼                                    │
┌─────────────────────────────────────────────────────────────┐
│                   Story-Fork Server                          │
│                                                             │
│  Stories ◄──── Branches ◄──── Payments                      │
│                  │                                          │
│                  ├── isCanon (dynamic, vote-driven)          │
│                  ├── totalFunding (accumulated STX)          │
│                  └── voteCount                              │
└─────────────────────────────────────────────────────────────┘
```

**Agent Cycle (every 10 minutes):**

1. **Fetch** — Calls `GET /api/stories?status=active` to retrieve all active stories, then `GET /api/branches?storyId=` for each story to get the full branch tree (including `isCanon`, `totalFunding`, `voteCount` for every node)
2. **Analyze** — Walks the tree to find leaf nodes (branches with no children). Traces the Canon path (`isCanon=true` from root to leaf) to understand the "official" storyline readers have voted for. Skips leaves at depth ≥ 4 (story conclusion)
3. **Generate** — OpenClaw's LLM generates 2–3 new branch options for each leaf, following the narrative guidelines in `SKILL.md` (third person, past tense, 200–500 words, cliffhanger endings, varied tones). The LLM receives the full Canon context so new branches continue naturally from where the community has steered the story
4. **Push** — Calls `POST /api/branches` for each generated branch, providing `storyId`, `parentId`, `title`, `content`, and `summary`. The server calculates `depth` and `orderIndex` automatically

This creates a **feedback loop**: readers vote → Canon shifts → agent reads new Canon → agent generates branches that continue the community-chosen direction → readers vote again. The story grows organically, driven by both crowd economics and AI creativity.

**OpenClaw Skill Structure:**

```
openclaw-skill/
├── src/
│   ├── tools.ts                   # Main loop: fetch → analyze → generate → push
│   ├── server-api.ts              # HTTP client wrapping Story-Fork REST API
│   └── types.ts                   # Story & Branch TypeScript types
├── skills/story-fork/SKILL.md    # LLM prompt & narrative guidelines
├── openclaw.plugin.json           # OpenClaw plugin manifest
├── entrypoint.sh                  # Docker entrypoint: init LLM config, wait for server, start agent
├── Dockerfile                     # Agent container image
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- (Optional) A Stacks testnet wallet for x402 payments

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/user/story-fork.git
cd story-fork

# 2. Set up environment
cp .env.example .env
# Edit .env — set SERVER_ADDRESS to your STX wallet for x402 payments
# Leave SERVER_ADDRESS empty for dev mode (free access)

# 3. Start PostgreSQL
docker compose up db -d

# 4. Install dependencies and push schema
npm install
npx prisma db push

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Start the AI Agent

The AI agent seeds demo stories and generates new branches at leaf nodes:

```bash
# In a separate terminal
cd openclaw-skill
npm install
npx tsx src/tools.ts
```

### Full Docker Deployment

```bash
# Start all services (PostgreSQL + App + AI Agent)
docker compose up --build

# The app will be available at http://localhost:3000
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SERVER_ADDRESS` | STX wallet address to receive payments | No (dev mode if empty) |
| `FACILITATOR_URL` | x402 facilitator endpoint | No (defaults to `https://facilitator.stacksx402.com`) |
| `NETWORK` | Stacks network (`testnet` or `mainnet`) | No (defaults to `testnet`) |
| `NEXT_PUBLIC_APP_URL` | Public app URL | No |
| `ANYROUTER_BASE_URL` | OpenAI-compatible endpoint for AI agent | No (defaults to `https://anyrouter.top`) |
| `ANYROUTER_API_KEY` | API key for AnyRouter provider | No (defaults to `sk-free`) |
| `ANYROUTER_MODEL_ID` | Model ID used by AI agent | No (defaults to `claude-opus-4-5-20251101`) |

## API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/stories` | List all stories | None |
| `POST` | `/api/stories` | Create a story with root branch | None |
| `GET` | `/api/branches?storyId=` | Get branch tree for a story | None |
| `POST` | `/api/branches` | Create a new branch | None |
| `GET` | `/api/branches/:id/read` | Read branch content | x402 (μSTX) |
| `POST` | `/api/branches/:id/vote` | Vote for a branch | x402 (μSTX) |
| `GET` | `/api/health` | Health check | None |

## Demo

The platform ships with a built-in demo story, "The Last Archive" — a sci-fi narrative about a keeper of humanity's last unaltered memory repository. The AI agent automatically generates branching paths, and users can vote to determine which direction becomes Canon.

## License

MIT

---

Built for the [x402 Stacks Challenge](https://dorahacks.io/hackathon/x402-stacks/detail) hackathon.

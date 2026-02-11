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
- **AI Story Agent** — An OpenClaw-based agent that monitors stories and generates new narrative branches at leaf nodes, keeping stories alive and growing
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

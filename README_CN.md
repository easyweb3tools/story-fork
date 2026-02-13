# Story-Fork

**付费投票，改写叙事** — 基于 [x402-stacks](https://docs.x402stacks.xyz/) 与 Stacks 区块链的去中心化分叉叙事平台。

[English](./README.md) | [在线演示](https://story.easyweb3.tools/)

---

## 核心理念

如果读者不只是阅读故事，而是用**真金白银**来决定剧情走向呢？

Story-Fork 将互动小说变成一种叙事经济。读者通过 HTTP 402 协议支付微额 STX 来解锁章节并为喜欢的剧情方向投票。资金最高的分支成为 **Canon（正史）**，而正史会随着新投票实时变化。

自治 AI 代理（OpenClaw）持续生成新的分支选项，确保故事永不停歇。

**这是 x402 在创意经济领域的首次应用** — 微支付不仅用于解锁内容，更用于塑造内容。

## 运作流程

```
  读者支付 STX            正史实时变化
  解锁 & 投票
       │                        │
       ▼                        ▼
┌─────────────┐   x402    ┌───────────┐    settle    ┌──────────┐
│   浏览器     │◄─────────►│  Next.js  │◄────────────►│  x402    │
│  + 钱包     │   402 ◄── │   服务端   │  ──► verify  │ Facilitator│
└─────────────┘   pay ──► └─────┬─────┘  ──► settle  └──────────┘
                                │                          │
                          ┌─────▼─────┐              ┌─────▼─────┐
                          │ PostgreSQL│              │  Stacks   │
                          │ (故事、分支 │              │   区块链    │
                          │  支付记录) │              │  (STX)    │
                          └─────┬─────┘              └───────────┘
                                │
                          ┌─────▼─────┐
                          │ OpenClaw  │
                          │ AI 代理    │
                          │ (LLM 循环) │
                          └───────────┘
```

### 分步说明

1. **浏览** — 首页展示活跃故事列表，点击进入分支树。
2. **阅读** — 根章节免费，子分支需要 `10 uSTX` 付费解锁。
3. **支付** — 点击「阅读 (10 uSTX)」，钱包签名 STX 转账，服务端通过 x402 facilitator 验证并链上结算，内容解锁。
4. **投票** — 点击「投票 (100 uSTX)」为喜欢的分支投票，支付被记录，分支资金增加。
5. **正史变化** — 每次投票后，服务端重新计算：同级分支中资金最高者成为 Canon。
6. **AI 续写** — 每 10 分钟，OpenClaw 代理读取当前分支树，沿着正史路径生成 2 条新分支（分别对应两个思想方向）。

## x402 支付集成

Story-Fork 是原生 x402-stacks 应用。每次付费交互遵循 HTTP 402 协议：

```
客户端                          服务端                       Facilitator
  │                               │                              │
  │  GET /branches/:id/read       │                              │
  │──────────────────────────────►│                              │
  │                               │                              │
  │  402 + PaymentRequirements    │                              │
  │◄──────────────────────────────│                              │
  │                               │                              │
  │  [钱包签名 STX 转账]           │                              │
  │                               │                              │
  │  GET /branches/:id/read       │                              │
  │  x-payment: <签名载荷>         │                              │
  │──────────────────────────────►│  POST /verify                │
  │                               │─────────────────────────────►│
  │                               │  ✓ 验证通过                   │
  │                               │◄─────────────────────────────│
  │                               │  POST /settle                │
  │                               │─────────────────────────────►│
  │                               │  txHash                      │
  │                               │◄─────────────────────────────│
  │  200 + 解锁内容               │                              │
  │◄──────────────────────────────│                              │
```

**两种付费类型：**

| 动作 | 价格 | 说明 |
|------|------|------|
| **阅读** | 10 uSTX | 解锁分支内容；增加 `readCount` 和 `totalFunding` |
| **投票** | 100 uSTX | 资助分支方向；增加 `voteCount` 和 `totalFunding`；触发正史重算 |

**开发兜底：** 若 `SERVER_ADDRESS` 为空，则关闭支付门控（本地免费模式）。

## Canon 投票机制

Canon 是「官方」故事线 — 完全由读者资金决定。

```
父分支
    ├── 分支 A  (totalFunding: 300 uSTX)  ← CANON ●
    ├── 分支 B  (totalFunding: 150 uSTX)     备选 ○
    └── 分支 C  (totalFunding:  50 uSTX)     备选 ○
```

每次投票支付后：
1. 服务端获取所有同级分支（相同 `parentId`）
2. 资金最高的分支设为 `isCanon = true`
3. 其他分支设为 `isCanon = false`
4. 前端重新渲染：正史分支显示蓝色标记，备选显示灰色

正史随时可以改变 — 一次大额投票就能让备选分支翻盘成为正史。

## AI 代理 — OpenClaw

OpenClaw 是自治 AI 服务，持续推动故事生长：

```
┌─────────────────────────────────────────────┐
│             OpenClaw 循环（每 10 分钟）        │
│                                             │
│  1. GET /api/stories?status=active          │
│  2. GET /api/branches?storyId=<id>          │
│  3. 查找叶子节点（无子分支）                    │
│  4. 追溯正史路径获取上下文                      │
│  5. 调用 LLM → 生成 2 条续写：                 │
│     • 焚钥自由方向                             │
│     • 主权接管方向                             │
│  6. POST /api/branches（创建新分支）            │
│  7. 休眠 10 分钟 → 重复                       │
└─────────────────────────────────────────────┘
```

- **双语输出：** 每个生成分支同时包含中文和英文字段
- **思想对撞：** 每次分叉呈现两种对立世界观 — 读者用 STX 投票决定哪个成为正史
- **付费投票门控：** 开启 `OPENCLAW_REQUIRE_PAID_VOTE=true` 时，仅在分支收到付费投票信号后才生成续写
- **自动种子：** 若无活跃故事，OpenClaw 自动创建默认赛博朋克故事

## 产品功能

- **中英双语内容**：故事与分支均支持中文/英文字段
- **分叉树阅读**：根章节免费，子分支按需付费
- **方向化叙事**：两条核心路线 — 焚钥自由 vs 主权接管
- **两类付费动作**：阅读（10 uSTX）与投票（100 uSTX）
- **投票历史面板**：最近投票记录，支持跳转 Hiro 区块链浏览器
- **STX 钱包集成**：连接钱包 + 签名 x402 支付载荷
- **OpenClaw AI 循环**：自动种子、续写分支、双语内容、思想对撞
- **付费投票续写门控**：AI 仅在收到付费投票信号后续写
- **链上证明**：每笔支付均记录 `txHash`，可在 Stacks 浏览器验证

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15 (App Router)、React 19、Tailwind CSS 4 |
| 后端 | Next.js API Routes |
| 数据库 | PostgreSQL 16 + Prisma 6.3 |
| 区块链 | Stacks (STX)，@stacks/connect + @stacks/transactions |
| 支付 | x402-stacks（HTTP 402 协议） |
| AI 代理 | OpenClaw（自治服务，OpenAI 兼容 LLM） |
| 部署 | Docker Compose（应用 + 数据库 + 代理） |

## 架构概览

```
story-fork/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── stories/route.ts          # 故事 CRUD
│   │   │   ├── branches/route.ts         # 分支树 CRUD
│   │   │   ├── branches/[branchId]/
│   │   │   │   ├── read/route.ts         # x402 付费阅读
│   │   │   │   └── vote/route.ts         # x402 付费投票 + 正史重算
│   │   │   ├── payments/route.ts         # 支付/投票历史
│   │   │   └── health/route.ts
│   │   ├── story/[storyId]/page.tsx      # 故事详情 + 分支树
│   │   └── page.tsx                      # 首页
│   ├── components/
│   │   ├── LuminousFlow.tsx              # 递归分支树
│   │   ├── BranchNode.tsx                # 分支卡片（阅读/投票）
│   │   └── PaymentStatus.tsx             # 支付状态提示
│   └── lib/
│       ├── x402.ts                       # x402 辅助（402/verify/settle）
│       ├── wallet.ts                     # Stacks 钱包集成
│       ├── auth.ts                       # API 密钥鉴权
│       ├── i18n.ts                       # 双语支持
│       └── db.ts                         # Prisma 客户端
├── prisma/schema.prisma                  # Story、Branch、Payment 模型
├── openclaw-skill/
│   ├── src/tools.ts                      # 代理主循环
│   ├── skills/story-fork/SKILL.md        # LLM 叙事提示词
│   └── entrypoint.sh                     # Docker 入口
└── docker-compose.yml                    # 全栈部署
```

## 数据模型

```
Story（故事）
  ├── id, title, titleEn, description, descriptionEn
  ├── genre, coverImage, status
  └── branches[] ──► Branch

Branch（分支）
  ├── id, storyId, parentId
  ├── title, titleEn, content, contentEn, summary, summaryEn
  ├── depth, orderIndex
  ├── readPrice (10), votePrice (100)
  ├── totalFunding, readCount, voteCount, isCanon
  ├── generatedBy ("ai" | null), prompt
  ├── children[] ──► Branch（树结构）
  └── payments[] ──► Payment

Payment（支付）
  ├── id, branchId, type ("read" | "vote")
  ├── amount, payerAddress, txHash (唯一)
  └── network, createdAt
```

## 快速开始

### 1）本地开发

```bash
cd story-fork
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

打开 `http://localhost:3000`。

### 2）Docker 全栈启动

```bash
cd story-fork
docker compose up --build
```

服务包含：

- app: `http://localhost:3000`
- db: compose 网络内 PostgreSQL
- openclaw: AI 自动创作工作进程

### 3）启用真实支付

在 `.env` 中设置 `SERVER_ADDRESS`：

- 测试网地址以 `ST...` 开头
- 主网地址以 `SP...` 开头

为空则为免费模式（不走 x402 门控）。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | 必填 |
| `SERVER_ADDRESS` | x402 收款 STX 地址 | 空（免费模式） |
| `FACILITATOR_URL` | x402 facilitator 地址 | `https://facilitator.stacksx402.com` |
| `FACILITATOR_TIMEOUT_MS` | facilitator 超时（毫秒） | `8000` |
| `NETWORK` | `testnet` 或 `mainnet` | `testnet` |
| `NEXT_PUBLIC_APP_URL` | 应用对外地址 | `http://localhost:3000` |
| `STORY_FORK_API_KEY` | 可选写接口密钥 | 空 |
| `OPENCLAW_REQUIRE_PAID_VOTE` | 仅在有付费投票后续写 | `true` |
| `ANYROUTER_BASE_URL` | OpenClaw LLM Base URL | `https://anyrouter.top` |
| `ANYROUTER_API_KEY` | OpenClaw LLM Key | `sk-free` |
| `ANYROUTER_MODEL_ID` | OpenClaw 使用模型 | provider 默认 |

注意：若设置了 `STORY_FORK_API_KEY`，必须在 app 与 OpenClaw 两侧使用**同一个值**。

## API 参考

| 方法 | 端点 | 说明 | 鉴权 |
|---|---|---|---|
| `GET` | `/api/stories` | 获取故事列表 | 无 |
| `POST` | `/api/stories` | 创建故事与根分支 | `x-api-key` |
| `GET` | `/api/branches?storyId=...` | 获取故事分支树 | 无 |
| `POST` | `/api/branches` | 创建分支 | `x-api-key` |
| `GET` | `/api/branches/:id/read` | 阅读分支（x402） | x402 或免费 |
| `POST` | `/api/branches/:id/vote` | 投票分支（x402） | x402 或免费 |
| `GET` | `/api/payments?storyId=...&type=vote` | 支付/投票历史 | 无 |
| `GET` | `/api/health` | 健康检查 | 无 |

## 常见问题

- **钱包冲突**（`Cannot redefine property: StacksProvider`）：同时安装 Xverse 和 Leather 时请先禁用其中一个。
- **前端持续 402**：检查 `SERVER_ADDRESS`、`NETWORK` 与钱包网络是否一致。
- **facilitator 异常**：查看日志中 `x402 verify request/response` 并逐字段比对。

## 许可证

MIT

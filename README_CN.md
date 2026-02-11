# Story-Fork

**支付即投票，决定故事走向** — 基于 [x402-stacks](https://docs.x402stacks.xyz/) 协议和 Stacks 区块链的去中心化多分支叙事平台。

[English](./README.md)

## 愿景

Story-Fork 重新定义了互动小说：读者不再是内容的被动消费者，而是剧情发展的投资者。

故事在每个章节分裂为多条路径。读者通过支付 STX 微支付来解锁和阅读分支，然后用 STX 投票支持他们希望的剧情走向。获得最高资金池的分支将成为 **Canon（正史）** —— 即"官方"故事线。其他分支依然可访问，但会被标记为非正史路径。

这创造了一个由市场驱动的叙事机制：读者群体用真金白银塑造故事走向。HTTP 402 协议让支付变得无缝且可编程 —— 无需账户、无需会话，只需一个请求和一笔微支付。

### x402 如何驱动 Story-Fork

Story-Fork 构建在 [x402-stacks](https://docs.x402stacks.xyz/) 开放支付标准之上，利用 HTTP `402 Payment Required` 状态码实现原生加密货币支付：

1. 读者通过 API 请求一个锁定的故事分支
2. 服务器返回 `402 Payment Required`，包含支付指令（金额、资产类型、收款地址）
3. 读者客户端使用 STX 钱包签署支付
4. 服务器通过 [x402-stacks facilitator](https://facilitator.stacksx402.com) 验证并结算支付
5. 支付成功后，返回完整的分支内容

**阅读**和**投票**操作均通过 x402 付费墙进行门控，每个操作都有可配置的微支付价格。例如，阅读一个分支可能花费 10 μSTX，而投票花费 100 μSTX。

## 功能特性

- **分支叙事树** — 故事以树形结构组织，每个深度层级可有多个分支，通过交互式流程图可视化展示
- **x402 付费墙集成** — 阅读和投票操作均通过 HTTP 402 微支付（STX）进行门控
- **动态正史系统** — 同级分支中资金最高的自动成为 Canon；随着投票累积，Canon 状态实时变化
- **AI 故事代理** — 基于 OpenClaw 的 AI 代理，监控故事并在叶节点自动生成新的叙事分支，保持故事持续生长
- **开发模式** — 未配置 `SERVER_ADDRESS` 时，所有内容免费访问，便于本地开发和测试
- **Docker 部署** — 通过 Docker Compose 实现全栈部署（PostgreSQL + Next.js 应用 + AI 代理）

## 架构

```
story-fork/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── stories/route.ts       # 故事 GET/POST
│   │   │   ├── branches/route.ts      # 分支 GET/POST（树构建器）
│   │   │   ├── branches/[branchId]/
│   │   │   │   ├── read/route.ts      # x402 门控的分支阅读
│   │   │   │   └── vote/route.ts      # x402 门控的投票 + 正史重算
│   │   │   └── health/route.ts        # 健康检查
│   │   ├── story/[storyId]/page.tsx   # 故事详情页（含分支树）
│   │   ├── page.tsx                   # 首页 — 故事列表
│   │   └── layout.tsx                 # 根布局
│   ├── components/
│   │   ├── LuminousFlow.tsx           # 分支树可视化（递归渲染）
│   │   ├── BranchNode.tsx             # 单个分支卡片
│   │   ├── StoryCard.tsx              # 故事列表卡片
│   │   └── PaymentStatus.tsx          # 支付状态提示
│   ├── lib/
│   │   ├── x402.ts                    # x402 支付工具（402 响应、验证、结算）
│   │   ├── db.ts                      # Prisma 客户端单例
│   │   └── types.ts                   # 共享 TypeScript 类型
│   └── styles/
│       └── luminous-flow.css          # 自定义动画
├── prisma/
│   └── schema.prisma                  # 数据库模型（Story、Branch、Payment）
├── openclaw-skill/                    # AI 故事代理
│   ├── src/
│   │   ├── tools.ts                   # 代理逻辑：查找叶节点、生成分支
│   │   ├── server-api.ts              # Story-Fork 服务端 API 客户端
│   │   └── types.ts                   # 代理类型定义
│   └── skills/story-fork/SKILL.md    # 代理技能定义
├── docker-compose.yml                 # 全栈部署
├── Dockerfile                         # Next.js 生产镜像
└── .env.example                       # 环境变量模板
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15、React 19、Tailwind CSS 4 |
| 后端 | Next.js API Routes（App Router） |
| 数据库 | PostgreSQL 16 + Prisma ORM |
| 支付 | x402-stacks（HTTP 402 + STX 微支付） |
| AI 代理 | OpenClaw skill（TypeScript） |
| 部署 | Docker Compose |

### 数据模型

**Story（故事）** — 包含元数据的叙事实体（标题、描述、类型、状态）

**Branch（分支）** — 故事树中的节点：
- `parentId` — 指向父分支（根节点为 null）
- `depth` / `orderIndex` — 在树中的位置
- `readPrice` / `votePrice` — x402 支付金额（单位：μSTX）
- `totalFunding` — 从阅读和投票中累积的 STX
- `voteCount` — 收到的投票数
- `isCanon` — 是否为同级分支中资金最高者

**Payment（支付记录）** — 每笔 x402 交易的记录（类型、金额、付款人地址、交易哈希）

### x402 支付流程

```
读者                       Story-Fork 服务器              x402 Facilitator
  │                              │                              │
  │  GET /api/branches/:id/read  │                              │
  │─────────────────────────────>│                              │
  │                              │                              │
  │  402 Payment Required        │                              │
  │  X-Payment-Requirements: ... │                              │
  │<─────────────────────────────│                              │
  │                              │                              │
  │  GET /api/branches/:id/read  │                              │
  │  X-Payment: {签名的支付载荷}  │                              │
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
  │  200 OK { 分支内容 }          │                              │
  │<─────────────────────────────│                              │
```

### 正史重算机制

当投票发生时，服务器：
1. 记录支付并增加分支的 `totalFunding` 和 `voteCount`
2. 查询所有同级分支（相同 `parentId`）
3. 将资金最高的分支设为 `isCanon = true`
4. 将其他同级分支设为 `isCanon = false`

这意味着正史是动态的 —— 一个资金充足的"黑马"分支可以随时超越当前的正史。

## 快速开始

### 前置要求

- Node.js 20+
- Docker 和 Docker Compose
- （可选）Stacks 测试网钱包，用于 x402 支付

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/user/story-fork.git
cd story-fork

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env — 设置 SERVER_ADDRESS 为你的 STX 钱包地址以启用 x402 支付
# 留空 SERVER_ADDRESS 即为开发模式（免费访问）

# 3. 启动 PostgreSQL
docker compose up db -d

# 4. 安装依赖并推送数据库模型
npm install
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 启动 AI 代理

AI 代理会自动创建演示故事并在叶节点生成新的分支：

```bash
# 在另一个终端
cd openclaw-skill
npm install
npx tsx src/tools.ts
```

### Docker 完整部署

```bash
# 启动所有服务（PostgreSQL + 应用 + AI 代理）
docker compose up --build

# 应用将在 http://localhost:3000 可用
```

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 是 |
| `SERVER_ADDRESS` | 接收支付的 STX 钱包地址 | 否（留空为开发模式） |
| `FACILITATOR_URL` | x402 facilitator 端点 | 否（默认 `https://facilitator.stacksx402.com`） |
| `NETWORK` | Stacks 网络（`testnet` 或 `mainnet`） | 否（默认 `testnet`） |
| `NEXT_PUBLIC_APP_URL` | 应用公开 URL | 否 |

## API 参考

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/stories` | 列出所有故事 | 无 |
| `POST` | `/api/stories` | 创建故事（含根分支） | 无 |
| `GET` | `/api/branches?storyId=` | 获取故事的分支树 | 无 |
| `POST` | `/api/branches` | 创建新分支 | 无 |
| `GET` | `/api/branches/:id/read` | 阅读分支内容 | x402（μSTX） |
| `POST` | `/api/branches/:id/vote` | 为分支投票 | x402（μSTX） |
| `GET` | `/api/health` | 健康检查 | 无 |

## 演示

平台内置了一个演示故事《The Last Archive》—— 一个关于人类最后一座未被篡改的记忆档案馆守护者的科幻叙事。AI 代理会自动生成分支路径，用户可以投票决定哪个方向成为正史。

## 许可证

MIT

---

为 [x402 Stacks Challenge](https://dorahacks.io/hackathon/x402-stacks/detail) 黑客松而构建。

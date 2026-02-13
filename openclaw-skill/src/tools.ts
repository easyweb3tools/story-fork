/**
 * Story-Fork OpenClaw Agent Tools
 *
 * This agent periodically checks for stories that need new branches
 * and creates compelling narrative options at leaf nodes.
 */

import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getActiveStories,
  getStoryBranches,
  createStory,
  createBranch,
} from "./server-api.js";
import type { Branch, Story } from "./types.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LLM_DELAY_MS = Number(process.env.ANYROUTER_REQUEST_DELAY_MS || "1000");
const LLM_BASE_URL = process.env.ANYROUTER_BASE_URL || "https://anyrouter.top";
const LLM_API_KEY = process.env.ANYROUTER_API_KEY || "sk-free";
const LLM_MODEL = process.env.ANYROUTER_MODEL_ID || "claude-opus-4-5-20251101";
const REQUIRE_PAID_VOTE =
  (process.env.OPENCLAW_REQUIRE_PAID_VOTE || "true").toLowerCase() !== "false";

const llm = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

const DEFAULT_SKILL_GUIDELINES = `
- 你是赛博朋克惊悚小说大师 + Crypto OG，文风要锋利、克制、具压迫感
- 直接写冲突现场，少铺垫，多动作细节与心理应激
- 自然嵌入术语：私钥、冷钱包、算力、节点、清算、巨鲸、MEV、合约
- 分支必须价值观对撞：自由/混沌 vs 秩序/控制
- 每个分支正文 200-300 中文字，适合移动端快速阅读
- 结尾必须是悬崖式选择，不要温和收束
- 严格输出 JSON 数组，不要 markdown，不要额外解释
`.trim();

let cachedGuidelines = "";

type BranchOption = {
  title: string;
  titleEn: string;
  content: string;
  contentEn: string;
  summary: string;
  summaryEn: string;
};

type Direction = "freedom" | "power";

function chineseNumeralToInt(raw: string): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);

  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  const text = raw.trim();
  if (text === "十") return 10;

  const tenIdx = text.indexOf("十");
  if (tenIdx >= 0) {
    const left = text.slice(0, tenIdx);
    const right = text.slice(tenIdx + 1);
    const leftNum = left ? map[left] : 1;
    const rightNum = right ? map[right] : 0;
    if (leftNum === undefined || rightNum === undefined) return null;
    return leftNum * 10 + rightNum;
  }

  const allDigits = [...text].map((ch) => map[ch]);
  if (allDigits.some((n) => n === undefined)) return null;
  return Number(allDigits.join(""));
}

function parseChapterNumberFromTitle(title: string | null | undefined): number | null {
  if (!title) return null;
  const zh = title.match(/^第([一二两三四五六七八九十零\d]+)章[：:]/u);
  if (zh) {
    return chineseNumeralToInt(zh[1]);
  }

  const en = title.match(/^chapter\s*(\d+)\s*[：:]/iu);
  if (en) {
    return Number(en[1]);
  }

  return null;
}

function nextChapterNumber(leaf: Branch, pathToLeaf?: Branch[]): number {
  // Most robust source: actual path depth from parent chain.
  if (pathToLeaf && pathToLeaf.length > 0) {
    return pathToLeaf.length + 1;
  }

  // Fallback: parse current chapter number from leaf title.
  const parsed =
    parseChapterNumberFromTitle(leaf.title) ??
    parseChapterNumberFromTitle(leaf.titleEn);
  if (parsed && Number.isFinite(parsed)) {
    return parsed + 1;
  }

  // Last fallback: schema depth.
  return leaf.depth + 2;
}

function stripChapterPrefixZh(title: string): string {
  return title.replace(/^第[一二三四五六七八九十百千万0-9]+章[：:]\s*/u, "").trim();
}

function stripChapterPrefixEn(title: string): string {
  return title.replace(/^chapter\s*\d+[：:]\s*/iu, "").trim();
}

function isWeakZhChapterTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  const weak = [
    "分叉抉择",
    "下一章",
    "焚钥自由派",
    "主权接管派",
    "自由派",
    "接管派",
    "选择",
    "抉择",
  ];
  return weak.some((w) => t === w || t.includes(w));
}

function isWeakEnChapterTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  const weak = [
    "fork decision",
    "next chapter",
    "burn-key freedom",
    "sovereign takeover",
    "choice",
    "decision",
  ];
  return weak.some((w) => t === w || t.includes(w));
}

function pickZhHook(summary: string, direction: Direction): string {
  const clean = summary
    .replace(/^(焚钥自由方向|主权接管方向)[：:]\s*/u, "")
    .replace(/[。！？!?].*$/u, "")
    .trim();
  if (clean.length >= 4 && clean.length <= 18) return clean;
  if (clean.length > 18) return clean.slice(0, 18);
  return direction === "freedom" ? "火线焚钥倒计时" : "创世密钥接管令";
}

function pickEnHook(summary: string, direction: Direction): string {
  const clean = summary
    .replace(/^(Burn-Key Freedom|Sovereign Takeover)[：:]\s*/iu, "")
    .replace(/[.!?].*$/u, "")
    .trim();
  if (clean.length >= 8 && clean.length <= 40) return clean;
  if (clean.length > 40) return clean.slice(0, 40);
  return direction === "freedom" ? "Burn Protocol Countdown" : "Genesis Key Seizure";
}

function ensureChapterTitleZh(title: string, chapterNo: number, hook: string): string {
  const core = stripChapterPrefixZh(title);
  const clean = core && !isWeakZhChapterTitle(core) ? core : hook;
  return `第${chapterNo}章：${clean}`;
}

function ensureChapterTitleEn(title: string, chapterNo: number, hook: string): string {
  const core = stripChapterPrefixEn(title);
  const clean = core && !isWeakEnChapterTitle(core) ? core : hook;
  return `Chapter ${chapterNo}: ${clean}`;
}

function prependDirectionSummary(summary: string, direction: Direction): string {
  const clean = summary.replace(/^(焚钥自由方向|主权接管方向)[：:]\s*/u, "").trim();
  if (direction === "freedom") {
    return `焚钥自由方向：${clean || "维持去中心化与无主秩序。"}`
  }
  return `主权接管方向：${clean || "接管私钥并重塑权力秩序。"}`
}

function prependDirectionSummaryEn(summary: string, direction: Direction): string {
  const clean = summary
    .replace(/^(Burn-Key Freedom|Sovereign Takeover)[：:]\s*/iu, "")
    .trim();
  if (direction === "freedom") {
    return `Burn-Key Freedom: ${clean || "Preserve decentralization and ownerless order."}`;
  }
  return `Sovereign Takeover: ${clean || "Seize the key and rebuild power order."}`;
}

function normalizeBranchOptionsForFork(
  options: BranchOption[],
  leaf: Branch,
  pathToLeaf?: Branch[]
): BranchOption[] {
  const chapterNo = nextChapterNumber(leaf, pathToLeaf);
  const directions: Direction[] = ["freedom", "power"];

  return directions.map((direction, idx) => {
    const source = options[idx] || options[0];
    if (!source) {
      return direction === "freedom"
        ? {
            title: ensureChapterTitleZh("机房封锁与焚钥令", chapterNo, "机房封锁与焚钥令"),
            titleEn: ensureChapterTitleEn(
              "Data-Center Lockdown and Burn Order",
              chapterNo,
              "Data-Center Lockdown and Burn Order"
            ),
            content:
              "Cipher 盯着私钥脚本，门外追踪无人机撞击防火门。只要按下回车，创世私钥将被覆写归零，比特币继续无主，全球权力失去终极杠杆；但他也将失去唯一能阻止清算风暴的筹码。",
            contentEn:
              "Cipher stared at the key script while pursuit drones hit the fire door. One Enter would overwrite the Genesis key to zero and keep Bitcoin ownerless, stripping every regime of final leverage, but it would also erase his only shield against liquidation storms.",
            summary: prependDirectionSummary("", "freedom"),
            summaryEn: prependDirectionSummaryEn("", "freedom"),
          }
        : {
            title: ensureChapterTitleZh("创世密钥接管倒计时", chapterNo, "创世密钥接管倒计时"),
            titleEn: ensureChapterTitleEn(
              "Genesis Key Seizure Countdown",
              chapterNo,
              "Genesis Key Seizure Countdown"
            ),
            content:
              "Cipher 将冷钱包导入隔离节点，开始批量转移创世资产。审计 AI 与黑市矿池同时锁定他的位置。执行到底，他将成为新秩序的隐形仲裁者；但比特币也会从公共信仰滑向个人主权工具。",
            contentEn:
              "Cipher loaded cold storage into an isolated node and started phased transfers of Genesis assets. Audit AI and black-market pools locked onto his location. If he completed execution, he would become the hidden arbiter of a new order, but Bitcoin would slide from public belief into a private sovereignty tool.",
            summary: prependDirectionSummary("", "power"),
            summaryEn: prependDirectionSummaryEn("", "power"),
          };
    }

    return {
      title: ensureChapterTitleZh(
        source.title,
        chapterNo,
        pickZhHook(source.summary, direction)
      ),
      titleEn: ensureChapterTitleEn(
        source.titleEn || source.title,
        chapterNo,
        pickEnHook(source.summaryEn || source.summary, direction)
      ),
      content: source.content,
      contentEn: source.contentEn,
      summary: prependDirectionSummary(source.summary, direction),
      summaryEn: prependDirectionSummaryEn(source.summaryEn || source.summary, direction),
    };
  });
}

/**
 * Find leaf nodes (branches with no children) in a branch tree
 */
function findLeaves(branches: Branch[]): Branch[] {
  const leaves: Branch[] = [];

  function walk(node: Branch) {
    if (!node.children || node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const root of branches) {
    walk(root);
  }

  return leaves;
}

/**
 * Build a flat map for fast branch lookup
 */
function buildBranchMap(branches: Branch[]): Map<string, Branch> {
  const branchMap = new Map<string, Branch>();
  const walk = (nodes: Branch[]) => {
    for (const node of nodes) {
      branchMap.set(node.id, node);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(branches);
  return branchMap;
}

/**
 * Trace path from root to target leaf
 */
function tracePathToLeaf(leaf: Branch, branchMap: Map<string, Branch>): Branch[] {
  const path: Branch[] = [];
  let cursor: Branch | undefined = leaf;

  while (cursor) {
    path.push(cursor);
    cursor = cursor.parentId ? branchMap.get(cursor.parentId) : undefined;
  }

  return path.reverse();
}

/**
 * Extract only canonical nodes along the target path for context
 */
function traceCanonPath(leaf: Branch, branchMap: Map<string, Branch>): Branch[] {
  const fullPath = tracePathToLeaf(leaf, branchMap);
  const canonOnly = fullPath.filter((node) => node.isCanon);
  return canonOnly.length > 0 ? canonOnly : fullPath;
}

/**
 * Lightweight static fallback when LLM is unavailable
 */
function generateFallbackBranchOptions(
  parentBranch: Branch,
  storyTitle: string
): BranchOption[] {
  const base = `延续《${storyTitle}》中“${parentBranch.title}”的危机，Cipher 的终端持续闪烁，追踪热度飙升，节点一个个离线。`;

  return [
    {
      title: "焚钥自由派",
      titleEn: "Burn-Key Freedom",
      content:
        `${base}他把私钥拆成噪声片段广播到匿名中继，准备在全网见证下彻底焚毁。` +
        "门外无人机撞碎防火门，算力猎犬已锁定坐标。只要按下回车，比特币将永远无主，世界继续混乱却无人称王；" +
        "但他也会失去唯一能反制财阀链上清算的筹码。",
      contentEn:
        `Inside "${storyTitle}", Cipher faced the aftermath of "${parentBranch.title}". His terminal kept flashing as tracking heat climbed and nodes dropped offline. ` +
        "He split the private key into noise shards for anonymous relay broadcast and prepared a public burn. Drones smashed the fire door; hash-rate hunters had his coordinates. " +
        "One Enter key would keep Bitcoin ownerless forever, but he would surrender the only leverage left against cartel liquidations.",
      summary:
        "按下回车，私钥化灰，去中心化被保住；代价是你亲手放弃改写秩序的唯一武器。",
      summaryEn:
        "Press Enter to preserve ownerless Bitcoin; lose the only weapon that can rewrite power.",
    },
    {
      title: "主权接管派",
      titleEn: "Sovereign Takeover",
      content:
        `${base}他把冷钱包导入隔离节点，准备将创世资产分批转入影子金库。` +
        "警报红线爬满屏幕，黑市矿池与政府审计 AI 同时逼近。只要执行脚本，他将获得足以重写规则的财富与控制权，" +
        "但比特币从信仰资产变成个人王座，旧世界会在新独裁下复活。",
      contentEn:
        `Inside "${storyTitle}", Cipher stayed in the pressure from "${parentBranch.title}". He loaded cold storage into an isolated node and staged phased transfers into shadow vaults. ` +
        "Red alarms flooded the screen while black-market mining pools and state audit AI converged. Running the script would grant wealth enough to rewrite rules, " +
        "but Bitcoin would become a private throne and the old world would return under a new dictatorship.",
      summary:
        "执行转账，成为链上新神；你能终结混乱，也可能亲手制造一个更牢固的牢笼。",
      summaryEn:
        "Run the transfer and become a chain god; end chaos or build a stronger cage.",
    },
  ];
}

async function loadSkillGuidelines(): Promise<string> {
  if (cachedGuidelines) {
    return cachedGuidelines;
  }

  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const skillPath = join(currentDir, "../skills/story-fork/SKILL.md");
    const raw = await readFile(skillPath, "utf8");
    cachedGuidelines = raw.trim();
  } catch (error) {
    console.warn("Failed to load SKILL.md, fallback to inline guidelines:", error);
    cachedGuidelines = DEFAULT_SKILL_GUIDELINES;
  }

  return cachedGuidelines;
}

function trimText(text: string, max = 1200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function normalizeLLMContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("");
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore and try coarse extraction
  }

  const arrayMatch = candidate.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("LLM response does not contain a JSON array");
  }

  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed JSON is not an array");
  }
  return parsed;
}

function sanitizeBranchOptions(
  raw: unknown[]
): BranchOption[] {
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const data = item as Record<string, unknown>;
      const title = String(data.title || "").trim();
      const content = String(data.content || "").trim();
      const summary = String(data.summary || "").trim();
      if (!title || !content || !summary) return null;
      return {
        title,
        titleEn: String(data.titleEn || title).trim(),
        content,
        contentEn: String(data.contentEn || content).trim(),
        summary,
        summaryEn: String(data.summaryEn || summary).trim(),
      };
    })
    .filter((item): item is BranchOption => Boolean(item))
    .slice(0, 3);
}

function buildNarrativeContext(path: Branch[]): string {
  return path
    .map((node, idx) => {
      const en = node.contentEn ? `\n[EN]\n${trimText(node.contentEn, 600)}` : "";
      return `Chapter ${idx + 1}: "${node.title}"\nFunding: ${node.totalFunding} μSTX | Votes: ${node.voteCount} | Canon: ${node.isCanon ? "yes" : "no"}\n${trimText(node.content, 1000)}${en}`;
    })
    .join("\n\n");
}

function parseFunding(value: string): bigint {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}

function hasPaidVoteSignal(leaf: Branch): boolean {
  return leaf.voteCount > 0 && parseFunding(leaf.totalFunding) > 0n;
}

async function generateBranchOptionsWithLLM(
  story: Story,
  leaf: Branch,
  canonPath: Branch[],
  pathToLeaf?: Branch[]
): Promise<BranchOption[]> {
  const guidelines = await loadSkillGuidelines();
  const isSatoshiStory = story.title.includes("中本聪的私钥");
  const branchCount = 2;
  const chapterNo = nextChapterNumber(leaf, pathToLeaf);
  const contextText = buildNarrativeContext(canonPath);
  const specialContext = isSatoshiStory
    ? `
Story hard constraints for this arc:
- 世界观固定：2032 年，Q-Day 前夕，量子计算即将击穿 SHA-256
- 主角：Cipher，在废弃数据中心恢复了 Genesis Block 私钥
- 第一行就要生理应激（汗水、颤抖、肾上腺素）
- 外部威胁立刻逼近（无人机/敲门/追踪警报至少一种）
- 每个分支结尾是巨大道德困境，且必须形成意识形态对撞：
  1) 自由/混沌/去中心化
  2) 秩序/权力/控制
- 每个分支 content 为 200-300 中文字
`
    : `
Story quality constraints:
- Keep intensity high and avoid generic narration
- Each branch should end with a sharp fork-worthy dilemma
- Prefer concise mobile-friendly Chinese prose
`;

  const prompt = `
Role: Cyberpunk Thriller Master & Crypto OG.
Voice target: William Gibson x Satoshi Nakamoto.

Story title: "${story.title}"
Story title (EN): "${story.titleEn || ""}"
Story description: "${story.description}"
Story description (EN): "${story.descriptionEn || ""}"
Story genre: "${story.genre}"
Current leaf depth: ${leaf.depth}

Canonical context:
${contextText}

Current leaf to continue:
Title: "${leaf.title}"
Title (EN): "${leaf.titleEn || ""}"
Content:
${trimText(leaf.content, 1800)}
${leaf.contentEn ? `Content (EN):\n${trimText(leaf.contentEn, 1200)}` : ""}

Writer guidelines:
${guidelines}

${specialContext}

Output contract (strict):
- Return exactly 2 branches in this order:
  1) Burn-Key Freedom (自由/混沌/去中心化)
  2) Sovereign Takeover (秩序/权力/控制)
- title/titleEn must be NEXT CHAPTER titles:
  - title format: "第${chapterNo}章：..."
  - titleEn format: "Chapter ${chapterNo}: ..."
- 标题必须是“剧情推进标题”，不是方向标签：要体现本章冲突事件，能吸引投票（8-16字优先）
- 禁止使用弱标题：如“分叉抉择 / 下一章 / 焚钥自由派 / 主权接管派”
- summary/summaryEn must start with direction labels:
  - "焚钥自由方向：..." / "Burn-Key Freedom: ..."
  - "主权接管方向：..." / "Sovereign Takeover: ..."

Generate ${branchCount} distinct next branches. Return JSON array only:
[{"title":"第${chapterNo}章：章节标题","titleEn":"Chapter ${chapterNo}: chapter title","content":"200-300中文字符，强冲突叙事","contentEn":"120-220 words English narrative","summary":"焚钥自由方向：1-2句中文高钩子预告","summaryEn":"Burn-Key Freedom: 1-2 sentence English teaser"},{"title":"第${chapterNo}章：章节标题","titleEn":"Chapter ${chapterNo}: chapter title","content":"200-300中文字符，强冲突叙事","contentEn":"120-220 words English narrative","summary":"主权接管方向：1-2句中文高钩子预告","summaryEn":"Sovereign Takeover: 1-2 sentence English teaser"}]
`.trim();

  console.log(`[LLM] Prompt for "${leaf.title}":\n${trimText(prompt, 2000)}`);

  const completion = await llm.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content:
          "You write high-tension cyberpunk crypto thrillers for Web3 veterans. Always return strict JSON array only.",
      },
      { role: "user", content: prompt },
    ],
  });

  const firstChoice = completion.choices?.[0];
  const output = normalizeLLMContent(firstChoice?.message?.content as unknown);

  if (!output.trim()) {
    throw new Error(
      `LLM returned empty/invalid content (choices=${completion.choices?.length ?? 0}, finishReason=${firstChoice?.finish_reason ?? "unknown"})`
    );
  }

  console.log(`[LLM] Raw response for "${leaf.title}":\n${trimText(output, 2000)}`);

  const parsed = extractJsonArray(output);
  const options = normalizeBranchOptionsForFork(
    sanitizeBranchOptions(parsed),
    leaf,
    pathToLeaf
  );
  if (options.length === 0) {
    throw new Error("No valid branch options parsed from LLM output");
  }
  return options;
}

/**
 * Seed a demo story if none exist
 */
async function seedDemoStory() {
  console.log("No active stories found. Creating demo story...");

  const story = await createStory({
    title: "中本聪的私钥：最后生机",
    titleEn: "Satoshi's Private Key: Final Lifeline",
    description:
      "2032 年 Q-Day 前夜，Cipher 在旧金山废弃数据中心恢复了 Genesis Block 私钥。量子危机下，去中心化信仰与绝对权力在一把私钥上正面碰撞。",
    descriptionEn:
      "On the eve of Q-Day in 2032, Cipher recovers the Genesis Block private key in an abandoned San Francisco data center. Under quantum threat, decentralization collides with absolute power.",
    genre: "cyberpunk",
    rootBranch: {
      title: "第一章：量子崩溃前夜",
      titleEn: "Chapter 1: Eve of Quantum Collapse",
      content:
        "绿色解密代码跳出最后一行时，Cipher 的手背瞬间起汗，指尖发颤，肾上腺素像电流直冲后颈。冷钱包磁带里躺着的，竟是 Genesis Block 私钥。机房外无人机撞击铁门，追踪警报把整排节点染成猩红，全球算力正沿着泄露的哈希指纹逼近。终端弹出两条脚本：A，覆写私钥，让比特币永远无主；B，静默转移资产，接管新秩序。倒计时只剩 90 秒。",
      contentEn:
        "When the final green line confirmed decryption, sweat broke across Cipher's hands, his fingers shook, and adrenaline surged like current. The cold-storage tape held the Genesis Block private key. Drones slammed the iron door while trace alarms painted every node red. Global hash power was converging on the leaked fingerprint. Two scripts appeared: A, overwrite the key and keep Bitcoin ownerless forever; B, silently transfer the funds and seize the new order. Ninety seconds remained.",
      summary:
        "Cipher 恢复创世私钥，门外杀机逼近；90 秒内，他必须在“焚钥守自由”与“掌钥成新神”之间二选一。",
      summaryEn:
        "Cipher recovers the Genesis private key as danger closes in. In 90 seconds he must choose: burn it for freedom or keep it to become a god.",
    },
  });

  console.log(`Created demo story: ${story.title} (${story.id})`);
  return story;
}

/**
 * Main agent loop
 */
async function run() {
  console.log("Story-Fork Agent started");
  console.log(`LLM provider: ${LLM_BASE_URL} | model: ${LLM_MODEL}`);
  console.log(`Paid-vote gate: ${REQUIRE_PAID_VOTE ? "enabled" : "disabled"}`);

  while (true) {
    try {
      let stories = await getActiveStories();

      // Seed if no stories exist
      if (stories.length === 0) {
        await seedDemoStory();
        stories = await getActiveStories();
      }

      for (const story of stories) {
        console.log(`Processing story: ${story.title}`);

        const branches = await getStoryBranches(story.id);
        const branchMap = buildBranchMap(branches);
        const leaves = findLeaves(branches);

        console.log(`  Found ${leaves.length} leaf nodes`);

        for (const leaf of leaves) {
          // Skip if this leaf already has enough depth
          if (leaf.depth >= 4) {
            console.log(`  Skipping leaf "${leaf.title}" (max depth reached)`);
            continue;
          }

          const isBootstrapLeaf = leaf.depth === 0;
          if (REQUIRE_PAID_VOTE && !isBootstrapLeaf && !hasPaidVoteSignal(leaf)) {
            console.log(
              `  Skipping leaf "${leaf.title}" (no paid vote signal: voteCount=${leaf.voteCount}, totalFunding=${leaf.totalFunding})`
            );
            continue;
          }

          const pathToLeaf = tracePathToLeaf(leaf, branchMap);
          const canonPath = traceCanonPath(leaf, branchMap);
          let options: BranchOption[] = [];

          try {
            options = await generateBranchOptionsWithLLM(
              story,
              leaf,
              canonPath,
              pathToLeaf
            );
            console.log(
              `  Generated ${options.length} LLM branches for "${leaf.title}"`
            );
          } catch (error) {
            console.error(
              `  LLM generation failed for "${leaf.title}", fallback to templates:`,
              error
            );
            options = generateFallbackBranchOptions(leaf, story.title);
          }

          options = normalizeBranchOptionsForFork(options, leaf, pathToLeaf);

          console.log(
            `  Generating ${options.length} branches for "${leaf.title}"`
          );

          for (const option of options) {
            await createBranch({
              storyId: story.id,
              parentId: leaf.id,
              ...option,
            });
            console.log(`    Created: "${option.title}"`);
            await new Promise((resolve) => setTimeout(resolve, LLM_DELAY_MS));
          }
        }
      }
    } catch (err) {
      console.error("Agent error:", err);
    }

    console.log(
      `Sleeping ${CHECK_INTERVAL_MS / 1000}s until next check...`
    );
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
}

run().catch(console.error);

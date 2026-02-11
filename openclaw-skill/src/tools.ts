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

const llm = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

const DEFAULT_SKILL_GUIDELINES = `
- Write in third person, past tense
- Continue naturally from current branch context
- Generate 2-3 distinct branch options with varied tone
- Each branch content should be roughly 200-500 words
- End each branch with a decision point or cliffhanger
- Return strict JSON array only, no markdown
`.trim();

let cachedGuidelines = "";

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
): { title: string; content: string; summary: string }[] {
  const templates = [
    {
      direction: "bold",
      adjective: "daring",
      action: "charges forward into the unknown",
    },
    {
      direction: "cautious",
      adjective: "careful",
      action: "takes a step back to assess the situation",
    },
    {
      direction: "mysterious",
      adjective: "enigmatic",
      action: "discovers a hidden passage that changes everything",
    },
  ];

  return templates.slice(0, 2 + Math.floor(Math.random() * 2)).map((t, i) => ({
    title: `${t.direction.charAt(0).toUpperCase() + t.direction.slice(1)} Path`,
    content: `Continuing from "${parentBranch.title}" in "${storyTitle}"...\n\nThe protagonist ${t.action}. ` +
      `With a ${t.adjective} resolve, the story takes a ${t.direction} turn. ` +
      `What seemed like a simple choice reveals layers of complexity, ` +
      `as new characters emerge and old alliances are tested. ` +
      `The ${t.direction} path unfolds with unexpected consequences that will shape the narrative ahead.`,
    summary: `A ${t.direction} turn where the protagonist ${t.action.split(" ").slice(0, 5).join(" ")}...`,
  }));
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
): { title: string; content: string; summary: string }[] {
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const title = String((item as Record<string, unknown>).title || "").trim();
      const content = String((item as Record<string, unknown>).content || "").trim();
      const summary = String((item as Record<string, unknown>).summary || "").trim();
      if (!title || !content || !summary) return null;
      return { title, content, summary };
    })
    .filter((item): item is { title: string; content: string; summary: string } => Boolean(item))
    .slice(0, 3);
}

function buildNarrativeContext(path: Branch[]): string {
  return path
    .map((node, idx) => {
      return `Chapter ${idx + 1}: "${node.title}"\nFunding: ${node.totalFunding} μSTX | Votes: ${node.voteCount} | Canon: ${node.isCanon ? "yes" : "no"}\n${trimText(node.content, 1000)}`;
    })
    .join("\n\n");
}

async function generateBranchOptionsWithLLM(
  story: Story,
  leaf: Branch,
  canonPath: Branch[]
): Promise<{ title: string; content: string; summary: string }[]> {
  const guidelines = await loadSkillGuidelines();
  const branchCount = leaf.depth >= 3 ? 2 : 3;
  const contextText = buildNarrativeContext(canonPath);

  const prompt = `
You are the Story-Fork narrative agent.

Story title: "${story.title}"
Story description: "${story.description}"
Story genre: "${story.genre}"
Current leaf depth: ${leaf.depth}

Canonical context:
${contextText}

Current leaf to continue:
Title: "${leaf.title}"
Content:
${trimText(leaf.content, 1800)}

Writer guidelines:
${guidelines}

Generate ${branchCount} distinct next branches. Return JSON array only:
[{"title":"3-5 word title","content":"200-500 words narrative","summary":"1-2 sentence teaser"}]
`.trim();

  console.log(`[LLM] Prompt for "${leaf.title}":\n${trimText(prompt, 2000)}`);

  const completion = await llm.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content:
          "You generate high-quality branching fiction. Always return strict JSON array only.",
      },
      { role: "user", content: prompt },
    ],
  });

  const firstChoice = completion.choices?.[0];
  const messageContent = firstChoice?.message?.content;
  const output =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent
            .map((part) =>
              typeof part === "string"
                ? part
                : typeof part === "object" &&
                    part !== null &&
                    "text" in part &&
                    typeof part.text === "string"
                  ? part.text
                  : ""
            )
            .join("")
        : "";

  if (!output.trim()) {
    throw new Error(
      `LLM returned empty/invalid content (choices=${completion.choices?.length ?? 0}, finishReason=${firstChoice?.finish_reason ?? "unknown"})`
    );
  }

  console.log(`[LLM] Raw response for "${leaf.title}":\n${trimText(output, 2000)}`);

  const parsed = extractJsonArray(output);
  const options = sanitizeBranchOptions(parsed);
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
    title: "The Last Archive",
    description:
      "In a world where memories can be stored and traded, the last free archive holds secrets that could reshape civilization. Every choice matters — and every reader decides the Canon.",
    genre: "scifi",
    rootBranch: {
      title: "Chapter 1: The Keeper's Burden",
      content:
        "Mira adjusted her neural interface as the morning light filtered through the archive's crystalline walls. " +
        "For three generations, her family had guarded the Last Archive — the only repository of unaltered human memories in existence.\n\n" +
        "The Syndicate's latest offer lay on her desk: ten million credits for complete access. " +
        "Enough to fund the archive for a century. But the memories within were not hers to sell.\n\n" +
        "A chime broke her thoughts. Two visitors had arrived simultaneously — unusual for a place most people didn't know existed. " +
        "On the eastern entrance stood a young woman in Syndicate gray. On the western, an old man carrying a memory crystal that glowed with an impossible blue light.\n\n" +
        "Mira could only greet one first. The other would have to wait — and waiting, in this world, meant anything could happen.",
      summary:
        "Mira, keeper of the Last Archive, faces a pivotal choice between two mysterious visitors.",
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

          const canonPath = traceCanonPath(leaf, branchMap);
          let options: { title: string; content: string; summary: string }[] = [];

          try {
            options = await generateBranchOptionsWithLLM(story, leaf, canonPath);
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

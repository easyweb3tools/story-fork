/**
 * Story-Fork OpenClaw Agent Tools
 *
 * This agent periodically checks for stories that need new branches
 * and creates compelling narrative options at leaf nodes.
 */

import {
  getActiveStories,
  getStoryBranches,
  createStory,
  createBranch,
} from "./server-api.js";
import type { Branch } from "./types.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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
 * Generate branch options for a leaf node
 * In a full implementation, this would call an LLM.
 * For the hackathon demo, we use template-based generation.
 */
function generateBranchOptions(
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
        const leaves = findLeaves(branches);

        console.log(`  Found ${leaves.length} leaf nodes`);

        for (const leaf of leaves) {
          // Skip if this leaf already has enough depth
          if (leaf.depth >= 4) {
            console.log(`  Skipping leaf "${leaf.title}" (max depth reached)`);
            continue;
          }

          const options = generateBranchOptions(leaf, story.title);
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

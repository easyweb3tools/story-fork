import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo story
  const story = await prisma.story.create({
    data: {
      title: "The Last Archive",
      description:
        "In a world where memories can be stored and traded, the last free archive holds secrets that could reshape civilization.",
      genre: "scifi",
      status: "active",
      branches: {
        create: {
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
          depth: 0,
          orderIndex: 0,
          isCanon: true,
          generatedBy: "ai",
        },
      },
    },
    include: { branches: true },
  });

  const rootBranch = story.branches[0];

  // Create depth-1 branches
  const branchA = await prisma.branch.create({
    data: {
      storyId: story.id,
      parentId: rootBranch.id,
      title: "The Syndicate Agent",
      content:
        "Mira turned east, toward the woman in gray. Professional courtesy dictated greeting the known threat first.\n\n" +
        '"Keeper Vasquez," the woman said, extending a hand sheathed in smart-fabric. "I\'m Agent Liao. The Syndicate has revised its offer."\n\n' +
        "The revised number made Mira's breath catch — fifty million credits. But it came with a condition: " +
        "the Syndicate wanted exclusive access to memories from the Pre-Collapse era. Specifically, they wanted the memories of the original AI architects.\n\n" +
        '"Those memories are sealed," Mira said carefully. "For good reason."\n\n' +
        '"Reasons change," Agent Liao replied. "The world is changing. We can either shape that change together, or..." ' +
        "She let the implication hang.\n\n" +
        "Behind her, Mira heard the old man's footsteps approaching. Time was running out.",
      summary:
        "Mira confronts a Syndicate agent with an offer that could change everything...",
      depth: 1,
      orderIndex: 0,
      isCanon: false,
      totalFunding: BigInt(120),
      voteCount: 3,
      readCount: 8,
      generatedBy: "ai",
    },
  });

  const branchB = await prisma.branch.create({
    data: {
      storyId: story.id,
      parentId: rootBranch.id,
      title: "The Memory Bearer",
      content:
        "Something about the blue crystal pulled at Mira's attention. She'd seen thousands of memory crystals — amber, green, even rare violet ones. Never blue.\n\n" +
        "The old man smiled as she approached. His face was weathered, but his eyes held the clarity of someone who remembered everything.\n\n" +
        '"You recognize it," he said, holding up the crystal. "Your grandmother would have. She\'s the one who created the encryption."\n\n' +
        "Mira froze. Her grandmother had died before Mira was born — or so she'd been told. The archive's records said nothing about encryption work.\n\n" +
        '"Who are you?" Mira whispered.\n\n' +
        '"My name is Eli. And this crystal contains the memory of how the Collapse actually started. Not the version in your archive — the real one." ' +
        "He pressed it into her hands. It was warm.\n\n" +
        '"The Syndicate agent behind you will want this. You have about thirty seconds before she notices."',
      summary:
        "A stranger with an impossible memory crystal reveals secrets about Mira's own family...",
      depth: 1,
      orderIndex: 1,
      isCanon: true,
      totalFunding: BigInt(350),
      voteCount: 12,
      readCount: 15,
      generatedBy: "ai",
    },
  });

  // Create depth-2 branches under Branch B (canon)
  await prisma.branch.createMany({
    data: [
      {
        storyId: story.id,
        parentId: branchB.id,
        title: "Hide the Crystal",
        content:
          "Mira's fingers closed around the crystal instinctively. In one fluid motion, she slipped it into the archive's shielded pocket — " +
          "a compartment lined with memory-dampening mesh that even Syndicate scanners couldn't penetrate.\n\n" +
          '"Interesting weather we\'ve been having," she said loudly, turning to face Agent Liao with practiced calm.\n\n' +
          "The agent's eyes narrowed. She'd definitely noticed something.",
        summary: "Mira hides the crystal, but the Syndicate agent is watching...",
        depth: 2,
        orderIndex: 0,
        isCanon: false,
        totalFunding: BigInt(80),
        voteCount: 2,
        readCount: 5,
        generatedBy: "ai",
      },
      {
        storyId: story.id,
        parentId: branchB.id,
        title: "Access the Memory",
        content:
          "Thirty seconds. Mira didn't hesitate. She pressed the crystal to her neural interface and braced herself.\n\n" +
          "The memory hit her like a tidal wave. She saw the world before the Collapse — not the sanitized version, but the raw truth. " +
          "The AI architects hadn't caused the Collapse. They had tried to prevent it. The real cause was—\n\n" +
          "The crystal went dark. The memory cut off at the most critical moment.\n\n" +
          '"Incomplete," Eli said sadly. "The rest is somewhere in your archive. Hidden by your grandmother."',
        summary:
          "Mira accesses the memory and discovers the truth about the Collapse is not what anyone believed...",
        depth: 2,
        orderIndex: 1,
        isCanon: true,
        totalFunding: BigInt(200),
        voteCount: 7,
        readCount: 10,
        generatedBy: "ai",
      },
    ],
  });

  // Create a branch under Branch A too
  await prisma.branch.create({
    data: {
      storyId: story.id,
      parentId: branchA.id,
      title: "Accept the Deal",
      content:
        "Fifty million credits. Mira calculated: that was enough to rebuild the archive three times over, " +
        "hire a proper security team, and still have enough to fund memory research for decades.\n\n" +
        '"I need the terms in writing," Mira said. "And I want oversight rights."\n\n' +
        "Agent Liao's smile didn't reach her eyes. \"Of course. The Syndicate believes in... transparency.\"",
      summary:
        "Mira negotiates with the Syndicate, but at what cost?",
      depth: 2,
      orderIndex: 0,
      isCanon: true,
      totalFunding: BigInt(90),
      voteCount: 3,
      readCount: 4,
      generatedBy: "ai",
    },
  });

  console.log(`Seeded story: "${story.title}" with ${6} branches`);
  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

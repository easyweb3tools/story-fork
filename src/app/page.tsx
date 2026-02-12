import HomeClient from "@/components/HomeClient";
import prisma from "@/lib/db";

async function getStories() {
  const stories = await prisma.story.findMany({
    include: {
      branches: {
        orderBy: [{ depth: "asc" }, { orderIndex: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return stories.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    branches: s.branches.map((b) => ({
      ...b,
      totalFunding: b.totalFunding.toString(),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
  }));
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await getStories();

  return (
    <main className="max-w-4xl mx-auto px-6 py-20">
      <HomeClient stories={stories} />

      {/* Footer */}
      <footer className="mt-24 text-center text-xs text-[#AEAEB2] border-t border-[#D2D2D7] pt-8 pb-8">
        <p>
          Built for the{" "}
          <span className="text-[#1D1D1F]">x402 Stacks Challenge</span>
          {" "}&middot; Powered by STX micro-payments
        </p>
      </footer>
    </main>
  );
}

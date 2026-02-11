import StoryCard from "@/components/StoryCard";
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

type StoryData = React.ComponentProps<typeof StoryCard>["story"];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await getStories();

  return (
    <main className="max-w-4xl mx-auto px-6 py-20">
      {/* Hero */}
      <div className="text-center mb-20">
        <h1 className="text-5xl font-semibold tracking-tight text-[#1D1D1F] mb-4">
          Story-Fork
        </h1>
        <p className="text-xl text-[#86868B] font-light mb-3">
          Pay to Vote the Narrative
        </p>
        <p className="text-sm text-[#86868B] max-w-md mx-auto leading-relaxed">
          Explore branching stories, pay STX to unlock paths, and vote for your
          favorite direction. The highest-funded branch becomes{" "}
          <span className="text-[#0071E3] font-medium">Canon</span>.
        </p>
      </div>

      {/* Story grid */}
      {stories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stories.map((story: StoryData) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <p className="text-[#86868B] text-lg mb-2">No stories yet</p>
          <p className="text-[#AEAEB2] text-sm">
            Stories will appear here once created by the AI agent or via the API.
          </p>
        </div>
      )}

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

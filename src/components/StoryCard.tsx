"use client";

import type { Locale } from "@/lib/i18n";
import { pickLocalizedText } from "@/lib/i18n";

interface StoryCardProps {
  story: {
    id: string;
    title: string;
    titleEn: string | null;
    description: string;
    descriptionEn: string | null;
    genre: string;
    status: string;
    branches: { id: string; isCanon: boolean; totalFunding: string }[];
    createdAt: string;
  };
  locale: Locale;
}

export default function StoryCard({ story, locale }: StoryCardProps) {
  const totalFunding = story.branches.reduce(
    (sum, b) => sum + Number(b.totalFunding),
    0
  );
  const branchCount = story.branches.length;

  const genreAccents: Record<string, string> = {
    fantasy: "bg-violet-50 text-violet-600",
    scifi: "bg-blue-50 text-blue-600",
    horror: "bg-red-50 text-red-600",
    mystery: "bg-amber-50 text-amber-700",
    romance: "bg-pink-50 text-pink-600",
  };

  const genreAccent = genreAccents[story.genre] || "bg-gray-100 text-gray-600";
  const displayTitle = pickLocalizedText(locale, story.title, story.titleEn);
  const displayDescription = pickLocalizedText(
    locale,
    story.description,
    story.descriptionEn
  );

  return (
    <a
      href={`/story/${story.id}`}
      className="group block rounded-2xl bg-[#F5F5F7] p-5 transition-all duration-300 hover:bg-[#E8E8ED] hover:scale-[1.02] active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase ${genreAccent}`}
        >
          {story.genre}
        </span>
        <span
          className={`flex items-center gap-1.5 text-[11px] font-medium ${
            story.status === "active" ? "text-[#34C759]" : "text-[#AEAEB2]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              story.status === "active" ? "bg-[#34C759]" : "bg-[#AEAEB2]"
            }`}
          />
          {story.status}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-[#1D1D1F] mb-1.5 tracking-tight group-hover:text-[#0071E3] transition-colors duration-300">
        {displayTitle}
      </h3>
      <p className="text-sm text-[#86868B] line-clamp-2 mb-4 leading-relaxed">
        {displayDescription}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#AEAEB2]">
        <span>
          {locale === "zh"
            ? `${branchCount} 条分支`
            : `${branchCount} branch${branchCount !== 1 ? "es" : ""}`}
        </span>
        <span className="text-[#D2D2D7]">&middot;</span>
        <span>{totalFunding.toLocaleString()} uSTX</span>
      </div>
    </a>
  );
}

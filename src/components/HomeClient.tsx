"use client";

import { useEffect, useState } from "react";
import StoryCard from "@/components/StoryCard";
import type { Locale } from "@/lib/i18n";

const STORAGE_KEY = "story_fork_locale";

interface HomeStory {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  genre: string;
  status: string;
  branches: { id: string; isCanon: boolean; totalFunding: string }[];
  createdAt: string;
}

export default function HomeClient({ stories }: { stories: HomeStory[] }) {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") {
      setLocale(saved);
    }
  }, []);

  const switchLocale = (next: Locale) => {
    setLocale(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <>
      <div className="text-center mb-20">
        <h1 className="text-5xl font-semibold tracking-tight text-[#1D1D1F] mb-4">
          Story-Fork
        </h1>
        <p className="text-xl text-[#86868B] font-light mb-3">
          {locale === "zh" ? "付费投票，改写叙事" : "Pay to Vote the Narrative"}
        </p>
        <p className="text-sm text-[#86868B] max-w-md mx-auto leading-relaxed">
          {locale === "zh"
            ? "探索分支故事，支付 STX 解锁剧情，并用投票决定正史走向。资金最高的分支成为 Canon。"
            : "Explore branching stories, pay STX to unlock paths, and vote for the Canon direction."}
        </p>
        <div className="mt-5 inline-flex rounded-full border border-[#D2D2D7] p-1 bg-white">
          <button
            onClick={() => switchLocale("zh")}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              locale === "zh"
                ? "bg-[#1D1D1F] text-white"
                : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
            }`}
          >
            中文
          </button>
          <button
            onClick={() => switchLocale("en")}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              locale === "en"
                ? "bg-[#1D1D1F] text-white"
                : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {stories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <p className="text-[#86868B] text-lg mb-2">
            {locale === "zh" ? "暂无故事" : "No stories yet"}
          </p>
          <p className="text-[#AEAEB2] text-sm">
            {locale === "zh"
              ? "AI 代理或 API 创建后会显示在这里。"
              : "Stories will appear here once created by the AI agent or API."}
          </p>
        </div>
      )}
    </>
  );
}

"use client";

import { BranchNode as BranchNodeType } from "@/lib/types";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { pickLocalizedText } from "@/lib/i18n";

interface BranchNodeProps {
  node: BranchNodeType;
  maxSiblingFunding: number;
  onRead: (branchId: string) => void;
  onVote: (branchId: string) => void;
  isRevealed: boolean;
  locale: Locale;
  directionLabel?: string | null;
}

export default function BranchNode({
  node,
  maxSiblingFunding,
  onRead,
  onVote,
  isRevealed,
  locale,
  directionLabel,
}: BranchNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const funding = Number(node.totalFunding);
  const fundingRatio = maxSiblingFunding > 0 ? funding / maxSiblingFunding : 0;
  const title = pickLocalizedText(locale, node.title, node.titleEn);
  const content = pickLocalizedText(locale, node.content, node.contentEn);
  const summary = pickLocalizedText(locale, node.summary, node.summaryEn);

  return (
    <div
      className={`
        relative rounded-2xl p-5 w-60
        transition-all duration-300 ease-out
        ${
          node.isCanon
            ? "bg-white border border-[#0071E3]/20 shadow-[0_2px_20px_rgba(0,113,227,0.08)]"
            : "bg-[#F5F5F7] border border-transparent hover:border-[#D2D2D7]"
        }
      `}
    >
      {/* Canon badge */}
      {node.isCanon && node.depth > 0 && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#0071E3] rounded-full text-[10px] font-semibold text-white tracking-wide uppercase">
          Canon
        </div>
      )}

      {/* Title */}
      <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1.5 truncate tracking-tight">
        {title}
      </h3>
      {directionLabel && (
        <p className="text-[11px] text-[#86868B] mb-2">{directionLabel}</p>
      )}

      {/* Summary or locked state */}
      {isRevealed ? (
        <div>
          <p
            className={`text-xs text-[#86868B] mb-2 leading-relaxed ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {content}
          </p>
          {content.length > 150 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-[#0071E3] hover:text-[#0077ED] font-medium mb-2 transition-colors"
            >
              {expanded
                ? locale === "zh"
                  ? "收起"
                  : "Show less"
                : locale === "zh"
                  ? "展开"
                  : "Read more"}
            </button>
          )}
        </div>
      ) : (
        <div className="mb-2">
          {summary && (
            <p className="text-xs text-[#AEAEB2] italic mb-2 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}
          <button
            onClick={() => onRead(node.id)}
            className="w-full py-2 text-xs font-medium rounded-xl
              bg-[#0071E3] hover:bg-[#0077ED]
              text-white transition-all duration-200
              active:scale-[0.97]"
          >
            {locale === "zh" ? "阅读" : "Read"} ({node.readPrice} uSTX)
          </button>
        </div>
      )}

      {/* Funding bar */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-[#AEAEB2] font-medium">
            {funding.toLocaleString()} uSTX
          </span>
          <span className="text-[10px] text-[#AEAEB2] font-medium">
            {locale === "zh"
              ? `${node.voteCount} 票`
              : `${node.voteCount} vote${node.voteCount !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="w-full h-1 bg-[#E8E8ED] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              node.isCanon ? "bg-[#0071E3]" : "bg-[#AEAEB2]"
            }`}
            style={{ width: `${Math.max(fundingRatio * 100, 2)}%` }}
          />
        </div>
      </div>

      {/* Vote button */}
      {node.depth > 0 && (
        <button
          onClick={() => onVote(node.id)}
          className="mt-3 w-full py-2 text-xs font-medium rounded-xl
            border border-[#D2D2D7] text-[#1D1D1F]
            hover:bg-[#F5F5F7] hover:border-[#AEAEB2]
            transition-all duration-200
            active:scale-[0.97]"
        >
          {locale === "zh" ? "投票" : "Vote"} ({node.votePrice} uSTX)
        </button>
      )}

      {/* Depth indicator */}
      <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-white border border-[#D2D2D7] flex items-center justify-center shadow-sm">
        <span className="text-[9px] text-[#AEAEB2] font-medium">
          D{node.depth}
        </span>
      </div>
    </div>
  );
}

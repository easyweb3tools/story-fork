"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import LuminousFlow from "@/components/LuminousFlow";
import PaymentStatus from "@/components/PaymentStatus";
import { BranchNode } from "@/lib/types";

interface Story {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: string;
}

export default function StoryPage() {
  const params = useParams();
  const storyId = params.storyId as string;

  const [story, setStory] = useState<Story | null>(null);
  const [branches, setBranches] = useState<BranchNode[]>([]);
  const [revealedBranches, setRevealedBranches] = useState<Set<string>>(
    new Set()
  );
  const [paymentStatus, setPaymentStatus] = useState<{
    status: "idle" | "pending" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  const fetchData = useCallback(async () => {
    try {
      const [storiesRes, branchesRes] = await Promise.all([
        fetch("/api/stories"),
        fetch(`/api/branches?storyId=${storyId}`),
      ]);

      if (storiesRes.ok) {
        const stories = await storiesRes.json();
        const found = stories.find((s: Story) => s.id === storyId);
        if (found) setStory(found);
      }

      if (branchesRes.ok) {
        const branchTree = await branchesRes.json();
        setBranches(branchTree);
      }
    } catch (err) {
      console.error("Failed to fetch story data:", err);
    }
  }, [storyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRead = async (branchId: string) => {
    setPaymentStatus({ status: "pending", message: "Requesting content..." });

    try {
      const res = await fetch(`/api/branches/${branchId}/read`);

      if (res.status === 402) {
        setPaymentStatus({
          status: "pending",
          message: "Payment required. Connect wallet to pay STX.",
        });
        // Dev mode fallback: retry (will get free content if SERVER_ADDRESS not set)
        const retryRes = await fetch(`/api/branches/${branchId}/read`);
        if (retryRes.ok) {
          setRevealedBranches((prev) => new Set([...prev, branchId]));
          setPaymentStatus({ status: "success", message: "Content unlocked!" });
          await fetchData();
        }
      } else if (res.ok) {
        setRevealedBranches((prev) => new Set([...prev, branchId]));
        setPaymentStatus({ status: "success", message: "Content unlocked!" });
        await fetchData();
      } else {
        setPaymentStatus({ status: "error", message: "Failed to read branch" });
      }
    } catch {
      setPaymentStatus({ status: "error", message: "Network error" });
    }

    setTimeout(() => setPaymentStatus({ status: "idle" }), 3000);
  };

  const handleVote = async (branchId: string) => {
    setPaymentStatus({ status: "pending", message: "Processing vote..." });

    try {
      const res = await fetch(`/api/branches/${branchId}/vote`, {
        method: "POST",
      });

      if (res.ok) {
        setPaymentStatus({
          status: "success",
          message: "Vote recorded! Canon may have shifted.",
        });
        await fetchData();
      } else if (res.status === 402) {
        setPaymentStatus({
          status: "pending",
          message: "Payment required to vote. Connect wallet.",
        });
        const retryRes = await fetch(`/api/branches/${branchId}/vote`, {
          method: "POST",
        });
        if (retryRes.ok) {
          setPaymentStatus({ status: "success", message: "Vote recorded!" });
          await fetchData();
        }
      } else {
        setPaymentStatus({ status: "error", message: "Vote failed" });
      }
    } catch {
      setPaymentStatus({ status: "error", message: "Network error" });
    }

    setTimeout(() => setPaymentStatus({ status: "idle" }), 3000);
  };

  if (!story) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#AEAEB2] animate-pulse text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <a
          href="/"
          className="text-sm text-[#0071E3] hover:text-[#0077ED] transition-colors mb-6 inline-block font-medium"
        >
          &larr; Back to stories
        </a>
        <h1 className="text-3xl font-semibold text-[#1D1D1F] mb-2 tracking-tight">
          {story.title}
        </h1>
        <p className="text-[#86868B] leading-relaxed">{story.description}</p>
        <div className="flex items-center gap-3 mt-4">
          <span className="px-2.5 py-1 bg-[#F5F5F7] text-[#86868B] rounded-full text-xs font-medium">
            {story.genre}
          </span>
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              story.status === "active"
                ? "bg-[#34C759]/10 text-[#34C759]"
                : "bg-[#F5F5F7] text-[#AEAEB2]"
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
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-8 text-xs text-[#86868B]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
          <span>Canon (highest funded)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D2D2D7]" />
          <span>Alternative branch</span>
        </div>
      </div>

      {/* Flow Tree */}
      {branches.length > 0 ? (
        <LuminousFlow
          branches={branches}
          onRead={handleRead}
          onVote={handleVote}
          revealedBranches={revealedBranches}
        />
      ) : (
        <div className="text-center py-24 text-[#AEAEB2]">
          <p>No branches yet. The AI agent will create them soon.</p>
        </div>
      )}

      <PaymentStatus
        status={paymentStatus.status}
        message={paymentStatus.message}
      />
    </main>
  );
}

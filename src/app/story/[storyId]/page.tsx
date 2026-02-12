"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import LuminousFlow from "@/components/LuminousFlow";
import PaymentStatus from "@/components/PaymentStatus";
import { BranchNode, PaymentRequirements } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { pickLocalizedText } from "@/lib/i18n";
import {
  connectWallet,
  disconnectWallet,
  getActiveWalletAccount,
  signPayment,
  type WalletAccount,
} from "@/lib/wallet";

interface Story {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  genre: string;
  status: string;
}

const STORAGE_KEY = "story_fork_locale";

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
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [locale, setLocale] = useState<Locale>("zh");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePaymentStatus = useCallback(
    (next: { status: "idle" | "pending" | "success" | "error"; message?: string }) => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      setPaymentStatus(next);

      if (next.status === "success" || next.status === "error") {
        statusTimerRef.current = setTimeout(() => {
          setPaymentStatus({ status: "idle" });
          statusTimerRef.current = null;
        }, 3000);
      }
    },
    []
  );

  const formatWalletConnectError = useCallback(
    (error: unknown): string => {
      const raw =
        error instanceof Error && error.message
          ? error.message
          : "Wallet connection cancelled or failed";
      const normalized = raw.toLowerCase();

      if (
        normalized.includes("cannot redefine property: stacksprovider") ||
        normalized.includes("another wallet may have inpage.js script") ||
        normalized.includes("failed setting xverse stacks default provider")
      ) {
        return locale === "zh"
          ? "检测到钱包扩展冲突（如同时启用 Xverse + Leather）。请先禁用其中一个后重试。"
          : "Wallet extension conflict detected (e.g. Xverse + Leather both enabled). Disable one wallet extension and try again.";
      }

      return raw;
    },
    [locale]
  );

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
        const rootIds = (branchTree as BranchNode[])
          .filter((branch) => branch.depth === 0)
          .map((branch) => branch.id);
        if (rootIds.length > 0) {
          setRevealedBranches((prev) => {
            const next = new Set(prev);
            for (const id of rootIds) {
              next.add(id);
            }
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch story data:", err);
    }
  }, [storyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    getActiveWalletAccount()
      .then((account) => {
        if (account) setWalletAccount(account);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const ensureWalletConnected = useCallback(
    async (requiredNetwork?: string): Promise<WalletAccount> => {
      const network = requiredNetwork || "testnet";

      if (walletAccount) {
        return walletAccount;
      }

      setWalletLoading(true);
      try {
        const account = await connectWallet(network);
        setWalletAccount(account);
        return account;
      } finally {
        setWalletLoading(false);
      }
    },
    [walletAccount]
  );

  const submitPaidRequest = useCallback(
    async (url: string, init: RequestInit, paymentRequirements: PaymentRequirements) => {
      const account = await ensureWalletConnected(paymentRequirements.network);
      updatePaymentStatus({
        status: "pending",
        message: "Please sign payment in your wallet...",
      });

      const signedPayload = await signPayment(paymentRequirements, account);
      return fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
          "x-payment": JSON.stringify(signedPayload),
        },
      });
    },
    [ensureWalletConnected, updatePaymentStatus]
  );

  const handleConnectWallet = async () => {
    try {
      setWalletLoading(true);
      const account = await connectWallet("testnet");
      setWalletAccount(account);
      updatePaymentStatus({
        status: "success",
        message: "Wallet connected",
      });
    } catch (error) {
      const detail = formatWalletConnectError(error);
      updatePaymentStatus({
        status: "error",
        message: detail,
      });
    } finally {
      setWalletLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
    setWalletAccount(null);
  };

  const shortAddress = walletAccount
    ? `${walletAccount.address.slice(0, 6)}...${walletAccount.address.slice(-4)}`
    : null;
  const storyTitle = pickLocalizedText(locale, story?.title, story?.titleEn);
  const storyDescription = pickLocalizedText(
    locale,
    story?.description,
    story?.descriptionEn
  );

  const switchLocale = (next: Locale) => {
    setLocale(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const handleRead = async (branchId: string) => {
    updatePaymentStatus({
      status: "pending",
      message: "Requesting content...",
    });

    try {
      const res = await fetch(`/api/branches/${branchId}/read`);

      if (res.status === 402) {
        const data = await res.json();
        const paymentRequirements = data.paymentRequirements as PaymentRequirements;
        const retryRes = await submitPaidRequest(
          `/api/branches/${branchId}/read`,
          {},
          paymentRequirements
        );
        if (retryRes.ok) {
          setRevealedBranches((prev) => new Set([...prev, branchId]));
          updatePaymentStatus({ status: "success", message: "Content unlocked!" });
          await fetchData();
        } else {
          const retryData = await retryRes.json().catch(() => null);
          updatePaymentStatus({
            status: "error",
            message: retryData?.reason || retryData?.error || "Payment verification failed",
          });
        }
      } else if (res.ok) {
        setRevealedBranches((prev) => new Set([...prev, branchId]));
        updatePaymentStatus({ status: "success", message: "Content unlocked!" });
        await fetchData();
      } else {
        updatePaymentStatus({ status: "error", message: "Failed to read branch" });
      }
    } catch {
      updatePaymentStatus({ status: "error", message: "Network error" });
    }
  };

  const handleVote = async (branchId: string) => {
    updatePaymentStatus({ status: "pending", message: "Processing vote..." });

    try {
      const res = await fetch(`/api/branches/${branchId}/vote`, {
        method: "POST",
      });

      if (res.ok) {
        updatePaymentStatus({
          status: "success",
          message: "Vote recorded! Canon may have shifted.",
        });
        await fetchData();
      } else if (res.status === 402) {
        const data = await res.json();
        const paymentRequirements = data.paymentRequirements as PaymentRequirements;
        const retryRes = await submitPaidRequest(
          `/api/branches/${branchId}/vote`,
          { method: "POST" },
          paymentRequirements
        );
        if (retryRes.ok) {
          updatePaymentStatus({ status: "success", message: "Vote recorded!" });
          await fetchData();
        } else {
          const retryData = await retryRes.json().catch(() => null);
          updatePaymentStatus({
            status: "error",
            message: retryData?.reason || retryData?.error || "Payment verification failed",
          });
        }
      } else {
        updatePaymentStatus({ status: "error", message: "Vote failed" });
      }
    } catch {
      updatePaymentStatus({ status: "error", message: "Network error" });
    }
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
          &larr; {locale === "zh" ? "返回故事列表" : "Back to stories"}
        </a>
        <h1 className="text-3xl font-semibold text-[#1D1D1F] mb-2 tracking-tight">
          {storyTitle}
        </h1>
        <p className="text-[#86868B] leading-relaxed">{storyDescription}</p>
        <div className="mt-4">
          {walletAccount ? (
            <button
              onClick={handleDisconnectWallet}
              className="px-3 py-1.5 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
            >
              {locale === "zh"
                ? `钱包: ${shortAddress} (断开)`
                : `Wallet: ${shortAddress} (Disconnect)`}
            </button>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={walletLoading}
              className="px-3 py-1.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium hover:bg-[#0077ED] disabled:opacity-60 transition-colors"
            >
              {walletLoading
                ? locale === "zh"
                  ? "连接中..."
                  : "Connecting..."
                : locale === "zh"
                  ? "连接 STX 钱包"
                  : "Connect STX Wallet"}
            </button>
          )}
        </div>
        {!walletAccount && (
          <p className="mt-2 text-[11px] text-[#86868B]">
            {locale === "zh"
              ? "若连接失败且浏览器安装了 Xverse + Leather，请先禁用其中一个扩展后再连接。"
              : "If connection fails and both Xverse + Leather are installed, disable one extension before connecting."}
          </p>
        )}
        <div className="mt-4 inline-flex rounded-full border border-[#D2D2D7] p-1 bg-white">
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
            {locale === "zh"
              ? story.status === "active"
                ? "活跃"
                : "已结束"
              : story.status}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-8 text-xs text-[#86868B]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
          <span>
            {locale === "zh" ? "正史分支（资金最高）" : "Canon (highest funded)"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D2D2D7]" />
          <span>{locale === "zh" ? "其他分支" : "Alternative branch"}</span>
        </div>
      </div>

      {/* Flow Tree */}
      {branches.length > 0 ? (
        <LuminousFlow
          branches={branches}
          onRead={handleRead}
          onVote={handleVote}
          revealedBranches={revealedBranches}
          locale={locale}
        />
      ) : (
        <div className="text-center py-24 text-[#AEAEB2]">
          <p>
            {locale === "zh"
              ? "暂无分支，AI 代理稍后会继续创作。"
              : "No branches yet. The AI agent will create them soon."}
          </p>
        </div>
      )}

      <PaymentStatus
        status={paymentStatus.status}
        message={paymentStatus.message}
      />
    </main>
  );
}

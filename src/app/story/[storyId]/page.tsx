"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import LuminousFlow from "@/components/LuminousFlow";
import PaymentStatus from "@/components/PaymentStatus";
import { BranchNode, PaymentRequirements } from "@/lib/types";
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
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
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
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Wallet connection cancelled or failed";
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
          &larr; Back to stories
        </a>
        <h1 className="text-3xl font-semibold text-[#1D1D1F] mb-2 tracking-tight">
          {story.title}
        </h1>
        <p className="text-[#86868B] leading-relaxed">{story.description}</p>
        <div className="mt-4">
          {walletAccount ? (
            <button
              onClick={handleDisconnectWallet}
              className="px-3 py-1.5 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
            >
              Wallet: {shortAddress} (Disconnect)
            </button>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={walletLoading}
              className="px-3 py-1.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium hover:bg-[#0077ED] disabled:opacity-60 transition-colors"
            >
              {walletLoading ? "Connecting..." : "Connect STX Wallet"}
            </button>
          )}
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

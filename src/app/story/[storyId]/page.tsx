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

interface VoteHistoryItem {
  id: string;
  branchId: string;
  amount: string;
  payerAddress: string;
  txHash: string | null;
  network: string;
  createdAt: string;
  branch: {
    id: string;
    title: string;
    titleEn: string | null;
  };
}

const STORAGE_KEY = "story_fork_locale";
type Direction = "freedom" | "power";

function encodePaymentHeaderValue(payload: unknown): string {
  return JSON.stringify(payload);
}

function detectDirectionFromText(text: string): Direction | null {
  const normalized = text.toLowerCase();
  const freedomKeywords = ["焚", "自由", "无主", "chaos", "freedom", "burn"];
  const powerKeywords = ["主权", "接管", "控制", "order", "power", "keep"];
  if (freedomKeywords.some((k) => normalized.includes(k))) return "freedom";
  if (powerKeywords.some((k) => normalized.includes(k))) return "power";
  return null;
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
  const [locale, setLocale] = useState<Locale>("zh");
  const [voteHistory, setVoteHistory] = useState<VoteHistoryItem[]>([]);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directionLabel = useCallback(
    (direction: Direction) => {
      if (locale === "zh") {
        return direction === "freedom" ? "焚钥自由方向" : "主权接管方向";
      }
      return direction === "freedom" ? "Burn-Key Freedom" : "Sovereign Takeover";
    },
    [locale]
  );

  const formatTxHash = useCallback((txHash: string) => {
    return txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  }, []);

  const txExplorerUrl = useCallback((txHash: string, network: string) => {
    const normalized = network.toLowerCase();
    const isMainnet = normalized.includes("main") || normalized === "stacks:1";
    const chain = isMainnet ? "" : "?chain=testnet";
    return `https://explorer.hiro.so/txid/${formatTxHash(txHash)}${chain}`;
  }, [formatTxHash]);

  const shortenAddress = useCallback((value: string) => {
    if (!value || value.length < 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }, []);

  const directionByBranchId = useCallback((tree: BranchNode[]) => {
    const map = new Map<string, Direction>();
    const assign = (node: BranchNode, direction: Direction) => {
      map.set(node.id, direction);
      for (const child of node.children || []) assign(child, direction);
    };
    const depthOne: BranchNode[] = [];
    const walk = (items: BranchNode[]) => {
      for (const item of items) {
        if (item.depth === 1) depthOne.push(item);
        if (item.children?.length) walk(item.children);
      }
    };
    walk(tree);
    depthOne.sort((a, b) => a.orderIndex - b.orderIndex).forEach((node, idx) => {
      const text = `${node.title || ""} ${node.titleEn || ""} ${node.summary || ""} ${
        node.summaryEn || ""
      }`;
      const detected = detectDirectionFromText(text);
      assign(node, detected || (idx % 2 === 0 ? "freedom" : "power"));
    });
    return map;
  }, []);

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
      const voteHistoryRes = await fetch(
        `/api/payments?storyId=${storyId}&type=vote&limit=20`
      );

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

      if (voteHistoryRes.ok) {
        const history = (await voteHistoryRes.json()) as VoteHistoryItem[];
        setVoteHistory(history);
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
          "x-payment": encodePaymentHeaderValue(signedPayload),
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
    } catch (error) {
      const detail =
        error instanceof Error && error.message ? error.message : "Network error";
      updatePaymentStatus({ status: "error", message: detail });
    }
  };

  const handleVote = async (branchId: string) => {
    const directionMap = directionByBranchId(branches);
    const direction = directionMap.get(branchId);
    updatePaymentStatus({
      status: "pending",
      message: direction
        ? locale === "zh"
          ? `正在为「${directionLabel(direction)}」投票...`
          : `Voting for "${directionLabel(direction)}"...`
        : locale === "zh"
          ? "正在处理投票..."
          : "Processing vote...",
    });

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
    } catch (error) {
      const detail =
        error instanceof Error && error.message ? error.message : "Network error";
      updatePaymentStatus({ status: "error", message: detail });
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

      <section className="mt-6 mb-6 rounded-2xl border border-[#E8E8ED] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1D1D1F] mb-2">
          {locale === "zh" ? "分叉方向说明" : "Fork Direction Guide"}
        </h3>
        <div className="grid gap-2 text-xs text-[#86868B]">
          <p>
            <span className="font-medium text-[#1D1D1F]">
              {locale === "zh" ? "焚钥自由方向：" : "Burn-Key Freedom:"}
            </span>{" "}
            {locale === "zh"
              ? "彻底去中心化与无主秩序，宁可放弃财富也不让任何人控制创世私钥。"
              : "Radical decentralization and ownerless order, sacrificing wealth to prevent key capture."}
          </p>
          <p>
            <span className="font-medium text-[#1D1D1F]">
              {locale === "zh" ? "主权接管方向：" : "Sovereign Takeover:"}
            </span>{" "}
            {locale === "zh"
              ? "以控制与效率换取新秩序，接管私钥并重塑权力与财富结构。"
              : "Trade freedom for control and efficiency by seizing the key to reshape power and wealth."}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-8 items-start">
        <section>
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
        </section>

        <aside className="lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight mb-4">
            {locale === "zh" ? "投票历史" : "Vote History"}
          </h2>
          {voteHistory.length === 0 ? (
            <div className="rounded-2xl border border-[#E8E8ED] bg-white p-4 text-sm text-[#86868B]">
              {locale === "zh" ? "暂无投票记录" : "No vote records yet."}
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {voteHistory.map((item) => {
                const branchTitle = pickLocalizedText(
                  locale,
                  item.branch.title,
                  item.branch.titleEn
                );
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[#E8E8ED] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#1D1D1F]">{branchTitle}</p>
                      <p className="text-xs text-[#86868B]">
                        {new Date(item.createdAt).toLocaleString(
                          locale === "zh" ? "zh-CN" : "en-US"
                        )}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#86868B]">
                      <span>
                        {locale === "zh" ? "金额" : "Amount"}: {item.amount} uSTX
                      </span>
                      <span>
                        {locale === "zh" ? "地址" : "Payer"}:{" "}
                        {shortenAddress(item.payerAddress)}
                      </span>
                    </div>
                    {item.txHash ? (
                      <a
                        href={txExplorerUrl(item.txHash, item.network)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs font-medium text-[#0071E3] hover:text-[#0077ED]"
                      >
                        {locale === "zh" ? "查看链上交易" : "View On-chain Tx"}
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-[#AEAEB2]">
                        {locale === "zh" ? "无交易哈希" : "No transaction hash"}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <PaymentStatus
        status={paymentStatus.status}
        message={paymentStatus.message}
      />
    </main>
  );
}

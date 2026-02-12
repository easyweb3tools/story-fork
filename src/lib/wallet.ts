"use client";

import { connect, disconnect as disconnectWalletProvider, request } from "@stacks/connect";
import { makeUnsignedSTXTokenTransfer } from "@stacks/transactions";
import type { PaymentRequirements } from "./types";

export interface WalletAccount {
  address: string;
  publicKey: string;
}

export interface SignedPaymentPayload {
  x402Version: 2;
  resource: {
    url: string;
  };
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
  };
  payload: {
    transaction: string;
  };
}

type WalletAddressEntry = {
  address?: string;
  publicKey?: string;
};

function isStacksAddress(address: string | undefined): boolean {
  if (!address) return false;
  return address.startsWith("ST") || address.startsWith("SP");
}

function networkMatchesAddress(
  network: "mainnet" | "testnet",
  address: string | undefined
): boolean {
  if (!address) return false;
  if (network === "mainnet") return address.startsWith("SP");
  return address.startsWith("ST");
}

function pickBestStacksEntry(
  entries: WalletAddressEntry[],
  network: "mainnet" | "testnet"
): WalletAddressEntry | null {
  const stacksOnly = entries.filter(
    (entry) => isStacksAddress(entry.address) && typeof entry.publicKey === "string"
  );
  if (stacksOnly.length === 0) return null;

  const networkMatched = stacksOnly.find((entry) =>
    networkMatchesAddress(network, entry.address)
  );
  return networkMatched || stacksOnly[0] || null;
}

function getAddressEntries(payload: unknown): WalletAddressEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;

  if (Array.isArray(data.addresses)) {
    return data.addresses.filter(
      (entry): entry is WalletAddressEntry =>
        typeof entry === "object" && entry !== null && "address" in entry
    );
  }

  if (Array.isArray(data.accounts)) {
    const entries: WalletAddressEntry[] = [];
    for (const entry of data.accounts) {
      if (!entry || typeof entry !== "object") continue;
      const account = entry as Record<string, unknown>;
      const address =
        (typeof account.address === "string" && account.address) ||
        (typeof account.stxAddress === "string" && account.stxAddress) ||
        undefined;
      const publicKey = typeof account.publicKey === "string" ? account.publicKey : undefined;
      if (!address) continue;
      entries.push({ address, publicKey });
    }
    return entries;
  }

  return [];
}

function formatWalletError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  if (typeof error === "object" && error !== null) {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Wallet connection failed";
    return new Error(message);
  }

  return new Error("Wallet connection failed");
}

function normalizeStacksNetwork(network: string): "mainnet" | "testnet" {
  return network.toLowerCase().includes("main") ? "mainnet" : "testnet";
}

function isInvalidParamsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("invalid parameters") || msg.includes("invalid params");
}

async function requestAddressesCompat(network: "mainnet" | "testnet") {
  try {
    return await request("stx_getAddresses", { network });
  } catch (error) {
    if (!isInvalidParamsError(error)) throw error;
    return await request("stx_getAddresses");
  }
}

async function requestAccountsCompat(network: "mainnet" | "testnet") {
  try {
    return await request("stx_getAccounts", { network });
  } catch (error) {
    if (!isInvalidParamsError(error)) throw error;
    return await request("stx_getAccounts");
  }
}

function buildMemo(resource: string): string {
  if (!resource) return "story-fork";
  return resource.slice(0, 34);
}

export async function connectWallet(
  preferredNetwork: string = "testnet"
): Promise<WalletAccount> {
  const network = normalizeStacksNetwork(preferredNetwork);

  try {
    let connectResult: { addresses?: Array<{ address: string; publicKey: string }> } | undefined;
    try {
      connectResult = await connect({
        forceWalletSelect: true,
        persistWalletSelect: true,
        network,
      });
    } catch (error) {
      if (!isInvalidParamsError(error)) throw error;
      connectResult = await connect({
        forceWalletSelect: true,
        persistWalletSelect: true,
      });
    }

    const fromConnect = pickBestStacksEntry(connectResult?.addresses || [], network);
    if (fromConnect) {
      return {
        address: fromConnect.address!,
        publicKey: fromConnect.publicKey!,
      };
    }

    const addresses = await requestAddressesCompat(network);
    const address = pickBestStacksEntry(getAddressEntries(addresses), network);
    if (address) {
      return {
        address: address.address!,
        publicKey: address.publicKey!,
      };
    }

    // Compatibility fallback for wallets that still expose account payloads.
    const accounts = await requestAccountsCompat(network);
    const account = pickBestStacksEntry(getAddressEntries(accounts), network);
    if (!account) {
      throw new Error(`No ${network} Stacks account returned by wallet`);
    }

    return {
      address: account.address!,
      publicKey: account.publicKey!,
    };
  } catch (error) {
    throw formatWalletError(error);
  }
}

export function disconnectWallet() {
  disconnectWalletProvider();
}

export async function getActiveWalletAccount(
  preferredNetwork: string = "testnet"
): Promise<WalletAccount | null> {
  try {
    const network = normalizeStacksNetwork(preferredNetwork);
    const addresses = await requestAddressesCompat(network);
    const address = pickBestStacksEntry(getAddressEntries(addresses), network);
    if (address) {
      return {
        address: address.address!,
        publicKey: address.publicKey!,
      };
    }

    const accounts = await requestAccountsCompat(network);
    const account = pickBestStacksEntry(getAddressEntries(accounts), network);
    if (!account) return null;
    return {
      address: account.address!,
      publicKey: account.publicKey!,
    };
  } catch {
    return null;
  }
}

export async function signPayment(
  paymentRequirements: PaymentRequirements,
  account: WalletAccount
): Promise<SignedPaymentPayload> {
  const network = normalizeStacksNetwork(paymentRequirements.network);
  const activeAccount = (await getActiveWalletAccount(paymentRequirements.network)) || account;

  const unsignedTx = await makeUnsignedSTXTokenTransfer({
    recipient: paymentRequirements.payTo,
    amount: BigInt(paymentRequirements.maxAmountRequired),
    network,
    publicKey: activeAccount.publicKey,
    memo: buildMemo(paymentRequirements.resource),
  });

  const serialized = unsignedTx.serialize();
  const transactionForWallet =
    typeof serialized === "string"
      ? serialized
      : Buffer.from(serialized).toString("hex");

  const signed = await request("stx_signTransaction", {
    transaction: transactionForWallet,
    broadcast: false,
  });

  const signedTransaction =
    (typeof signed === "object" &&
      signed !== null &&
      "transaction" in signed &&
      typeof signed.transaction === "string" &&
      signed.transaction) ||
    (typeof signed === "object" &&
      signed !== null &&
      "txHex" in signed &&
      typeof (signed as { txHex?: string }).txHex === "string" &&
      (signed as { txHex: string }).txHex) ||
    null;

  if (!signedTransaction) {
    const signedObj =
      typeof signed === "object" && signed !== null
        ? (signed as unknown as Record<string, unknown>)
        : {};
    throw new Error(
      `Wallet did not return a signed transaction (keys=${Object.keys(signedObj).join(",")})`
    );
  }

  return {
    x402Version: 2,
    resource: {
      url: paymentRequirements.resource,
    },
    accepted: {
      scheme: paymentRequirements.scheme,
      network: paymentRequirements.network,
      amount: paymentRequirements.maxAmountRequired,
      asset: paymentRequirements.asset,
      payTo: paymentRequirements.payTo,
      maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
    },
    payload: {
      transaction: signedTransaction,
    },
  };
}

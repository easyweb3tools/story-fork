"use client";

import { connect, disconnect as disconnectWalletProvider, request } from "@stacks/connect";
import { makeUnsignedSTXTokenTransfer } from "@stacks/transactions";
import type { PaymentRequirements } from "./types";

export interface WalletAccount {
  address: string;
  publicKey: string;
}

export interface SignedPaymentPayload {
  x402Version: 1;
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    resource: string;
    description: string;
  };
  payload: {
    transaction: string;
  };
  payer: string;
  transaction: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
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
    try {
      await connect({
        forceWalletSelect: true,
        persistWalletSelect: true,
        network,
      });
    } catch (error) {
      if (!isInvalidParamsError(error)) throw error;
      await connect({
        forceWalletSelect: true,
        persistWalletSelect: true,
      });
    }

    const addresses = await requestAddressesCompat(network);
    const address = addresses.addresses[0];
    if (address) {
      return {
        address: address.address,
        publicKey: address.publicKey,
      };
    }

    // Compatibility fallback for wallets that still expose account payloads.
    const accounts = await requestAccountsCompat(network);
    const account = accounts.accounts[0];
    if (!account) {
      throw new Error(`No ${network} Stacks account returned by wallet`);
    }

    return {
      address: account.address,
      publicKey: account.publicKey,
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
    const address = addresses.addresses[0];
    if (address) {
      return {
        address: address.address,
        publicKey: address.publicKey,
      };
    }

    const accounts = await requestAccountsCompat(network);
    const account = accounts.accounts[0];
    if (!account) return null;
    return {
      address: account.address,
      publicKey: account.publicKey,
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

  const unsignedTx = await makeUnsignedSTXTokenTransfer({
    recipient: paymentRequirements.payTo,
    amount: BigInt(paymentRequirements.maxAmountRequired),
    network,
    publicKey: account.publicKey,
    memo: buildMemo(paymentRequirements.resource),
  });

  const signed = await request("stx_signTransaction", {
    transaction: unsignedTx.serialize(),
    broadcast: false,
  });

  if (!signed.transaction) {
    throw new Error("Wallet did not return a signed transaction");
  }

  return {
    x402Version: 1,
    accepted: {
      scheme: paymentRequirements.scheme,
      network: paymentRequirements.network,
      amount: paymentRequirements.maxAmountRequired,
      asset: paymentRequirements.asset,
      payTo: paymentRequirements.payTo,
      maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds,
      resource: paymentRequirements.resource,
      description: paymentRequirements.description,
    },
    payload: {
      transaction: signed.transaction,
    },
    payer: account.address,
    transaction: signed.transaction,
    network: paymentRequirements.network,
    amount: paymentRequirements.maxAmountRequired,
    asset: paymentRequirements.asset,
    payTo: paymentRequirements.payTo,
  };
}

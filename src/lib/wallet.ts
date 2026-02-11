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

function normalizeStacksNetwork(network: string): "mainnet" | "testnet" {
  return network.toLowerCase().includes("main") ? "mainnet" : "testnet";
}

function buildMemo(resource: string): string {
  if (!resource) return "story-fork";
  return resource.slice(0, 34);
}

export async function connectWallet(
  preferredNetwork: string = "testnet"
): Promise<WalletAccount> {
  const network = normalizeStacksNetwork(preferredNetwork);

  await connect({
    forceWalletSelect: true,
    persistWalletSelect: true,
  });

  const accounts = await request("stx_getAccounts", { network });
  const account = accounts.accounts[0];
  if (!account) {
    throw new Error("No Stacks account returned by wallet");
  }

  return {
    address: account.address,
    publicKey: account.publicKey,
  };
}

export function disconnectWallet() {
  disconnectWalletProvider();
}

export async function getActiveWalletAccount(
  preferredNetwork: string = "testnet"
): Promise<WalletAccount | null> {
  try {
    const network = normalizeStacksNetwork(preferredNetwork);
    const accounts = await request("stx_getAccounts", { network });
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

  return {
    x402Version: 2,
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

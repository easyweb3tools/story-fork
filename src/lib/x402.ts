import { NextRequest, NextResponse } from "next/server";
import { broadcastTransaction, deserializeTransaction } from "@stacks/transactions";
import type { PaymentRequirements } from "./types";

const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.stacksx402.com";
const SERVER_ADDRESS = process.env.SERVER_ADDRESS || "";
const RAW_NETWORK = process.env.NETWORK || "testnet";
const FACILITATOR_TIMEOUT_MS = Number(process.env.FACILITATOR_TIMEOUT_MS || "8000");

// STX asset identifier for testnet/mainnet
const STX_ASSET = "STX";

type FacilitatorPaymentRequirements = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
};

function toCaipNetwork(network: string): string {
  const value = String(network || "").toLowerCase();
  if (value === "stacks:1" || value === "stacks:2147483648") return value;
  if (value.includes("main")) return "stacks:1";
  return "stacks:2147483648";
}

function normalizePaymentPayloadNetwork(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const data = payload as Record<string, unknown>;
  const accepted =
    data.accepted && typeof data.accepted === "object"
      ? (data.accepted as Record<string, unknown>)
      : null;

  if (!accepted) return payload;

  const normalizedAccepted = {
    ...accepted,
    network: toCaipNetwork(String(accepted.network || RAW_NETWORK)),
  };

  return {
    ...data,
    accepted: normalizedAccepted,
  };
}

function toFacilitatorRequirements(
  requirements: PaymentRequirements
): FacilitatorPaymentRequirements {
  return {
    scheme: requirements.scheme,
    network: requirements.network,
    amount: requirements.maxAmountRequired,
    asset: requirements.asset,
    payTo: requirements.payTo,
    maxTimeoutSeconds: requirements.maxTimeoutSeconds,
  };
}

function truncateText(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function maskValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.length <= 12) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sanitizePaymentPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const data = payload as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    if (key === "transaction" || key === "payer") {
      safe[key] = maskValue(val);
      continue;
    }
    if (key === "payload" && val && typeof val === "object") {
      const payloadObj = val as Record<string, unknown>;
      safe[key] = {
        ...payloadObj,
        transaction: maskValue(payloadObj.transaction),
      };
      continue;
    }
    safe[key] = val;
  }

  return safe;
}

function parseSignedTxMeta(paymentPayload: unknown): Record<string, unknown> | null {
  try {
    if (!paymentPayload || typeof paymentPayload !== "object") return null;
    const payloadObj = paymentPayload as Record<string, unknown>;
    const nestedPayload =
      payloadObj.payload && typeof payloadObj.payload === "object"
        ? (payloadObj.payload as Record<string, unknown>)
        : null;
    const txRaw =
      nestedPayload && typeof nestedPayload.transaction === "string"
        ? nestedPayload.transaction
        : null;
    if (!txRaw) return null;

    const txHex = txRaw.startsWith("0x") ? txRaw.slice(2) : txRaw;
    const tx = deserializeTransaction(Buffer.from(txHex, "hex"));
    const spending = tx.auth.spendingCondition;
    const amount =
      tx.payload && typeof tx.payload === "object" && "amount" in tx.payload
        ? String((tx.payload as { amount?: bigint }).amount ?? "")
        : undefined;
    return {
      txid: tx.txid(),
      chainId: tx.chainId,
      transactionVersion: tx.transactionVersion,
      nonce:
        spending && typeof spending === "object" && "nonce" in spending
          ? String((spending as { nonce?: bigint }).nonce ?? "")
          : undefined,
      fee:
        spending && typeof spending === "object" && "fee" in spending
          ? String((spending as { fee?: bigint }).fee ?? "")
          : undefined,
      amount,
    };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : "unknown",
    };
  }
}

function caipToNetwork(caip: string): "mainnet" | "testnet" {
  return caip === "stacks:1" ? "mainnet" : "testnet";
}

/**
 * Build 402 payment-required response
 */
export function createPaymentRequired(
  resource: string,
  amountMicroSTX: number,
  description: string
): NextResponse {
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: toCaipNetwork(RAW_NETWORK),
    maxAmountRequired: String(amountMicroSTX),
    resource,
    description,
    payTo: SERVER_ADDRESS,
    asset: STX_ASSET,
    maxTimeoutSeconds: 60,
  };

  return NextResponse.json(
    {
      error: "Payment Required",
      paymentRequirements: requirements,
      facilitatorUrl: FACILITATOR_URL,
    },
    {
      status: 402,
      headers: {
        "X-Facilitator-URL": FACILITATOR_URL,
      },
    }
  );
}

/**
 * Verify payment from request header via facilitator
 */
export async function verifyPayment(
  req: NextRequest,
  amountMicroSTX: number,
  resource: string,
  description: string
): Promise<{
  valid: boolean;
  payer?: string;
  txHash?: string;
  error?: string;
}> {
  const paymentHeaderRaw = req.headers.get("x-payment");
  if (!paymentHeaderRaw) {
    return { valid: false, error: "No payment header" };
  }

  try {
    const decodePaymentHeaderToJson = (value: string): string => {
      try {
        JSON.parse(value);
        return value;
      } catch {
        const decoded = Buffer.from(value, "base64").toString("utf8");
        JSON.parse(decoded);
        return decoded;
      }
    };

    const paymentHeaderJson = decodePaymentHeaderToJson(paymentHeaderRaw);
    const originalPaymentPayload = JSON.parse(paymentHeaderJson) as Record<string, unknown>;
    const normalizedPaymentPayload = normalizePaymentPayloadNetwork(originalPaymentPayload);

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: toCaipNetwork(RAW_NETWORK),
      maxAmountRequired: String(amountMicroSTX),
      resource,
      description,
      payTo: SERVER_ADDRESS,
      asset: STX_ASSET,
      maxTimeoutSeconds: 60,
    };
    const facilitatorRequirements = toFacilitatorRequirements(requirements);

    const callFacilitator = async (
      path: string,
      paymentPayload: unknown,
      x402Version: string | number,
      paymentHeaderValue: string
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FACILITATOR_TIMEOUT_MS);

      try {
        const requestBody = {
          // Newer facilitator contract (x402 core style)
          x402Version,
          // Legacy contract compatibility
          paymentPayload,
          paymentRequirements: facilitatorRequirements,
        };

        console.log("x402 verify request", {
          path,
          facilitatorUrl: FACILITATOR_URL,
          x402Version,
          paymentHeaderLength: paymentHeaderValue.length,
          paymentHeaderPreview: truncateText(paymentHeaderValue, 80),
          paymentPayload: sanitizePaymentPayload(paymentPayload),
          signedTxMeta: parseSignedTxMeta(paymentPayload),
          paymentRequirements: facilitatorRequirements,
          paymentRequirementsLegacy: requirements,
        });

        const res = await fetch(`${FACILITATOR_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        const rawBody = await res.text().catch(() => "");
        console.log("x402 verify response", {
          path,
          status: res.status,
          ok: res.ok,
          body: truncateText(rawBody),
        });

        return new Response(rawBody, {
          status: res.status,
          headers: res.headers,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    // Verify with facilitator
    const verifyOnce = async (
      paymentPayload: unknown,
      x402Version: string | number,
      paymentHeaderValue: string
    ) => {
      const verifyRes = await callFacilitator(
        "/verify",
        paymentPayload,
        x402Version,
        paymentHeaderValue
      );

      if (!verifyRes.ok) {
        const detail = await verifyRes.text().catch(() => "");
        return {
          ok: false as const,
          isValid: false as const,
          invalidReason: detail || "Facilitator verification failed",
        };
      }

      const verifyData = await verifyRes.json();
      return {
        ok: true as const,
        isValid: Boolean(verifyData.isValid),
        invalidReason: String(verifyData.invalidReason || ""),
        verifyData,
      };
    };

    let paymentPayloadToUse: unknown = normalizedPaymentPayload;
    let paymentHeaderToUse = Buffer.from(
      JSON.stringify(normalizedPaymentPayload),
      "utf8"
    ).toString("base64");
    const currentVersion =
      (normalizedPaymentPayload as { x402Version?: unknown }).x402Version ?? 1;
    let x402VersionToUse: string | number =
      typeof currentVersion === "string" || typeof currentVersion === "number"
        ? currentVersion
        : 1;
    let verifyResult = await verifyOnce(
      paymentPayloadToUse,
      x402VersionToUse,
      paymentHeaderToUse
    );

    // Some wallets/facilitators disagree on x402Version type/value.
    // Retry with compatible versions to avoid hard-failing user payments.
    const verifyReason = verifyResult.invalidReason.toLowerCase();
    const shouldRetryVersion =
      !verifyResult.isValid && verifyReason.includes("invalid_x402_version");
    const shouldRetryNetwork =
      !verifyResult.isValid && verifyReason.includes("invalid_network");
    if (
      (shouldRetryVersion || shouldRetryNetwork) &&
      typeof normalizedPaymentPayload === "object" &&
      normalizedPaymentPayload
    ) {
      const candidates: Array<string | number> = [1, "1", 2, "2"].filter(
        (v) => v !== currentVersion
      );

      for (const version of candidates) {
        const candidatePayload = {
          ...(normalizedPaymentPayload as Record<string, unknown>),
          x402Version: version,
        };
        const candidateHeader = Buffer.from(
          JSON.stringify(candidatePayload),
          "utf8"
        ).toString("base64");
        const candidateResult = await verifyOnce(
          candidatePayload,
          version,
          candidateHeader
        );
        if (candidateResult.isValid) {
          paymentPayloadToUse = candidatePayload;
          paymentHeaderToUse = candidateHeader;
          x402VersionToUse = version;
          verifyResult = candidateResult;
          break;
        }
      }
    }

    if (!verifyResult.isValid) {
      console.error("x402 verify failed", {
        reason: verifyResult.invalidReason || "Payment invalid",
        x402VersionTried: x402VersionToUse,
      });
      return {
        valid: false,
        error: verifyResult.invalidReason || "Payment invalid",
      };
    }

    // Settle the payment
    const settleRes = await callFacilitator(
      "/settle",
      paymentPayloadToUse,
      x402VersionToUse,
      paymentHeaderToUse
    );

    if (!settleRes.ok) {
      const settleRaw = await settleRes.text().catch(() => "");
      let settleError: string = settleRaw || "Settlement failed";

      // Fallback: try broadcasting directly to Stacks node so we can surface precise reason.
      try {
        const payloadObj =
          paymentPayloadToUse && typeof paymentPayloadToUse === "object"
            ? (paymentPayloadToUse as Record<string, unknown>)
            : null;
        const nestedPayload =
          payloadObj?.payload && typeof payloadObj.payload === "object"
            ? (payloadObj.payload as Record<string, unknown>)
            : null;
        const txRaw =
          nestedPayload && typeof nestedPayload.transaction === "string"
            ? nestedPayload.transaction
            : null;

        if (txRaw) {
          const txHex = txRaw.startsWith("0x") ? txRaw.slice(2) : txRaw;
          const tx = deserializeTransaction(Buffer.from(txHex, "hex"));
          const network = caipToNetwork(facilitatorRequirements.network);
          const broadcastResult = await broadcastTransaction({
            transaction: tx,
            network,
          });

          console.error("x402 settle fallback broadcast result", {
            network,
            result: broadcastResult,
          });

          const isRejected =
            typeof (broadcastResult as { error?: unknown }).error === "string" ||
            typeof (broadcastResult as { reason?: unknown }).reason === "string";
          if (
            !isRejected &&
            "txid" in broadcastResult &&
            typeof broadcastResult.txid === "string"
          ) {
            return {
              valid: true,
              payer:
                verifyResult.verifyData?.payer ||
                (originalPaymentPayload as { payer?: string }).payer,
              txHash: broadcastResult.txid,
            };
          }

          const reason =
            typeof (broadcastResult as { reason?: unknown }).reason === "string"
              ? (broadcastResult as { reason: string }).reason
              : "broadcast_rejected";
          const reasonData = (broadcastResult as { reason_data?: unknown }).reason_data;
          settleError = JSON.stringify({
            error: "settlement_failed",
            facilitator: settleRaw || null,
            fallbackReason: reason,
            fallbackReasonData: reasonData ?? null,
          });
        }
      } catch (fallbackError) {
        console.error("x402 settle fallback broadcast error", {
          message: fallbackError instanceof Error ? fallbackError.message : "unknown",
        });
      }

      return { valid: false, error: settleError };
    }

    const settleData = await settleRes.json();
    const transactionHash =
      (typeof settleData?.transaction === "string" && settleData.transaction) ||
      (typeof settleData?.txid === "string" && settleData.txid) ||
      undefined;

    return {
      valid: true,
      payer: verifyResult.verifyData?.payer || (originalPaymentPayload as { payer?: string }).payer,
      txHash: transactionHash,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        valid: false,
        error: "Facilitator timeout",
      };
    }
    return {
      valid: false,
      error: "Payment processing error",
    };
  }
}

/**
 * Check if x402 payment is enabled (has SERVER_ADDRESS configured)
 */
export function isPaymentEnabled(): boolean {
  return !!SERVER_ADDRESS;
}

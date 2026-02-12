import { NextRequest, NextResponse } from "next/server";
import type { PaymentRequirements } from "./types";

const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.stacksx402.com";
const SERVER_ADDRESS = process.env.SERVER_ADDRESS || "";
const NETWORK = process.env.NETWORK || "testnet";
const FACILITATOR_TIMEOUT_MS = Number(process.env.FACILITATOR_TIMEOUT_MS || "8000");

// STX asset identifier for testnet/mainnet
const STX_ASSET = "STX";

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
    network: NETWORK,
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
        "X-Payment-Requirements": JSON.stringify(requirements),
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
  const paymentHeader = req.headers.get("x-payment");
  if (!paymentHeader) {
    return { valid: false, error: "No payment header" };
  }

  try {
    const originalPaymentPayload = JSON.parse(paymentHeader) as Record<string, unknown>;

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: String(amountMicroSTX),
      resource,
      description,
      payTo: SERVER_ADDRESS,
      asset: STX_ASSET,
      maxTimeoutSeconds: 60,
    };

    const callFacilitator = async (
      path: string,
      paymentPayload: unknown,
      x402Version: string | number
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FACILITATOR_TIMEOUT_MS);

      try {
        const paymentHeader =
          typeof paymentPayload === "string"
            ? paymentPayload
            : JSON.stringify(paymentPayload);

        return await fetch(`${FACILITATOR_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Newer facilitator contract (x402 core style)
            x402Version,
            paymentHeader,
            // Legacy contract compatibility
            paymentPayload,
            paymentRequirements: requirements,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    // Verify with facilitator
    const verifyOnce = async (
      paymentPayload: unknown,
      x402Version: string | number
    ) => {
      const verifyRes = await callFacilitator("/verify", paymentPayload, x402Version);

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

    let paymentPayloadToUse: unknown = originalPaymentPayload;
    const currentVersion =
      (originalPaymentPayload as { x402Version?: unknown }).x402Version ?? 1;
    let x402VersionToUse: string | number =
      typeof currentVersion === "string" || typeof currentVersion === "number"
        ? currentVersion
        : 1;
    let verifyResult = await verifyOnce(paymentPayloadToUse, x402VersionToUse);

    // Some wallets/facilitators disagree on x402Version type/value.
    // Retry with compatible versions to avoid hard-failing user payments.
    const invalidVersion =
      !verifyResult.isValid &&
      verifyResult.invalidReason.toLowerCase().includes("invalid_x402_version");
    if (invalidVersion && typeof originalPaymentPayload === "object" && originalPaymentPayload) {
      const candidates: Array<string | number> = [1, "1", 2, "2"].filter(
        (v) => v !== currentVersion
      );

      for (const version of candidates) {
        const candidatePayload = {
          ...originalPaymentPayload,
          x402Version: version,
        };
        const candidateResult = await verifyOnce(candidatePayload, version);
        if (candidateResult.isValid) {
          paymentPayloadToUse = candidatePayload;
          x402VersionToUse = version;
          verifyResult = candidateResult;
          break;
        }
      }
    }

    if (!verifyResult.isValid) {
      return {
        valid: false,
        error: verifyResult.invalidReason || "Payment invalid",
      };
    }

    // Settle the payment
    const settleRes = await callFacilitator(
      "/settle",
      paymentPayloadToUse,
      x402VersionToUse
    );

    if (!settleRes.ok) {
      return { valid: false, error: "Settlement failed" };
    }

    const settleData = await settleRes.json();

    return {
      valid: true,
      payer: verifyResult.verifyData?.payer || (originalPaymentPayload as { payer?: string }).payer,
      txHash: settleData.transaction,
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

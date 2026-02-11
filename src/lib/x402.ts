import { NextRequest, NextResponse } from "next/server";
import type { PaymentRequirements } from "./types";

const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.stacksx402.com";
const SERVER_ADDRESS = process.env.SERVER_ADDRESS || "";
const NETWORK = process.env.NETWORK || "testnet";

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
  resource: string
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
    const paymentPayload = JSON.parse(paymentHeader);

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: String(amountMicroSTX),
      resource,
      description: "Story-Fork payment",
      payTo: SERVER_ADDRESS,
      asset: STX_ASSET,
      maxTimeoutSeconds: 60,
    };

    // Verify with facilitator
    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements: requirements,
      }),
    });

    if (!verifyRes.ok) {
      return { valid: false, error: "Facilitator verification failed" };
    }

    const verifyData = await verifyRes.json();

    if (!verifyData.isValid) {
      return {
        valid: false,
        error: verifyData.invalidReason || "Payment invalid",
      };
    }

    // Settle the payment
    const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements: requirements,
      }),
    });

    if (!settleRes.ok) {
      return { valid: false, error: "Settlement failed" };
    }

    const settleData = await settleRes.json();

    return {
      valid: true,
      payer: verifyData.payer || paymentPayload.payer,
      txHash: settleData.transaction,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Payment processing error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Check if x402 payment is enabled (has SERVER_ADDRESS configured)
 */
export function isPaymentEnabled(): boolean {
  return !!SERVER_ADDRESS;
}

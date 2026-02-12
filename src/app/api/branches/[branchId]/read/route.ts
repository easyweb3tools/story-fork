import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createPaymentRequired, verifyPayment, isPaymentEnabled } from "@/lib/x402";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// GET /api/branches/[branchId]/read — read branch content (x402 paywall)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  // Root branches (depth 0) are free
  if (branch.depth === 0) {
    return NextResponse.json({
      ...branch,
      totalFunding: branch.totalFunding.toString(),
    });
  }

  // If payment is not configured, return content freely (dev mode)
  if (!isPaymentEnabled()) {
    return NextResponse.json({
      ...branch,
      totalFunding: branch.totalFunding.toString(),
    });
  }

  // Check for payment header
  const hasPayment = req.headers.get("x-payment");

  if (!hasPayment) {
    // Return 402 with summary only
    return createPaymentRequired(
      `/api/branches/${branchId}/read`,
      branch.readPrice,
      `Read branch content - ${branch.readPrice} microSTX`
    );
  }

  // Verify payment
  const result = await verifyPayment(
    req,
    branch.readPrice,
    `/api/branches/${branchId}/read`,
    `Read branch content - ${branch.readPrice} microSTX`
  );

  if (!result.valid) {
    return NextResponse.json(
      { error: "Payment verification failed", reason: result.error },
      { status: 402 }
    );
  }

  // Record payment and update branch
  try {
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          branchId,
          type: "read",
          amount: BigInt(branch.readPrice),
          payerAddress: result.payer || "unknown",
          txHash: result.txHash || null,
        },
      }),
      prisma.branch.update({
        where: { id: branchId },
        data: {
          readCount: { increment: 1 },
          totalFunding: { increment: BigInt(branch.readPrice) },
        },
      }),
    ]);
  } catch (error) {
    if (result.txHash && isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Duplicate payment transaction" },
        { status: 409 }
      );
    }
    throw error;
  }

  // Return full content
  const updated = await prisma.branch.findUnique({ where: { id: branchId } });
  return NextResponse.json({
    ...updated,
    totalFunding: updated!.totalFunding.toString(),
  });
}

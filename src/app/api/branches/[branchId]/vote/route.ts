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

// POST /api/branches/[branchId]/vote — vote for a branch (x402 paywall)
export async function POST(
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

  // If payment is not configured, allow free voting (dev mode)
  if (!isPaymentEnabled()) {
    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        voteCount: { increment: 1 },
        totalFunding: { increment: BigInt(branch.votePrice) },
      },
    });

    await recalculateCanon(branch.storyId, branch.parentId);

    return NextResponse.json({
      ...updated,
      totalFunding: updated.totalFunding.toString(),
    });
  }

  // Check for payment header
  const hasPayment = req.headers.get("x-payment");

  if (!hasPayment) {
    return createPaymentRequired(
      `/api/branches/${branchId}/vote`,
      branch.votePrice,
      `Vote for branch - ${branch.votePrice} microSTX`
    );
  }

  // Verify payment
  const result = await verifyPayment(
    req,
    branch.votePrice,
    `/api/branches/${branchId}/vote`,
    `Vote for branch - ${branch.votePrice} microSTX`
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
          type: "vote",
          amount: BigInt(branch.votePrice),
          payerAddress: result.payer || "unknown",
          txHash: result.txHash || null,
        },
      }),
      prisma.branch.update({
        where: { id: branchId },
        data: {
          voteCount: { increment: 1 },
          totalFunding: { increment: BigInt(branch.votePrice) },
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

  // Recalculate canon status among siblings
  await recalculateCanon(branch.storyId, branch.parentId);

  const updated = await prisma.branch.findUnique({ where: { id: branchId } });
  return NextResponse.json({
    ...updated,
    totalFunding: updated!.totalFunding.toString(),
  });
}

/**
 * Recalculate which sibling branch is "Canon" (highest funded)
 */
async function recalculateCanon(storyId: string, parentId: string | null) {
  // Get all siblings
  const siblings = await prisma.branch.findMany({
    where: { storyId, parentId },
    orderBy: { totalFunding: "desc" },
  });

  if (siblings.length === 0) return;

  const highestFunding = siblings[0].totalFunding;

  // Update all siblings: canon = true only for the highest funded
  for (const sibling of siblings) {
    await prisma.branch.update({
      where: { id: sibling.id },
      data: {
        isCanon: sibling.totalFunding === highestFunding,
      },
    });
  }
}

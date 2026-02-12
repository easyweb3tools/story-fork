import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storyId = searchParams.get("storyId");
  const type = searchParams.get("type") || undefined;
  const limitParam = Number(searchParams.get("limit") || "20");
  const take = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(Math.floor(limitParam), 100))
    : 20;

  if (!storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

  const payments = await prisma.payment.findMany({
    where: {
      ...(type ? { type } : {}),
      branch: { storyId },
    },
    include: {
      branch: {
        select: {
          id: true,
          title: true,
          titleEn: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(
    payments.map((payment) => ({
      id: payment.id,
      branchId: payment.branchId,
      type: payment.type,
      amount: payment.amount.toString(),
      payerAddress: payment.payerAddress,
      txHash: payment.txHash,
      network: payment.network,
      createdAt: payment.createdAt,
      branch: payment.branch,
    }))
  );
}

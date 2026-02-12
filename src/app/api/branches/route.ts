import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireWriteApiKey } from "@/lib/auth";

// GET /api/branches?storyId=xxx — get branches for a story
export async function GET(req: NextRequest) {
  const storyId = req.nextUrl.searchParams.get("storyId");

  if (!storyId) {
    return NextResponse.json(
      { error: "storyId query parameter is required" },
      { status: 400 }
    );
  }

  const branches = await prisma.branch.findMany({
    where: { storyId },
    orderBy: [{ depth: "asc" }, { orderIndex: "asc" }],
  });

  // Build tree structure
  const serialized = branches.map((b) => ({
    ...b,
    totalFunding: b.totalFunding.toString(),
  }));

  // Build nested tree
  const nodeMap = new Map<string, typeof serialized[0] & { children: typeof serialized }>();
  const roots: (typeof serialized[0] & { children: typeof serialized })[] = [];

  for (const b of serialized) {
    nodeMap.set(b.id, { ...b, children: [] });
  }

  for (const b of serialized) {
    const node = nodeMap.get(b.id)!;
    if (b.parentId && nodeMap.has(b.parentId)) {
      nodeMap.get(b.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json(roots);
}

// POST /api/branches — create a new branch
export async function POST(req: NextRequest) {
  const authError = requireWriteApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const {
    storyId,
    parentId,
    title,
    titleEn,
    content,
    contentEn,
    summary,
    summaryEn,
    generatedBy,
    prompt,
  } = body;

  if (!storyId || !parentId || !title || !content) {
    return NextResponse.json(
      { error: "storyId, parentId, title, and content are required" },
      { status: 400 }
    );
  }

  // Get parent to determine depth
  const parent = await prisma.branch.findUnique({
    where: { id: parentId },
  });

  if (!parent) {
    return NextResponse.json({ error: "Parent branch not found" }, { status: 404 });
  }

  if (parent.storyId !== storyId) {
    return NextResponse.json(
      { error: "Parent branch does not belong to the provided storyId" },
      { status: 400 }
    );
  }

  // Count existing siblings for orderIndex
  const siblingCount = await prisma.branch.count({
    where: { storyId, parentId },
  });

  const branch = await prisma.branch.create({
    data: {
      storyId,
      parentId,
      title,
      titleEn: titleEn || null,
      content,
      contentEn: contentEn || null,
      summary: summary || null,
      summaryEn: summaryEn || null,
      depth: parent.depth + 1,
      orderIndex: siblingCount,
      generatedBy: generatedBy || null,
      prompt: prompt || null,
    },
  });

  return NextResponse.json(
    { ...branch, totalFunding: branch.totalFunding.toString() },
    { status: 201 }
  );
}

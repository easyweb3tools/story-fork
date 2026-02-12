import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireWriteApiKey } from "@/lib/auth";

// GET /api/stories — list all stories
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");

  const stories = await prisma.story.findMany({
    where: status ? { status } : undefined,
    include: {
      branches: {
        orderBy: [{ depth: "asc" }, { orderIndex: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize BigInt
  const serialized = stories.map((s) => ({
    ...s,
    branches: s.branches.map((b) => ({
      ...b,
      totalFunding: b.totalFunding.toString(),
    })),
  }));

  return NextResponse.json(serialized);
}

// POST /api/stories — create a new story with root branch
export async function POST(req: NextRequest) {
  const authError = requireWriteApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const {
    title,
    titleEn,
    description,
    descriptionEn,
    genre,
    coverImage,
    rootBranch,
  } = body;

  if (!title || !description || !rootBranch?.title || !rootBranch?.content) {
    return NextResponse.json(
      { error: "title, description, and rootBranch (title, content) are required" },
      { status: 400 }
    );
  }

  const story = await prisma.story.create({
    data: {
      title,
      titleEn: titleEn || null,
      description,
      descriptionEn: descriptionEn || null,
      genre: genre || "fantasy",
      coverImage,
      branches: {
        create: {
          title: rootBranch.title,
          titleEn: rootBranch.titleEn || null,
          content: rootBranch.content,
          contentEn: rootBranch.contentEn || null,
          summary: rootBranch.summary || null,
          summaryEn: rootBranch.summaryEn || null,
          depth: 0,
          orderIndex: 0,
          isCanon: true,
          generatedBy: body.generatedBy || null,
        },
      },
    },
    include: { branches: true },
  });

  const serialized = {
    ...story,
    branches: story.branches.map((b) => ({
      ...b,
      totalFunding: b.totalFunding.toString(),
    })),
  };

  return NextResponse.json(serialized, { status: 201 });
}

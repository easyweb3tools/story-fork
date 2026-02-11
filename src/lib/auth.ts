import { NextRequest, NextResponse } from "next/server";

const STORY_FORK_API_KEY = process.env.STORY_FORK_API_KEY || "";

function getPresentedApiKey(req: NextRequest): string | null {
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey;

  const authorization = req.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireWriteApiKey(req: NextRequest): NextResponse | null {
  if (!STORY_FORK_API_KEY) return null;

  const presentedApiKey = getPresentedApiKey(req);
  if (presentedApiKey === STORY_FORK_API_KEY) return null;

  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

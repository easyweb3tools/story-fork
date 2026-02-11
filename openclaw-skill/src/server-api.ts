import type { Story, Branch } from "./types.js";

const BASE_URL = process.env.STORY_FORK_SERVER_URL || "http://localhost:3000";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getActiveStories(): Promise<Story[]> {
  return apiFetch("/api/stories?status=active");
}

export async function getStoryBranches(storyId: string): Promise<Branch[]> {
  return apiFetch(`/api/branches?storyId=${storyId}`);
}

export async function createStory(data: {
  title: string;
  description: string;
  genre: string;
  rootBranch: { title: string; content: string; summary: string };
}): Promise<Story> {
  return apiFetch("/api/stories", {
    method: "POST",
    body: JSON.stringify({ ...data, generatedBy: "ai" }),
  });
}

export async function createBranch(data: {
  storyId: string;
  parentId: string;
  title: string;
  content: string;
  summary: string;
  prompt?: string;
}): Promise<Branch> {
  return apiFetch("/api/branches", {
    method: "POST",
    body: JSON.stringify({ ...data, generatedBy: "ai" }),
  });
}

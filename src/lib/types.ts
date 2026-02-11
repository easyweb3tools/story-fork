export interface StoryWithBranches {
  id: string;
  title: string;
  description: string;
  genre: string;
  coverImage: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  branches: BranchNode[];
}

export interface BranchNode {
  id: string;
  storyId: string;
  parentId: string | null;
  title: string;
  content: string;
  summary: string | null;
  depth: number;
  orderIndex: number;
  readPrice: number;
  votePrice: number;
  totalFunding: string; // BigInt serialized as string
  readCount: number;
  voteCount: number;
  isCanon: boolean;
  generatedBy: string | null;
  createdAt: string;
  children: BranchNode[];
}

export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
}

export interface CreateStoryInput {
  title: string;
  description: string;
  genre?: string;
  coverImage?: string;
  rootBranch: {
    title: string;
    content: string;
    summary?: string;
  };
}

export interface CreateBranchInput {
  storyId: string;
  parentId: string;
  title: string;
  content: string;
  summary?: string;
  generatedBy?: string;
  prompt?: string;
}

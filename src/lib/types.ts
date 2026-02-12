export interface StoryWithBranches {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
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
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  summary: string | null;
  summaryEn: string | null;
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
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  genre?: string;
  coverImage?: string;
  rootBranch: {
    title: string;
    titleEn?: string;
    content: string;
    contentEn?: string;
    summary?: string;
    summaryEn?: string;
  };
}

export interface CreateBranchInput {
  storyId: string;
  parentId: string;
  title: string;
  titleEn?: string;
  content: string;
  contentEn?: string;
  summary?: string;
  summaryEn?: string;
  generatedBy?: string;
  prompt?: string;
}

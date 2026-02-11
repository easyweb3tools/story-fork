export interface Story {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: string;
  branches: Branch[];
}

export interface Branch {
  id: string;
  storyId: string;
  parentId: string | null;
  title: string;
  content: string;
  summary: string | null;
  depth: number;
  orderIndex: number;
  totalFunding: string;
  readCount: number;
  voteCount: number;
  isCanon: boolean;
  generatedBy: string | null;
  children: Branch[];
}

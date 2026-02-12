export interface Story {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  genre: string;
  status: string;
  branches: Branch[];
}

export interface Branch {
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
  totalFunding: string;
  readCount: number;
  voteCount: number;
  isCanon: boolean;
  generatedBy: string | null;
  children: Branch[];
}

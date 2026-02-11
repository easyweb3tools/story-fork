"use client";

import { BranchNode as BranchNodeType } from "@/lib/types";
import BranchNode from "./BranchNode";
import { useCallback, useMemo } from "react";

interface LuminousFlowProps {
  branches: BranchNodeType[];
  onRead: (branchId: string) => void;
  onVote: (branchId: string) => void;
  revealedBranches: Set<string>;
}

export default function LuminousFlow({
  branches,
  onRead,
  onVote,
  revealedBranches,
}: LuminousFlowProps) {
  // Calculate max funding per depth level for relative sizing
  const maxFundingByParent = useMemo(() => {
    const map = new Map<string, number>();
    const collectMax = (nodes: BranchNodeType[]) => {
      // Group by parentId
      const groups = new Map<string, number>();
      for (const node of nodes) {
        const key = node.parentId || "root";
        const funding = Number(node.totalFunding);
        groups.set(key, Math.max(groups.get(key) || 0, funding));
        if (node.children?.length) collectMax(node.children);
      }
      for (const [k, v] of groups) map.set(k, v);
    };
    collectMax(branches);
    return map;
  }, [branches]);

  const renderBranch = useCallback(
    (node: BranchNodeType, isLast: boolean) => {
      const parentKey = node.parentId || "root";
      const maxSiblingFunding = maxFundingByParent.get(parentKey) || 0;

      return (
        <div key={node.id} className="flex flex-col items-center">
          {/* Connector line from parent */}
          {node.depth > 0 && (
            <div
              className={`w-px h-8 ${
                node.isCanon ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
              }`}
            />
          )}

          <BranchNode
            node={node}
            maxSiblingFunding={maxSiblingFunding}
            onRead={onRead}
            onVote={onVote}
            isRevealed={revealedBranches.has(node.id) || node.depth === 0}
          />

          {/* Children */}
          {node.children && node.children.length > 0 && (
            <div className="relative flex flex-col items-center w-full">
              {/* Vertical connector to children */}
              <div
                className={`w-px h-6 ${
                  node.isCanon ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
                }`}
              />

              {/* Horizontal spread line */}
              {node.children.length > 1 && (
                <div className="relative w-full flex justify-center">
                  <div
                    className="h-px bg-[#D2D2D7]"
                    style={{
                      width: `${Math.min(node.children.length * 200, 600)}px`,
                    }}
                  />
                </div>
              )}

              {/* Children nodes */}
              <div className="flex gap-5 justify-center flex-wrap">
                {node.children.map((child, idx) =>
                  renderBranch(child, idx === node.children.length - 1)
                )}
              </div>
            </div>
          )}
        </div>
      );
    },
    [maxFundingByParent, onRead, onVote, revealedBranches]
  );

  return (
    <div className="luminous-flow w-full overflow-x-auto py-10">
      <div className="flex flex-col items-center min-w-fit mx-auto">
        {branches.map((root, idx) => renderBranch(root, idx === branches.length - 1))}
      </div>
    </div>
  );
}

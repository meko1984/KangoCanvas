import { createContext, useContext } from "react";
import type { CategoryId, EdgeLineType } from "./types";

export type HandleSide = "top" | "right" | "bottom" | "left";

export interface NodePatch {
  [key: string]: unknown;
  label?: string;
  category?: CategoryId;
  subcategory?: string;
  color?: string;
  fontSize?: number;
  locked?: boolean;
  editing?: boolean;
}

interface EditorActions {
  updateNode: (id: string, patch: NodePatch) => void;
  duplicateSelection: (id?: string) => void;
  deleteSelection: (id?: string) => void;
  updateEdge: (
    id: string,
    patch: Partial<{
      lineType: EdgeLineType;
      color: string;
      width: number;
      arrow: boolean;
    }>,
  ) => void;
  reverseEdge: (id: string) => void;
  deleteEdge: (id: string) => void;
}

export const EditorActionsContext = createContext<EditorActions | null>(null);

export function useEditorActions() {
  const context = useContext(EditorActionsContext);
  if (!context) throw new Error("EditorActionsContext is not available");
  return context;
}

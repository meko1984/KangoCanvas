import type { Edge, Node, Viewport } from "@xyflow/react";

export type CategoryId =
  | "patient"
  | "disease"
  | "symptom"
  | "test"
  | "treatment"
  | "neutral";

export type EdgeLineType = "step" | "straight";

export interface KangoNodeData extends Record<string, unknown> {
  label: string;
  category: CategoryId;
  subcategory?: string;
  color: string;
  fontSize: number;
  locked: boolean;
  editing?: boolean;
}

export interface FrameNodeData extends Record<string, unknown> {
  label: string;
  color: string;
  locked: boolean;
  editing?: boolean;
}

export interface KangoEdgeData extends Record<string, unknown> {
  lineType: EdgeLineType;
  color: string;
  width: number;
  arrow: boolean;
}

export interface PaperSettings {
  size: "a4" | "a3";
  orientation: "portrait" | "landscape";
  margin: "narrow" | "standard" | "wide";
  showTitle: boolean;
  showDate: boolean;
}

export interface DiagramDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  primarySystem: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastBackedUpAt?: string;
  nodes: Array<Node<KangoNodeData | FrameNodeData>>;
  edges: Array<Edge<KangoEdgeData>>;
  viewport: Viewport;
  paper: PaperSettings;
  settings: {
    grid: boolean;
    snap: boolean;
    minimap: boolean;
    fontSize?: number;
    lineWidth?: number;
  };
}

export interface CatalogCategory {
  id: CategoryId;
  label: string;
  color: string;
  subcategories: string[];
}

export interface CatalogItem {
  id: string;
  label: string;
  category: CategoryId;
  subcategory: string;
  aliases?: string[];
}

export interface ClipboardPayload {
  nodes: Array<Node<KangoNodeData | FrameNodeData>>;
  edges: Array<Edge<KangoEdgeData>>;
}

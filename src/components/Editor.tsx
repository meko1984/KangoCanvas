import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CATEGORY_COLORS, getCategory } from "../catalog";
import {
  EditorActionsContext,
  type HandleSide,
  type NodePatch,
} from "../editor-actions";
import { downloadJson, safeFilename, saveDiagram } from "../storage";
import type {
  CategoryId,
  ClipboardPayload,
  DiagramDocument,
  FrameNodeData,
  KangoEdgeData,
  KangoNodeData,
  PaperSettings,
} from "../types";
import { AddMenu } from "./AddMenu";
import { FrameNode } from "./FrameNode";
import { KangoEdge } from "./KangoEdge";
import { KangoNode } from "./KangoNode";

interface EditorProps {
  document: DiagramDocument;
  onBack: () => void;
  onDocumentChange: (document: DiagramDocument) => void;
}

type DiagramNode = Node<KangoNodeData | FrameNodeData>;
type DiagramEdge = Edge<KangoEdgeData>;

let sharedClipboard: ClipboardPayload | null = null;

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

function EditorCanvas({
  document: initialDocument,
  onBack,
  onDocumentChange,
}: EditorProps) {
  const [document, setDocument] = useState(initialDocument);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<DiagramNode>(
    initialDocument.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>(
    initialDocument.edges,
  );
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [menu, setMenu] = useState<{
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
    sourceId?: string;
    side?: HandleSide;
  }>();
  const [continuous, setContinuous] = useState<{
    category: CategoryId;
    subcategory?: string;
    sourceId?: string;
    side?: HandleSide;
  }>();
  const [showArrange, setShowArrange] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showFrame, setShowFrame] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const viewportRef = useRef(initialDocument.viewport);
  const historyRef = useRef<{
    past: Array<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>;
    future: Array<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>;
  }>({ past: [], future: [] });
  const saveTimer = useRef<number | undefined>(undefined);
  const flowWrapper = useRef<HTMLDivElement>(null);
  const {
    screenToFlowPosition,
    fitView,
    setViewport,
  } = useReactFlow<DiagramNode, DiagramEdge>();

  const nodeTypes = useMemo(
    () => ({ kango: KangoNode, frame: FrameNode }),
    [],
  );
  const edgeTypes = useMemo(() => ({ kango: KangoEdge }), []);

  const selectedNodes = nodes.filter((node) => node.selected);

  const snapshot = useCallback(
    () => ({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }),
    [edges, nodes],
  );

  const pushHistory = useCallback(() => {
    const history = historyRef.current;
    history.past.push(snapshot());
    if (history.past.length > 100) history.past.shift();
    history.future = [];
  }, [snapshot]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(snapshot());
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [setEdges, setNodes, snapshot]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(snapshot());
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setEdges, setNodes, snapshot]);

  const buildDocument = useCallback(
    (patch?: Partial<DiagramDocument>): DiagramDocument => ({
      ...document,
      ...patch,
      nodes: nodes.map((node) => ({
        ...node,
        selected: false,
        dragging: false,
      })),
      edges: edges.map((edge) => ({ ...edge, selected: false })),
      viewport: viewportRef.current,
      updatedAt: new Date().toISOString(),
    }),
    [document, edges, nodes],
  );

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(async () => {
      const next = buildDocument();
      try {
        await saveDiagram(next);
        onDocumentChange(next);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(saveTimer.current);
  }, [buildDocument, onDocumentChange]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (initialDocument.nodes.length) {
        void fitView({ padding: 0.18, duration: 450 });
      } else {
        void setViewport(initialDocument.viewport);
      }
    });
  }, [fitView, initialDocument.nodes.length, initialDocument.viewport, setViewport]);

  const updateNode = useCallback(
    (
      id: string,
      patch: Partial<KangoNodeData & FrameNodeData>,
      withHistory = true,
    ) => {
      if (withHistory) pushHistory();
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                draggable:
                  patch.locked !== undefined
                    ? !patch.locked
                    : node.draggable,
                data: { ...node.data, ...patch },
              }
            : node,
        ),
      );
    },
    [pushHistory, setNodes],
  );

  const addNodeAt = useCallback(
    (
      position: { x: number; y: number },
      input: {
        category: CategoryId;
        subcategory?: string;
        label?: string;
      },
      sourceId?: string,
      sourceHandle?: string,
    ) => {
      pushHistory();
      const id = crypto.randomUUID();
      const newNode: DiagramNode = {
        id,
        type: "kango",
        position,
        style: { width: 170, minHeight: 54 },
        data: {
          label: input.label ?? "",
          category: input.category,
          subcategory: input.subcategory,
          color: CATEGORY_COLORS[input.category],
          fontSize: document.settings.fontSize ?? 12,
          locked: false,
          editing: !input.label,
        },
        selected: true,
      };
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);
      if (sourceId) {
        setEdges((current) => [
          ...current.map((edge) => ({ ...edge, selected: false })),
          {
            id: crypto.randomUUID(),
            source: sourceId,
            target: id,
            sourceHandle,
            targetHandle: oppositeHandle(sourceHandle as HandleSide),
            type: "kango",
            markerEnd: { type: MarkerType.ArrowClosed },
            data: {
              lineType: "step",
              color: "#475569",
              width: document.settings.lineWidth ?? 1.5,
              arrow: true,
            },
          },
        ]);
      }
      return id;
    },
    [
      document.settings.fontSize,
      document.settings.lineWidth,
      pushHistory,
      setEdges,
      setNodes,
    ],
  );

  const setGlobalFontSize = useCallback(
    (fontSize: number) => {
      setDocument((current) => ({
        ...current,
        settings: { ...current.settings, fontSize },
      }));
      setNodes((current) =>
        current.map((node) =>
          node.type === "kango"
            ? {
                ...node,
                data: { ...node.data, fontSize },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const setGlobalLineWidth = useCallback(
    (lineWidth: number) => {
      setDocument((current) => ({
        ...current,
        settings: { ...current.settings, lineWidth },
      }));
      setEdges((current) =>
        current.map((edge) => ({
          ...edge,
          data: {
            lineType: "step",
            color: "#475569",
            arrow: true,
            ...edge.data,
            width: lineWidth,
          },
        })),
      );
    },
    [setEdges],
  );

  const duplicateSelection = useCallback(
    (fallbackId?: string) => {
      const sourceNodes = nodes.filter(
        (node) => node.selected || (fallbackId && node.id === fallbackId),
      );
      if (!sourceNodes.length) return;
      pushHistory();
      const map = new Map(sourceNodes.map((node) => [node.id, crypto.randomUUID()]));
      const duplicatedNodes = sourceNodes.map((node) => ({
        ...structuredClone(node),
        id: map.get(node.id)!,
        position: { x: node.position.x + 28, y: node.position.y + 28 },
        selected: true,
      }));
      const duplicatedEdges = edges
        .filter((edge) => map.has(edge.source) && map.has(edge.target))
        .map((edge) => ({
          ...structuredClone(edge),
          id: crypto.randomUUID(),
          source: map.get(edge.source)!,
          target: map.get(edge.target)!,
          selected: false,
        }));
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        ...duplicatedNodes,
      ]);
      setEdges((current) => [...current, ...duplicatedEdges]);
    },
    [edges, nodes, pushHistory, setEdges, setNodes],
  );

  const deleteSelection = useCallback(
    (fallbackId?: string) => {
      const ids = new Set(
        nodes
          .filter((node) => node.selected || (fallbackId && node.id === fallbackId))
          .map((node) => node.id),
      );
      if (!ids.size) return;
      pushHistory();
      setNodes((current) => current.filter((node) => !ids.has(node.id)));
      setEdges((current) =>
        current.filter(
          (edge) => !ids.has(edge.source) && !ids.has(edge.target),
        ),
      );
    },
    [nodes, pushHistory, setEdges, setNodes],
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<KangoEdgeData>) => {
      pushHistory();
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  lineType: "step",
                  color: "#475569",
                  width: document.settings.lineWidth ?? 1.5,
                  arrow: true,
                  ...edge.data,
                  ...patch,
                },
              }
            : edge,
        ),
      );
    },
    [document.settings.lineWidth, pushHistory, setEdges],
  );

  const reverseEdge = useCallback(
    (id: string) => {
      pushHistory();
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                source: edge.target,
                target: edge.source,
                sourceHandle: edge.targetHandle,
                targetHandle: edge.sourceHandle,
              }
            : edge,
        ),
      );
    },
    [pushHistory, setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      pushHistory();
      setEdges((current) => current.filter((edge) => edge.id !== id));
    },
    [pushHistory, setEdges],
  );

  const actions = useMemo(
    () => ({
      updateNode: (id: string, patch: NodePatch) =>
        updateNode(id, patch),
      duplicateSelection,
      deleteSelection,
      updateEdge,
      reverseEdge,
      deleteEdge,
    }),
    [
      deleteEdge,
      deleteSelection,
      duplicateSelection,
      reverseEdge,
      updateEdge,
      updateNode,
    ],
  );

  const handleAdd = (input: {
    category: CategoryId;
    subcategory?: string;
    label?: string;
    continueAdding: boolean;
  }) => {
    if (!menu) return;
    addNodeAt(
      { x: menu.flowX, y: menu.flowY },
      input,
      menu.sourceId,
      menu.side,
    );
    setMenu(undefined);
    setContinuous(
      input.continueAdding
        ? {
            category: input.category,
            subcategory: input.subcategory,
            sourceId: menu.sourceId,
            side: menu.side,
          }
        : undefined,
    );
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: "kango",
            markerEnd: { type: MarkerType.ArrowClosed },
            data: {
              lineType: "step",
              color: "#475569",
              width: document.settings.lineWidth ?? 1.5,
              arrow: true,
            },
          },
          current,
        ),
      );
    },
    [document.settings.lineWidth, pushHistory, setEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<DiagramNode>[]) => {
      onNodesChangeBase(
        changes.filter((change) => {
          if (change.type !== "position") return true;
          const node = nodes.find((candidate) => candidate.id === change.id);
          return !(node?.data as KangoNodeData).locked;
        }),
      );
    },
    [nodes, onNodesChangeBase],
  );

  const align = (mode: string) => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length < 2) return;
    pushHistory();
    const boxes = selected.map((node) => ({
      node,
      width: node.measured?.width ?? Number(node.style?.width) ?? 170,
      height: node.measured?.height ?? Number(node.style?.height) ?? 70,
    }));
    const left = Math.min(...boxes.map(({ node }) => node.position.x));
    const right = Math.max(
      ...boxes.map(({ node, width }) => node.position.x + width),
    );
    const top = Math.min(...boxes.map(({ node }) => node.position.y));
    const bottom = Math.max(
      ...boxes.map(({ node, height }) => node.position.y + height),
    );
    const updates = new Map<string, { x: number; y: number }>();
    if (mode === "distribute-x") {
      const sorted = [...boxes].sort(
        (a, b) => a.node.position.x - b.node.position.x,
      );
      const first = sorted[0].node.position.x;
      const last = sorted.at(-1)!.node.position.x;
      sorted.forEach(({ node }, index) =>
        updates.set(node.id, {
          x: first + ((last - first) * index) / (sorted.length - 1),
          y: node.position.y,
        }),
      );
    } else if (mode === "distribute-y") {
      const sorted = [...boxes].sort(
        (a, b) => a.node.position.y - b.node.position.y,
      );
      const first = sorted[0].node.position.y;
      const last = sorted.at(-1)!.node.position.y;
      sorted.forEach(({ node }, index) =>
        updates.set(node.id, {
          x: node.position.x,
          y: first + ((last - first) * index) / (sorted.length - 1),
        }),
      );
    } else {
      boxes.forEach(({ node, width, height }) => {
        const next = { ...node.position };
        if (mode === "left") next.x = left;
        if (mode === "center-x") next.x = (left + right - width) / 2;
        if (mode === "right") next.x = right - width;
        if (mode === "top") next.y = top;
        if (mode === "center-y") next.y = (top + bottom - height) / 2;
        if (mode === "bottom") next.y = bottom - height;
        updates.set(node.id, next);
      });
    }
    setNodes((current) =>
      current.map((node) =>
        updates.has(node.id)
          ? { ...node, position: updates.get(node.id)! }
          : node,
      ),
    );
    setShowArrange(false);
  };

  const addFrame = () => {
    pushHistory();
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 - 180,
      y: window.innerHeight / 2 - 120,
    });
    const frame: DiagramNode = {
      id: crypto.randomUUID(),
      type: "frame",
      position,
      zIndex: -10,
      style: { width: 380, height: 240 },
      data: {
        label: "囲み枠",
        color: "#8db7d8",
        locked: false,
        editing: true,
      },
      selected: true,
    };
    setNodes((current) => [
      frame,
      ...current.map((node) => ({ ...node, selected: false })),
    ]);
    setShowFrame(false);
  };

  const copySelected = useCallback(() => {
    const copiedNodes = nodes.filter((node) => node.selected);
    if (!copiedNodes.length) return;
    const ids = new Set(copiedNodes.map((node) => node.id));
    sharedClipboard = {
      nodes: structuredClone(copiedNodes),
      edges: structuredClone(
        edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      ),
    };
    setNotice(`${copiedNodes.length}個のボックスをコピーしました`);
  }, [edges, nodes]);

  const pasteClipboard = useCallback(() => {
    if (!sharedClipboard) return;
    pushHistory();
    const map = new Map(
      sharedClipboard.nodes.map((node) => [node.id, crypto.randomUUID()]),
    );
    const pastedNodes = sharedClipboard.nodes.map((node) => ({
      ...structuredClone(node),
      id: map.get(node.id)!,
      position: { x: node.position.x + 36, y: node.position.y + 36 },
      selected: true,
    }));
    const pastedEdges = sharedClipboard.edges.map((edge) => ({
      ...structuredClone(edge),
      id: crypto.randomUUID(),
      source: map.get(edge.source)!,
      target: map.get(edge.target)!,
      selected: false,
    }));
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...pastedNodes,
    ]);
    setEdges((current) => [...current, ...pastedEdges]);
  }, [pushHistory, setEdges, setNodes]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (editing) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
      }
      if (event.key === "Escape") {
        setMenu(undefined);
        setContinuous(undefined);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodes.length) {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    copySelected,
    deleteSelection,
    pasteClipboard,
    redo,
    selectedNodes.length,
    undo,
  ]);

  const exportBackup = async () => {
    const next = buildDocument({ lastBackedUpAt: new Date().toISOString() });
    await saveDiagram(next);
    downloadJson(next);
    setDocument(next);
    onDocumentChange(next);
    setNotice("バックアップファイルを書き出しました");
  };

  const exportPdf = async (paper: PaperSettings) => {
    const viewportElement = flowWrapper.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!viewportElement || !nodes.length) {
      setNotice("PDFに出力するボックスがありません");
      return;
    }
    setPdfBusy(true);
    try {
      const bounds = getNodesBounds(nodes);
      const imageWidth = 2200;
      const pageRatio =
        paper.size === "a3"
          ? paper.orientation === "landscape"
            ? 420 / 297
            : 297 / 420
          : paper.orientation === "landscape"
            ? 297 / 210
            : 210 / 297;
      const imageHeight = Math.round(imageWidth / pageRatio);
      const viewport = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.1,
        2,
        0.08,
      );
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 1,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
        filter: (element) =>
          !element.classList?.contains("node-toolbar") &&
          !element.classList?.contains("edge-toolbar") &&
          !element.classList?.contains("plus-handle") &&
          !element.classList?.contains("react-flow__resize-control"),
      });
      const pdf = new jsPDF({
        orientation: paper.orientation,
        unit: "mm",
        format: paper.size,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = paper.margin === "narrow" ? 6 : paper.margin === "wide" ? 18 : 10;
      const header = paper.showTitle || paper.showDate ? 9 : 0;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2 - header;
      if (paper.showTitle || paper.showDate) {
        const headerElement = window.document.createElement("div");
        headerElement.className = "pdf-header-render";
        headerElement.style.cssText =
          "position:fixed;left:-9999px;top:0;background:white;color:#17211b;padding:12px 18px;font-family:sans-serif;display:flex;justify-content:space-between;width:1800px;";
        headerElement.innerHTML = `<strong>${escapeHtml(document.title)}</strong><span>${
          paper.showDate ? new Date().toLocaleDateString("ja-JP") : ""
        }</span>`;
        window.document.body.appendChild(headerElement);
        const headerImage = await toPng(headerElement, { pixelRatio: 1 });
        headerElement.remove();
        pdf.addImage(headerImage, "PNG", margin, margin, usableWidth, 7);
      }
      pdf.addImage(
        dataUrl,
        "PNG",
        margin,
        margin + header,
        usableWidth,
        usableHeight,
        undefined,
        "FAST",
      );
      pdf.save(`${safeFilename(document.title)}.pdf`);
      const next = buildDocument({ paper });
      setDocument(next);
      await saveDiagram(next);
      onDocumentChange(next);
      setShowPdf(false);
      setNotice("A3・1ページのPDFを書き出しました");
    } catch {
      setNotice("PDFの作成に失敗しました。もう一度お試しください。");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <EditorActionsContext.Provider value={actions}>
      <main className="editor-shell">
        <header className="editor-header">
          <div className="editor-header-left">
            <button className="back-button" onClick={onBack} aria-label="一覧へ戻る">
              ←
            </button>
            <div className="editor-title-wrap">
              <input
                className="editor-title"
                aria-label="関連図のタイトル"
                value={document.title}
                onChange={(event) =>
                  setDocument((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              <span className={`save-status ${saveStatus}`}>
                {saveStatus === "saving"
                  ? "保存中…"
                  : saveStatus === "error"
                    ? "保存できません"
                    : "この端末に保存済み"}
              </span>
            </div>
          </div>
          <div className="editor-header-actions">
            <label className="global-font-size">
              <span>文字</span>
              <select
                aria-label="すべてのボックスの文字サイズ"
                value={document.settings.fontSize ?? 12}
                onChange={(event) =>
                  setGlobalFontSize(Number(event.target.value))
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28].map((size) => (
                  <option key={size} value={size}>
                    {size}pt
                  </option>
                ))}
              </select>
            </label>
            <label className="global-line-width">
              <span>線</span>
              <select
                aria-label="すべての線の太さ"
                value={document.settings.lineWidth ?? 1.5}
                onChange={(event) =>
                  setGlobalLineWidth(Number(event.target.value))
                }
              >
                <option value={1}>細い</option>
                <option value={1.5}>標準</option>
                <option value={2.5}>太い</option>
                <option value={4}>極太</option>
              </select>
            </label>
            <button
              onClick={undo}
              disabled={!historyRef.current.past.length}
              title="元に戻す"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={!historyRef.current.future.length}
              title="やり直す"
            >
              ↷
            </button>
            <button onClick={() => void fitView({ padding: 0.16, duration: 350 })}>
              全体表示
            </button>
            <div className="toolbar-popover-wrap">
              <button
                disabled={selectedNodes.length < 2}
                onClick={() => setShowArrange((value) => !value)}
              >
                配置
              </button>
              {showArrange && (
                <div className="toolbar-menu arrange-menu">
                  {[
                    ["left", "左揃え"],
                    ["center-x", "左右中央"],
                    ["right", "右揃え"],
                    ["top", "上揃え"],
                    ["center-y", "上下中央"],
                    ["bottom", "下揃え"],
                    ["distribute-x", "左右に等間隔"],
                    ["distribute-y", "上下に等間隔"],
                  ].map(([id, label]) => (
                    <button key={id} onClick={() => align(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowFrame(true)}>囲み枠</button>
            <button className="pdf-button" onClick={() => setShowPdf(true)}>
              PDF
            </button>
            <div className="toolbar-popover-wrap">
              <button onClick={() => setShowMore((value) => !value)}>…</button>
              {showMore && (
                <div className="toolbar-menu more-menu">
                  <button onClick={copySelected}>コピー</button>
                  <button onClick={pasteClipboard}>貼り付け</button>
                  <button onClick={() => void exportBackup()}>
                    バックアップを書き出す
                  </button>
                  <button
                    onClick={() =>
                      setDocument((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          grid: !current.settings.grid,
                        },
                      }))
                    }
                  >
                    方眼：{document.settings.grid ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() =>
                      setDocument((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          minimap: !current.settings.minimap,
                        },
                      }))
                    }
                  >
                    ミニマップ：{document.settings.minimap ? "ON" : "OFF"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {saveStatus === "error" && (
          <div className="save-error">
            自動保存できません。バックアップを書き出してから、ブラウザの空き容量をご確認ください。
            <button onClick={() => void exportBackup()}>バックアップ</button>
          </div>
        )}

        {continuous && (
          <div className="continuous-banner">
            続けて追加中：
            {getCategory(continuous.category).label}
            {continuous.subcategory ? ` › ${continuous.subcategory}` : ""}
            <button onClick={() => setContinuous(undefined)}>終了</button>
          </div>
        )}

        <div
          className="flow-wrapper"
          ref={flowWrapper}
        >
          <ReactFlow<DiagramNode, DiagramEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={pushHistory}
            onPaneClick={(event) => {
              setShowArrange(false);
              setShowMore(false);
              setMenu(undefined);
            }}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              const flow = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              if (continuous) {
                addNodeAt(flow, {
                  category: continuous.category,
                  subcategory: continuous.subcategory,
                });
                return;
              }
              setMenu({
                screenX: event.clientX,
                screenY: event.clientY,
                flowX: flow.x,
                flowY: flow.y,
              });
            }}
            onMoveEnd={(_, viewport) => {
              viewportRef.current = viewport;
            }}
            defaultViewport={initialDocument.viewport}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{
              stroke: "#2f7653",
              strokeWidth: 2.5,
            }}
            selectionMode={SelectionMode.Partial}
            selectionOnDrag={false}
            panOnDrag={[0, 1]}
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            connectOnClick={false}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            deleteKeyCode={null}
            snapToGrid={document.settings.snap}
            snapGrid={[16, 16]}
            minZoom={0.12}
            maxZoom={2.5}
            nodesDraggable
            nodesConnectable
            elevateNodesOnSelect
            fitView={false}
            proOptions={{ hideAttribution: true }}
          >
            <svg aria-hidden="true">
              <defs>
                <marker
                  id="kango-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
              </defs>
            </svg>
            {document.settings.grid && (
              <Background
                variant={BackgroundVariant.Lines}
                gap={16}
                size={0.7}
                color="#dfe7e1"
              />
            )}
            <Controls showInteractive={false} position="bottom-left" />
            {document.settings.minimap && (
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                nodeColor={(node) =>
                  node.type === "frame"
                    ? "#d7e6f1"
                    : ((node.data as KangoNodeData).color ?? "#ffffff")
                }
              />
            )}
          </ReactFlow>

          {menu && (
            <AddMenu
              x={menu.screenX}
              y={menu.screenY}
              onAdd={handleAdd}
              onClose={() => setMenu(undefined)}
            />
          )}
        </div>

        <div className="editor-tip">
          左ドラッグで画面移動。右クリックで項目追加。ボックス周囲の＋から別のボックスへドラッグすると線を作れます。
        </div>
      </main>

      {showPdf && (
        <PdfDialog
          initial={document.paper}
          busy={pdfBusy}
          onClose={() => setShowPdf(false)}
          onExport={(paper) => void exportPdf(paper)}
        />
      )}

      {showFrame && (
        <div className="modal-backdrop">
          <div className="modal-card small-modal">
            <span className="eyebrow">BACKGROUND FRAME</span>
            <h2>囲み枠を追加</h2>
            <p>
              薄い背景枠をキャンバス中央へ追加します。追加後に名前・色・大きさを変更できます。
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowFrame(false)}>キャンセル</button>
              <button className="primary-button" onClick={addFrame}>
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast">
          {notice}
          <button onClick={() => setNotice(undefined)}>閉じる</button>
        </div>
      )}
    </EditorActionsContext.Provider>
  );
}

function PdfDialog({
  initial,
  busy,
  onClose,
  onExport,
}: {
  initial: PaperSettings;
  busy: boolean;
  onClose: () => void;
  onExport: (settings: PaperSettings) => void;
}) {
  const [paper, setPaper] = useState(initial);
  return (
    <div className="modal-backdrop">
      <form
        className="modal-card pdf-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onExport(paper);
        }}
      >
        <span className="eyebrow">EXPORT</span>
        <h2>PDFとして出力</h2>
        <div className="pdf-preview-card">
          <div
            className={`paper-preview ${paper.orientation}`}
            data-size={paper.size}
          >
            <span>{paper.showTitle ? "関連図タイトル" : ""}</span>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <p>関連図全体を1ページに収めます</p>
        </div>
        <div className="pdf-fields">
          <label>
            用紙
            <select
              value={paper.size}
              onChange={(event) =>
                setPaper((current) => ({
                  ...current,
                  size: event.target.value as PaperSettings["size"],
                }))
              }
            >
              <option value="a3">A3</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label>
            向き
            <select
              value={paper.orientation}
              onChange={(event) =>
                setPaper((current) => ({
                  ...current,
                  orientation: event.target
                    .value as PaperSettings["orientation"],
                }))
              }
            >
              <option value="landscape">横向き</option>
              <option value="portrait">縦向き</option>
            </select>
          </label>
          <label>
            余白
            <select
              value={paper.margin}
              onChange={(event) =>
                setPaper((current) => ({
                  ...current,
                  margin: event.target.value as PaperSettings["margin"],
                }))
              }
            >
              <option value="narrow">狭い</option>
              <option value="standard">標準</option>
              <option value="wide">広い</option>
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={paper.showTitle}
            onChange={(event) =>
              setPaper((current) => ({
                ...current,
                showTitle: event.target.checked,
              }))
            }
          />
          タイトルを表示
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={paper.showDate}
            onChange={(event) =>
              setPaper((current) => ({
                ...current,
                showDate: event.target.checked,
              }))
            }
          />
          作成日を表示
        </label>
        <div className="modal-warning">
          PDFに個人を特定できる情報が含まれていないか、出力後にも確認してください。
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "PDFを作成中…" : "PDFを作成"}
          </button>
        </div>
      </form>
    </div>
  );
}

function oppositeHandle(side?: HandleSide) {
  if (side === "top") return "bottom";
  if (side === "bottom") return "top";
  if (side === "left") return "right";
  return "left";
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

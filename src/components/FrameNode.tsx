import {
  NodeResizer,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { useEditorActions } from "../editor-actions";
import type { FrameNodeData } from "../types";

type FrameFlowNode = Node<FrameNodeData, "frame">;

export function FrameNode({
  id,
  data,
  selected,
}: NodeProps<FrameFlowNode>) {
  const actions = useEditorActions();
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(data.label), [data.label]);
  useEffect(() => {
    if (data.editing) inputRef.current?.focus();
  }, [data.editing]);

  const commit = () =>
    actions.updateNode(id, {
      label: draft.trim() || "囲み枠",
      editing: false,
    });

  return (
    <>
      <NodeToolbar
        isVisible={selected && !data.editing}
        position={Position.Top}
        className="node-toolbar"
      >
        <label className="color-button">
          <span>背景</span>
          <input
            type="color"
            value={data.color}
            onChange={(event) =>
              actions.updateNode(id, { color: event.target.value })
            }
          />
        </label>
        <button
          onClick={() => actions.updateNode(id, { locked: !data.locked })}
        >
          {data.locked ? "固定解除" : "固定"}
        </button>
        <button
          className="danger-button"
          onClick={() => actions.deleteSelection(id)}
        >
          削除
        </button>
      </NodeToolbar>
      <NodeResizer
        isVisible={selected && !data.locked && !data.editing}
        minWidth={180}
        minHeight={120}
      />
      <div
        className={`frame-node ${selected ? "selected" : ""}`}
        style={{ backgroundColor: `${data.color}5c`, borderColor: data.color }}
        onDoubleClick={() => actions.updateNode(id, { editing: true })}
      >
        {data.editing ? (
          <input
            ref={inputRef}
            value={draft}
            aria-label="囲み枠の名前"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft(data.label);
                actions.updateNode(id, { editing: false });
              }
            }}
          />
        ) : (
          <span>{data.label}</span>
        )}
      </div>
    </>
  );
}

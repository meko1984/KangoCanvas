import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_COLORS } from "../catalog";
import { useEditorActions, type HandleSide } from "../editor-actions";
import type { KangoNodeData } from "../types";

type KangoFlowNode = Node<KangoNodeData, "kango">;

const handleConfig: Array<{
  side: HandleSide;
  position: Position;
  className: string;
}> = [
  { side: "top", position: Position.Top, className: "handle-top" },
  { side: "right", position: Position.Right, className: "handle-right" },
  { side: "bottom", position: Position.Bottom, className: "handle-bottom" },
  { side: "left", position: Position.Left, className: "handle-left" },
];

export function KangoNode({
  id,
  data,
  selected,
}: NodeProps<KangoFlowNode>) {
  const actions = useEditorActions();
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(data.label);
  }, [data.label]);

  useEffect(() => {
    if (data.editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [data.editing]);

  const commit = () => {
    actions.updateNode(id, {
      label: draft.trim() || "無題",
      editing: false,
    });
  };

  return (
    <>
      <NodeToolbar
        isVisible={selected && !data.editing}
        position={Position.Top}
        className="node-toolbar"
      >
        <label className="toolbar-field">
          <span>分類</span>
          <select
            value={data.category}
            onChange={(event) => {
              const category = event.target.value as KangoNodeData["category"];
              actions.updateNode(id, {
                category,
                color: CATEGORY_COLORS[category],
              });
            }}
          >
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="color-button" title="色を変更">
          <span>色</span>
          <input
            type="color"
            value={data.color}
            onChange={(event) =>
              actions.updateNode(id, { color: event.target.value })
            }
          />
        </label>
        <button onClick={() => actions.duplicateSelection(id)}>複製</button>
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
        minWidth={80}
        minHeight={44}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
      />

      <div
        className={`kango-node ${selected ? "selected" : ""} ${
          data.locked ? "locked" : ""
        }`}
        style={{
          backgroundColor: data.color,
          fontSize: `${data.fontSize}pt`,
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          actions.updateNode(id, { editing: true });
        }}
      >
        {data.editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            aria-label="ボックスの文章"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(data.label);
                actions.updateNode(id, { editing: false });
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commit();
              }
            }}
          />
        ) : (
          <div className="node-label">{data.label}</div>
        )}
      </div>

      {!data.editing &&
        handleConfig.map(({ side, position, className }) => (
          <Handle
            key={side}
            id={side}
            type="source"
            position={position}
            className={`plus-handle ${className} ${
              selected ? "is-visible" : ""
            }`}
            title={`${sideLabel(side)}から線を引く`}
          >
            +
          </Handle>
        ))}
    </>
  );
}

function sideLabel(side: HandleSide) {
  return (
    {
      top: "上",
      right: "右",
      bottom: "下",
      left: "左",
    } as const
  )[side];
}

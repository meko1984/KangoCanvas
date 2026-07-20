import {
  BaseEdge,
  EdgeToolbar,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useEditorActions } from "../editor-actions";
import type { KangoEdgeData } from "../types";

type KangoFlowEdge = Edge<KangoEdgeData, "kango">;

export function KangoEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<KangoFlowEdge>) {
  const actions = useEditorActions();
  const resolved = data ?? {
    lineType: "step",
    color: "#475569",
    width: 1.5,
    arrow: true,
  };
  const pathResult =
    resolved.lineType === "straight"
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 2,
        });
  const [path, labelX, labelY] = pathResult;
  const isMostlyHorizontal =
    Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={resolved.arrow ? "url(#kango-arrow)" : undefined}
        interactionWidth={20}
        style={{
          stroke: selected ? "#2563eb" : resolved.color,
          strokeWidth: resolved.width,
        }}
      />
      <EdgeToolbar
        edgeId={id}
        x={labelX}
        y={labelY}
        alignX={isMostlyHorizontal ? "center" : "left"}
        alignY={isMostlyHorizontal ? "bottom" : "center"}
        style={
          isMostlyHorizontal
            ? { marginTop: "-14px" }
            : { marginLeft: "14px" }
        }
        isVisible={selected}
        className="edge-toolbar"
      >
        <button onClick={() => actions.reverseEdge(id)}>向きを反転</button>
        <button
          onClick={() =>
            actions.updateEdge(id, {
              lineType:
                resolved.lineType === "step" ? "straight" : "step",
            })
          }
        >
          {resolved.lineType === "step" ? "直線にする" : "折れ線にする"}
        </button>
        <button
          onClick={() =>
            actions.updateEdge(id, { arrow: !resolved.arrow })
          }
        >
          {resolved.arrow ? "矢印なし" : "矢印あり"}
        </button>
        <label className="color-button">
          <span>線色</span>
          <input
            type="color"
            value={resolved.color}
            onChange={(event) =>
              actions.updateEdge(id, { color: event.target.value })
            }
          />
        </label>
        <button className="danger-button" onClick={() => actions.deleteEdge(id)}>
          削除
        </button>
      </EdgeToolbar>
    </>
  );
}

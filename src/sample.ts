import type { DiagramDocument, KangoNodeData } from "./types";
import { CATEGORY_COLORS } from "./catalog";
import { createEmptyDiagram } from "./storage";

export function createSampleDiagram(): DiagramDocument {
  const diagram = createEmptyDiagram("練習用：AML関連図", "血液・造血器");
  const node = (
    id: string,
    label: string,
    category: KangoNodeData["category"],
    x: number,
    y: number,
  ) => ({
    id,
    type: "kango",
    position: { x, y },
    style: { width: 170 },
    data: {
      label,
      category,
      color: CATEGORY_COLORS[category],
      fontSize: 12,
      locked: false,
    },
  });
  diagram.nodes = [
    node("sample-patient", "75歳・男性\n※架空情報", "patient", 0, 310),
    node("sample-mechanism", "正常造血が抑制", "neutral", 270, 0),
    node("sample-aml", "AML", "disease", 270, 150),
    node("sample-anemia", "貧血", "disease", 30, 490),
    node("sample-infection", "易感染状態", "disease", 270, 490),
    node("sample-bleeding", "出血傾向", "disease", 510, 490),
    node("sample-hb", "Hb 8.2 g/dL ↓", "test", 30, 650),
    node("sample-fever", "発熱", "symptom", 270, 650),
    node("sample-plt", "PLT 7万/μL ↓", "test", 510, 650),
    node("sample-treatment", "AZA＋VEN", "treatment", 520, 150),
  ];
  diagram.edges = [
    ["sample-aml", "sample-mechanism"],
    ["sample-aml", "sample-anemia"],
    ["sample-aml", "sample-infection"],
    ["sample-aml", "sample-bleeding"],
    ["sample-anemia", "sample-hb"],
    ["sample-infection", "sample-fever"],
    ["sample-bleeding", "sample-plt"],
    ["sample-treatment", "sample-aml"],
  ].map(([source, target], index) => ({
    id: `sample-edge-${index}`,
    source,
    target,
    type: "kango",
    markerEnd: "kango-arrow",
    data: {
      lineType: "step",
      color: "#475569",
      width: 1.5,
      arrow: true,
    },
  }));
  return diagram;
}

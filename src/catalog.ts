import type { CatalogCategory, CatalogItem, CategoryId } from "./types";

export const CATEGORY_COLORS: Record<CategoryId, string> = {
  patient: "#dff3df",
  disease: "#f8ddd3",
  symptom: "#ffffff",
  test: "#ffffff",
  treatment: "#fff0bd",
  neutral: "#ffffff",
};

export const CATEGORIES: CatalogCategory[] = [
  {
    id: "patient",
    label: "患者情報",
    color: CATEGORY_COLORS.patient,
    subcategories: ["基本情報", "既往歴", "生活背景", "家族・社会背景", "ADL"],
  },
  {
    id: "disease",
    label: "疾患",
    color: CATEGORY_COLORS.disease,
    subcategories: [
      "循環器",
      "呼吸器",
      "消化器",
      "血液・造血器",
      "脳・神経",
      "腎・泌尿器",
      "内分泌・代謝",
      "免疫・アレルギー",
      "感染症",
      "運動器",
      "皮膚",
      "眼",
      "耳鼻咽喉",
      "女性生殖器・母性",
      "精神",
      "その他",
    ],
  },
  {
    id: "symptom",
    label: "症状・所見",
    color: CATEGORY_COLORS.symptom,
    subcategories: [
      "全身",
      "呼吸器",
      "循環器",
      "消化器",
      "脳・神経",
      "腎・泌尿器",
      "血液・出血",
      "内分泌・代謝",
      "運動器",
      "皮膚",
      "感覚器",
      "排泄",
      "精神・心理",
      "その他",
    ],
  },
  {
    id: "test",
    label: "検査",
    color: CATEGORY_COLORS.test,
    subcategories: [
      "バイタルサイン",
      "血算",
      "生化学検査",
      "凝固検査",
      "免疫・血清検査",
      "尿検査",
      "便検査",
      "微生物検査",
      "画像検査",
      "生理検査",
      "病理・細胞検査",
      "その他",
    ],
  },
  {
    id: "treatment",
    label: "治療・薬剤",
    color: CATEGORY_COLORS.treatment,
    subcategories: [
      "薬剤",
      "輸液",
      "輸血",
      "手術",
      "処置",
      "放射線治療",
      "食事療法",
      "リハビリテーション",
      "その他",
    ],
  },
  {
    id: "neutral",
    label: "自由入力",
    color: CATEGORY_COLORS.neutral,
    subcategories: ["通常ボックス", "見出し", "メモ"],
  },
];

// 具体的な医学項目は、内容を確認しながら後からこの配列へ追加する。
export const CATALOG_ITEMS: CatalogItem[] = [];

export const SYSTEMS = [
  "未分類",
  "循環器",
  "呼吸器",
  "消化器",
  "血液・造血器",
  "脳・神経",
  "腎・泌尿器",
  "内分泌・代謝",
  "免疫・アレルギー",
  "感染症",
  "運動器",
  "皮膚",
  "眼・耳鼻咽喉",
  "女性生殖器・母性",
  "小児",
  "精神",
  "その他",
];

export function getCategory(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[5];
}

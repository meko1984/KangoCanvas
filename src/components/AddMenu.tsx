import { useMemo, useState } from "react";
import { CATALOG_ITEMS, CATEGORIES, getCategory } from "../catalog";
import type { CatalogItem, CategoryId } from "../types";

interface AddMenuProps {
  x: number;
  y: number;
  initialCategory?: CategoryId;
  onAdd: (input: {
    category: CategoryId;
    subcategory?: string;
    label?: string;
    continueAdding: boolean;
  }) => void;
  onClose: () => void;
}

export function AddMenu({
  x,
  y,
  initialCategory = "patient",
  onAdd,
  onClose,
}: AddMenuProps) {
  const [activeCategory, setActiveCategory] =
    useState<CategoryId>(initialCategory);
  const [activeSubcategory, setActiveSubcategory] = useState<string>();
  const [query, setQuery] = useState("");
  const [continueAdding, setContinueAdding] = useState(false);
  const category = getCategory(activeCategory);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");
    if (!normalized) return [];
    return CATALOG_ITEMS.filter((item) =>
      [item.label, ...(item.aliases ?? [])].some((text) =>
        text.toLocaleLowerCase("ja").includes(normalized),
      ),
    ).slice(0, 20);
  }, [query]);

  const addCatalogItem = (item: CatalogItem) => {
    onAdd({
      category: item.category,
      subcategory: item.subcategory,
      label: item.label,
      continueAdding,
    });
  };

  return (
    <div
      className="add-menu"
      style={{
        left: `min(${x}px, calc(100vw - 620px))`,
        top: `min(${y}px, calc(100vh - 500px))`,
      }}
      role="dialog"
      aria-label="項目を追加"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="add-menu-search">
        <span aria-hidden="true">⌕</span>
        <input
          autoFocus
          value={query}
          placeholder="登録済み項目を検索…"
          aria-label="登録済み項目を検索"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && searchResults[0]) {
              addCatalogItem(searchResults[0]);
            }
          }}
        />
        <button className="icon-button" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      {query ? (
        <div className="search-results">
          {searchResults.length ? (
            searchResults.map((item) => (
              <button key={item.id} onClick={() => addCatalogItem(item)}>
                <span
                  className="category-swatch"
                  style={{ background: getCategory(item.category).color }}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {getCategory(item.category).label} › {item.subcategory}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty-search">
              <strong>登録済み項目は見つかりません</strong>
              <span>
                左の分類を選び、「この分類で自由入力」を使ってください。
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="add-menu-columns">
          <div className="category-column">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                className={item.id === activeCategory ? "active" : ""}
                onPointerEnter={() => {
                  setActiveCategory(item.id);
                  setActiveSubcategory(undefined);
                }}
                onClick={() => {
                  setActiveCategory(item.id);
                  setActiveSubcategory(undefined);
                }}
              >
                <span
                  className="category-swatch"
                  style={{ background: item.color }}
                />
                {item.label}
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <div className="subcategory-column">
            <div className="menu-column-title">
              <span
                className="category-swatch"
                style={{ background: category.color }}
              />
              {category.label}
            </div>
            <div className="subcategory-list">
              {category.subcategories.map((subcategory) => (
                <button
                  key={subcategory}
                  className={
                    activeSubcategory === subcategory ? "active" : ""
                  }
                  onClick={() => setActiveSubcategory(subcategory)}
                >
                  {subcategory}
                </button>
              ))}
            </div>
            <button
              className="free-input-button"
              onClick={() =>
                onAdd({
                  category: activeCategory,
                  subcategory: activeSubcategory,
                  continueAdding,
                })
              }
            >
              <span>＋</span>
              <span>
                <strong>
                  {activeSubcategory
                    ? `${activeSubcategory}として自由入力`
                    : `${category.label}として自由入力`}
                </strong>
                <small>分類の色を引き継いで作成</small>
              </span>
            </button>
          </div>
        </div>
      )}

      <label className="continue-toggle">
        <input
          type="checkbox"
          checked={continueAdding}
          onChange={(event) => setContinueAdding(event.target.checked)}
        />
        続けて追加
      </label>
    </div>
  );
}

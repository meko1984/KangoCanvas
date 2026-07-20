import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  loadCatalogPreferences,
  removeCatalogItem,
  resetCatalogPreferences,
  resolveCatalogItems,
  saveCatalogPreferences,
  upsertCatalogItem,
} from "../catalog-preferences";
import { CATEGORIES, getCategory } from "../catalog";
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

interface ItemDraft {
  id: string;
  label: string;
  category: CategoryId;
  subcategory: string;
  aliases: string;
}

export function AddMenu({
  x,
  y,
  initialCategory = "patient",
  onAdd,
  onClose,
}: AddMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [activeCategory, setActiveCategory] =
    useState<CategoryId>(initialCategory);
  const [activeSubcategory, setActiveSubcategory] = useState<string>();
  const [query, setQuery] = useState("");
  const [continueAdding, setContinueAdding] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [preferences, setPreferences] = useState(loadCatalogPreferences);
  const [draft, setDraft] = useState<ItemDraft>();
  const category = getCategory(activeCategory);
  const catalogItems = useMemo(
    () => resolveCatalogItems(preferences),
    [preferences],
  );
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");
    if (!normalized) return [];
    return catalogItems
      .filter((item) =>
        [item.label, ...(item.aliases ?? [])].some((text) =>
          text.toLocaleLowerCase("ja").includes(normalized),
        ),
      )
      .slice(0, 30);
  }, [catalogItems, query]);
  const visibleItems = useMemo(
    () =>
      catalogItems.filter(
        (item) =>
          item.category === activeCategory &&
          item.subcategory === activeSubcategory,
      ),
    [activeCategory, activeSubcategory, catalogItems],
  );

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const viewportMargin = 12;
    const bottomSafeArea = 72;
    const keepInsideViewport = () => {
      const bounds = menu.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const left = Math.max(
        viewportLeft + viewportMargin,
        Math.min(
          x,
          viewportLeft + viewportWidth - bounds.width - viewportMargin,
        ),
      );
      const top = Math.max(
        viewportTop + viewportMargin,
        Math.min(
          y,
          viewportTop + viewportHeight - bounds.height - bottomSafeArea,
        ),
      );

      setPosition((current) =>
        current.left === left && current.top === top
          ? current
          : { left, top },
      );
    };

    keepInsideViewport();
    const resizeObserver = new ResizeObserver(keepInsideViewport);
    resizeObserver.observe(menu);
    window.addEventListener("resize", keepInsideViewport);
    window.visualViewport?.addEventListener("resize", keepInsideViewport);
    window.visualViewport?.addEventListener("scroll", keepInsideViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", keepInsideViewport);
      window.visualViewport?.removeEventListener("resize", keepInsideViewport);
      window.visualViewport?.removeEventListener("scroll", keepInsideViewport);
    };
  }, [x, y]);

  const applyPreferences = (
    next: ReturnType<typeof loadCatalogPreferences>,
  ) => {
    saveCatalogPreferences(next);
    setPreferences(next);
  };

  const addCatalogItem = (item: CatalogItem) => {
    onAdd({
      category: item.category,
      subcategory: item.subcategory,
      label: item.label,
      continueAdding,
    });
  };

  const beginCreate = () => {
    if (!activeSubcategory) return;
    setDraft({
      id: `custom:${crypto.randomUUID()}`,
      label: "",
      category: activeCategory,
      subcategory: activeSubcategory,
      aliases: "",
    });
  };

  const beginEdit = (item: CatalogItem) => {
    setActiveCategory(item.category);
    setActiveSubcategory(item.subcategory);
    setDraft({
      id: item.id,
      label: item.label,
      category: item.category,
      subcategory: item.subcategory,
      aliases: (item.aliases ?? []).join("、"),
    });
  };

  const saveDraft = () => {
    if (!draft?.label.trim() || !draft.subcategory) return;
    const item: CatalogItem = {
      id: draft.id,
      label: draft.label.trim(),
      category: draft.category,
      subcategory: draft.subcategory,
      aliases: draft.aliases
        .split(/[、,\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    };
    applyPreferences(upsertCatalogItem(preferences, item));
    setActiveCategory(item.category);
    setActiveSubcategory(item.subcategory);
    setDraft(undefined);
  };

  const deleteItem = (item: CatalogItem) => {
    const message = item.id.startsWith("custom:")
      ? `「${item.label}」を削除しますか？`
      : `標準項目「${item.label}」を一覧から非表示にしますか？`;
    if (!window.confirm(message)) return;
    applyPreferences(removeCatalogItem(preferences, item));
  };

  const resetItems = () => {
    if (!window.confirm("項目の追加・編集・非表示をすべて初期状態へ戻しますか？")) {
      return;
    }
    setPreferences(resetCatalogPreferences());
    setDraft(undefined);
  };

  return (
    <div
      ref={menuRef}
      className="add-menu"
      style={{ left: position.left, top: position.top }}
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
            if (event.key === "Enter" && searchResults[0] && !manageMode) {
              addCatalogItem(searchResults[0]);
            }
          }}
        />
        <button
          className={`manage-items-button ${manageMode ? "active" : ""}`}
          onClick={() => {
            setManageMode((value) => !value);
            setDraft(undefined);
          }}
        >
          {manageMode ? "管理を終了" : "項目を管理"}
        </button>
        <button className="icon-button" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      {query ? (
        <div className="search-results">
          {searchResults.length ? (
            searchResults.map((item) => (
              <div className="search-result-row" key={item.id}>
                <button onClick={() => addCatalogItem(item)}>
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
                {manageMode && (
                  <button
                    className="item-edit-button"
                    onClick={() => {
                      setQuery("");
                      beginEdit(item);
                    }}
                  >
                    編集
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="empty-search">
              <strong>登録済み項目は見つかりません</strong>
              <span>
                分類を選び、「この分類で自由入力」または「項目を管理」を使ってください。
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
                  if (draft) return;
                  setActiveCategory(item.id);
                  setActiveSubcategory(undefined);
                }}
                onClick={() => {
                  setDraft(undefined);
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
            <div className="subcategory-list single-column">
              {category.subcategories.map((subcategory) => (
                <button
                  key={subcategory}
                  className={activeSubcategory === subcategory ? "active" : ""}
                  onPointerEnter={() => {
                    if (!draft) setActiveSubcategory(subcategory);
                  }}
                  onClick={() => {
                    setDraft(undefined);
                    setActiveSubcategory(subcategory);
                  }}
                >
                  {subcategory}
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-item-column">
            <div className="menu-column-title">
              {activeSubcategory ?? "項目を選択"}
            </div>

            {draft ? (
              <div className="catalog-item-form">
                <label>
                  <span>項目名</span>
                  <input
                    autoFocus
                    value={draft.label}
                    onChange={(event) =>
                      setDraft({ ...draft, label: event.target.value })
                    }
                    placeholder="例：誤嚥性肺炎"
                  />
                </label>
                <label>
                  <span>分類</span>
                  <select
                    value={draft.category}
                    onChange={(event) => {
                      const nextCategory = event.target.value as CategoryId;
                      setDraft({
                        ...draft,
                        category: nextCategory,
                        subcategory:
                          getCategory(nextCategory).subcategories[0] ?? "その他",
                      });
                    }}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>系統・小分類</span>
                  <select
                    value={draft.subcategory}
                    onChange={(event) =>
                      setDraft({ ...draft, subcategory: event.target.value })
                    }
                  >
                    {getCategory(draft.category).subcategories.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>検索用の別名（任意）</span>
                  <input
                    value={draft.aliases}
                    onChange={(event) =>
                      setDraft({ ...draft, aliases: event.target.value })
                    }
                    placeholder="読点で区切る"
                  />
                </label>
                <div className="catalog-form-actions">
                  <button onClick={() => setDraft(undefined)}>キャンセル</button>
                  <button
                    className="primary-small-button"
                    disabled={!draft.label.trim()}
                    onClick={saveDraft}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : activeSubcategory ? (
              <>
                <div className="catalog-item-list">
                  {visibleItems.length ? (
                    visibleItems.map((item) => (
                      <div className="catalog-item-row" key={item.id}>
                        <button onClick={() => addCatalogItem(item)}>
                          {item.label}
                        </button>
                        {manageMode && (
                          <div className="catalog-row-actions">
                            <button onClick={() => beginEdit(item)}>編集</button>
                            <button
                              className="danger-button"
                              onClick={() => deleteItem(item)}
                            >
                              {item.id.startsWith("custom:") ? "削除" : "非表示"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="catalog-empty-note">登録項目はまだありません</div>
                  )}
                </div>
                {manageMode ? (
                  <div className="catalog-management-actions">
                    <button className="add-custom-item" onClick={beginCreate}>
                      ＋ この分類に項目を追加
                    </button>
                    <button onClick={resetItems}>項目を初期状態へ戻す</button>
                  </div>
                ) : (
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
                      <strong>{activeSubcategory}として自由入力</strong>
                      <small>分類の色を引き継いで作成</small>
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="catalog-empty-note large">
                左から系統・小分類を選んでください
              </div>
            )}
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

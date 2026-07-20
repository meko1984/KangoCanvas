import { CATALOG_ITEMS } from "./catalog";
import type { CatalogItem } from "./types";

const STORAGE_KEY = "kango-canvas-catalog-v1";

export interface CatalogPreferences {
  customItems: CatalogItem[];
  overrides: Record<string, Partial<CatalogItem> & { hidden?: boolean }>;
}

const EMPTY_PREFERENCES: CatalogPreferences = {
  customItems: [],
  overrides: {},
};

export function loadCatalogPreferences(): CatalogPreferences {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return structuredClone(EMPTY_PREFERENCES);
    const parsed = JSON.parse(value) as Partial<CatalogPreferences>;
    return {
      customItems: Array.isArray(parsed.customItems) ? parsed.customItems : [],
      overrides:
        parsed.overrides && typeof parsed.overrides === "object"
          ? parsed.overrides
          : {},
    };
  } catch {
    return structuredClone(EMPTY_PREFERENCES);
  }
}

export function saveCatalogPreferences(value: CatalogPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function resolveCatalogItems(
  preferences: CatalogPreferences,
): CatalogItem[] {
  const builtIn = CATALOG_ITEMS.flatMap((item) => {
    const override = preferences.overrides[item.id];
    if (override?.hidden) return [];
    return [{ ...item, ...override, id: item.id }];
  });
  return [...builtIn, ...preferences.customItems];
}

export function upsertCatalogItem(
  preferences: CatalogPreferences,
  item: CatalogItem,
): CatalogPreferences {
  if (item.id.startsWith("custom:")) {
    const exists = preferences.customItems.some(({ id }) => id === item.id);
    return {
      ...preferences,
      customItems: exists
        ? preferences.customItems.map((current) =>
            current.id === item.id ? item : current,
          )
        : [...preferences.customItems, item],
    };
  }
  return {
    ...preferences,
    overrides: {
      ...preferences.overrides,
      [item.id]: {
        label: item.label,
        category: item.category,
        subcategory: item.subcategory,
        aliases: item.aliases,
      },
    },
  };
}

export function removeCatalogItem(
  preferences: CatalogPreferences,
  item: CatalogItem,
): CatalogPreferences {
  if (item.id.startsWith("custom:")) {
    return {
      ...preferences,
      customItems: preferences.customItems.filter(({ id }) => id !== item.id),
    };
  }
  return {
    ...preferences,
    overrides: {
      ...preferences.overrides,
      [item.id]: { ...preferences.overrides[item.id], hidden: true },
    },
  };
}

export function resetCatalogPreferences(): CatalogPreferences {
  localStorage.removeItem(STORAGE_KEY);
  return structuredClone(EMPTY_PREFERENCES);
}

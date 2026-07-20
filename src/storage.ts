import type { DiagramDocument } from "./types";

const DB_NAME = "kango-canvas";
const DB_VERSION = 1;
const STORE_NAME = "diagrams";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listDiagrams(): Promise<DiagramDocument[]> {
  const result = await withStore<DiagramDocument[]>("readonly", (store) =>
    store.getAll(),
  );
  return result.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getDiagram(id: string): Promise<DiagramDocument | undefined> {
  return withStore<DiagramDocument | undefined>("readonly", (store) =>
    store.get(id),
  );
}

export function saveDiagram(document: DiagramDocument): Promise<IDBValidKey> {
  return withStore<IDBValidKey>("readwrite", (store) => store.put(document));
}

export function deleteDiagram(id: string): Promise<undefined> {
  return withStore<undefined>("readwrite", (store) => store.delete(id));
}

export function createEmptyDiagram(
  title = "無題の関連図",
  primarySystem = "未分類",
): DiagramDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: title.trim() || "無題の関連図",
    primarySystem,
    tags: [],
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    paper: {
      size: "a3",
      orientation: "landscape",
      margin: "standard",
      showTitle: true,
      showDate: false,
    },
    settings: {
      grid: false,
      snap: false,
      minimap: true,
      fontSize: 12,
      lineWidth: 1.5,
    },
  };
}

export function isDiagramDocument(value: unknown): value is DiagramDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiagramDocument>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
}

export function downloadJson(document: DiagramDocument) {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(document.title)}.kangocanvas`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "関連図";
}

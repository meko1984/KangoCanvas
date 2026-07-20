import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Editor } from "./components/Editor";
import { createSampleDiagram } from "./sample";
import {
  deleteDiagram,
  listDiagrams,
  saveDiagram,
} from "./storage";
import type { DiagramDocument } from "./types";

export default function App() {
  const [diagrams, setDiagrams] = useState<DiagramDocument[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState<DiagramDocument>();
  const [pendingDelete, setPendingDelete] = useState<DiagramDocument>();
  const deleteTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      let stored = await listDiagrams();
      if (
        !stored.length &&
        localStorage.getItem("kango-canvas-sample-created") !== "yes"
      ) {
        const sample = createSampleDiagram();
        await saveDiagram(sample);
        localStorage.setItem("kango-canvas-sample-created", "yes");
        stored = [sample];
      }
      setDiagrams(stored);
      setLoading(false);
    };
    void load();
  }, []);

  const activeDocument = useMemo(
    () => diagrams.find((diagram) => diagram.id === activeId),
    [activeId, diagrams],
  );

  const upsert = useCallback((document: DiagramDocument) => {
    setDiagrams((current) =>
      [document, ...current.filter((item) => item.id !== document.id)].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    );
  }, []);

  const createAndOpen = async (document: DiagramDocument) => {
    await saveDiagram(document);
    upsert(document);
    setActiveId(document.id);
  };

  const remove = async (document: DiagramDocument) => {
    window.clearTimeout(deleteTimer.current);
    await deleteDiagram(document.id);
    setDiagrams((current) =>
      current.filter((item) => item.id !== document.id),
    );
    setDeleted(document);
    setPendingDelete(undefined);
    deleteTimer.current = window.setTimeout(() => setDeleted(undefined), 10000);
  };

  const restoreDeleted = async () => {
    if (!deleted) return;
    window.clearTimeout(deleteTimer.current);
    await saveDiagram(deleted);
    upsert(deleted);
    setDeleted(undefined);
  };

  const duplicate = async (document: DiagramDocument) => {
    const now = new Date().toISOString();
    const copy: DiagramDocument = {
      ...structuredClone(document),
      id: crypto.randomUUID(),
      title: `${document.title}（コピー）`,
      createdAt: now,
      updatedAt: now,
      lastBackedUpAt: undefined,
      nodes: document.nodes.map((node) => ({
        ...structuredClone(node),
        selected: false,
      })),
      edges: document.edges.map((edge) => ({
        ...structuredClone(edge),
        selected: false,
      })),
    };
    await saveDiagram(copy);
    upsert(copy);
  };

  const restoreSample = async () => {
    const sample = createSampleDiagram();
    sample.title = diagrams.some((item) => item.title === sample.title)
      ? "練習用：AML関連図（新規）"
      : sample.title;
    await saveDiagram(sample);
    upsert(sample);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="brand-mark">K</div>
        <strong>KangoCanvasを準備しています</strong>
      </div>
    );
  }

  if (activeDocument) {
    return (
      <Editor
        key={activeDocument.id}
        document={activeDocument}
        onBack={() => setActiveId(undefined)}
        onDocumentChange={upsert}
      />
    );
  }

  return (
    <>
      <Dashboard
        diagrams={diagrams}
        onOpen={setActiveId}
        onCreate={(document) => void createAndOpen(document)}
        onDelete={setPendingDelete}
        onDuplicate={(document) => void duplicate(document)}
        onRestoreSample={() => void restoreSample()}
      />
      {deleted && (
        <div className="toast">
          「{deleted.title}」を削除しました
          <button onClick={() => void restoreDeleted()}>元に戻す</button>
        </div>
      )}
      {pendingDelete && (
        <div className="modal-backdrop">
          <div className="modal-card small-modal" role="dialog" aria-modal="true">
            <span className="eyebrow">DELETE</span>
            <h2>関連図を削除しますか？</h2>
            <p>
              「{pendingDelete.title}」をこの端末から削除します。削除直後は元に戻せます。
            </p>
            <div className="modal-actions">
              <button onClick={() => setPendingDelete(undefined)}>
                キャンセル
              </button>
              <button
                className="primary-button delete-confirm"
                onClick={() => void remove(pendingDelete)}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useMemo, useRef, useState } from "react";
import { SYSTEMS } from "../catalog";
import {
  createEmptyDiagram,
  isDiagramDocument,
  saveDiagram,
} from "../storage";
import type { DiagramDocument } from "../types";

interface DashboardProps {
  diagrams: DiagramDocument[];
  onOpen: (id: string) => void;
  onCreate: (document: DiagramDocument) => void;
  onDelete: (document: DiagramDocument) => void;
  onDuplicate: (document: DiagramDocument) => void;
  onRestoreSample: () => void;
}

export function Dashboard({
  diagrams,
  onOpen,
  onCreate,
  onDelete,
  onDuplicate,
  onRestoreSample,
}: DashboardProps) {
  const [filter, setFilter] = useState("すべて");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [system, setSystem] = useState("未分類");
  const [message, setMessage] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = useMemo(
    () =>
      filter === "すべて"
        ? diagrams
        : diagrams.filter((diagram) => diagram.primarySystem === filter),
    [diagrams, filter],
  );

  const importFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isDiagramDocument(parsed)) throw new Error("invalid");
      const imported: DiagramDocument = {
        ...parsed,
        id: crypto.randomUUID(),
        title: `${parsed.title}（読み込み）`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDiagram(imported);
      onCreate(imported);
    } catch {
      setMessage("このファイルはKangoCanvasの関連図として読み込めませんでした。");
    }
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="brand-mark">K</div>
          <div>
            <h1>KangoCanvas</h1>
            <p>看護学生の思考を、自由につなぐ。</p>
          </div>
        </div>
        <div className="header-actions">
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".kangocanvas,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.currentTarget.value = "";
            }}
          />
          <button className="secondary-button" onClick={() => fileInput.current?.click()}>
            バックアップを読み込む
          </button>
          <button className="primary-button" onClick={() => setShowCreate(true)}>
            ＋ 新しい関連図
          </button>
        </div>
      </header>

      <section className="privacy-note">
        <span aria-hidden="true">◉</span>
        <div>
          <strong>この端末だけに保存されます</strong>
          <p>
            氏名・患者ID・生年月日など、個人を特定できる情報は入力しないでください。
          </p>
        </div>
      </section>

      <section className="dashboard-content">
        <aside className="filter-panel">
          <h2>分野</h2>
          {["すべて", ...SYSTEMS].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              <span>{item === "すべて" ? "すべての関連図" : item}</span>
              <small>
                {item === "すべて"
                  ? diagrams.length
                  : diagrams.filter((diagram) => diagram.primarySystem === item)
                      .length}
              </small>
            </button>
          ))}
          <button className="restore-sample" onClick={onRestoreSample}>
            練習用サンプルを追加
          </button>
        </aside>

        <div className="diagram-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MY DIAGRAMS</span>
              <h2>{filter === "すべて" ? "最近編集した関連図" : filter}</h2>
            </div>
            <label className="mobile-filter">
              <span>分野</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                {["すべて", ...SYSTEMS].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          {visible.length ? (
            <div className="diagram-grid">
              {visible.map((diagram) => (
                <article
                  className="diagram-card"
                  key={diagram.id}
                  onDoubleClick={() => onOpen(diagram.id)}
                >
                  <button
                    className="diagram-card-main"
                    onClick={() => onOpen(diagram.id)}
                  >
                    <div className="diagram-placeholder" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <i />
                      <i />
                    </div>
                    <div className="diagram-card-copy">
                      <span className="system-pill">{diagram.primarySystem}</span>
                      <h3>{diagram.title}</h3>
                      <p>更新：{formatDate(diagram.updatedAt)}</p>
                    </div>
                  </button>
                  <div className="card-actions">
                    <button onClick={() => onDuplicate(diagram)}>複製</button>
                    <button
                      className="danger-link"
                      onClick={() => onDelete(diagram)}
                    >
                      削除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-dashboard">
              <div className="empty-illustration" aria-hidden="true">
                <span>＋</span>
              </div>
              <h3>この分野の関連図はまだありません</h3>
              <p>白紙のキャンバスから、思考をつないでみましょう。</p>
              <button className="primary-button" onClick={() => setShowCreate(true)}>
                新しい関連図を作る
              </button>
            </div>
          )}
        </div>
      </section>

      {showCreate && (
        <div className="modal-backdrop" role="presentation">
          <form
            className="modal-card"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate(createEmptyDiagram(title, system));
              setTitle("");
              setSystem("未分類");
              setShowCreate(false);
            }}
          >
            <span className="eyebrow">NEW DIAGRAM</span>
            <h2>新しい関連図</h2>
            <label>
              タイトル
              <input
                autoFocus
                value={title}
                placeholder="無題の関連図"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              主な分野
              <select value={system} onChange={(event) => setSystem(event.target.value)}>
                {SYSTEMS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="modal-warning">
              個人を特定できる情報は入力しないでください。
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCreate(false)}>
                キャンセル
              </button>
              <button className="primary-button" type="submit">
                作成する
              </button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <div className="toast" role="alert">
          {message}
          <button onClick={() => setMessage(undefined)}>閉じる</button>
        </div>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

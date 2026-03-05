import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { SummaryProfile } from "../api/types";
import { api } from "../api/client";

const defaultFields = ["title", "content"];

export function SummaryProfiles() {
  const [profiles, setProfiles] = useState<SummaryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addBaseUrl, setAddBaseUrl] = useState("");
  const [addKey, setAddKey] = useState("");
  const [addModel, setAddModel] = useState("");
  const [addPrompt, setAddPrompt] = useState("");
  const [editName, setEditName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  const loadProfiles = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getSummaryProfiles()
      .then(setProfiles)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "请求失败");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = addName.trim();
    if (!name) {
      setFormError("请填写名称");
      return;
    }
    const base_url = addBaseUrl.trim() || "https://api.openai.com/v1";
    const key = addKey.trim();
    const model = addModel.trim() || "gpt-4";
    const prompt_template = addPrompt.trim() || "{title}";
    try {
      await api.createSummaryProfile({
        name,
        base_url,
        key,
        model,
        fields: defaultFields,
        prompt_template,
      });
      setAddName("");
      setAddBaseUrl("");
      setAddKey("");
      setAddModel("");
      setAddPrompt("");
      setShowAddForm(false);
      loadProfiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "添加失败");
    }
  };

  const startEdit = (p: SummaryProfile) => {
    setEditingName(p.name);
    setEditName(p.name);
    setEditBaseUrl(p.base_url);
    setEditKey(p.key);
    setEditModel(p.model);
    setEditPrompt(p.prompt_template);
    setFormError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingName) return;
    setFormError(null);
    const name = editName.trim();
    if (!name) {
      setFormError("请填写名称");
      return;
    }
    try {
      await api.updateSummaryProfile(editingName, {
        name,
        base_url: editBaseUrl.trim(),
        key: editKey.trim(),
        model: editModel.trim(),
        prompt_template: editPrompt.trim(),
      });
      setEditingName(null);
      loadProfiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "更新失败");
    }
  };

  const confirmDelete = (name: string) => setDeletingName(name);
  const handleDeleteConfirm = async () => {
    if (!deletingName) return;
    setFormError(null);
    try {
      await api.deleteSummaryProfile(deletingName);
      setDeletingName(null);
      loadProfiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "删除失败");
    }
  };

  const inputClass =
    "w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const labelClass = "block text-sm font-medium text-foreground mt-2 first:mt-0";
  const btnPrimary =
    "px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const btnSecondary =
    "px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">摘要配置</h1>
      <nav className="mb-6">
        <Link to="/" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded">
          首页
        </Link>
      </nav>
      {loading && <p className="text-muted-foreground">加载中…</p>}
      {error && (
        <p className="text-destructive whitespace-pre-wrap mb-4" role="alert">
          错误：{error}
        </p>
      )}
      {formError && (
        <p className="text-destructive mb-4" role="alert">
          {formError}
        </p>
      )}
      {!loading && !error && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              aria-label="添加"
              className={btnPrimary}
            >
              添加
            </button>
            <button type="button" onClick={loadProfiles} aria-label="刷新" className={btnSecondary}>
              刷新
            </button>
          </div>
          {showAddForm && (
            <form data-testid="add-profile-form" onSubmit={handleAddSubmit} className="space-y-2 mb-6 p-4 border border-border rounded-lg bg-secondary/20">
              <label htmlFor="add-name" className={labelClass}>名称</label>
              <input id="add-name" className={inputClass} value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="配置名称" />
              <label htmlFor="add-baseurl" className={labelClass}>API Base URL</label>
              <input id="add-baseurl" className={inputClass} value={addBaseUrl} onChange={(e) => setAddBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
              <label htmlFor="add-key" className={labelClass}>密钥</label>
              <input id="add-key" type="password" className={inputClass} value={addKey} onChange={(e) => setAddKey(e.target.value)} placeholder="sk-..." />
              <label htmlFor="add-model" className={labelClass}>Model</label>
              <input id="add-model" className={inputClass} value={addModel} onChange={(e) => setAddModel(e.target.value)} placeholder="gpt-4" />
              <label htmlFor="add-prompt" className={labelClass}>提示模板</label>
              <input id="add-prompt" className={inputClass} value={addPrompt} onChange={(e) => setAddPrompt(e.target.value)} placeholder="{title}" />
              <div className="flex gap-2 mt-4">
                <button type="submit" className={btnPrimary}>确定</button>
                <button type="button" onClick={() => { setShowAddForm(false); setFormError(null); }} className={btnSecondary}>取消</button>
              </div>
            </form>
          )}
          {!loading && !error && profiles.length === 0 && (
            <p className="text-muted-foreground">暂无摘要配置，请先添加配置。</p>
          )}
          {!loading && !error && profiles.length > 0 && (
            <ul className="space-y-4 list-none p-0">
              {profiles.map((p) => (
                <li key={p.name} className="border border-border rounded-lg p-4">
                  {editingName === p.name ? (
                    <form data-testid="edit-profile-form" onSubmit={handleEditSubmit} className="space-y-2">
                      <label htmlFor="edit-name" className={labelClass}>名称</label>
                      <input id="edit-name" className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <label htmlFor="edit-baseurl" className={labelClass}>API Base URL</label>
                      <input id="edit-baseurl" className={inputClass} value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} />
                      <label htmlFor="edit-key" className={labelClass}>密钥</label>
                      <input id="edit-key" type="password" className={inputClass} value={editKey} onChange={(e) => setEditKey(e.target.value)} />
                      <label htmlFor="edit-model" className={labelClass}>Model</label>
                      <input id="edit-model" className={inputClass} value={editModel} onChange={(e) => setEditModel(e.target.value)} />
                      <label htmlFor="edit-prompt" className={labelClass}>提示模板</label>
                      <input id="edit-prompt" className={inputClass} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} />
                      <div className="flex gap-2 mt-4">
                        <button type="submit" className={btnPrimary}>确定</button>
                        <button type="button" onClick={() => { setEditingName(null); setFormError(null); }} className={btnSecondary}>取消</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground break-words">{p.name}</span>
                      <button type="button" onClick={() => startEdit(p)} aria-label={`编辑 ${p.name}`} className={btnSecondary}>
                        编辑
                      </button>
                      <button type="button" onClick={() => confirmDelete(p.name)} aria-label={`删除 ${p.name}`} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        删除
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {deletingName && (
            <div role="dialog" aria-modal="true" aria-labelledby="delete-profile-title" className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-lg">
                <p id="delete-profile-title" className="text-foreground mb-4">确认删除该摘要配置？</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDeleteConfirm} className={btnPrimary}>确认</button>
                  <button type="button" onClick={() => setDeletingName(null)} className={btnSecondary}>取消</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

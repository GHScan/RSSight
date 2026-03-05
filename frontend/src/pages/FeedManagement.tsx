import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Feed } from "../api/types";
import { api } from "../api/client";

export function FeedManagement() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const loadFeeds = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getFeeds()
      .then(setFeeds)
      .catch((e) => setError(e instanceof Error ? e.message : "请求失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const title = addTitle.trim();
    const url = addUrl.trim();
    if (!title) {
      setFormError("请填写标题");
      return;
    }
    if (!url) {
      setFormError("请填写订阅地址");
      return;
    }
    try {
      await api.createFeed({ title, url });
      setAddTitle("");
      setAddUrl("");
      setShowAddForm(false);
      loadFeeds();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "添加失败");
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">订阅管理</h1>
      <nav className="flex flex-wrap gap-4 items-center mb-6">
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
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormError(null);
            }}
            aria-label="添加"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            添加
          </button>
        </div>
      )}
      {showAddForm && !loading && !error && (
        <form
          onSubmit={handleAddSubmit}
          className="space-y-2 mb-6 p-4 border border-border rounded-lg bg-secondary/20"
        >
          <label htmlFor="add-title" className="block text-sm font-medium text-foreground">
            标题
          </label>
          <input
            id="add-title"
            className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="订阅名称"
          />
          <label htmlFor="add-url" className="block text-sm font-medium text-foreground">
            订阅地址
          </label>
          <input
            id="add-url"
            type="url"
            className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
          />
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              确定
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
              }}
              className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              取消
            </button>
          </div>
        </form>
      )}
      {!loading && !error && feeds.length === 0 && !showAddForm && (
        <p className="text-muted-foreground">暂无订阅，请先添加订阅源。</p>
      )}
      {!loading && !error && feeds.length > 0 && (
        <ul className="space-y-2 list-none p-0">
          {feeds.map((f) => (
            <li key={f.id} className="border-b border-border py-2 last:border-b-0">
              <Link
                to={`/feeds/${f.id}/articles`}
                className="text-primary hover:underline break-words focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {f.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

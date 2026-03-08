import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import type { Feed } from "../api/types";
import { api } from "../api/client";
import { trackPageView } from "../telemetry";

export function FeedManagement() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<{ id: string; title: string } | null>(null);

  const loadFeeds = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getFeeds()
      .then(setFeeds)
      .catch((e) => setError(e instanceof Error ? e.message : "请求失败"))
      .finally(() => setLoading(false));
  }, []);

  const rssFeeds = feeds
    .filter((f) => (f.feed_type ?? "rss") === "rss")
    .slice()
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "zh-CN"));
  const sortedRssFeeds = useMemo(
    () => [...rssFeeds].sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-CN")),
    [rssFeeds]
  );

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  useEffect(() => {
    trackPageView("rss_subscriptions");
  }, []);

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

  const confirmDelete = (id: string, title: string) => setConfirmDeleteFeed({ id, title });
  const handleDeleteConfirm = async () => {
    if (!confirmDeleteFeed) return;
    setDeletingId(confirmDeleteFeed.id);
    setError(null);
    try {
      await api.deleteFeed(confirmDeleteFeed.id);
      setConfirmDeleteFeed(null);
      loadFeeds();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const btnBase =
    "inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const btnPrimary = `${btnBase} bg-primary text-primary-foreground hover:opacity-90`;
  const btnSecondary = `${btnBase} border border-border bg-background text-foreground hover:bg-accent`;

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-center gap-3 mb-4">
        <BackLink to="/" aria-label="首页" />
        <h1 className="text-2xl font-semibold text-foreground">RSS 订阅</h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
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
          <section role="region" aria-label="RSS 订阅列表" className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setFormError(null);
                }}
                aria-label="添加 Feed"
                className={btnPrimary}
              >
                添加 Feed
              </button>
            </div>
      {showAddForm && (
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
            <button type="submit" className={btnPrimary}>
              确定
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
              }}
              className={btnSecondary}
            >
              取消
            </button>
          </div>
        </form>
      )}
            {sortedRssFeeds.length === 0 && !showAddForm && (
              <p className="text-muted-foreground">暂无 RSS 订阅，请先添加订阅源。</p>
            )}
            {sortedRssFeeds.length > 0 && (
              <ul className="space-y-4 list-none p-0">
                {sortedRssFeeds.map((f) => (
                  <li key={f.id} className="border border-border rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Link
                          to={`/feeds/${f.id}/articles`}
                          className="font-medium text-primary hover:underline break-words min-w-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                        >
                          {f.title}
                        </Link>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => confirmDelete(f.id, f.title)}
                          disabled={deletingId === f.id}
                          aria-label={`删除 ${f.title}`}
                          className={`${btnBase} bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50`}
                        >
                          {deletingId === f.id ? "删除中…" : "删除"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      </div>
      {confirmDeleteFeed && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-feed-title" className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-lg">
            <p id="delete-feed-title" className="text-foreground mb-4">确认删除该订阅？</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDeleteConfirm} className={btnPrimary}>确认</button>
              <button type="button" onClick={() => setConfirmDeleteFeed(null)} className={btnSecondary}>取消</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import type { Feed } from "../api/types";
import { api } from "../api/client";

export function ArticleFavorites() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVirtualForm, setShowVirtualForm] = useState(false);
  const [virtualFeedName, setVirtualFeedName] = useState("");
  const [virtualFormError, setVirtualFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<{ id: string; title: string } | null>(null);

  const favoritesFeeds = feeds.filter((f) => f.feed_type === "virtual");

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

  const handleCreateVirtualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVirtualFormError(null);
    const name = virtualFeedName.trim();
    if (!name) {
      setVirtualFormError("请填写收藏夹名称");
      return;
    }
    try {
      await api.createVirtualFeed(name);
      setVirtualFeedName("");
      setShowVirtualForm(false);
      loadFeeds();
    } catch (e) {
      setVirtualFormError(e instanceof Error ? e.message : "创建失败");
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
        <h1 className="text-2xl font-semibold text-foreground">文章收藏</h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        {loading && <p className="text-muted-foreground">加载中…</p>}
        {error && (
          <p className="text-destructive whitespace-pre-wrap mb-4" role="alert">
            错误：{error}
          </p>
        )}
        {virtualFormError && (
          <p className="text-destructive mb-4" role="alert">
            {virtualFormError}
          </p>
        )}
        {!loading && !error && (
          <>
            <section role="region" aria-labelledby="favorites-heading" className="mb-8">
              <h2 id="favorites-heading" className="text-lg font-medium text-foreground mb-3">
                收藏夹
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowVirtualForm(true);
                    setVirtualFeedName("");
                    setVirtualFormError(null);
                  }}
                  aria-label="新建收藏夹"
                  className={btnPrimary}
                >
                  新建收藏夹
                </button>
              </div>
              {favoritesFeeds.length === 0 && !showVirtualForm && (
                <p className="text-muted-foreground">暂无收藏夹，可点击「新建收藏夹」创建。</p>
              )}
              {favoritesFeeds.length > 0 && (
                <ul className="space-y-4 list-none p-0">
                  {favoritesFeeds.map((f) => (
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
      {showVirtualForm && (
        <div role="dialog" aria-modal="true" aria-labelledby="virtual-feed-title" className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-lg">
            <h2 id="virtual-feed-title" className="text-lg font-medium text-foreground mb-4">新建文章收藏夹</h2>
            {virtualFormError && (
              <p className="text-destructive text-sm mb-3" role="alert">{virtualFormError}</p>
            )}
            <form onSubmit={handleCreateVirtualSubmit}>
              <label htmlFor="virtual-feed-name" className="block text-sm font-medium text-foreground mb-1">名称</label>
              <input
                id="virtual-feed-name"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mb-4"
                value={virtualFeedName}
                onChange={(e) => setVirtualFeedName(e.target.value)}
                placeholder="收藏夹名称"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className={btnPrimary}>确定</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVirtualForm(false);
                    setVirtualFeedName("");
                    setVirtualFormError(null);
                  }}
                  className={btnSecondary}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDeleteFeed && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-feed-title" className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-lg">
            <p id="delete-feed-title" className="text-foreground mb-4">确认删除该收藏夹？</p>
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

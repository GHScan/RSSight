import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import type { Article, Feed } from "../api/types";
import { api } from "../api/client";

/** Format local date for datetime-local input (YYYY-MM-DDTHH:mm). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format ISO date as year-month for display (e.g. 2026年3月). */
function formatYearMonth(published: string): string {
  const d = new Date(published);
  if (Number.isNaN(d.getTime())) return published.slice(0, 7);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}年${m}月`;
}

/** Age-based wrapper: border + bg both fade (same day darkest, 3+ months lightest). */
function getDateWrapClass(published: string): string {
  const pub = new Date(published);
  const now = new Date();
  if (Number.isNaN(pub.getTime())) return "border-foreground/25 bg-foreground/5";
  const sameDay =
    pub.getUTCDate() === now.getUTCDate() &&
    pub.getUTCMonth() === now.getUTCMonth() &&
    pub.getUTCFullYear() === now.getUTCFullYear();
  const daysAgo = (now.getTime() - pub.getTime()) / (24 * 60 * 60 * 1000);
  if (sameDay) return "border-foreground bg-foreground/15";       // 当天最深
  if (daysAgo <= 30) return "border-foreground/75 bg-foreground/10";
  if (daysAgo <= 90) return "border-foreground/45 bg-foreground/5";
  return "border-foreground/25 bg-foreground/5";                  // 3 个月以上最浅
}

export function ArticleList() {
  const { feedId } = useParams<{ feedId: string }>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addPublished, setAddPublished] = useState(() => toDatetimeLocal(new Date()));
  const [addSource, setAddSource] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** S032: true after first submit in no-URL path when we filled defaults; second click creates. */
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [createPendingMessage, setCreatePendingMessage] = useState<string | null>(null);
  /** S042: delete feedback for favorites collection articles. */
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    if (!feedId) return;
    api.getFeed(feedId).then(setFeed).catch(() => setFeed(null));
  }, [feedId]);

  const loadArticles = useCallback(() => {
    if (!feedId) return;
    setLoading(true);
    setError(null);
    api
      .getArticles(feedId)
      .then(setArticles)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "请求失败");
      })
      .finally(() => setLoading(false));
  }, [feedId]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!createSuccess) return;
    const t = setTimeout(() => setCreateSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [createSuccess]);

  useEffect(() => {
    if (!deleteSuccess) return;
    const t = setTimeout(() => setDeleteSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [deleteSuccess]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const title = (a.title_trans ?? a.title).toLowerCase();
      return title.includes(q);
    });
  }, [articles, searchQuery]);

  if (!feedId) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">缺少订阅 ID</p>;
  if (loading && articles.length === 0) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">加载中…</p>;
  const backTo = feed?.feed_type === "virtual" ? "/favorites" : "/feeds";
  const backAriaLabel = feed?.feed_type === "virtual" ? "返回文章收藏" : "返回RSS 订阅";

  if (error && articles.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-4">
          <BackLink to={backTo} aria-label={backAriaLabel} />
          <h1 className="text-2xl font-semibold text-foreground">文章列表</h1>
        </header>
        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <p className="text-destructive whitespace-pre-wrap mb-4" role="alert">错误：{error}</p>
          <button
            type="button"
            onClick={loadArticles}
            aria-label="重试"
            data-testid="retry-articles"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-base font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-4">
        <BackLink to={backTo} aria-label={backAriaLabel} />
        <h1 className="text-2xl font-semibold text-foreground">文章列表</h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {feed?.feed_type === "virtual" && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm((v) => !v);
                setCreateError(null);
                setCreateSuccess(null);
                setCreatePendingMessage(null);
                setPendingConfirm(false);
                if (!showAddForm) {
                  setAddPublished(toDatetimeLocal(new Date()));
                }
              }}
              aria-label="添加"
              data-testid="add-custom-article-toggle"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-base font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              添加
            </button>
          )}
          {feed?.feed_type !== "virtual" && (
            <button
              type="button"
              onClick={loadArticles}
              disabled={loading}
              aria-label="刷新"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg border border-border bg-background text-foreground text-base font-medium hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              刷新
            </button>
          )}
          {!loading && !error && articles.length > 0 && (
            <>
              <label htmlFor="article-search" className="sr-only">
                搜索文章
              </label>
              <input
                id="article-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文章标题…"
                aria-label="搜索文章"
                className="flex-1 min-w-[12rem] max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </>
          )}
        </div>
        {feed?.feed_type === "virtual" && showAddForm && (
          <section className="mb-4 p-4 rounded-lg border border-border bg-muted/30" aria-label="添加文章表单">
            <h2 className="text-lg font-medium text-foreground mb-3">添加文章</h2>
            {createError && (
              <p className="text-destructive text-sm mb-3" role="alert">
                {createError}
              </p>
            )}
            {createPendingMessage && (
              <p className="text-muted-foreground text-sm mb-3" role="status">
                {createPendingMessage}
              </p>
            )}
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (!feedId) return;
                setCreateError(null);
                setCreatePendingMessage(null);
                // S031: No-URL path requires title and content (mandatory validation).
                const urlTrimmed = addUrl.trim();
                if (!urlTrimmed) {
                  const titleOk = addTitle.trim().length > 0;
                  const contentOk = addContent.trim().length > 0;
                  if (!titleOk || !contentOk) {
                    setCreateError("不填链接时，标题和内容为必填项。");
                    return;
                  }
                  // S032: First click in no-URL path fills defaults and enters pending-confirm; no API call.
                  if (!pendingConfirm) {
                    setAddUrl("https://");
                    setAddPublished(toDatetimeLocal(new Date()));
                    setPendingConfirm(true);
                    setCreatePendingMessage("已填充默认值（链接、发布时间），请确认后再次点击「提交」创建文章。");
                    return;
                  }
                } else {
                  setPendingConfirm(false);
                }
                setCreating(true);
                const publishedAt = addPublished ? new Date(addPublished).toISOString() : new Date().toISOString();
                try {
                  await api.createCustomArticle(feedId, {
                    title: addTitle,
                    link: addUrl,
                    description: addContent,
                    published_at: publishedAt,
                    source: addSource.trim() || undefined,
                  });
                  setAddUrl("");
                  setAddTitle("");
                  setAddContent("");
                  setAddSource("");
                  setAddPublished(toDatetimeLocal(new Date()));
                  setCreateError(null);
                  setCreatePendingMessage(null);
                  setPendingConfirm(false);
                  setShowAddForm(false);
                  setCreateSuccess("创建成功");
                  loadArticles();
                } catch (err) {
                  setCreateError(err instanceof Error ? err.message : "创建失败");
                } finally {
                  setCreating(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="custom-article-url" className="block text-sm font-medium text-foreground mb-1">
                  链接 (URL)
                </label>
                <input
                  id="custom-article-url"
                  type="url"
                  value={addUrl}
                  onChange={(e) => {
                    setAddUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setPendingConfirm(false);
                      setCreatePendingMessage(null);
                    }
                  }}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="custom-article-title" className="block text-sm font-medium text-foreground mb-1">
                  标题
                </label>
                <input
                  id="custom-article-title"
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="文章标题"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="custom-article-content" className="block text-sm font-medium text-foreground mb-1">
                  内容
                </label>
                <textarea
                  id="custom-article-content"
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder="文章内容或摘要"
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
              <div>
                <label htmlFor="custom-article-published" className="block text-sm font-medium text-foreground mb-1">
                  发布时间
                </label>
                <input
                  id="custom-article-published"
                  type="datetime-local"
                  value={addPublished}
                  onChange={(e) => setAddPublished(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="custom-article-source" className="block text-sm font-medium text-foreground mb-1">
                  来源（可选）
                </label>
                <input
                  id="custom-article-source"
                  type="text"
                  value={addSource}
                  onChange={(e) => setAddSource(e.target.value)}
                  placeholder="来源说明"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  data-testid="custom-article-submit"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-base font-medium hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {creating ? "提交中…" : pendingConfirm ? "确认创建" : "提交"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setCreateError(null);
                  }}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg border border-border bg-background text-foreground text-base font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  取消
                </button>
              </div>
            </form>
          </section>
        )}
        {createSuccess && (
          <p className="mb-4 px-4 py-2 rounded-lg bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30" role="status">
            {createSuccess}
          </p>
        )}
        {deleteSuccess && (
          <p className="mb-4 px-4 py-2 rounded-lg bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30" role="status">
            {deleteSuccess}
          </p>
        )}
        {deleteError && (
          <p className="mb-4 px-4 py-2 rounded-lg bg-destructive/15 text-destructive border border-destructive/30" role="alert">
            {deleteError}
          </p>
        )}
        {loading && <p className="text-muted-foreground">加载中…</p>}
      {error && (
        <p className="text-destructive whitespace-pre-wrap mb-4" role="alert">
          错误：{error}
        </p>
      )}
      {!loading && !error && articles.length === 0 && (
        <p className="text-muted-foreground">暂无文章</p>
      )}
      {!loading && !error && articles.length > 0 && (
        <>
          {filteredArticles.length === 0 && (
            <p className="text-muted-foreground">无匹配文章</p>
          )}
          {filteredArticles.length > 0 && (
        <ul className="space-y-2 list-none p-0">
          {filteredArticles.map((a) => (
            <li
              key={a.id}
              className="border-b border-border py-2 last:border-b-0 flex items-center gap-2"
            >
              {feed?.feed_type === "virtual" ? (
                <span className="shrink-0 text-lg leading-none p-1 min-w-[1.5rem] text-center" aria-hidden>
                  ☆
                </span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!feedId) return;
                    const next = !a.favorite;
                    await api.setArticleFavorite(feedId, a.id, next);
                    loadArticles();
                  }}
                  aria-label={a.favorite ? "取消收藏" : "收藏"}
                  title={a.favorite ? "取消收藏" : "收藏"}
                  className="shrink-0 text-lg leading-none p-1 rounded focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {a.favorite ? "★" : "☆"}
                </button>
              )}
              <div
                className={`shrink-0 flex items-center gap-2 rounded-md border-l-4 py-0.5 pl-2 pr-2 min-w-[6rem] ${getDateWrapClass(a.published)}`}
                aria-hidden
                title={formatYearMonth(a.published)}
              >
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatYearMonth(a.published)}
                </span>
              </div>
              <Link
                to={`/feeds/${feedId}/articles/${a.id}`}
                className="text-primary hover:underline break-words focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded flex-1 min-w-0"
              >
                {a.title_trans ?? a.title}
              </Link>
              {feed?.feed_type === "virtual" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!feedId) return;
                    const confirmed = window.confirm("确定要删除这篇文章吗？");
                    if (!confirmed) return;
                    setDeleteError(null);
                    setDeletingId(a.id);
                    try {
                      await api.deleteArticle(feedId, a.id);
                      setDeleteSuccess("已删除");
                      loadArticles();
                    } catch (err) {
                      setDeleteError(err instanceof Error ? err.message : "删除失败");
                    } finally {
                      setDeletingId(null);
                    }
                  }}
                  disabled={deletingId === a.id}
                  aria-label="删除"
                  title="删除"
                  data-testid={`delete-article-${a.id}`}
                  className="shrink-0 ml-auto text-lg leading-none p-1 rounded text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  删除
                </button>
              )}
            </li>
          ))}
        </ul>
          )}
        </>
      )}
      </div>
    </main>
  );
}

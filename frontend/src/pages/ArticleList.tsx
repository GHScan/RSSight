import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { NavLink } from "../components/NavLink";
import type { Article } from "../api/types";
import { api } from "../api/client";

export function ArticleList() {
  const { feedId } = useParams<{ feedId: string }>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!feedId) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">缺少订阅 ID</p>;
  if (loading && articles.length === 0) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">加载中…</p>;
  if (error && articles.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground mb-4">文章列表</h1>
        <nav className="flex flex-wrap gap-3 mb-6">
          <NavLink to="/feeds">返回订阅管理</NavLink>
        </nav>
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
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">文章列表</h1>
      <nav className="flex flex-wrap gap-3 mb-6 items-center">
        <NavLink to="/feeds">返回订阅管理</NavLink>
        <button
          type="button"
          onClick={loadArticles}
          disabled={loading}
          aria-label="刷新"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg border border-border bg-background text-foreground text-base font-medium hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          刷新
        </button>
      </nav>
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
        <ul className="space-y-2 list-none p-0">
          {articles.map((a) => (
            <li key={a.id} className="border-b border-border py-2 last:border-b-0">
              <Link
                to={`/feeds/${feedId}/articles/${a.id}`}
                className="text-primary hover:underline break-words focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {a.title_trans ?? a.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

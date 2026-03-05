import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
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

  if (!feedId) return <p>缺少订阅 ID</p>;
  if (loading && articles.length === 0) return <p>加载中…</p>;
  if (error && articles.length === 0) {
    return (
      <main>
        <h1>文章列表</h1>
        <nav>
          <Link to="/feeds">返回订阅管理</Link>
        </nav>
        <p className="error-message" style={{ whiteSpace: "pre-wrap" }}>
          错误：{error}
        </p>
        <button type="button" onClick={loadArticles} aria-label="重试">
          重试
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>文章列表</h1>
      <nav>
        <Link to="/feeds">返回订阅管理</Link>
        <button
          type="button"
          onClick={loadArticles}
          disabled={loading}
          aria-label="刷新"
        >
          刷新
        </button>
      </nav>
      {loading && <p>加载中…</p>}
      {error && (
        <p className="error-message" role="alert" style={{ whiteSpace: "pre-wrap" }}>
          错误：{error}
        </p>
      )}
      {!loading && !error && articles.length === 0 && (
        <p>暂无文章</p>
      )}
      {!loading && !error && articles.length > 0 && (
        <ul>
          {articles.map((a) => (
            <li key={a.id}>
              <Link to={`/feeds/${feedId}/articles/${a.id}`}>{a.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Article } from "../api/types";
import { api } from "../api/client";

export function ArticleList() {
  const { feedId } = useParams<{ feedId: string }>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getArticles(feedId)
      .then((data) => {
        if (!cancelled) setArticles(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "请求失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedId]);

  if (!feedId) return <p>缺少订阅 ID</p>;
  if (loading) return <p>加载中…</p>;
  if (error) return <p>错误：{error}</p>;

  return (
    <main>
      <h1>文章列表</h1>
      <nav>
        <Link to="/feeds">返回订阅管理</Link>
      </nav>
      {articles.length === 0 ? (
        <p>暂无文章</p>
      ) : (
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

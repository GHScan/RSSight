import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Feed } from "../api/types";
import { api } from "../api/client";

export function FeedManagement() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFeeds()
      .then((data) => {
        if (!cancelled) setFeeds(data);
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
  }, []);

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
      {!loading && !error && feeds.length === 0 && (
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

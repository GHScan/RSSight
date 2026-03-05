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
    <main>
      <h1>订阅管理</h1>
      <nav>
        <Link to="/">首页</Link>
      </nav>
      {loading && <p>加载中…</p>}
      {error && (
        <p className="error-message" style={{ whiteSpace: "pre-wrap" }}>
          错误：{error}
        </p>
      )}
      {!loading && !error && feeds.length === 0 && (
        <p>暂无订阅，请先添加订阅源。</p>
      )}
      {!loading && !error && feeds.length > 0 && (
        <ul>
          {feeds.map((f) => (
            <li key={f.id}>
              <Link to={`/feeds/${f.id}/articles`}>{f.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

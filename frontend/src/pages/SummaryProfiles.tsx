import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SummaryProfile } from "../api/types";
import { api } from "../api/client";

export function SummaryProfiles() {
  const [profiles, setProfiles] = useState<SummaryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getSummaryProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
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
      <h1>摘要配置</h1>
      <nav>
        <Link to="/">首页</Link>
      </nav>
      {loading && <p>加载中…</p>}
      {error && <p>错误：{error}</p>}
      {!loading && !error && profiles.length === 0 && (
        <p>暂无摘要配置，请先添加配置。</p>
      )}
      {!loading && !error && profiles.length > 0 && (
        <ul>
          {profiles.map((p) => (
            <li key={p.name}>{p.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import type { SummaryProfile } from "../api/types";
import { api } from "../api/client";

export function ArticleSummary() {
  const { feedId, articleId } = useParams<{ feedId: string; articleId: string }>();
  const [profiles, setProfiles] = useState<SummaryProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const loadProfiles = useCallback(() => {
    api
      .getSummaryProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoadingProfiles(false));
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const loadSummary = useCallback(() => {
    if (!feedId || !articleId || !selectedProfile) return;
    setLoadingSummary(true);
    setError(null);
    setSummary(null);
    api
      .getSummary(feedId, articleId, selectedProfile)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [feedId, articleId, selectedProfile]);

  useEffect(() => {
    if (selectedProfile) loadSummary();
    else {
      setSummary(null);
      setError(null);
    }
  }, [selectedProfile, loadSummary]);

  const handleGenerate = async () => {
    if (!feedId || !articleId || !selectedProfile) return;
    setGenerating(true);
    setError(null);
    try {
      const text = await api.generateSummary(feedId, articleId, selectedProfile);
      setSummary(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  if (!feedId || !articleId) return <p>缺少参数</p>;

  return (
    <main>
      <h1>文章摘要</h1>
      <nav>
        <Link to={`/feeds/${feedId}/articles`}>返回文章列表</Link>
      </nav>
      {loadingProfiles && <p>加载中…</p>}
      {!loadingProfiles && profiles.length === 0 && (
        <p>暂无摘要配置，请先在摘要配置页添加。</p>
      )}
      {!loadingProfiles && profiles.length > 0 && (
        <>
          <label htmlFor="summary-profile">摘要配置</label>
          <select
            id="summary-profile"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            aria-label="摘要配置"
          >
            <option value="">请选择摘要配置</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {!selectedProfile && (
            <p>请选择摘要配置</p>
          )}
          {selectedProfile && (
            <>
              {loadingSummary && <p>加载摘要中…</p>}
              {!loadingSummary && summary === null && !error && (
                <>
                  <p>暂无摘要</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    aria-label="生成摘要"
                  >
                    {generating ? "生成中…" : "生成"}
                  </button>
                </>
              )}
              {!loadingSummary && summary !== null && (
                <>
                  <div data-testid="summary-content">
                    <pre style={{ whiteSpace: "pre-wrap" }}>{summary}</pre>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    aria-label="重新生成"
                  >
                    {generating ? "生成中…" : "重新生成"}
                  </button>
                </>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              {error && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  aria-label="重试"
                >
                  {generating ? "生成中…" : "重试"}
                </button>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

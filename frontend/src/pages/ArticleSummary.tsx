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

  if (!feedId || !articleId) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">缺少参数</p>;

  const btnPrimary = "px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">文章摘要</h1>
      <nav className="mb-6">
        <Link
          to={`/feeds/${feedId}/articles`}
          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          返回文章列表
        </Link>
      </nav>
      {loadingProfiles && <p className="text-muted-foreground">加载中…</p>}
      {!loadingProfiles && profiles.length === 0 && (
        <p className="text-muted-foreground">暂无摘要配置，请先在摘要配置页添加。</p>
      )}
      {!loadingProfiles && profiles.length > 0 && (
        <div className="space-y-4">
          <label htmlFor="summary-profile" className="block text-sm font-medium text-foreground">
            摘要配置
          </label>
          <select
            id="summary-profile"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            aria-label="摘要配置"
            className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">请选择摘要配置</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {!selectedProfile && (
            <p className="text-muted-foreground">请选择摘要配置</p>
          )}
          {selectedProfile && (
            <div className="space-y-4">
              {loadingSummary && <p className="text-muted-foreground">加载摘要中…</p>}
              {!loadingSummary && summary === null && !error && (
                <div className="space-y-2">
                  <p className="text-muted-foreground">暂无摘要</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    aria-label="生成摘要"
                    className={btnPrimary}
                  >
                    {generating ? "生成中…" : "生成"}
                  </button>
                </div>
              )}
              {!loadingSummary && summary !== null && (
                <div className="space-y-4">
                  <div data-testid="summary-content" className="rounded-md border border-border p-4 bg-secondary/30 overflow-auto max-h-[70vh]">
                    <pre className="whitespace-pre-wrap text-foreground text-sm break-words">{summary}</pre>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    aria-label="重新生成"
                    className={btnPrimary}
                  >
                    {generating ? "生成中…" : "重新生成"}
                  </button>
                </div>
              )}
              {error && (
                <div className="space-y-2">
                  <p className="text-destructive" role="alert">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    aria-label="重试"
                    className={btnPrimary}
                  >
                    {generating ? "生成中…" : "重试"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

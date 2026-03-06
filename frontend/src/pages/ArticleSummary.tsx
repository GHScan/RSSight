import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { SummaryProfile } from "../api/types";
import { api } from "../api/client";
import { MarkdownContent } from "../components/MarkdownContent";
import { BackLink } from "../components/BackLink";

export function ArticleSummary() {
  const { feedId, articleId } = useParams<{ feedId: string; articleId: string }>();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SummaryProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  useEffect(() => {
    if (!feedId || !articleId) return;
    api
      .getArticles(feedId)
      .then((list) => {
        const a = list.find((x) => x.id === articleId);
        setArticleTitle(a ? (a.title_trans ?? a.title) : null);
      })
      .catch(() => setArticleTitle(null));
  }, [feedId, articleId]);

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

  const handleDelete = async () => {
    if (!feedId || !articleId || !selectedProfile) return;
    if (!window.confirm("确认删除该摘要？")) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteSummary(feedId, articleId, selectedProfile);
      setSummary(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  if (!feedId || !articleId) return <p className="max-w-4xl mx-auto px-4 py-6 text-muted-foreground">缺少参数</p>;

  const btnPrimary =
    "inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-base font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-4">
        <BackLink to={`/feeds/${feedId}/articles`} aria-label="返回文章列表" />
        <h1 className="text-2xl font-semibold text-foreground">文章摘要</h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        {articleTitle && (
        <p className="text-lg font-medium text-foreground mb-4 break-words border-b border-border pb-3">
          {articleTitle}
        </p>
      )}
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
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating}
                      aria-label="重新生成"
                      className={btnPrimary}
                    >
                      {generating ? "生成中…" : "重新生成"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      aria-label="删除摘要"
                      className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-5 py-2.5 rounded-lg border border-border bg-background text-foreground text-base font-medium hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                    >
                      {deleting ? "删除中…" : "删除"}
                    </button>
                  </div>
                  <div data-testid="summary-content" className="mt-4">
                    <MarkdownContent content={summary} />
                  </div>
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
      </div>
    </main>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { SummaryProfile } from "../api/types";
import { api } from "../api/client";
import { MarkdownContent } from "../components/MarkdownContent";
import { BackLink } from "../components/BackLink";

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

/** 有当前文章摘要的配置按 generated_at 降序，无摘要的按 last_used_at 降序。 */
function sortProfilesForArticle(
  profiles: SummaryProfile[],
  meta: Array<{ profile_name: string; generated_at: string }>,
): SummaryProfile[] {
  const metaByProfile = Object.fromEntries(meta.map((m) => [m.profile_name, m]));
  const ts = (p: SummaryProfile): number => {
    const m = metaByProfile[p.name];
    if (m) return new Date(m.generated_at).getTime();
    const u = p.last_used_at;
    return u ? new Date(u).getTime() : 0;
  };
  const hasSummary = (p: SummaryProfile): boolean => p.name in metaByProfile;
  return [...profiles].sort((a, b) => {
    const hasA = hasSummary(a);
    const hasB = hasSummary(b);
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return ts(b) - ts(a);
  });
}

export function ArticleSummary() {
  const { feedId, articleId } = useParams<{ feedId: string; articleId: string }>();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [articleLink, setArticleLink] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SummaryProfile[]>([]);
  const [summaryMeta, setSummaryMeta] = useState<Array<{ profile_name: string; generated_at: string }>>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [inReadLater, setInReadLater] = useState(false);
  const [loadingReadLater, setLoadingReadLater] = useState(true);
  const [togglingReadLater, setTogglingReadLater] = useState(false);

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
      .getArticleSummaryMeta(feedId, articleId)
      .then(setSummaryMeta)
      .catch(() => setSummaryMeta([]));
  }, [feedId, articleId]);

  useEffect(() => {
    if (!feedId || !articleId) return;
    api
      .getArticles(feedId)
      .then((list) => {
        const a = list.find((x) => x.id === articleId);
        setArticleTitle(a ? (a.title_trans ?? a.title) : null);
        setArticleLink(a?.link ?? null);
      })
      .catch(() => {
        setArticleTitle(null);
        setArticleLink(null);
      });
  }, [feedId, articleId]);

  useEffect(() => {
    if (!feedId || !articleId) return;
    setLoadingReadLater(true);
    api
      .getReadLaterCheck(feedId, articleId)
      .then((res) => setInReadLater(res.in_read_later))
      .catch(() => setInReadLater(false))
      .finally(() => setLoadingReadLater(false));
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

  const sortedProfiles = useMemo(
    () => sortProfilesForArticle(profiles, summaryMeta),
    [profiles, summaryMeta],
  );

  useEffect(() => {
    if (selectedProfile) loadSummary();
    else {
      setSummary(null);
      setError(null);
    }
  }, [selectedProfile, loadSummary]);

  const refreshSummaryMeta = useCallback(() => {
    if (!feedId || !articleId) return;
    api.getArticleSummaryMeta(feedId, articleId).then(setSummaryMeta).catch(() => setSummaryMeta([]));
  }, [feedId, articleId]);

  const handleGenerate = async () => {
    if (!feedId || !articleId || !selectedProfile) return;
    setGenerating(true);
    setError(null);
    try {
      const text = await api.generateSummary(feedId, articleId, selectedProfile);
      setSummary(text);
      refreshSummaryMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleReadLaterToggle = async () => {
    if (!feedId || !articleId) return;
    setTogglingReadLater(true);
    try {
      if (inReadLater) {
        await api.removeReadLater(feedId, articleId);
        setInReadLater(false);
      } else {
        await api.addReadLater(feedId, articleId);
        setInReadLater(true);
      }
    } finally {
      setTogglingReadLater(false);
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
      refreshSummaryMeta();
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
        <BackLink useHistory aria-label="返回上一页" />
        <h1 className="text-2xl font-semibold text-foreground">文章摘要</h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        {articleTitle && (
        <div className="flex flex-wrap items-center gap-3 mb-4 border-b border-border pb-3">
          <p className="text-xl font-serif font-semibold text-foreground tracking-tight break-words flex-1 min-w-0">
            {articleLink ? (
              <a
                href={articleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-90 decoration-2"
              >
                {articleTitle}
              </a>
            ) : (
              articleTitle
            )}
          </p>
          {!loadingReadLater && (
            <button
              type="button"
              onClick={handleReadLaterToggle}
              disabled={togglingReadLater}
              aria-label={inReadLater ? "从待读移除" : "加入待读"}
              className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 ${
                inReadLater
                  ? "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-green-500/60 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
              }`}
            >
              {inReadLater ? (
                <>
                  <MinusIcon />
                  <span>待读</span>
                </>
              ) : (
                <>
                  <PlusIcon />
                  <span>待读</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      {loadingProfiles && <p className="text-muted-foreground">加载中…</p>}
      {!loadingProfiles && profiles.length === 0 && (
        <p className="text-muted-foreground">暂无摘要配置，请先在摘要配置页添加。</p>
      )}
      {!loadingProfiles && profiles.length > 0 && (
        <div className="space-y-4">
          <select
            id="summary-profile"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            aria-label="摘要配置"
            className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">请选择摘要配置</option>
            {sortedProfiles.map((p) => (
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

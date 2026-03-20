/**
 * API client for backend REST API. Kept separate from UI for testability.
 */

import type {
  Feed,
  Article,
  ArticleDetail,
  SummaryProfile,
  ApiError,
  ApiErrorDetail,
  CustomArticleCreatePayload,
  ReadLaterItemWithTitle,
} from "./types";

const BASE = "/api";

function buildErrorMessage(status: number, statusText: string, body: ApiError): string {
  const parts: string[] = [`${status} ${statusText}`];
  let msg = body?.message ?? "";
  const detail = body?.detail;
  if (typeof detail === "object" && detail !== null && "message" in detail) {
    const obj = detail as ApiErrorDetail;
    if (obj.message) msg = obj.message;
  }
  if (msg) parts.push(msg);
  if (!msg && (status === 502 || status === 503))
    parts.push("后端未启动或无法连接，请确认已运行 scripts\\start.cmd 或后端在 127.0.0.1:8000 可访问");
  const detailStr = typeof detail === "string" ? detail.trim() : "";
  if (detailStr) parts.push("\n" + detailStr);
  return parts.join(": ");
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    const message = buildErrorMessage(res.status, res.statusText || "Request failed", body);
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getFeeds(): Promise<Feed[]> {
    return fetch(`${BASE}/feeds`).then(handleResponse<Feed[]>);
  },
  createFeed(body: { title: string; url: string }): Promise<Feed> {
    return fetch(`${BASE}/feeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<Feed>);
  },
  createVirtualFeed(name: string): Promise<Feed> {
    return fetch(`${BASE}/feeds/virtual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(handleResponse<Feed>);
  },
  updateFeed(feedId: string, body: { title?: string; url?: string }): Promise<Feed> {
    return fetch(`${BASE}/feeds/${feedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<Feed>);
  },
  deleteFeed(feedId: string): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}`, { method: "DELETE" }).then(handleResponse<void>);
  },
  getFeed(feedId: string): Promise<Feed> {
    return fetch(`${BASE}/feeds/${feedId}`).then(handleResponse<Feed>);
  },
  getArticles(feedId: string): Promise<Article[]> {
    return fetch(`${BASE}/feeds/${feedId}/articles`).then(handleResponse<Article[]>);
  },
  getArticle(feedId: string, articleId: string): Promise<ArticleDetail> {
    return fetch(`${BASE}/feeds/${feedId}/articles/${encodeURIComponent(articleId)}`).then(handleResponse<ArticleDetail>);
  },
  /** Re-fetch RSS for this feed and persist articles; then use getArticles to refresh list. */
  refreshFeed(feedId: string): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}/refresh`, { method: "POST" }).then(handleResponse<void>);
  },
  setArticleFavorite(feedId: string, articleId: string, favorite: boolean): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}/articles/${articleId}/favorite`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    }).then(handleResponse<void>);
  },
  /** Extract title, description, published_at from URL for form prefill (no article created). */
  extractUrlMetadata(url: string): Promise<{ title?: string | null; description?: string | null; published_at?: string | null }> {
    return fetch(`${BASE}/feeds/extract-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    }).then(handleResponse<{ title?: string | null; description?: string | null; published_at?: string | null }>);
  },
  createCustomArticle(feedId: string, payload: CustomArticleCreatePayload): Promise<Article> {
    return fetch(`${BASE}/feeds/${feedId}/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        link: payload.link ?? "",
        description: payload.description ?? "",
        published_at: payload.published_at,
        source: payload.source ?? null,
      }),
    }).then(handleResponse<Article>);
  },
  deleteArticle(feedId: string, articleId: string): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}/articles/${encodeURIComponent(articleId)}`, {
      method: "DELETE",
    }).then(handleResponse<void>);
  },
  getSummaryProfiles(): Promise<SummaryProfile[]> {
    return fetch(`${BASE}/summary-profiles`).then(handleResponse<SummaryProfile[]>);
  },
  createSummaryProfile(profile: Omit<SummaryProfile, "name"> & { name: string }): Promise<SummaryProfile> {
    return fetch(`${BASE}/summary-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }).then(handleResponse<SummaryProfile>);
  },
  updateSummaryProfile(profileName: string, body: Partial<SummaryProfile>): Promise<SummaryProfile> {
    return fetch(`${BASE}/summary-profiles/${encodeURIComponent(profileName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<SummaryProfile>);
  },
  deleteSummaryProfile(profileName: string): Promise<void> {
    return fetch(`${BASE}/summary-profiles/${encodeURIComponent(profileName)}`, {
      method: "DELETE",
    }).then(handleResponse<void>);
  },
  /** List profiles that have a summary for this article, with generated_at (file mtime ISO). */
  getArticleSummaryMeta(
    feedId: string,
    articleId: string,
  ): Promise<Array<{ profile_name: string; generated_at: string }>> {
    return fetch(`${BASE}/feeds/${feedId}/articles/${articleId}/summaries`).then(handleResponse<Array<{ profile_name: string; generated_at: string }>>);
  },
  getSummary(feedId: string, articleId: string, profileName: string): Promise<string> {
    return fetch(
      `${BASE}/feeds/${feedId}/articles/${articleId}/summaries/${encodeURIComponent(profileName)}`,
    ).then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
      return res.text();
    });
  },
  generateSummary(feedId: string, articleId: string, profileName: string): Promise<string> {
    return fetch(
      `${BASE}/feeds/${feedId}/articles/${articleId}/summaries/${encodeURIComponent(profileName)}/generate`,
      { method: "POST" },
    ).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; detail?: { message?: string } };
        const msg = body.detail?.message ?? body.message ?? res.statusText;
        throw new Error(msg);
      }
      return res.text();
    });
  },
  deleteSummary(feedId: string, articleId: string, profileName: string): Promise<void> {
    return fetch(
      `${BASE}/feeds/${feedId}/articles/${articleId}/summaries/${encodeURIComponent(profileName)}`,
      { method: "DELETE" },
    ).then(handleResponse<void>);
  },
  /** List read-later items with resolved titles, newest first (S063). */
  getReadLaterList(): Promise<ReadLaterItemWithTitle[]> {
    return fetch(`${BASE}/read-later`).then(handleResponse<ReadLaterItemWithTitle[]>);
  },
  /** Check if article is in read-later (S061). */
  getReadLaterCheck(feedId: string, articleId: string): Promise<{ in_read_later: boolean }> {
    return fetch(
      `${BASE}/read-later/check?feed_id=${encodeURIComponent(feedId)}&article_id=${encodeURIComponent(articleId)}`,
    ).then(handleResponse<{ in_read_later: boolean }>);
  },
  addReadLater(feedId: string, articleId: string): Promise<void> {
    return fetch(`${BASE}/read-later`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feedId, article_id: articleId }),
    }).then(handleResponse<void>);
  },
  removeReadLater(feedId: string, articleId: string): Promise<void> {
    return fetch(
      `${BASE}/read-later/${encodeURIComponent(feedId)}/${encodeURIComponent(articleId)}`,
      { method: "DELETE" },
    ).then(handleResponse<void>);
  },
};

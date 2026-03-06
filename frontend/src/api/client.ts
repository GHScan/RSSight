/**
 * API client for backend REST API. Kept separate from UI for testability.
 */

import type { Feed, Article, SummaryProfile, ApiError, CustomArticleCreatePayload } from "./types";

const BASE = "/api";

function buildErrorMessage(status: number, statusText: string, body: ApiError): string {
  const parts: string[] = [`${status} ${statusText}`];
  const msg = body?.message ?? "";
  if (msg) parts.push(msg);
  if (!msg && (status === 502 || status === 503))
    parts.push("后端未启动或无法连接，请确认已运行 scripts\\start.cmd 或后端在 127.0.0.1:8000 可访问");
  const detail = typeof body?.detail === "string" ? body.detail.trim() : "";
  if (detail) parts.push("\n" + detail);
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
    return fetch(`${BASE}/feeds`).then(handleResponse);
  },
  createFeed(body: { title: string; url: string }): Promise<Feed> {
    return fetch(`${BASE}/feeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },
  createVirtualFeed(name: string): Promise<Feed> {
    return fetch(`${BASE}/feeds/virtual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(handleResponse);
  },
  updateFeed(feedId: string, body: { title?: string; url?: string }): Promise<Feed> {
    return fetch(`${BASE}/feeds/${feedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },
  deleteFeed(feedId: string): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}`, { method: "DELETE" }).then(handleResponse);
  },
  getFeed(feedId: string): Promise<Feed> {
    return fetch(`${BASE}/feeds/${feedId}`).then(handleResponse);
  },
  getArticles(feedId: string): Promise<Article[]> {
    return fetch(`${BASE}/feeds/${feedId}/articles`).then(handleResponse);
  },
  setArticleFavorite(feedId: string, articleId: string, favorite: boolean): Promise<void> {
    return fetch(`${BASE}/feeds/${feedId}/articles/${articleId}/favorite`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    }).then(handleResponse);
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
    }).then(handleResponse);
  },
  getSummaryProfiles(): Promise<SummaryProfile[]> {
    return fetch(`${BASE}/summary-profiles`).then(handleResponse);
  },
  createSummaryProfile(profile: Omit<SummaryProfile, "name"> & { name: string }): Promise<SummaryProfile> {
    return fetch(`${BASE}/summary-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }).then(handleResponse);
  },
  updateSummaryProfile(profileName: string, body: Partial<SummaryProfile>): Promise<SummaryProfile> {
    return fetch(`${BASE}/summary-profiles/${encodeURIComponent(profileName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },
  deleteSummaryProfile(profileName: string): Promise<void> {
    return fetch(`${BASE}/summary-profiles/${encodeURIComponent(profileName)}`, {
      method: "DELETE",
    }).then(handleResponse);
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
    ).then(handleResponse);
  },
};

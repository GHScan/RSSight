/**
 * API client for backend REST API. Kept separate from UI for testability.
 */

import type { Feed, Article, SummaryProfile, ApiError } from "./types";

const BASE = "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.message ?? res.statusText ?? "Request failed");
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
  getArticles(feedId: string): Promise<Article[]> {
    return fetch(`${BASE}/feeds/${feedId}/articles`).then(handleResponse);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
      return res.text();
    });
  },
};

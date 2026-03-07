/**
 * Shared types for API responses (aligned with backend).
 */

export type FeedType = "rss" | "virtual";

export interface Feed {
  id: string;
  title: string;
  /** URL for RSS feeds; null for virtual feeds (e.g. article favorites collection). */
  url: string | null;
  /** "rss" for normal feeds, "virtual" for collections; default "rss" when omitted. */
  feed_type?: FeedType;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  published: string;
  /** Translated title when available (e.g. from background translation profile). */
  title_trans?: string | null;
  favorite?: boolean;
  favorited_at?: string | null;
  /** Optional source metadata for custom articles. */
  source?: string | null;
}

/** Payload for creating a custom article under a virtual feed (S028). */
export interface CustomArticleCreatePayload {
  title: string;
  link?: string;
  description?: string;
  published_at: string;
  source?: string | null;
}

export interface SummaryProfile {
  name: string;
  base_url: string;
  key: string;
  model: string;
  fields: string[];
  prompt_template: string;
  /** e.g. "low" | "medium" | "high" for APIs that support reasoning.effort */
  reasoning_effort?: string | null;
  /** 最后使用时间（ISO 字符串），列表接口按此排序，最近使用的在前 */
  last_used_at?: string | null;
}

/** One read-later entry with resolved title (S063). S069: includes published for date/color marker. */
export interface ReadLaterItemWithTitle {
  feed_id: string;
  article_id: string;
  added_at: string;
  title: string;
  published: string;
}

/** FastAPI HTTPException returns detail as object with code/message/details. */
export interface ApiErrorDetail {
  code?: string;
  message?: string;
  details?: unknown;
}

export interface ApiError {
  code?: string;
  message?: string;
  /** Server-side: string (validation) or object (HTTPException detail). */
  detail?: string | ApiErrorDetail;
  details?: unknown;
}

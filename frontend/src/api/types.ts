/**
 * Shared types for API responses (aligned with backend).
 */

export interface Feed {
  id: string;
  title: string;
  url: string;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  published: string;
  /** Translated title when available (e.g. from background translation profile). */
  title_trans?: string | null;
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

export interface ApiError {
  code?: string;
  message?: string;
  /** Server-side traceback or extra debug info when WEBRSS_DEBUG=1 */
  detail?: string;
  details?: unknown;
}

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
}

export interface ApiError {
  code?: string;
  message?: string;
  /** Server-side traceback or extra debug info when WEBRSS_DEBUG=1 */
  detail?: string;
  details?: unknown;
}

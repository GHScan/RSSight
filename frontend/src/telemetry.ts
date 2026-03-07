/**
 * Lightweight telemetry for page views and nav entry clicks.
 * S049: Distinguishes events between RSS订阅 (rss_subscriptions) and 文章收藏 (article_favorites).
 * Replace or extend send() to integrate with analytics backends.
 */

export type NavEntry = "rss_subscriptions" | "article_favorites" | "summary_settings";

export type PageDomain =
  | "home"
  | "rss_subscriptions"
  | "article_favorites"
  | "summary_settings"
  | "article_list"
  | "article_summary";

export type TelemetryEvent =
  | { type: "entry_click"; entry: NavEntry }
  | { type: "page_view"; page: PageDomain };

function send(event: TelemetryEvent): void {
  if (typeof window === "undefined") return;
  // Development: log for debugging. Production: replace with analytics backend.
  if (import.meta.env?.DEV) {
    console.debug("[telemetry]", event.type, event);
  }
  // Future: window.gtag?.("event", event.type, { ...event });
}

export function trackEntryClick(entry: NavEntry): void {
  send({ type: "entry_click", entry });
}

export function trackPageView(page: PageDomain): void {
  send({ type: "page_view", page });
}

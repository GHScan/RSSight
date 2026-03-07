import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavLink } from "../components/NavLink";
import { api } from "../api/client";
import type { ReadLaterItemWithTitle } from "../api/types";
import { trackEntryClick } from "../telemetry";
import { formatYearMonth, getDateWrapClass } from "../utils/dateDisplay";

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Home() {
  const [readLaterList, setReadLaterList] = useState<ReadLaterItemWithTitle[]>([]);

  useEffect(() => {
    api
      .getReadLaterList()
      .then(setReadLaterList)
      .catch(() => setReadLaterList([]));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-foreground">RSSight</h1>
        <Link
          to="/profiles"
          onClick={() => trackEntryClick("summary_settings")}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="摘要设置"
        >
          <SettingsIcon className="shrink-0" />
          <span>摘要设置</span>
        </Link>
      </header>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <nav className="flex flex-wrap gap-3" aria-label="主导航">
          <NavLink to="/feeds" onClick={() => trackEntryClick("rss_subscriptions")}>
            RSS 订阅
          </NavLink>
          <NavLink to="/favorites" onClick={() => trackEntryClick("article_favorites")}>
            文章收藏
          </NavLink>
        </nav>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background p-4 sm:p-5">
        <h2 className="text-lg font-medium text-foreground mb-3">待读</h2>
        {readLaterList.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无待读文章</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {readLaterList.map((item) => (
              <li
                key={`${item.feed_id}-${item.article_id}`}
                className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"
              >
                <div
                  className={`shrink-0 flex items-center gap-2 rounded-md border-l-4 py-0.5 pl-2 pr-2 min-w-[6rem] ${getDateWrapClass(item.published)}`}
                  aria-hidden
                  title={formatYearMonth(item.published)}
                >
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatYearMonth(item.published)}
                  </span>
                </div>
                <Link
                  to={`/feeds/${item.feed_id}/articles/${item.article_id}`}
                  className="text-sm text-foreground no-underline hover:underline flex-1 min-w-0 break-words text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

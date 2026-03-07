import { NavLink } from "../components/NavLink";
import { trackEntryClick } from "../telemetry";

export function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">RSSight</h1>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <nav className="flex flex-wrap gap-3" aria-label="主导航">
          <NavLink to="/feeds" onClick={() => trackEntryClick("rss_subscriptions")}>
            RSS 订阅
          </NavLink>
          <NavLink to="/favorites" onClick={() => trackEntryClick("article_favorites")}>
            文章收藏
          </NavLink>
          <NavLink to="/profiles" onClick={() => trackEntryClick("summary_settings")}>
            摘要设置
          </NavLink>
        </nav>
      </div>
    </main>
  );
}

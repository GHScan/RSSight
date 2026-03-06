import { NavLink } from "../components/NavLink";

export function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">RSSight</h1>
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <nav className="flex flex-wrap gap-3">
          <NavLink to="/feeds">RSS 订阅</NavLink>
          <NavLink to="/profiles">摘要配置</NavLink>
        </nav>
      </div>
    </main>
  );
}

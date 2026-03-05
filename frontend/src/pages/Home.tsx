import { NavLink } from "../components/NavLink";

export function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">WebRSSReader</h1>
      <nav className="flex flex-wrap gap-3">
        <NavLink to="/feeds">订阅管理</NavLink>
        <NavLink to="/profiles">摘要配置</NavLink>
      </nav>
    </main>
  );
}

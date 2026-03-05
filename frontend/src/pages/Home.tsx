import { Link } from "react-router-dom";

export function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-4">WebRSSReader</h1>
      <nav className="flex flex-wrap gap-4">
        <Link to="/feeds" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded">
          订阅管理
        </Link>
        <Link to="/profiles" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded">
          摘要配置
        </Link>
      </nav>
    </main>
  );
}

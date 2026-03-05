import { Link } from "react-router-dom";

export function Home() {
  return (
    <main>
      <h1>WebRSSReader</h1>
      <nav>
        <Link to="/feeds">订阅管理</Link>
        <Link to="/profiles">摘要配置</Link>
      </nav>
    </main>
  );
}

import { Link, useParams } from "react-router-dom";

export function ArticleSummary() {
  const { feedId, articleId } = useParams<{ feedId: string; articleId: string }>();

  if (!feedId || !articleId) return <p>缺少参数</p>;

  return (
    <main>
      <h1>文章摘要</h1>
      <nav>
        <Link to={`/feeds/${feedId}/articles`}>返回文章列表</Link>
      </nav>
      <p>订阅：{feedId}，文章：{articleId}</p>
    </main>
  );
}

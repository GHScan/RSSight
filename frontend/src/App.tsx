import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { FeedManagement } from "./pages/FeedManagement";
import { ArticleFavorites } from "./pages/ArticleFavorites";
import { ArticleList } from "./pages/ArticleList";
import { ArticleSummary } from "./pages/ArticleSummary";
import { SummaryProfiles } from "./pages/SummaryProfiles";

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/feeds" element={<FeedManagement />} />
      <Route path="/favorites" element={<ArticleFavorites />} />
      <Route path="/feeds/:feedId/articles" element={<ArticleList />} />
      <Route path="/feeds/:feedId/articles/:articleId" element={<ArticleSummary />} />
      <Route path="/profiles" element={<SummaryProfiles />} />
    </Routes>
    </div>
  );
}

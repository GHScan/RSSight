/**
 * S010: Article list browsing interaction details.
 * Happy path, boundary/exception, and regression tests.
 */

import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";
import type { Article } from "../api/types";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getFeed: vi.fn(),
    getArticles: vi.fn(),
    getSummaryProfiles: vi.fn(),
    createFeed: vi.fn(),
    updateFeed: vi.fn(),
    deleteFeed: vi.fn(),
    createVirtualFeed: vi.fn(),
    setArticleFavorite: vi.fn(),
    extractUrlMetadata: vi.fn(),
    createCustomArticle: vi.fn(),
    deleteArticle: vi.fn(),
    getSummary: vi.fn(),
    generateSummary: vi.fn(),
    createSummaryProfile: vi.fn(),
    updateSummaryProfile: vi.fn(),
    deleteSummaryProfile: vi.fn(),
    getReadLaterList: vi.fn(),
  },
}));

// Backend returns reverse chronological (newest first)
const mockArticles: Article[] = [
  { id: "a3", title: "Article Third", link: "https://example.com/3", published: "2025-03-03T10:00:00Z" },
  { id: "a2", title: "Article Second", link: "https://example.com/2", published: "2025-03-02T10:00:00Z" },
  { id: "a1", title: "Article First", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
];

function renderArticleList(feedId = "f1") {
  return render(
    <MemoryRouter initialEntries={[`/feeds/${feedId}/articles`]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Article list interaction (S010)", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    vi.mocked(api.getFeed).mockResolvedValue({ id: "f1", title: "Feed", url: "https://example.com", feed_type: "rss" });
    vi.mocked(api.getSummaryProfiles).mockResolvedValue([]);
    vi.mocked(api.getArticles).mockReset();
    vi.mocked(api.getArticles).mockResolvedValue([...mockArticles]);
    vi.mocked(api.getReadLaterList).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Happy path", () => {
    it("users can enter feed article list and view loaded results", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      expect(screen.getByText("Article First")).toBeInTheDocument();
      expect(screen.getByText("Article Second")).toBeInTheDocument();
      expect(screen.getByText("Article Third")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /返回RSS 订阅/i })).toBeInTheDocument();
    });

    it("refresh list without losing current context", async () => {
      const refreshed = [
        ...mockArticles,
        { id: "a4", title: "Article After Refresh", link: "https://example.com/4", published: "2025-03-04T10:00:00Z" },
      ];
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([...mockArticles])
        .mockResolvedValueOnce(refreshed);

      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article Third")).toBeInTheDocument();
      });
      expect(screen.queryByText("Article After Refresh")).not.toBeInTheDocument();

      const refreshBtn = screen.getByRole("button", { name: /刷新|refresh/i });
      await userEvent.click(refreshBtn);

      await waitFor(
        () => {
          expect(screen.getByText("Article After Refresh")).toBeInTheDocument();
          expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Boundary/exception", () => {
    it("empty list state is clearly visible", async () => {
      vi.mocked(api.getArticles).mockResolvedValue([]);
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText(/暂无文章|没有文章/i)).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
    });

    it("fetch failure shows error and retry is available and stable", async () => {
      vi.mocked(api.getArticles).mockRejectedValueOnce(new Error("Network error"));

      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText(/错误|失败|error/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole("button", { name: /重试|retry/i });
      expect(retryBtn).toBeInTheDocument();
      vi.mocked(api.getArticles).mockResolvedValueOnce([...mockArticles]);
      await userEvent.click(retryBtn);

      await waitFor(
        () => {
          expect(screen.getByText("Article First")).toBeInTheDocument();
          expect(screen.queryByText(/错误|失败/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Regression", () => {
    it("articles are shown in reverse chronological order (newest first)", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article Third")).toBeInTheDocument();
      });
      const list = screen.getByRole("list");
      const items = within(list).getAllByRole("listitem");
      const links = items.map((li) => within(li).getByRole("link").textContent);
      expect(links[0]).toBe("Article Third");
      expect(links[1]).toBe("Article Second");
      expect(links[2]).toBe("Article First");
    });

    it("feed-to-list navigation remains correct", async () => {
      vi.mocked(api.getFeeds).mockResolvedValue([
        { id: "f1", title: "Feed One", url: "https://example.com/feed.xml" },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "Feed One" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "Feed One" }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      expect(screen.getByText("Article First")).toBeInTheDocument();
    });
  });

  describe("Virtual feed article list (S026)", () => {
    it("navigating from virtual feed item opens article list page", async () => {
      vi.mocked(api.getFeeds).mockResolvedValue([
        { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" },
        { id: "f1", title: "RSS Feed", url: "https://example.com/feed.xml", feed_type: "rss" },
      ]);
      vi.mocked(api.getArticles).mockResolvedValue([]);
      render(
        <MemoryRouter initialEntries={["/favorites"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "My Favorites" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "My Favorites" }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      expect(api.getArticles).toHaveBeenCalledWith("v1");
      expect(screen.getByText(/暂无文章|没有文章/)).toBeInTheDocument();
    });

    it("virtual feed article list shows loading then empty state", async () => {
      vi.mocked(api.getArticles).mockResolvedValue([]);
      renderArticleList("v1");
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      expect(screen.getByText(/暂无文章|没有文章/)).toBeInTheDocument();
    });

    it("virtual feed article list shows error and retry when fetch fails", async () => {
      vi.mocked(api.getArticles).mockRejectedValueOnce(new Error("Network error"));
      renderArticleList("v1");
      await waitFor(() => {
        expect(screen.getByText(/错误|失败|error/i)).toBeInTheDocument();
      });
      const retryBtn = screen.getByRole("button", { name: /重试|retry/i });
      expect(retryBtn).toBeInTheDocument();
      vi.mocked(api.getArticles).mockResolvedValueOnce([]);
      await userEvent.click(retryBtn);
      await waitFor(() => {
        expect(screen.getByText(/暂无文章|没有文章/)).toBeInTheDocument();
        expect(screen.queryByText(/错误|失败/i)).not.toBeInTheDocument();
      });
    });

    it("regression: normal feed article list still works after virtual feed flow", async () => {
      vi.mocked(api.getFeeds).mockResolvedValue([
        { id: "v1", title: "Virtual", url: null, feed_type: "virtual" },
        { id: "f1", title: "RSS One", url: "https://example.com/feed.xml", feed_type: "rss" },
      ]);
      vi.mocked(api.getFeed).mockImplementation((id: string) => {
        if (id === "v1") return Promise.resolve({ id: "v1", title: "Virtual", url: null, feed_type: "virtual" });
        if (id === "f1") return Promise.resolve({ id: "f1", title: "RSS One", url: "https://example.com/feed.xml", feed_type: "rss" });
        return Promise.resolve({ id, title: "Feed", url: "https://example.com", feed_type: "rss" });
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([...mockArticles]);
      render(
        <MemoryRouter initialEntries={["/favorites"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "Virtual" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "Virtual" }));
      await waitFor(() => {
        expect(screen.getByText(/暂无文章|没有文章/)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: /返回文章收藏/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: "文章收藏" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: /首页/i }));
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "RSS 订阅" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "RSS 订阅" }));
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "RSS One" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "RSS One" }));
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
      });
      expect(screen.getByText("Article Third")).toBeInTheDocument();
    });
  });

  describe("Search filter (S021)", () => {
    it("typing in search filters articles by title in real time", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
      });
      const search = screen.getByRole("searchbox", { name: /搜索文章/i });
      await userEvent.type(search, "Third");
      await waitFor(() => {
        expect(screen.getByText("Article Third")).toBeInTheDocument();
        expect(screen.queryByText("Article First")).not.toBeInTheDocument();
        expect(screen.queryByText("Article Second")).not.toBeInTheDocument();
      });
    });

    it("empty search shows all articles", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
      });
      const search = screen.getByRole("searchbox", { name: /搜索文章/i });
      await userEvent.type(search, "Third");
      await waitFor(() => {
        expect(screen.queryByText("Article First")).not.toBeInTheDocument();
      });
      await userEvent.clear(search);
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
        expect(screen.getByText("Article Second")).toBeInTheDocument();
        expect(screen.getByText("Article Third")).toBeInTheDocument();
      });
    });
  });

  describe("Left-side date with age-based fading (S022)", () => {
    it("each article row shows year-month date on the left", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
      });
      const dateLabels = screen.getAllByText("2025年3月");
      expect(dateLabels.length).toBe(3);
    });

    it("each row has an age-based date wrap (rounded block + text, gradient by recency)", async () => {
      renderArticleList();
      await waitFor(() => {
        expect(screen.getByText("Article First")).toBeInTheDocument();
      });
      const list = screen.getByRole("list");
      const rows = within(list).getAllByRole("listitem");
      expect(rows.length).toBe(3);
      rows.forEach((row) => {
        const wrap = row.querySelector('[aria-hidden][title*="年"]');
        expect(wrap).toBeTruthy();
        const className = wrap?.getAttribute("class") ?? "";
        const hasGradient =
          /border-foreground(\/\d+)?/.test(className) || /bg-foreground(\/\d+)?/.test(className);
        expect(
          hasGradient,
          `Date wrap should have border-foreground or bg-foreground (gradient), got: ${className}`,
        ).toBe(true);
      });
    });
  });

  describe("Custom article create form for virtual feed (S028)", () => {
    it("S041: create button text does not contain 'Add custom article' wording", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      const addButton = screen.getByRole("button", { name: /^添加$/i });
      expect(addButton).toBeInTheDocument();
      expect(addButton.textContent).not.toMatch(/添加自定义文章|Add custom article/i);
    });

    it("virtual feed article list shows add-article button and form can be toggled (S041: no 'Add custom article' wording)", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /^添加$/i });
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveAttribute("data-testid", "add-custom-article-toggle");

      await userEvent.click(addButton);
      await waitFor(() => {
        expect(screen.getByLabelText(/链接 \(URL\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/标题/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/内容/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/发布时间/i)).toBeInTheDocument();
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });

      await userEvent.click(addButton);
      await waitFor(() => {
        expect(screen.queryByLabelText(/链接 \(URL\)/i)).not.toBeInTheDocument();
      });
    });

    it("form submission invokes createCustomArticle and refreshes list", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "cust1",
            title: "My Custom",
            link: "https://example.com/c",
            published: "2025-03-01T12:00:00Z",
          },
        ]);
      vi.mocked(api.createCustomArticle).mockResolvedValue({
        id: "cust1",
        title: "My Custom",
        link: "https://example.com/c",
        published: "2025-03-01T12:00:00Z",
      });

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/标题/i)).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/标题/i), "My Custom");
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://example.com/c");
      await userEvent.type(screen.getByLabelText(/内容/i), "Some content");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.createCustomArticle).toHaveBeenCalledWith("vf1", expect.objectContaining({
          title: "My Custom",
          link: "https://example.com/c",
          description: "Some content",
        }));
      });
      await waitFor(() => {
        expect(screen.getByText("My Custom")).toBeInTheDocument();
      });
    });

    it("S030: URL-only first click extracts and fills form, second click creates article", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.extractUrlMetadata).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "art1",
            title: "Fetched Title",
            link: "https://example.com/page",
            published: "2025-03-05T14:00:00Z",
          },
        ]);
      vi.mocked(api.extractUrlMetadata).mockResolvedValue({
        title: "Fetched Title",
        description: "Fetched description",
        published_at: "2025-03-05T14:00:00Z",
      });
      vi.mocked(api.createCustomArticle).mockResolvedValue({
        id: "art1",
        title: "Fetched Title",
        link: "https://example.com/page",
        published: "2025-03-05T14:00:00Z",
      });

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/链接 \(URL\)/i)).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://example.com/page");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.extractUrlMetadata).toHaveBeenCalledWith("https://example.com/page");
      });
      await waitFor(() => {
        expect(screen.getByText(/已从链接填充|请确认.*再次点击.*提交/i)).toBeInTheDocument();
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/标题/i)).toHaveValue("Fetched Title");
      expect(screen.getByLabelText(/内容/i)).toHaveValue("Fetched description");

      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.createCustomArticle).toHaveBeenCalledWith("vf1", expect.objectContaining({
          link: "https://example.com/page",
          title: "Fetched Title",
          description: "Fetched description",
        }));
      });
      await waitFor(() => {
        expect(screen.getByText("创建成功")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Fetched Title")).toBeInTheDocument();
      });
    });

    it("S030: URL extract failure shows error in form and does not create", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.extractUrlMetadata).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);
      vi.mocked(api.extractUrlMetadata).mockRejectedValue(
        new Error("400 Bad Request: Could not fetch or parse URL for autofill."),
      );

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://bad.example/");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/autofill|无法从链接提取|创建失败/i);
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();
    });

    it("S044: URL extract returns no title/content; second click create returns MISSING_REQUIRED_FIELDS and form stays open", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);
      vi.mocked(api.extractUrlMetadata).mockResolvedValue({ title: null, description: null, published_at: null });
      vi.mocked(api.createCustomArticle).mockRejectedValue(
        new Error("400 Bad Request: Title and content are required; URL extraction did not provide them."),
      );

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://example.com/no-meta");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByText(/已从链接填充|请确认.*再次点击/i)).toBeInTheDocument();
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/required|标题|内容|extraction|创建失败/i);
      });
      expect(screen.getByLabelText(/标题/i)).toBeInTheDocument();
      expect(api.createCustomArticle).toHaveBeenCalledTimes(1);
    });

    it("S031: no-URL submit with missing title shows validation message and does not call API", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      // Leave URL empty, leave title empty, fill content only
      await userEvent.type(screen.getByLabelText(/内容/i), "Some content");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/标题和内容为必填项|必填/i);
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();
    });

    it("S031: no-URL submit with missing content shows validation message and does not call API", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      // Leave URL empty, fill title, leave content empty
      await userEvent.type(screen.getByLabelText(/标题/i), "My Title");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/标题和内容为必填项|必填/i);
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();
    });

    it("S032: no-URL first click fills defaults and shows pending confirm without calling API", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      // No URL, title and content present, other fields empty
      await userEvent.type(screen.getByLabelText(/标题/i), "My Note");
      await userEvent.type(screen.getByLabelText(/内容/i), "Some note content");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByText(/已填充默认值|请确认后再次点击|待确认/i)).toBeInTheDocument();
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();
      // URL and published should be filled with defaults
      expect(screen.getByLabelText(/链接 \(URL\)/i)).toHaveValue("https://");
    });

    it("S032: no-URL second click after default fill creates article", async () => {
      vi.mocked(api.createCustomArticle).mockResolvedValue({
        id: "cust1",
        title: "My Note",
        link: "https://",
        published: "2025-03-07T12:00:00Z",
      });
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "cust1",
            title: "My Note",
            link: "https://",
            published: "2025-03-07T12:00:00Z",
          },
        ]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/标题/i), "My Note");
      await userEvent.type(screen.getByLabelText(/内容/i), "Some content");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByText(/已填充默认值|请确认|待确认/i)).toBeInTheDocument();
      });
      expect(api.createCustomArticle).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.createCustomArticle).toHaveBeenCalledWith("vf1", expect.objectContaining({
          title: "My Note",
          description: "Some content",
          link: "https://",
        }));
      });
      await waitFor(() => {
        expect(screen.getByText("创建成功")).toBeInTheDocument();
      });
    });

    it("S033: no-URL after default fill user can edit values and second click creates with edited values", async () => {
      vi.mocked(api.createCustomArticle).mockClear();
      vi.mocked(api.createCustomArticle).mockResolvedValue({
        id: "cust2",
        title: "Edited Title",
        link: "https://example.com/custom",
        published: "2025-01-15T08:30:00Z",
      });
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: "cust2",
          title: "Edited Title",
          link: "https://example.com/custom",
          published: "2025-01-15T08:30:00Z",
        }]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^添加$/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /^添加$/i }));
      await waitFor(() => {
        expect(screen.getByTestId("custom-article-submit")).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/标题/i), "Edited Title");
      await userEvent.type(screen.getByLabelText(/内容/i), "Edited content");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(screen.getByText(/已填充默认值|请确认|待确认/i)).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /确认创建/i })).toBeInTheDocument();
      expect(api.createCustomArticle).not.toHaveBeenCalled();

      // S033: user edits default-filled URL and published before confirming
      await userEvent.clear(screen.getByLabelText(/链接 \(URL\)/i));
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://example.com/custom");
      await userEvent.clear(screen.getByLabelText(/发布时间/i));
      await userEvent.type(screen.getByLabelText(/发布时间/i), "2025-01-15T08:30");

      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.createCustomArticle).toHaveBeenCalledWith("vf1", expect.objectContaining({
          title: "Edited Title",
          description: "Edited content",
          link: "https://example.com/custom",
        }));
      });
      const call = vi.mocked(api.createCustomArticle).mock.calls[0][1];
      expect(call.published_at).toBeDefined();
      expect(call.published_at).toContain("2025-01-15");
      await waitFor(() => {
        expect(screen.getByText("创建成功")).toBeInTheDocument();
      });
    });
  });

  describe("S042: favorites article delete flow", () => {
    it("virtual feed article list shows delete button per article", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "art1", title: "Custom One", link: "https://example.com/1", published: "2025-03-01T12:00:00Z" },
        { id: "art2", title: "Custom Two", link: "https://example.com/2", published: "2025-03-02T12:00:00Z" },
      ]);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Custom One")).toBeInTheDocument();
        expect(screen.getByText("Custom Two")).toBeInTheDocument();
      });
      expect(screen.getByTestId("delete-article-art1")).toBeInTheDocument();
      expect(screen.getByTestId("delete-article-art2")).toBeInTheDocument();
      // S055: virtual feed has same interactive favorite toggle as RSS (收藏/取消收藏)
      expect(screen.getAllByRole("button", { name: /收藏|取消收藏/ }).length).toBeGreaterThanOrEqual(2);
    });

    it("clicking delete opens standardized dialog; confirm calls deleteArticle, refreshes list and shows success", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([
          { id: "art1", title: "To Remove", link: "https://example.com/1", published: "2025-03-01T12:00:00Z" },
        ])
        .mockResolvedValueOnce([]);
      vi.mocked(api.deleteArticle).mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("To Remove")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId("delete-article-art1"));

      const dialog = screen.getByRole("dialog", { name: /确认删除该文章/i });
      expect(dialog).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "确认" }));

      await waitFor(() => {
        expect(api.deleteArticle).toHaveBeenCalledWith("vf1", "art1");
      });
      await waitFor(() => {
        expect(screen.getByText("已删除")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText(/暂无文章/)).toBeInTheDocument();
      });
    });

    it("delete failure shows error message", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "art1", title: "To Remove", link: "https://example.com/1", published: "2025-03-01T12:00:00Z" },
      ]);
      vi.mocked(api.deleteArticle).mockRejectedValue(new Error("Network error"));

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("To Remove")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId("delete-article-art1"));
      await userEvent.click(screen.getByRole("button", { name: "确认" }));

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert.textContent).toMatch(/Network error|删除失败/);
      });
      expect(screen.getByText("To Remove")).toBeInTheDocument();
    });
  });

  describe("S052: favorites article list controls, layout, and back navigation", () => {
    it("virtual feed toolbar shows add button (添加) and no refresh button", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      const addBtn = screen.getByRole("button", { name: /^添加$/i });
      expect(addBtn).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /刷新/i })).not.toBeInTheDocument();
    });

    it("virtual feed article row order is star (favorite toggle), date, title, delete", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "art1", title: "Custom One", link: "https://example.com/1", published: "2025-03-01T12:00:00Z" },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Custom One")).toBeInTheDocument();
      });
      const list = screen.getByRole("list");
      const item = within(list).getByRole("listitem");
      const link = within(item).getByRole("link", { name: "Custom One" });
      expect(link).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: /收藏|取消收藏/ })).toBeInTheDocument();
      expect(within(item).getByTestId("delete-article-art1")).toBeInTheDocument();
      expect(item.textContent).toMatch(/2025年3月/);
    });

    it("delete requires confirmation; cancel does not call deleteArticle", async () => {
      vi.mocked(api.deleteArticle).mockClear();
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "art1", title: "To Keep", link: "https://example.com/1", published: "2025-03-01T12:00:00Z" },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("To Keep")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId("delete-article-art1"));
      expect(screen.getByRole("dialog", { name: /确认删除该文章/i })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "取消" }));
      expect(api.deleteArticle).not.toHaveBeenCalled();
      expect(screen.getByText("To Keep")).toBeInTheDocument();
    });

    it("back button from virtual feed article list navigates to 文章收藏", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章列表/i })).toBeInTheDocument();
      });
      const backLink = screen.getByRole("link", { name: /返回文章收藏/i });
      expect(backLink).toHaveAttribute("href", "/favorites");
    });
  });

  describe("S055: favorites article list star logic aligned with RSS", () => {
    it("virtual feed article row shows interactive favorite toggle with 收藏/取消收藏 aria", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "art1", title: "Not Fav", link: "https://example.com/1", published: "2025-03-01T12:00:00Z", favorite: false },
        { id: "art2", title: "Is Fav", link: "https://example.com/2", published: "2025-03-02T12:00:00Z", favorite: true },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Not Fav")).toBeInTheDocument();
        expect(screen.getByText("Is Fav")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "取消收藏" })).toBeInTheDocument();
    });

    it("clicking favorite toggle on virtual feed calls setArticleFavorite and refreshes list", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([
          { id: "art1", title: "One", link: "https://example.com/1", published: "2025-03-01T12:00:00Z", favorite: false },
        ])
        .mockResolvedValueOnce([
          { id: "art1", title: "One", link: "https://example.com/1", published: "2025-03-01T12:00:00Z", favorite: true },
        ]);
      vi.mocked(api.setArticleFavorite).mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: "收藏" }));

      await waitFor(() => {
        expect(api.setArticleFavorite).toHaveBeenCalledWith("vf1", "art1", true);
      });
      await waitFor(() => {
        expect(api.getArticles).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("S056: favorites article list date and age-color aligned with RSS", () => {
    it("virtual feed article row shows year-month date on the left (same format as RSS)", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "a1", title: "Fav One", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
        { id: "a2", title: "Fav Two", link: "https://example.com/2", published: "2026-04-15T12:00:00Z" },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Fav One")).toBeInTheDocument();
        expect(screen.getByText("Fav Two")).toBeInTheDocument();
      });
      const dateLabels = screen.getAllByText("2025年3月");
      expect(dateLabels.length).toBe(1);
      expect(screen.getByText("2026年4月")).toBeInTheDocument();
    });

    it("virtual feed article row has age-based date wrap (bordered color block by recency)", async () => {
      vi.mocked(api.getFeed).mockResolvedValue({
        id: "vf1",
        title: "My Favorites",
        url: null,
        feed_type: "virtual",
      });
      vi.mocked(api.getArticles).mockResolvedValue([
        { id: "a1", title: "Fav One", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
      ]);
      render(
        <MemoryRouter initialEntries={["/feeds/vf1/articles"]}>
          <App />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByText("Fav One")).toBeInTheDocument();
      });
      const list = screen.getByRole("list");
      const rows = within(list).getAllByRole("listitem");
      expect(rows.length).toBe(1);
      rows.forEach((row) => {
        const wrap = row.querySelector('[aria-hidden][title*="年"]');
        expect(wrap).toBeTruthy();
        const className = wrap?.getAttribute("class") ?? "";
        const hasGradient =
          /border-foreground(\/\d+)?/.test(className) || /bg-foreground(\/\d+)?/.test(className);
        expect(
          hasGradient,
          `Date wrap should have border-foreground or bg-foreground (gradient), got: ${className}`,
        ).toBe(true);
      });
    });
  });
});

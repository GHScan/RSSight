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
    createCustomArticle: vi.fn(),
    getSummary: vi.fn(),
    generateSummary: vi.fn(),
    createSummaryProfile: vi.fn(),
    updateSummaryProfile: vi.fn(),
    deleteSummaryProfile: vi.fn(),
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
        <MemoryRouter initialEntries={["/feeds"]}>
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
      vi.mocked(api.getArticles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([...mockArticles]);
      render(
        <MemoryRouter initialEntries={["/feeds"]}>
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
      await userEvent.click(screen.getByRole("link", { name: /返回RSS 订阅/ }));
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
    it("virtual feed article list shows Add custom article button and form can be toggled", async () => {
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

      const addButton = screen.getByRole("button", { name: /添加自定义文章/i });
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
        expect(screen.getByRole("button", { name: /添加自定义文章/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /添加自定义文章/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/标题/i)).toBeInTheDocument();
      });
      await userEvent.type(screen.getByLabelText(/标题/i), "My Custom");
      await userEvent.type(screen.getByLabelText(/链接 \(URL\)/i), "https://example.com/c");
      await userEvent.click(screen.getByTestId("custom-article-submit"));

      await waitFor(() => {
        expect(api.createCustomArticle).toHaveBeenCalledWith("vf1", expect.objectContaining({
          title: "My Custom",
          link: "https://example.com/c",
        }));
      });
      await waitFor(() => {
        expect(screen.getByText("My Custom")).toBeInTheDocument();
      });
    });
  });
});

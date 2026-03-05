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
    getArticles: vi.fn(),
    getSummaryProfiles: vi.fn(),
    createFeed: vi.fn(),
    updateFeed: vi.fn(),
    deleteFeed: vi.fn(),
    setArticleFavorite: vi.fn(),
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
      expect(screen.getByRole("link", { name: /返回订阅管理/i })).toBeInTheDocument();
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
});

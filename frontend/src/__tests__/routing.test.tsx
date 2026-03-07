import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";
import * as telemetry from "../telemetry";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getFeed: vi.fn(),
    getSummaryProfiles: vi.fn(),
    getArticles: vi.fn(),
    getReadLaterList: vi.fn(),
    getArticleSummaryMeta: vi.fn(),
    getReadLaterCheck: vi.fn(),
    getSummary: vi.fn(),
    removeReadLater: vi.fn(),
  },
}));

vi.mock("../telemetry", () => ({
  trackEntryClick: vi.fn(),
  trackPageView: vi.fn(),
}));

function renderWithRouter(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

describe("Routing and page structure", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    vi.mocked(api.getSummaryProfiles).mockResolvedValue([]);
    vi.mocked(api.getReadLaterList).mockResolvedValue([]);
  });

  it("shows feed management page at /feeds", async () => {
    renderWithRouter(["/feeds"]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "添加 Feed" })).toBeInTheDocument();
    });
  });

  it("shows summary profile page at /profiles", async () => {
    renderWithRouter(["/profiles"]);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /摘要配置|Summary profile|配置/i }),
      ).toBeInTheDocument();
    });
  });

  it("navigates to feeds from home via link", async () => {
    renderWithRouter(["/"]);
    await userEvent.click(screen.getByRole("link", { name: /订阅|Feeds/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "添加 Feed" })).toBeInTheDocument();
    });
  });

  it("navigates to profiles from home via link", async () => {
    renderWithRouter(["/"]);
    await userEvent.click(screen.getByRole("link", { name: "摘要设置" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /摘要配置|Summary profile|配置/i }),
      ).toBeInTheDocument();
    });
  });

  it("S046: home shows two top-level nav entries (RSS订阅, 文章收藏) and 摘要设置 in header", () => {
    renderWithRouter(["/"]);
    const links = screen.getAllByRole("link");
    const navLinks = links.filter((l) => ["/feeds", "/favorites"].includes(l.getAttribute("href") ?? ""));
    expect(navLinks).toHaveLength(2);
    expect(navLinks[0]).toHaveTextContent("RSS 订阅");
    expect(navLinks[0]).toHaveAttribute("href", "/feeds");
    expect(navLinks[1]).toHaveTextContent("文章收藏");
    expect(navLinks[1]).toHaveAttribute("href", "/favorites");
    const summarySettingsLink = screen.getByRole("link", { name: "摘要设置" });
    expect(summarySettingsLink).toHaveAttribute("href", "/profiles");
  });

  it("S046: shows article favorites page at /favorites", async () => {
    renderWithRouter(["/favorites"]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "文章收藏" })).toBeInTheDocument();
    });
  });

  it("S046: navigating to article favorites from home via link", async () => {
    renderWithRouter(["/"]);
    await userEvent.click(screen.getByRole("link", { name: "文章收藏" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "文章收藏" })).toBeInTheDocument();
    });
  });

  describe("S049: page split regression and telemetry", () => {
    beforeEach(() => {
      vi.mocked(telemetry.trackEntryClick).mockClear();
      vi.mocked(telemetry.trackPageView).mockClear();
    });

    it("S049: visiting /feeds emits page_view for rss_subscriptions", async () => {
      renderWithRouter(["/feeds"]);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "添加 Feed" })).toBeInTheDocument();
      });
      expect(telemetry.trackPageView).toHaveBeenCalledWith("rss_subscriptions");
    });

    it("S049: visiting /favorites emits page_view for article_favorites", async () => {
      renderWithRouter(["/favorites"]);
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: "文章收藏" })).toBeInTheDocument();
      });
      expect(telemetry.trackPageView).toHaveBeenCalledWith("article_favorites");
    });

    it("S049: clicking RSS 订阅 on home emits entry_click rss_subscriptions", async () => {
      renderWithRouter(["/"]);
      await userEvent.click(screen.getByRole("link", { name: "RSS 订阅" }));
      expect(telemetry.trackEntryClick).toHaveBeenCalledWith("rss_subscriptions");
    });

    it("S049: clicking 文章收藏 on home emits entry_click article_favorites", async () => {
      renderWithRouter(["/"]);
      await userEvent.click(screen.getByRole("link", { name: "文章收藏" }));
      expect(telemetry.trackEntryClick).toHaveBeenCalledWith("article_favorites");
    });
  });

  describe("S065: read-later end-to-end flows", () => {
    describe("S063: read-later panel on home", () => {
        it("S063: home shows 待读 panel with empty-state hint when list is empty", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([]);
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        expect(screen.getByText("暂无待读文章")).toBeInTheDocument();
      });

      it("S063: home shows read-later article titles in newest-first order", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: "f1", article_id: "a2", added_at: "2024-01-02T00:00:00Z", title: "Second Article", published: "2024-01-02T12:00:00Z" },
          { feed_id: "f1", article_id: "a1", added_at: "2024-01-01T00:00:00Z", title: "First Article", published: "2024-01-01T12:00:00Z" },
        ]);
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        const links = screen.getAllByRole("link", { name: /Article/ });
        expect(links).toHaveLength(2);
        expect(links[0]).toHaveTextContent("Second Article");
        expect(links[0]).toHaveAttribute("href", "/feeds/f1/articles/a2");
        expect(links[1]).toHaveTextContent("First Article");
        expect(links[1]).toHaveAttribute("href", "/feeds/f1/articles/a1");
      });

      it("S068: read-later list displays resolved title (e.g. translated when API returns it)", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: "f1", article_id: "a1", added_at: "2024-01-01T00:00:00Z", title: "翻译后的标题", published: "2024-01-01T12:00:00Z" },
        ]);
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        expect(screen.getByRole("link", { name: "翻译后的标题" })).toBeInTheDocument();
      });

      it("S069: each read-later item shows date and color marker before title", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: "f1", article_id: "a1", added_at: "2024-01-01T00:00:00Z", title: "Article One", published: "2024-01-01T12:00:00Z" },
        ]);
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        expect(screen.getByText("2024年1月")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Article One" })).toBeInTheDocument();
      });
    });

    describe("S064: navigation from read-later to summary and read-later state", () => {
      it("S064: clicking read-later title opens summary page with read-later button in red minus-state", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: "f1", article_id: "a1", added_at: "2024-01-01T00:00:00Z", title: "My Read-Later Article", published: "2024-01-01T12:00:00Z" },
        ]);
        vi.mocked(api.getArticles).mockResolvedValue([
          { id: "a1", title: "My Read-Later Article", link: "https://example.com/1", published: "2024-01-01T00:00:00Z" },
        ]);
        vi.mocked(api.getArticleSummaryMeta).mockResolvedValue([]);
        vi.mocked(api.getReadLaterCheck).mockResolvedValue({ in_read_later: true });
        vi.mocked(api.getSummary).mockRejectedValue(new Error("No summary"));
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole("link", { name: "My Read-Later Article" }));
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "文章摘要" })).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "从待读移除" })).toBeInTheDocument();
      });

      it("S064: from article-favorites-origin read-later entry opens summary with minus-state", async () => {
        const virtualFeedId = "virtual-favorites";
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: virtualFeedId, article_id: "fav-a1", added_at: "2024-01-01T00:00:00Z", title: "Favorites Article", published: "2024-01-01T12:00:00Z" },
        ]);
        vi.mocked(api.getArticles).mockResolvedValue([
          { id: "fav-a1", title: "Favorites Article", link: "", published: "2024-01-01T00:00:00Z" },
        ]);
        vi.mocked(api.getArticleSummaryMeta).mockResolvedValue([]);
        vi.mocked(api.getReadLaterCheck).mockResolvedValue({ in_read_later: true });
        vi.mocked(api.getSummary).mockRejectedValue(new Error("No summary"));
        renderWithRouter(["/"]);
        await waitFor(() => {
          expect(screen.getByRole("link", { name: "Favorites Article" })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole("link", { name: "Favorites Article" }));
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "文章摘要" })).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "从待读移除" })).toBeInTheDocument();
      });
    });

    describe("S066: back navigation returns to previous page", () => {
      it("from read-later list into summary, back returns to home (read-later) not feeds", async () => {
        vi.mocked(api.getReadLaterList).mockResolvedValue([
          { feed_id: "f1", article_id: "a1", added_at: "2024-01-01T00:00:00Z", title: "My Article", published: "2024-01-01T12:00:00Z" },
        ]);
        vi.mocked(api.getArticles).mockResolvedValue([
          { id: "a1", title: "My Article", link: "https://example.com/1", published: "2024-01-01T00:00:00Z" },
        ]);
        vi.mocked(api.getArticleSummaryMeta).mockResolvedValue([]);
        vi.mocked(api.getReadLaterCheck).mockResolvedValue({ in_read_later: true });
        vi.mocked(api.getSummary).mockRejectedValue(new Error("No summary"));
        // Simulate: user was on home (read-later), then navigated to summary
        renderWithRouter(["/", "/feeds/f1/articles/a1"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "文章摘要" })).toBeInTheDocument();
        });
        const backControl = screen.getByRole("button", { name: /返回上一页|返回/ });
        await userEvent.click(backControl);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
        });
        expect(screen.getByRole("heading", { name: "待读" })).toBeInTheDocument();
      });

      it("from feeds article list into summary, back returns to article list", async () => {
        vi.mocked(api.getFeeds).mockResolvedValue([
          { id: "f1", title: "Feed 1", url: "https://example.com/feed", feed_type: "rss" },
        ]);
        vi.mocked(api.getFeed).mockResolvedValue({
          id: "f1",
          title: "Feed 1",
          url: "https://example.com/feed",
          feed_type: "rss",
        });
        vi.mocked(api.getArticles).mockResolvedValue([
          { id: "a1", title: "Article One", link: "https://example.com/1", published: "2024-01-01T00:00:00Z" },
        ]);
        vi.mocked(api.getArticleSummaryMeta).mockResolvedValue([]);
        vi.mocked(api.getReadLaterCheck).mockResolvedValue({ in_read_later: false });
        vi.mocked(api.getSummary).mockRejectedValue(new Error("No summary"));
        // Simulate: user was on feeds -> article list -> summary
        renderWithRouter(["/feeds", "/feeds/f1/articles", "/feeds/f1/articles/a1"]);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "文章摘要" })).toBeInTheDocument();
        });
        const backControl = screen.getByRole("button", { name: /返回上一页|返回/ });
        await userEvent.click(backControl);
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "文章列表" })).toBeInTheDocument();
        });
      });
    });
  });
});

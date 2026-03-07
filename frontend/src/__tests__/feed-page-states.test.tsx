import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getSummaryProfiles: vi.fn(),
    getReadLaterList: vi.fn(),
  },
}));

function renderFeedsPage() {
  return render(
    <MemoryRouter initialEntries={["/feeds"]}>
      <App />
    </MemoryRouter>,
  );
}

function renderFavoritesPage() {
  return render(
    <MemoryRouter initialEntries={["/favorites"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Feed page states", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    vi.mocked(api.getReadLaterList).mockResolvedValue([]);
  });

  it("shows loading state while fetching feeds", () => {
    vi.mocked(api.getFeeds).mockImplementation(() => new Promise(() => {}));
    renderFeedsPage();
    expect(screen.getByText(/加载|loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no RSS feeds", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无 RSS 订阅/)).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(api.getFeeds).mockRejectedValue(new Error("Network error"));
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/错误|error|失败/i)).toBeInTheDocument();
    });
  });

  it("S047: RSS subscriptions page shows only RSS list (no favorites block)", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "f1", title: "RSS One", url: "https://example.com/one.xml", feed_type: "rss" },
      { id: "f2", title: "RSS Two", url: "https://example.com/two.xml", feed_type: "rss" },
      { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "RSS One" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "RSS Two" })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("region", { name: "RSS 订阅列表" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("region", { name: "文章收藏" })).not.toBeInTheDocument();
    expect(screen.queryByText("My Favorites")).not.toBeInTheDocument();
  });

  it("S047: navigation to article list works from RSS list", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "f1", title: "RSS Feed", url: "https://example.com/feed.xml", feed_type: "rss" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      const rssLinks = screen.getAllByRole("link", { name: "RSS Feed" });
      expect(rssLinks.length).toBeGreaterThanOrEqual(1);
      expect(rssLinks[0]).toHaveAttribute("href", "/feeds/f1/articles");
    });
  });

  it("S053: RSS subscriptions page add button is 添加 Feed in list section", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "添加 Feed" }).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByRole("heading", { level: 1, name: "RSS 订阅" }).length).toBeGreaterThanOrEqual(1);
    const rssListRegions = screen.getAllByRole("region", { name: "RSS 订阅列表" });
    const addButton = within(rssListRegions[0]).getByRole("button", { name: "添加 Feed" });
    expect(addButton).toHaveTextContent("添加 Feed");
  });

  it("S058: RSS subscriptions page title in standard location, no duplicate above add control", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "添加 Feed" }).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByRole("heading", { level: 1, name: "RSS 订阅" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("heading", { level: 2, name: "RSS 订阅" })).not.toBeInTheDocument();
    const rssListRegions = screen.getAllByRole("region", { name: "RSS 订阅列表" });
    expect(rssListRegions.length).toBeGreaterThanOrEqual(1);
    const addButton = within(rssListRegions[0]).getByRole("button", { name: "添加 Feed" });
    expect(addButton).toBeInTheDocument();
  });
});

describe("Article favorites page (文章收藏)", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
  });

  it("S051: article favorites page add button is 添加收藏夹 (no redundant 收藏夹 section heading)", async () => {
    renderFavoritesPage();
    await waitFor(() => {
      expect(screen.getAllByText(/暂无收藏夹/).length).toBeGreaterThanOrEqual(1);
    });
    const regions = screen.getAllByRole("region", { name: "收藏夹列表" });
    const addButton = within(regions[0]).getByRole("button", { name: "添加收藏夹" });
    expect(addButton).toHaveTextContent("添加收藏夹");
  });

  it("S051: create-collection button is 添加收藏夹 not 新建收藏夹", async () => {
    renderFavoritesPage();
    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: "收藏夹列表" }).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("button", { name: /新建收藏夹/ })).not.toBeInTheDocument();
    const regions = screen.getAllByRole("region", { name: "收藏夹列表" });
    expect(within(regions[0]).getByRole("button", { name: "添加收藏夹" })).toBeInTheDocument();
  });

  it("S054: article favorites page has no section heading 收藏夹", async () => {
    renderFavoritesPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "添加收藏夹" }).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("heading", { name: "收藏夹" })).not.toBeInTheDocument();
  });

  it("S054: article favorites page primary add button is 添加收藏夹", async () => {
    renderFavoritesPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "添加收藏夹" }).length).toBeGreaterThanOrEqual(1);
    });
    const addButtons = screen.getAllByRole("button", { name: "添加收藏夹" });
    expect(addButtons[0]).toHaveTextContent("添加收藏夹");
  });
});

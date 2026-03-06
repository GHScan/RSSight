import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getSummaryProfiles: vi.fn(),
    createVirtualFeed: vi.fn(),
  },
}));

function renderFeedsPage() {
  return render(
    <MemoryRouter initialEntries={["/feeds"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Feed page states", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
  });

  it("shows loading state while fetching feeds", () => {
    vi.mocked(api.getFeeds).mockImplementation(() => new Promise(() => {}));
    renderFeedsPage();
    expect(screen.getByText(/加载|loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no feeds", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无 RSS 订阅/)).toBeInTheDocument();
      expect(screen.getByText(/暂无收藏夹/)).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(api.getFeeds).mockRejectedValue(new Error("Network error"));
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/错误|error|失败/i)).toBeInTheDocument();
    });
  });

  it("S025: shows Article Favorites button and virtual feed with visual distinction", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" },
      { id: "f1", title: "RSS Feed", url: "https://example.com/feed.xml", feed_type: "rss" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText("My Favorites")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button", { name: /文章收藏/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("收藏夹")).toBeInTheDocument();
    expect(screen.getByText("RSS Feed")).toBeInTheDocument();
  });

  it("S025: clicking Article Favorites opens create-virtual-feed dialog with name field", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /文章收藏/ }).length).toBeGreaterThanOrEqual(1);
    });
    screen.getAllByRole("button", { name: /文章收藏/ })[0].click();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/名称/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/收藏夹名称/)).toBeInTheDocument();
  });

  it("S038: feed management shows RSS and favorites as separate top-level list sections", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "f1", title: "RSS One", url: "https://example.com/one.xml", feed_type: "rss" },
      { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "RSS One" })).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "My Favorites" }).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByRole("region", { name: "RSS 订阅" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("region", { name: "文章收藏" }).length).toBeGreaterThanOrEqual(1);
    const rssLink = screen.getAllByRole("link", { name: "RSS One" })[0];
    const favLink = screen.getAllByRole("link", { name: "My Favorites" })[0];
    expect(rssLink.closest("[aria-labelledby='rss-heading']")).toBeInTheDocument();
    expect(favLink.closest("[aria-labelledby='favorites-heading']")).toBeInTheDocument();
  });

  it("S038: navigation to article list works from both RSS and favorites lists", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "f1", title: "RSS Feed", url: "https://example.com/feed.xml", feed_type: "rss" },
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      const rssLinks = screen.getAllByRole("link", { name: "RSS Feed" });
      const favLinks = screen.getAllByRole("link", { name: "Favorites" });
      expect(rssLinks.length).toBeGreaterThanOrEqual(1);
      expect(favLinks.length).toBeGreaterThanOrEqual(1);
      expect(rssLinks[0]).toHaveAttribute("href", "/feeds/f1/articles");
      expect(favLinks[0]).toHaveAttribute("href", "/feeds/v1/articles");
    });
  });

  it("S039: RSS and favorites are rendered in separate lists", async () => {
    vi.mocked(api.getFeeds).mockResolvedValue([
      { id: "f1", title: "RSS One", url: "https://example.com/one.xml", feed_type: "rss" },
      { id: "f2", title: "RSS Two", url: "https://example.com/two.xml", feed_type: "rss" },
      { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" },
    ]);
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "RSS One" }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("link", { name: "RSS Two" }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("link", { name: "My Favorites" }).length).toBeGreaterThanOrEqual(1);
    });
    const rssOneLinks = screen.getAllByRole("link", { name: "RSS One" });
    const rssTwoLinks = screen.getAllByRole("link", { name: "RSS Two" });
    const myFavLinks = screen.getAllByRole("link", { name: "My Favorites" });
    expect(rssOneLinks[0].closest("[aria-labelledby='rss-heading']")).toBeInTheDocument();
    expect(rssTwoLinks[0].closest("[aria-labelledby='rss-heading']")).toBeInTheDocument();
    expect(myFavLinks[0].closest("[aria-labelledby='rss-heading']")).toBeNull();
    expect(myFavLinks[0].closest("[aria-labelledby='favorites-heading']")).toBeInTheDocument();
    expect(rssOneLinks[0].closest("[aria-labelledby='favorites-heading']")).toBeNull();
    expect(rssTwoLinks[0].closest("[aria-labelledby='favorites-heading']")).toBeNull();
  });
});

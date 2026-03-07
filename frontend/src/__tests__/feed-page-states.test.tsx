import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getSummaryProfiles: vi.fn(),
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
    expect(screen.getAllByRole("region", { name: "RSS 订阅" }).length).toBeGreaterThanOrEqual(1);
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

  it("S050: RSS subscriptions page add button displays only 添加 (no RSS 订阅 in label)", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无 RSS 订阅/)).toBeInTheDocument();
    });
    const addButton = screen.getByRole("button", { name: "添加" });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent("添加");
    expect(addButton.textContent).not.toMatch(/RSS\s*订阅/);
  });
});

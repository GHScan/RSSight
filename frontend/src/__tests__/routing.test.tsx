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
    getSummaryProfiles: vi.fn(),
    getArticles: vi.fn(),
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
});

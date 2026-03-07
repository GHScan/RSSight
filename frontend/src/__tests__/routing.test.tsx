import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getSummaryProfiles: vi.fn(),
    getArticles: vi.fn(),
  },
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
      expect(screen.getByRole("heading", { level: 1, name: "RSS 订阅" })).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { level: 1, name: "RSS 订阅" })).toBeInTheDocument();
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

  it("S046: home shows exactly three top-level nav entries in order (RSS订阅, 文章收藏, 摘要设置)", () => {
    renderWithRouter(["/"]);
    const links = screen.getAllByRole("link");
    const navLinks = links.filter((l) => ["/feeds", "/favorites", "/profiles"].includes(l.getAttribute("href") ?? ""));
    expect(navLinks).toHaveLength(3);
    expect(navLinks[0]).toHaveTextContent("RSS 订阅");
    expect(navLinks[0]).toHaveAttribute("href", "/feeds");
    expect(navLinks[1]).toHaveTextContent("文章收藏");
    expect(navLinks[1]).toHaveAttribute("href", "/favorites");
    expect(navLinks[2]).toHaveTextContent("摘要设置");
    expect(navLinks[2]).toHaveAttribute("href", "/profiles");
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
});

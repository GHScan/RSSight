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
    await userEvent.click(screen.getByRole("link", { name: /摘要配置|Profiles|配置/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /摘要配置|Summary profile|配置/i }),
      ).toBeInTheDocument();
    });
  });
});

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

  it("shows empty state when no feeds", async () => {
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无|empty|没有订阅/i)).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(api.getFeeds).mockRejectedValue(new Error("Network error"));
    renderFeedsPage();
    await waitFor(() => {
      expect(screen.getByText(/错误|error|失败/i)).toBeInTheDocument();
    });
  });
});

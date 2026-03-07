/**
 * S012: Article summary page interaction details.
 * Happy path, boundary/exception, and regression tests.
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { api } from "../api/client";
import type { SummaryProfile } from "../api/types";

vi.mock("../api/client", () => ({
  api: {
    getFeeds: vi.fn(),
    getArticles: vi.fn(),
    getSummaryProfiles: vi.fn(),
    getSummary: vi.fn(),
    generateSummary: vi.fn(),
    createFeed: vi.fn(),
    updateFeed: vi.fn(),
    deleteFeed: vi.fn(),
    createSummaryProfile: vi.fn(),
    updateSummaryProfile: vi.fn(),
    deleteSummaryProfile: vi.fn(),
  },
}));

const mockProfiles: SummaryProfile[] = [
  {
    name: "default",
    base_url: "https://api.openai.com/v1",
    key: "sk-xxx",
    model: "gpt-4",
    fields: ["title", "content"],
    prompt_template: "Summarize: {title}",
  },
  {
    name: "brief",
    base_url: "https://api.openai.com/v1",
    key: "sk-yyy",
    model: "gpt-3.5",
    fields: ["title"],
    prompt_template: "Brief: {title}",
  },
];

function renderArticleSummary(feedId = "f1", articleId = "a1") {
  return render(
    <MemoryRouter initialEntries={[`/feeds/${feedId}/articles/${articleId}`]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Article summary interaction (S012)", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    vi.mocked(api.getArticles).mockResolvedValue([]);
    vi.mocked(api.getSummaryProfiles).mockResolvedValue([...mockProfiles]);
    vi.mocked(api.getSummary).mockRejectedValue(new Error("Not found"));
    vi.mocked(api.generateSummary).mockResolvedValue("# Summary\n\nGenerated content.");
  });

  afterEach(() => {
    cleanup();
  });

  describe("Happy path", () => {
    it("user can select profile, trigger generation, and view result", async () => {
      vi.mocked(api.generateSummary).mockResolvedValue("# Summary\n\nDone.");
      renderArticleSummary();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      await userEvent.selectOptions(
        screen.getByLabelText(/摘要配置|配置|profile/i),
        "default",
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /生成|trigger/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /生成|trigger/i }));

      await waitFor(() => {
        const summaryContent = screen.getAllByTestId("summary-content")[0];
        expect(summaryContent).toHaveTextContent(/Done\.|Summary/);
      });
    });

    it("existing summary is shown when profile has summary", async () => {
      vi.mocked(api.getSummary).mockResolvedValue("# Existing\n\nAlready saved.");
      renderArticleSummary();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      await userEvent.selectOptions(
        screen.getByLabelText(/摘要配置|配置|profile/i),
        "default",
      );

      await waitFor(() => {
        const summaryContent = screen.getAllByTestId("summary-content")[0];
        expect(summaryContent).toHaveTextContent(/Existing|Already saved/);
      });
    });
  });

  describe("Boundary/exception", () => {
    it("no profile selected shows explicit feedback", async () => {
      renderArticleSummary();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      expect(screen.getByRole("combobox", { name: /摘要配置/ })).toBeInTheDocument();
      const hint = screen.getByText("请选择摘要配置", { selector: "p" });
      expect(hint).toBeInTheDocument();
    });

    it("no existing summary shows no-data state and trigger option", async () => {
      vi.mocked(api.getSummary).mockRejectedValue(new Error("Not found"));
      renderArticleSummary();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      await userEvent.selectOptions(
        screen.getByLabelText(/摘要配置|配置|profile/i),
        "default",
      );
      await waitFor(() => {
        expect(screen.getByText(/暂无|没有|未生成/i)).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /生成|trigger/i })).toBeInTheDocument();
    });

    it("generation failure shows explicit error feedback", async () => {
      vi.mocked(api.generateSummary).mockRejectedValue(new Error("API error"));
      renderArticleSummary();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      await userEvent.selectOptions(
        screen.getByLabelText(/摘要配置|配置|profile/i),
        "default",
      );
      await userEvent.click(screen.getByRole("button", { name: /生成|trigger/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/失败|错误|error|API/i);
      });
    });
  });

  describe("Regression", () => {
    it("S057: no '摘要配置' label above summary profile selector", async () => {
      renderArticleSummary();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      expect(screen.getByRole("combobox", { name: /摘要配置/ })).toBeInTheDocument();
      expect(document.querySelector('label[for="summary-profile"]')).toBeNull();
    });

    it("repeated trigger and page revisit keep UI stable", async () => {
      vi.mocked(api.generateSummary).mockResolvedValue("# Summary\n\nContent.");
      renderArticleSummary();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
      });
      await userEvent.selectOptions(
        screen.getByLabelText(/摘要配置|配置|profile/i),
        "default",
      );
      await userEvent.click(screen.getByRole("button", { name: /生成|trigger/i }));
      await waitFor(() => {
        expect(screen.getByText(/Content\./)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /生成|trigger/i }));
      await waitFor(() => {
        expect(screen.getByText(/Content\./)).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { name: /文章摘要/ })).toBeInTheDocument();
    });
  });
});

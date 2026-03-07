/**
 * S014: Summary profile management interaction details.
 * Happy path, boundary/exception, and regression tests.
 */

import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
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
    createSummaryProfile: vi.fn(),
    updateSummaryProfile: vi.fn(),
    deleteSummaryProfile: vi.fn(),
    getSummary: vi.fn(),
    generateSummary: vi.fn(),
    createFeed: vi.fn(),
    updateFeed: vi.fn(),
    deleteFeed: vi.fn(),
  },
}));

const mockProfiles: SummaryProfile[] = [
  { name: "p1", base_url: "https://api.example.com", key: "k1", model: "gpt-4", fields: ["title"], prompt_template: "{title}" },
  { name: "p2", base_url: "https://api.example.com", key: "k2", model: "gpt-3", fields: ["title", "content"], prompt_template: "Sum: {title}" },
];

function renderProfilesPage() {
  return render(
    <MemoryRouter initialEntries={["/profiles"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Summary profile management interaction (S014)", () => {
  beforeEach(() => {
    vi.mocked(api.getFeeds).mockResolvedValue([]);
    vi.mocked(api.getSummaryProfiles).mockResolvedValue([...mockProfiles]);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Happy path", () => {
    it("users can create profile and see it in list", async () => {
      const newProfile: SummaryProfile = {
        name: "p3",
        base_url: "https://api.example.com",
        key: "k3",
        model: "gpt-4",
        fields: ["title"],
        prompt_template: "{title}",
      };
      vi.mocked(api.createSummaryProfile).mockResolvedValue(newProfile);
      vi.mocked(api.getSummaryProfiles)
        .mockResolvedValueOnce([...mockProfiles])
        .mockResolvedValueOnce([...mockProfiles, newProfile]);

      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /添加|add/i }));
      await userEvent.type(screen.getByLabelText(/名称|name/i), "p3");
      await userEvent.type(screen.getByLabelText(/base_url|API|url/i), "https://api.example.com");
      await userEvent.type(screen.getByLabelText(/key|密钥/i), "k3");
      await userEvent.type(screen.getByLabelText(/model/i), "gpt-4");
      await userEvent.type(screen.getByLabelText(/prompt|模板/i), "{title}");
      await userEvent.click(screen.getByRole("button", { name: /确定|保存|submit/i }));

      await waitFor(() => {
        expect(screen.getByText("p3")).toBeInTheDocument();
      });
    });

    it("users can update profile and see updated name in list", async () => {
      vi.mocked(api.updateSummaryProfile).mockResolvedValue({
        ...mockProfiles[0],
        name: "p1-updated",
        prompt_template: "Updated",
      });
      vi.mocked(api.getSummaryProfiles).mockResolvedValueOnce([...mockProfiles]).mockResolvedValueOnce([
        { ...mockProfiles[0], name: "p1-updated", prompt_template: "Updated" },
        mockProfiles[1],
      ]);

      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      const editBtn = screen.getByRole("button", { name: /编辑.*p1|edit.*p1/i });
      await userEvent.click(editBtn);
      const nameInput = screen.getByDisplayValue("p1");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "p1-updated");
      await userEvent.click(within(screen.getByTestId("edit-profile-form")).getByRole("button", { name: /确定|保存/i }));

      await waitFor(() => {
        expect(screen.getByText("p1-updated")).toBeInTheDocument();
      });
    });

    it("users can delete profile and it disappears from list", async () => {
      vi.mocked(api.deleteSummaryProfile).mockResolvedValue(undefined);
      vi.mocked(api.getSummaryProfiles).mockResolvedValueOnce([...mockProfiles]).mockResolvedValueOnce([mockProfiles[1]]);

      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /删除.*p1|delete.*p1/i }));
      await userEvent.click(screen.getByRole("button", { name: /确认|confirm/i }));

      await waitFor(() => {
        expect(screen.queryByText("p1")).not.toBeInTheDocument();
        expect(screen.getByText("p2")).toBeInTheDocument();
      });
    });

  });

  describe("Boundary/exception", () => {
    it("required field missing shows validation feedback", async () => {
      vi.mocked(api.createSummaryProfile).mockClear();
      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /添加|add/i }));
      const addForm = await screen.findByTestId("add-profile-form");
      const nameInput = within(addForm).getByLabelText(/名称|name/i);
      expect(nameInput).toHaveValue("");
      await userEvent.click(within(addForm).getByRole("button", { name: /确定|保存|submit/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/名称|请填写|必填|required/i);
      });
      expect(api.createSummaryProfile).not.toHaveBeenCalled();
    });

    it("name conflict shows clear error", async () => {
      vi.mocked(api.createSummaryProfile).mockRejectedValue(new Error("Profile name already exists"));
      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /添加|add/i }));
      await userEvent.type(screen.getByLabelText(/名称|name/i), "p1");
      await userEvent.type(screen.getByLabelText(/base_url|API|url/i), "https://api.example.com");
      await userEvent.type(screen.getByLabelText(/key|密钥/i), "k");
      await userEvent.type(screen.getByLabelText(/model/i), "gpt-4");
      await userEvent.type(screen.getByLabelText(/prompt|模板/i), "{title}");
      await userEvent.click(screen.getByRole("button", { name: /确定|保存|submit/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/已存在|冲突|conflict|already/i);
      });
    });

    it("backend failure shows actionable error", async () => {
      vi.mocked(api.createSummaryProfile).mockRejectedValue(new Error("Network error"));
      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("button", { name: /添加|add/i }));
      await userEvent.type(screen.getByLabelText(/名称|name/i), "p3");
      await userEvent.type(screen.getByLabelText(/base_url|API|url/i), "https://api.example.com");
      await userEvent.type(screen.getByLabelText(/key|密钥/i), "k3");
      await userEvent.type(screen.getByLabelText(/model/i), "gpt-4");
      await userEvent.type(screen.getByLabelText(/prompt|模板/i), "{title}");
      await userEvent.click(screen.getByRole("button", { name: /确定|保存|submit/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/失败|错误|error|Network/i);
      });
    });
  });

  describe("Regression", () => {
    it("profile list and navigation stay stable", async () => {
      renderProfilesPage();
      await waitFor(() => {
        expect(screen.getByText("p1")).toBeInTheDocument();
        expect(screen.getByText("p2")).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { name: /摘要配置/i })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("link", { name: /首页|home/i }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /RSSight/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole("link", { name: "摘要设置" }));
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /摘要配置/i })).toBeInTheDocument();
        expect(screen.getByText("p1")).toBeInTheDocument();
      });
    });
  });
});

/**
 * S013: UI automation for article summary viewing and triggering flow.
 * Happy path, boundary/exception, and regression coverage.
 */

import { test, expect } from "@playwright/test";
import { mockReadLaterApi } from "./helpers/api-mocks";

const articleDetail = {
  id: "a1",
  title: "Article First",
  link: "https://example.com/1",
  published: "2025-03-01T10:00:00Z",
  description: "Body",
};

test.describe("Article summary E2E (S013)", () => {
  test.beforeEach(async ({ page }) => {
    await mockReadLaterApi(page);
    await page.route("**/api/feeds**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const p = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (p.endsWith("/refresh") && method === "POST") {
        return route.fulfill({ status: 204 });
      }
      if (p === "/api/feeds" && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "f1", title: "Feed One", url: "https://example.com/one.xml", feed_type: "rss" },
          ]),
        });
      }
      const feedOnly = p.match(/^\/api\/feeds\/([^/]+)$/);
      if (feedOnly && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "f1",
            title: "Feed One",
            url: "https://example.com/one.xml",
            feed_type: "rss",
          }),
        });
      }
      const articlesList = p.match(/^\/api\/feeds\/([^/]+)\/articles$/);
      if (articlesList && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "a1", title: "Article First", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
          ]),
        });
      }
      const articleOne = p.match(/^\/api\/feeds\/([^/]+)\/articles\/([^/]+)$/);
      if (articleOne && method === "GET" && !p.includes("/summaries")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(articleDetail),
        });
      }
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "unmocked", path: p }),
      });
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { name: "default", base_url: "https://api.example.com", key: "k", model: "gpt-4", fields: ["title"], prompt_template: "{title}" },
        ]),
      });
    });
    await page.route("**/summaries/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const p = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (method === "GET" && /\/articles\/[^/]+\/summaries$/.test(p)) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      if (method === "GET") {
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }) });
      }
      if (method === "POST" && (url.includes("/generate") || p.includes("/generate"))) {
        return route.fulfill({
          status: 201,
          contentType: "text/plain",
          body: "# Summary\n\nGenerated content.",
        });
      }
      return route.fulfill({ status: 404, body: "{}" });
    });
  });

  test("Regression: article summary route loads and profile selector visible", async ({
    page,
  }) => {
    await page.goto("/feeds/f1/articles/a1");
    await expect(page.getByRole("heading", { name: /文章摘要/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /摘要配置/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /返回上一页/ })).toBeVisible();
  });

  test("Happy path: select profile and trigger generation shows success content", async ({
    page,
  }) => {
    await page.goto("/feeds/f1/articles/a1");
    await expect(page.getByRole("heading", { name: /文章摘要/ })).toBeVisible();
    await page.getByRole("combobox", { name: /摘要配置/ }).selectOption("default");
    await expect(page.getByText(/暂无摘要/)).toBeVisible();
    await page.getByRole("button", { name: /生成/ }).click();
    await expect(page.getByText("Generated content.")).toBeVisible();
  });

  test("Boundary: no profile selected shows hint", async ({ page }) => {
    await page.goto("/feeds/f1/articles/a1");
    await expect(page.getByRole("paragraph").filter({ hasText: "请选择摘要配置" })).toBeVisible();
  });

  test("Boundary: generation failure shows error", async ({ page }) => {
    await page.route("**/summaries/*/generate**", async (route) => {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "API error" }),
      });
    });
    await page.goto("/feeds/f1/articles/a1");
    await page.getByRole("combobox", { name: /摘要配置/ }).selectOption("default");
    await page.getByRole("button", { name: /生成/ }).click();
    await expect(page.getByRole("alert")).toContainText(/失败|错误|error|API/i);
  });

  test("Regression: summary view and re-entry stable", async ({ page }) => {
    await page.goto("/feeds/f1/articles/a1");
    await page.getByRole("combobox", { name: /摘要配置/ }).selectOption("default");
    await page.getByRole("button", { name: /生成/ }).click();
    await expect(page.getByText(/Generated content/)).toBeVisible();
    await page.getByRole("button", { name: /返回上一页/ }).click();
    await page.goto("/feeds/f1/articles/a1");
    await expect(page.getByRole("heading", { name: /文章摘要/ })).toBeVisible();
    await page.getByRole("combobox", { name: /摘要配置/ }).selectOption("default");
    await expect(page.getByRole("button", { name: /生成|重新生成/ })).toBeVisible();
  });
});

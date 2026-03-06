/**
 * S011: UI automation for article list browsing flow.
 * Happy path, boundary/exception, and regression coverage.
 * Runs with mocked API so no backend is required.
 */

import { test, expect } from "@playwright/test";

const mockFeeds = [
  { id: "f1", title: "Feed One", url: "https://example.com/one.xml" },
];

const mockArticles = [
  { id: "a3", title: "Article Third", link: "https://example.com/3", published: "2025-03-03T10:00:00Z" },
  { id: "a2", title: "Article Second", link: "https://example.com/2", published: "2025-03-02T10:00:00Z" },
  { id: "a1", title: "Article First", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
];

test.describe("Article list E2E (S011)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feeds**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === "GET" && !url.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockFeeds),
        });
      }
      if (method === "GET" && url.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockArticles),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("Regression: article list route loads and baseline list renders", async ({
    page,
  }) => {
    await page.goto("/feeds/f1/articles");
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("Article Third")).toBeVisible();
    await expect(page.getByText("Article First")).toBeVisible();
    await expect(page.getByRole("link", { name: /返回RSS 订阅/ })).toBeVisible();
  });

  test("Happy path: feed entry to article list loading and visible list", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("link", { name: "Feed One" })).toBeVisible();
    await page.getByRole("link", { name: "Feed One" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("Article Third")).toBeVisible();
    await expect(page.getByText("Article First")).toBeVisible();
  });

  test("Happy path: refresh reloads list and keeps context", async ({
    page,
  }) => {
    const articles = [...mockArticles];
    await page.route("**/api/feeds/**", async (route) => {
      const reqUrl = route.request().url();
      const method = route.request().method();
      if (method === "GET" && !reqUrl.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockFeeds),
        });
      }
      if (method === "GET" && reqUrl.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(articles),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/feeds/f1/articles");
    await expect(page.getByText("Article Third")).toBeVisible();
    await expect(page.getByText("Article After Refresh")).not.toBeVisible();

    articles.push({
      id: "a4",
      title: "Article After Refresh",
      link: "https://example.com/4",
      published: "2025-03-04T10:00:00Z",
    });
    await page.getByRole("button", { name: /刷新/ }).click();
    await expect(page.getByText("Article After Refresh")).toBeVisible();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
  });

  test("Boundary: empty article list shows visible empty state", async ({
    page,
  }) => {
    await page.route("**/api/feeds/**", async (route) => {
      const reqUrl = route.request().url();
      const method = route.request().method();
      if (method === "GET" && !reqUrl.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockFeeds),
        });
      }
      if (method === "GET" && reqUrl.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.continue();
    });

    await page.goto("/feeds/f1/articles");
    await expect(page.getByText(/暂无文章/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
  });

  test("Boundary: fetch failure shows error and retry succeeds", async ({
    page,
  }) => {
    let getArticlesCount = 0;
    await page.route("**/api/feeds/f1/articles**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      getArticlesCount++;
      if (getArticlesCount <= 2) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Network error" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockArticles),
      });
    });

    await page.goto("/feeds/f1/articles");
    await expect(page.getByText(/错误|失败/)).toBeVisible();
    const retryBtn = page.getByTestId("retry-articles");
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();
    await expect(page.getByText("Article Third")).toBeVisible();
    await expect(page.getByText(/错误|失败/)).not.toBeVisible();
  });

  test("Regression: articles in reverse chronological order and nav stable", async ({
    page,
  }) => {
    await page.goto("/feeds/f1/articles");
    await expect(page.getByText("Article Third")).toBeVisible();
    const list = page.getByRole("list");
    const links = await list.locator("li a").allTextContents();
    expect(links[0]).toBe("Article Third");
    expect(links[1]).toBe("Article Second");
    expect(links[2]).toBe("Article First");

    await page.getByRole("link", { name: /返回RSS 订阅/ }).click();
    await expect(page.getByRole("heading", { name: /RSS 订阅/ })).toBeVisible();
    await page.getByRole("link", { name: "Feed One" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("Article Third")).toBeVisible();
  });

  test("S026: navigate from virtual feed to article list shows empty state", async ({
    page,
  }) => {
    const feedsWithVirtual = [
      { id: "f1", title: "Feed One", url: "https://example.com/one.xml", feed_type: "rss" as const },
      { id: "v1", title: "My Favorites", url: null, feed_type: "virtual" as const },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === "GET" && !url.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(feedsWithVirtual),
        });
      }
      if (method === "GET" && url.includes("/feeds/v1/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      if (method === "GET" && url.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockArticles),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/feeds");
    await expect(page.getByRole("link", { name: "My Favorites" })).toBeVisible();
    await page.getByRole("link", { name: "My Favorites" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText(/暂无文章/)).toBeVisible();
    await expect(page.getByRole("link", { name: /返回RSS 订阅/ })).toBeVisible();
  });

  test("S026: virtual feed article list error state shows retry", async ({
    page,
  }) => {
    await page.route("**/api/feeds/**", async (route) => {
      const reqUrl = route.request().url();
      const method = route.request().method();
      if (method === "GET" && !reqUrl.includes("/articles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "v1", title: "Virtual", url: null, feed_type: "virtual" },
          ]),
        });
      }
      if (method === "GET" && reqUrl.includes("/feeds/v1/articles")) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server error" }),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/feeds/v1/articles");
    await expect(page.getByText(/错误|失败/)).toBeVisible();
    await expect(page.getByTestId("retry-articles")).toBeVisible();
  });
});

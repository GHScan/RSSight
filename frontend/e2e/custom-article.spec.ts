/**
 * S035: UI automation for custom article create flows (virtual feed + URL branch + no-URL two-step).
 * Happy path, boundary/exception, and regression coverage.
 * Runs with mocked API so no backend is required.
 */

import { test, expect } from "@playwright/test";

const baseFeeds = [
  { id: "f1", title: "Feed One", url: "https://example.com/one.xml", feed_type: "rss" as const },
];

function parseFeedsPath(url: string): { isList: boolean; feedId: string | null; isArticles: boolean } {
  const path = new URL(url).pathname;
  const match = path.match(/^\/api\/feeds(?:\/([^/]+))?(\/articles)?\/?$/);
  if (!match) return { isList: false, feedId: null, isArticles: false };
  const feedId = match[1] ?? null;
  const isArticles = !!match[2];
  const isList = path === "/api/feeds" || path === "/api/feeds/";
  return { isList, feedId, isArticles };
}

test.describe("Custom article create flow E2E (S035)", () => {
  test("Happy path: create virtual feed and open its article list", async ({ page }) => {
    const feeds = [...baseFeeds];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          const list = feedId === "v1" ? [] : [
            { id: "a1", title: "Article One", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
          ];
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(list),
          });
        }
      }
      if (method === "POST" && (url.endsWith("/feeds/virtual") || url.includes("/feeds/virtual"))) {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const newFeed = {
          id: "v1",
          title: body.name ?? "收藏夹",
          url: null,
          feed_type: "virtual" as const,
        };
        feeds.push(newFeed);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newFeed),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/favorites");
    await expect(page.getByRole("button", { name: /添加/ })).toBeVisible();
    await page.getByRole("button", { name: /添加/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByPlaceholder(/收藏夹名称/).fill("My Favorites");
    await page.getByRole("button", { name: "确定" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("My Favorites")).toBeVisible();

    await page.getByRole("link", { name: "My Favorites" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /添加文章/ })).toBeVisible();
    await expect(page.getByText(/暂无文章/)).toBeVisible();
  });

  test("Happy path: URL branch custom article creation with success feedback", async ({ page }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    let articles: Array<{ id: string; title: string; link: string; published: string }> = [];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feedId === "v1" ? articles : []),
          });
        }
      }
      if (method === "POST" && feedId && isArticles) {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const created = {
          id: "cust1",
          title: body.title || "Fetched Title",
          link: body.link || "https://example.com/page",
          published: body.published_at || new Date().toISOString(),
        };
        articles = [created];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/v1/articles");
    await expect(page.getByRole("button", { name: /添加文章/ })).toBeVisible();
    await page.getByRole("button", { name: /添加文章/ }).click();
    await expect(page.getByLabel(/链接 \(URL\)/)).toBeVisible();
    await page.getByPlaceholder("https://...").fill("https://example.com/page");
    await page.getByRole("button", { name: "提交" }).click();

    await expect(page.getByText("创建成功")).toBeVisible();
    await expect(page.getByText("Fetched Title")).toBeVisible();
  });

  test("Boundary: URL branch create failure shows visible error feedback", async ({ page }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        }
      }
      if (method === "POST" && url.includes("/articles")) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Could not fetch or parse URL for autofill." }),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/v1/articles");
    await page.getByRole("button", { name: /添加文章/ }).click();
    await page.getByPlaceholder("https://...").fill("https://bad.example/");
    await page.getByRole("button", { name: "提交" }).click();

    await expect(page.getByRole("alert")).toContainText(/autofill|创建失败|Could not|fetch|parse/i);
  });

  test("Happy path: no-URL two-step flow — first click fills defaults, second click creates", async ({
    page,
  }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    let articles: Array<{ id: string; title: string; link: string; published: string }> = [];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feedId === "v1" ? articles : []),
          });
        }
      }
      if (method === "POST" && url.includes("/feeds/v1/articles")) {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const created = {
          id: "cust2",
          title: body.title,
          link: body.link || "https://",
          published: body.published_at || new Date().toISOString(),
        };
        articles = [created];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/v1/articles");
    await page.getByRole("button", { name: /添加文章/ }).click();
    await page.getByLabel(/标题/).fill("My Note");
    await page.getByLabel(/内容/).fill("Some content");
    await page.getByRole("button", { name: "提交" }).click();

    await expect(page.getByText(/已填充默认值|请确认后再次点击/)).toBeVisible();
    await expect(page.getByRole("button", { name: "确认创建" })).toBeVisible();

    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText("创建成功")).toBeVisible();
    await expect(page.getByText("My Note")).toBeVisible();
  });

  test("Boundary: no-URL missing title/content shows validation message", async ({ page }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        }
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/v1/articles");
    await page.getByRole("button", { name: /添加文章/ }).click();
    await page.getByLabel(/内容/).fill("Only content");
    await page.getByRole("button", { name: "提交" }).click();

    await expect(page.getByRole("alert")).toContainText(/标题和内容为必填项|必填/);
  });

  test("Regression: normal RSS feed article list has no add-custom-article button", async ({
    page,
  }) => {
    const mockArticles = [
      { id: "a1", title: "RSS Article", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(baseFeeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = baseFeeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feedId === "f1" ? mockArticles : []),
          });
        }
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/f1/articles");
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("RSS Article")).toBeVisible();
    await expect(page.getByRole("button", { name: /添加文章/ })).not.toBeVisible();
  });

  test("Regression: feed management and RSS list navigation still work after custom-article flow", async ({
    page,
  }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    const rssArticles = [
      { id: "a1", title: "RSS One", link: "https://example.com/1", published: "2025-03-01T10:00:00Z" },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          const list = feedId === "f1" ? rssArticles : [];
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(list),
          });
        }
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds");
    await expect(page.getByRole("heading", { name: /RSS 订阅/ })).toBeVisible();
    await expect(page.getByText("Feed One")).toBeVisible();
    await page.getByRole("link", { name: "Feed One" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("RSS One")).toBeVisible();
    await expect(page.getByRole("button", { name: /添加文章/ })).not.toBeVisible();
    await page.getByRole("link", { name: /返回RSS 订阅/ }).click();
    await expect(page.getByRole("heading", { name: /RSS 订阅/, level: 1 })).toBeVisible();
  });

  test("S042: delete article from favorites list and see persistent removal after re-entry", async ({
    page,
  }) => {
    const feeds = [
      ...baseFeeds,
      { id: "v1", title: "Favorites", url: null, feed_type: "virtual" as const },
    ];
    let articles: Array<{ id: string; title: string; link: string; published: string }> = [
      { id: "del1", title: "To Delete", link: "https://example.com/d", published: "2025-03-01T12:00:00Z" },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const deleteMatch = url.match(/^.*\/api\/feeds\/([^/]+)\/articles\/([^/]+)\/?$/);
      if (method === "DELETE" && deleteMatch) {
        const [, feedId, articleId] = deleteMatch;
        if (feedId === "v1") {
          articles = articles.filter((a) => a.id !== articleId);
          return route.fulfill({ status: 204 });
        }
      }
      const { isList, feedId, isArticles } = parseFeedsPath(url);
      if (method === "GET") {
        if (isList) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feeds),
          });
        }
        if (feedId && !isArticles) {
          const feed = feeds.find((f) => f.id === feedId);
          if (feed) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(feed),
            });
          }
        }
        if (feedId && isArticles) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(feedId === "v1" ? articles : []),
          });
        }
      }
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/feeds/v1/articles");
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("To Delete")).toBeVisible();
    await expect(page.getByRole("button", { name: "删除" })).toBeVisible();

    await page.getByTestId("delete-article-del1").click();
    await expect(page.getByText("已删除")).toBeVisible();
    await expect(page.getByText("To Delete")).not.toBeVisible();
    await expect(page.getByText(/暂无文章/)).toBeVisible();

    await page.goto("/favorites");
    await page.getByRole("link", { name: "Favorites" }).click();
    await expect(page.getByRole("heading", { name: /文章列表/ })).toBeVisible();
    await expect(page.getByText("To Delete")).not.toBeVisible();
    await expect(page.getByText(/暂无文章/)).toBeVisible();
  });
});

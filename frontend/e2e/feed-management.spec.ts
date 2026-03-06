/**
 * S009: UI automation for feed management flow.
 * Happy path, boundary/exception, and regression coverage.
 * Runs with mocked API so no backend is required.
 */

import { test, expect } from "@playwright/test";

const initialFeeds = [
  { id: "f1", title: "Feed One", url: "https://example.com/one.xml" },
  { id: "f2", title: "Feed Two", url: "https://example.com/two.xml" },
];

test.describe("Feed management E2E (S009)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(initialFeeds),
        });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "f3",
            title: body.title ?? "New",
            url: body.url ?? "",
          }),
        });
      }
      if (method === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "f1",
            title: body.title ?? "Updated",
            url: body.url ?? "https://example.com/one.xml",
          }),
        });
      }
      if (method === "DELETE") {
        return route.fulfill({ status: 204 });
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

  test("Regression: feed management route loads and baseline list renders", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("heading", { name: /订阅管理/ })).toBeVisible();
    await expect(page.getByText("Feed One")).toBeVisible();
    await expect(page.getByText("Feed Two")).toBeVisible();
    await expect(page.getByRole("link", { name: /首页/ })).toBeVisible();
  });

  test("Happy path: add feed then list shows new feed and UI stays consistent", async ({
    page,
  }) => {
    const feeds = [...initialFeeds];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(feeds),
        });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const newFeed = {
          id: "f3",
          title: body.title ?? "New",
          url: body.url ?? "",
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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/feeds");
    await expect(page.getByText("Feed One")).toBeVisible();

    await page.getByRole("button", { name: /添加/ }).click();
    await page.getByLabel(/标题/).first().fill("New Feed");
    await page.locator("#add-url").fill("https://example.com/new.xml");
    await page.getByRole("button", { name: "确定" }).first().click();

    await expect(page.getByText("New Feed")).toBeVisible();
    await expect(page.getByText("Feed One")).toBeVisible();
    await expect(page.getByText("Feed Two")).toBeVisible();
  });

  test("Happy path: edit feed then list shows updated title", async ({
    page,
  }) => {
    const feeds = [
      { id: "f1", title: "Feed One", url: "https://example.com/one.xml" },
      { id: "f2", title: "Feed Two", url: "https://example.com/two.xml" },
    ];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(feeds),
        });
      }
      if (method === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const idx = feeds.findIndex((f) => f.id === "f1");
        if (idx >= 0 && body.title) feeds[idx].title = body.title;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(feeds[idx >= 0 ? idx : 0]),
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
    await expect(page.getByText("Feed One")).toBeVisible();

    await page.getByRole("button", { name: /编辑.*Feed One/ }).click();
    await page.locator("#edit-title-f1").fill("Feed One Updated");
    await page.getByTestId("edit-feed-form").getByRole("button", { name: "确定" }).click();

    await expect(page.getByText("Feed One Updated")).toBeVisible();
  });

  test("Happy path: delete feed then it disappears from list", async ({
    page,
  }) => {
    const feeds = [...initialFeeds];
    await page.route("**/api/feeds**", async (route) => {
      const method = route.request().method();
      const reqUrl = route.request().url();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(feeds),
        });
      }
      if (method === "DELETE") {
        const feedId = reqUrl.split("/").filter(Boolean).pop();
        const idx = feeds.findIndex((f) => f.id === feedId);
        if (idx >= 0) feeds.splice(idx, 1);
        return route.fulfill({ status: 204 });
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
    await expect(page.getByText("Feed One")).toBeVisible();

    await page.getByRole("button", { name: /删除.*Feed One/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "确认" }).click();

    await expect(page.getByText("Feed One")).not.toBeVisible();
    await expect(page.getByText("Feed Two")).toBeVisible();
  });

  test("Happy path: refresh button reloads list", async ({ page }) => {
    let getCount = 0;
    await page.route("**/api/feeds**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      getCount++;
      const body =
        getCount >= 3
          ? [
              ...initialFeeds,
              { id: "f3", title: "After Refresh", url: "https://example.com/three.xml" },
            ]
          : initialFeeds;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/feeds");
    await expect(page.getByText("Feed One")).toBeVisible();
    await expect(page.getByText("After Refresh")).not.toBeVisible();

    await page.getByRole("button", { name: /刷新/ }).click();
    await expect(page.getByText("After Refresh")).toBeVisible();
  });

  test("Boundary: invalid URL shows explicit error feedback", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await page.getByRole("button", { name: /添加/ }).click();
    await page.getByLabel(/标题/).first().fill("Bad");
    await page.locator("#add-url").fill("not-a-url");
    await page.getByRole("button", { name: "确定" }).first().click();

    await expect(page.getByText(/有效的|URL/)).toBeVisible();
  });

  test("Boundary: createFeed API failure shows visible error feedback", async ({
    page,
  }) => {
    await page.route("**/api/feeds**", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Duplicate URL or server error" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(initialFeeds),
      });
    });

    await page.goto("/feeds");
    await page.getByRole("button", { name: /添加/ }).click();
    await page.getByLabel(/标题/).fill("New");
    await page.getByPlaceholder(/https:\/\/example\.com\/feed\.xml/).fill("https://example.com/rss.xml");
    await page.getByRole("button", { name: "确定" }).first().click();

    await expect(page.getByRole("alert")).toContainText(/失败|错误|Duplicate|server|error/i);
  });

  test("Regression: home to feeds navigation remains stable", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("heading", { name: /订阅管理/ })).toBeVisible();
    await page.getByRole("link", { name: /首页/ }).click();
    await expect(page.getByRole("heading", { name: /RSSight/ })).toBeVisible();
    await page.getByRole("link", { name: /订阅管理/ }).click();
    await expect(page.getByRole("heading", { name: /订阅管理/ })).toBeVisible();
    await expect(page.getByText("Feed One")).toBeVisible();
  });
});

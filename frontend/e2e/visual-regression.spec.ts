/**
 * S018: UI verification for Tailwind visual regression.
 * Critical pages and key UI states (empty, loading, error) with stable baselines.
 * Run with fixed viewport for reproducible screenshots.
 */

import { test, expect } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 375, height: 667 };

test.describe("Visual regression (S018)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.route("**/api/summary-profiles**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
  });

  test("home page matches baseline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("home-desktop.png");
  });

  test("feed management empty state matches baseline", async ({ page }) => {
    await page.route("**/api/feeds**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.continue();
    });
    await page.goto("/feeds");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("feeds-empty-desktop.png");
  });

  test("feed management with list matches baseline", async ({ page }) => {
    await page.route("**/api/feeds**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "f1", title: "Sample Feed", url: "https://example.com/feed.xml" },
          ]),
        });
      }
      return route.continue();
    });
    await page.goto("/feeds");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("feeds-list-desktop.png");
  });

  test("feed management error state matches baseline", async ({ page }) => {
    await page.route("**/api/feeds**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 500, body: "Server error" });
      }
      return route.continue();
    });
    await page.goto("/feeds");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("feeds-error-desktop.png");
  });

  test("summary profiles empty state matches baseline", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("profiles-empty-desktop.png");
  });
});

test.describe("Visual regression narrow viewport (S018)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/summary-profiles**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
  });

  test("home page narrow matches baseline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("home-narrow.png");
  });

  test("feed management empty narrow matches baseline", async ({ page }) => {
    await page.route("**/api/feeds**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.continue();
    });
    await page.goto("/feeds");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("feeds-empty-narrow.png");
  });
});

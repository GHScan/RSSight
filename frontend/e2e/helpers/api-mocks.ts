import type { Page, Route } from "@playwright/test";

/** Last-resort handler so tests never fall through to the Vite proxy. */
export async function fulfillUnmockedApi(route: Route): Promise<void> {
  const pathname = new URL(route.request().url()).pathname;
  return route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ message: "unmocked", path: pathname }),
  });
}

/** Intercept read-later API so E2E does not hit the Vite proxy (no backend). */
export async function mockReadLaterApi(page: Page): Promise<void> {
  await page.route("**/api/read-later**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === "GET" && url.includes("/check")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ in_read_later: false }),
      });
    }
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({ status: 204 });
  });
}

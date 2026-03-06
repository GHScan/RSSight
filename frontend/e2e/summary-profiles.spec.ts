/**
 * S015: UI automation for summary profile management flow.
 * Happy path, boundary/exception, and regression coverage.
 */

import { test, expect } from "@playwright/test";

test.describe("Summary profile E2E (S015)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feeds**", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return route.continue();
    });
    await page.route("**/api/summary-profiles**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { name: "p1", base_url: "https://api.example.com", key: "k1", model: "gpt-4", fields: ["title"], prompt_template: "{title}" },
          ]),
        });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ...body, name: body.name ?? "new" }),
        });
      }
      if (method === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ name: body.name ?? "p1", base_url: body.base_url ?? "https://api.example.com", key: body.key ?? "", model: body.model ?? "gpt-4", fields: body.fields ?? ["title"], prompt_template: body.prompt_template ?? "{title}" }),
        });
      }
      if (method === "DELETE") {
        return route.fulfill({ status: 204 });
      }
      return route.continue();
    });
  });

  test("Regression: profile page loads and baseline list renders", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page.getByRole("heading", { name: /摘要配置/ })).toBeVisible();
    await expect(page.getByText("p1")).toBeVisible();
    await expect(page.getByRole("link", { name: /首页/ })).toBeVisible();
  });

  test("Happy path: create profile and see in list", async ({ page }) => {
    const profiles: Array<{ name: string; base_url: string; key: string; model: string; fields: string[]; prompt_template: string }> = [
      { name: "p1", base_url: "https://api.example.com", key: "k1", model: "gpt-4", fields: ["title"], prompt_template: "{title}" },
    ];
    await page.route("**/api/summary-profiles**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profiles) });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        profiles.push({ ...body, name: body.name ?? "new" });
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(profiles[profiles.length - 1]) });
      }
      return route.continue();
    });

    await page.goto("/profiles");
    await expect(page.getByText("p1")).toBeVisible();
    await page.getByRole("button", { name: /添加/ }).click();
    await page.getByTestId("add-profile-form").getByLabel(/名称/).fill("p2");
    await page.getByTestId("add-profile-form").getByLabel(/API Base URL/).fill("https://api.example.com");
    await page.getByTestId("add-profile-form").getByLabel(/密钥/).fill("k2");
    await page.getByTestId("add-profile-form").getByLabel(/Model/).fill("gpt-4");
    await page.getByTestId("add-profile-form").getByLabel(/提示模板/).fill("{title}");
    await page.getByTestId("add-profile-form").getByRole("button", { name: "确定" }).click();
    await expect(page.getByText("p2")).toBeVisible();
  });

  test("Boundary: submit without name shows validation", async ({ page }) => {
    await page.goto("/profiles");
    await page.getByRole("button", { name: /添加/ }).click();
    const form = page.getByTestId("add-profile-form");
    await form.getByRole("button", { name: "确定" }).click();
    await expect(page.getByRole("alert")).toContainText(/名称|请填写/);
  });

  test("Boundary: API failure on create shows error", async ({ page }) => {
    await page.route("**/api/summary-profiles**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ name: "p1", base_url: "u", key: "k", model: "m", fields: [], prompt_template: "t" }]) });
      }
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "Profile name already exists" }) });
      }
      return route.continue();
    });
    await page.goto("/profiles");
    await page.getByRole("button", { name: /添加/ }).click();
    await page.getByTestId("add-profile-form").getByLabel(/名称/).fill("p1");
    await page.getByTestId("add-profile-form").getByLabel(/API Base URL/).fill("https://api.example.com");
    await page.getByTestId("add-profile-form").getByLabel(/密钥/).fill("k");
    await page.getByTestId("add-profile-form").getByLabel(/Model/).fill("gpt-4");
    await page.getByTestId("add-profile-form").getByLabel(/提示模板/).fill("{title}");
    await page.getByTestId("add-profile-form").getByRole("button", { name: "确定" }).click();
    await expect(page.getByRole("alert")).toContainText(/失败|错误|已存在|already/i);
  });

  test("Regression: nav and list stable", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page.getByRole("heading", { name: /摘要配置/ })).toBeVisible();
    await page.getByRole("link", { name: /首页/ }).click();
    await expect(page.getByRole("heading", { name: /RSSight/ })).toBeVisible();
    await page.getByRole("link", { name: /摘要配置/ }).click();
    await expect(page.getByRole("heading", { name: /摘要配置/ })).toBeVisible();
    await expect(page.getByText("p1")).toBeVisible();
  });
});

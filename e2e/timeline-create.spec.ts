import { expect, test } from "@playwright/test";

test("create message from timeline and persists after refresh", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as free user" }).click();
  await expect(page.getByText("Timeline")).toBeVisible();

  await page
    .getByRole("button", { name: /Schedule message at/ })
    .first()
    .click();

  await page.getByLabel("Phone number").fill("555-123-4567");
  await page.getByLabel("Message").fill("Hello from Playwright");
  await page.getByRole("button", { name: "Schedule" }).click();

  await expect(page.getByText("test@example.com")).toBeVisible();

  await page.reload();
  await expect(page.getByText("test@example.com")).toBeVisible();
});

import { expect, test } from "@playwright/test";

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("dashboard filters failed messages", async ({ page }) => {
  const gatewaySecret = process.env.GATEWAY_SECRET;
  test.skip(!gatewaySecret, "GATEWAY_SECRET is required for gateway status updates.");

  await page.goto("/login");
  await page.getByRole("button", { name: "Login as free user" }).click();
  await expect(page.getByText("Timeline")).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const scheduledLocal = `${formatDateKey(tomorrow)}T10:00:00-06:00`;

  const createResponse = await page.request.post("/api/messages", {
    data: {
      to_handle: "555-123-4567",
      body: "Should fail",
      scheduled_for_local: scheduledLocal,
      timezone: "America/Chicago",
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const { id: failedMessageId } = await createResponse.json();

  const createQueuedResponse = await page.request.post("/api/messages", {
    data: {
      to_handle: "555-987-6543",
      body: "Should stay queued",
      scheduled_for_local: scheduledLocal,
      timezone: "America/Chicago",
    },
  });
  expect(createQueuedResponse.ok()).toBeTruthy();

  const failedResponse = await page.request.post("/api/gateway/status", {
    headers: {
      "X-Gateway-Secret": gatewaySecret ?? "",
    },
    data: {
      messageId: failedMessageId,
      status: "FAILED",
      payload: { error: "Gateway error" },
    },
  });
  expect(failedResponse.ok()).toBeTruthy();

  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard")).toBeVisible();

  await page.getByRole("button", { name: "All statuses" }).click();
  await page.getByRole("option", { name: "Failed" }).click();

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("FAILED")).toBeVisible();
});

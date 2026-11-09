import { expect, test } from "@playwright/test";
import { boot } from "./helpers";

test("the interface is English (stable English only)", async ({ page }) => {
	await boot(page);
	await page.getByTestId("open-settings").click();
	const title = page.getByTestId("settings").locator("h1");
	await expect(title).toHaveText("Settings");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
	await page.getByTestId("settings-back").click();
	await expect(page.getByTestId("open-file")).toContainText("Open file");
});

test.describe("on a non-English phone", () => {
	test.use({ locale: "fr-FR" });
	test("the app stays in stable English", async ({ page }) => {
		await boot(page);
		await expect(page.getByTestId("open-file")).toContainText("Open file");
		await page.getByTestId("open-settings").click();
		const title = page.getByTestId("settings").locator("h1");
		await expect(title).toHaveText("Settings");
	});
});

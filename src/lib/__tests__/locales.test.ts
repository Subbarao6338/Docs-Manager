import { describe, expect, it } from "vitest";
import { formatBytes } from "../backend";
import { LANGUAGES, isRtl, resolveLanguage, t, tn } from "../i18n";

describe("stable English translations", () => {
	it("offers only English", () => {
		expect(LANGUAGES).toEqual([["en", "English"]]);
	});

	it("returns English interface strings", () => {
		expect(t("Open file")).toBe("Open file");
		expect(t("Page {n}", { n: 4 })).toBe("Page 4");
	});

	it("handles English plurals correctly", () => {
		expect(tn(1, "{n} page", "{n} pages")).toBe("1 page");
		expect(tn(3, "{n} page", "{n} pages")).toBe("3 pages");
	});

	it("formats bytes in English", () => {
		expect(formatBytes(730)).toBe("730 B");
		expect(formatBytes(1_572_864)).toBe("1.5 MB");
	});

	it("uses LTR layout only", () => {
		expect(isRtl("en")).toBe(false);
		expect(document.documentElement.dir).toBe("ltr");
	});

	it("resolves to English for any preferred languages", () => {
		expect(resolveLanguage("system", ["de-DE", "fr-CA", "en"])).toBe("en");
		expect(resolveLanguage("system", ["zh-CN"])).toBe("en");
	});
});

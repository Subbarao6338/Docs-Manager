import { describe, expect, it } from "vitest";
import { convertDocument, getAvailableTargets } from "../converter";

describe("converter engine", () => {
	it("detects available targets for spreadsheets and tabular files", () => {
		const targets = getAvailableTargets("sheet.csv");
		const ids = targets.map((t) => t.id);
		expect(ids).toContain("xlsx");
		expect(ids).toContain("json");
		expect(ids).toContain("tsv");
	});

	it("detects available targets for markdown files", () => {
		const targets = getAvailableTargets("readme.mdx");
		const ids = targets.map((t) => t.id);
		expect(ids).toContain("html");
		expect(ids).toContain("txt");
		expect(ids).toContain("pdf");
	});

	it("converts CSV to XLSX", async () => {
		const csv = "Name,Age\nAlice,30\nBob,25";
		const data = new TextEncoder().encode(csv).buffer;
		const result = await convertDocument(data, "test.csv", "xlsx");
		expect(result.extension).toBe("xlsx");
		expect(result.filename).toBe("test.xlsx");
		expect(result.data.length).toBeGreaterThan(0);
	});

	it("converts CSV to JSON", async () => {
		const csv = "Name,Age\nAlice,30";
		const data = new TextEncoder().encode(csv).buffer;
		const result = await convertDocument(data, "test.csv", "json");
		expect(result.extension).toBe("json");
		const parsed = JSON.parse(new TextDecoder().decode(result.data));
		expect(parsed[0].Name).toBe("Alice");
		expect(Number(parsed[0].Age)).toBe(30);
	});

	it("converts JSON to CSV", async () => {
		const json = JSON.stringify([{ Product: "Pen", Price: 2 }]);
		const data = new TextEncoder().encode(json).buffer;
		const result = await convertDocument(data, "items.json", "csv");
		expect(result.extension).toBe("csv");
		const text = new TextDecoder().decode(result.data);
		expect(text).toContain("Product");
		expect(text).toContain("Pen");
	});

	it("converts Markdown to HTML", async () => {
		const md = "# Title\n\nHello world";
		const data = new TextEncoder().encode(md).buffer;
		const result = await convertDocument(data, "doc.md", "html");
		expect(result.extension).toBe("html");
		const text = new TextDecoder().decode(result.data);
		expect(text).toContain("<h1");
		expect(text).toContain("Title</h1>");
		expect(text).toContain("Hello world");
	});

	it("converts Text to PDF", async () => {
		const text = "Hello Sark Docs\nSecond line";
		const data = new TextEncoder().encode(text).buffer;
		const result = await convertDocument(data, "notes.txt", "pdf");
		expect(result.extension).toBe("pdf");
		expect(result.data.length).toBeGreaterThan(100);
		// Check PDF header
		const header = new TextDecoder().decode(result.data.slice(0, 5));
		expect(header).toBe("%PDF-");
	});
});

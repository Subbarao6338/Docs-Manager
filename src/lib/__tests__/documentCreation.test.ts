import { describe, expect, it } from "vitest";
import {
	createNewPdf,
	createNewPresentation,
	createNewWordDoc,
	createNewWorkbook,
} from "../documentCreation";

describe("Document Creation", () => {
	it("creates a valid blank PDF document", async () => {
		const bytes = await createNewPdf("Test PDF");
		expect(bytes.byteLength).toBeGreaterThan(100);
		// Starts with %PDF
		const header = new TextDecoder().decode(bytes.slice(0, 5));
		expect(header).toBe("%PDF-");
	});

	it("creates a valid Word docx document", () => {
		const bytes = createNewWordDoc("Test Word Doc");
		expect(bytes.byteLength).toBeGreaterThan(100);
		// Starts with PK zip header
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
	});

	it("creates a valid Excel xlsx workbook", () => {
		const bytes = createNewWorkbook("MySheet");
		expect(bytes.byteLength).toBeGreaterThan(100);
		// Starts with PK zip header
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
	});

	it("creates a valid PowerPoint pptx presentation", () => {
		const bytes = createNewPresentation("My Slides");
		expect(bytes.byteLength).toBeGreaterThan(100);
		// Starts with PK zip header
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
	});
});

/**
 * Sark Docs universal document conversion engine.
 * Converts between spreadsheets, data tables, text, documents, and images.
 */

import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import * as XLSX from "xlsx";
import { type FileFormat, extensionOf, formatFromName } from "./formats";
import { decodeText } from "./text";

export type ConvertTarget =
	| "pdf"
	| "xlsx"
	| "csv"
	| "tsv"
	| "json"
	| "txt"
	| "md"
	| "html"
	| "png"
	| "jpeg"
	| "webp";

export interface ConversionOption {
	id: ConvertTarget;
	label: string;
	mime: string;
	extension: string;
}

const TARGETS: Record<ConvertTarget, ConversionOption> = {
	pdf: {
		id: "pdf",
		label: "PDF Document (.pdf)",
		mime: "application/pdf",
		extension: "pdf",
	},
	xlsx: {
		id: "xlsx",
		label: "Excel Workbook (.xlsx)",
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		extension: "xlsx",
	},
	csv: {
		id: "csv",
		label: "Comma Separated Values (.csv)",
		mime: "text/csv",
		extension: "csv",
	},
	tsv: {
		id: "tsv",
		label: "Tab Separated Values (.tsv)",
		mime: "text/tab-separated-values",
		extension: "tsv",
	},
	json: {
		id: "json",
		label: "JSON Data (.json)",
		mime: "application/json",
		extension: "json",
	},
	txt: {
		id: "txt",
		label: "Plain Text (.txt)",
		mime: "text/plain",
		extension: "txt",
	},
	md: {
		id: "md",
		label: "Markdown (.md)",
		mime: "text/markdown",
		extension: "md",
	},
	html: {
		id: "html",
		label: "HTML Document (.html)",
		mime: "text/html",
		extension: "html",
	},
	png: {
		id: "png",
		label: "PNG Image (.png)",
		mime: "image/png",
		extension: "png",
	},
	jpeg: {
		id: "jpeg",
		label: "JPEG Image (.jpg)",
		mime: "image/jpeg",
		extension: "jpg",
	},
	webp: {
		id: "webp",
		label: "WEBP Image (.webp)",
		mime: "image/webp",
		extension: "webp",
	},
};

/** Get the list of possible conversion targets for a given file name and format */
export function getAvailableTargets(
	name: string,
	format?: FileFormat,
): ConversionOption[] {
	const ext = extensionOf(name);
	const fmt = format ?? formatFromName(name);

	if (
		fmt === "xlsx" ||
		fmt === "xls" ||
		fmt === "ods" ||
		fmt === "csv" ||
		fmt === "parquet" ||
		ext === "tsv"
	) {
		return [
			TARGETS.xlsx,
			TARGETS.csv,
			TARGETS.tsv,
			TARGETS.json,
			TARGETS.html,
			TARGETS.txt,
			TARGETS.pdf,
		];
	}

	if (ext === "json") {
		return [
			TARGETS.json,
			TARGETS.csv,
			TARGETS.tsv,
			TARGETS.xlsx,
			TARGETS.txt,
			TARGETS.html,
		];
	}

	if (fmt === "md" || ext === "md" || ext === "mdx") {
		return [TARGETS.html, TARGETS.txt, TARGETS.pdf, TARGETS.md];
	}

	if (fmt === "txt" || ext === "txt" || ext === "log") {
		return [TARGETS.pdf, TARGETS.md, TARGETS.html, TARGETS.txt];
	}

	if (fmt === "docx" || fmt === "doc" || fmt === "odt" || fmt === "rtf") {
		return [TARGETS.txt, TARGETS.html, TARGETS.md, TARGETS.pdf];
	}

	if (fmt === "pdf") {
		return [TARGETS.txt, TARGETS.png, TARGETS.jpeg];
	}

	if (fmt === "image") {
		return [TARGETS.png, TARGETS.jpeg, TARGETS.webp, TARGETS.pdf];
	}

	return [TARGETS.txt, TARGETS.pdf];
}

/** Converts plain text lines into a simple standard PDF file */
export async function textToPdf(text: string): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const fontSize = 10;
	const lineHeight = 14;
	const margin = 40;
	const pageWidth = 595.28; // A4
	const pageHeight = 841.89; // A4
	const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);

	const lines = text.split(/\r?\n/);
	const chunks: string[][] = [];
	for (let i = 0; i < lines.length; i += linesPerPage) {
		chunks.push(lines.slice(i, i + linesPerPage));
	}
	if (chunks.length === 0) chunks.push([""]);

	for (const chunk of chunks) {
		const page = doc.addPage([pageWidth, pageHeight]);
		let y = pageHeight - margin - fontSize;
		for (const line of chunk) {
			// Sanitize line for winansi
			const cleanLine = line
				.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
				.slice(0, 110);
			page.drawText(cleanLine, {
				x: margin,
				y,
				size: fontSize,
				font,
				color: rgb(0.1, 0.1, 0.1),
			});
			y -= lineHeight;
		}
	}

	return await doc.save();
}

/** Parses Parquet rows into a 2D array [headers, ...rows] */
async function parseParquetToAoa(data: ArrayBuffer): Promise<unknown[][]> {
	const { parquetRead } = await import("hyparquet");
	const headers: string[] = [];
	return new Promise<unknown[][]>((resolve, reject) => {
		parquetRead({
			file: data,
			onChunk: (chunk) => {
				if (!headers.includes(chunk.columnName)) {
					headers.push(chunk.columnName);
				}
			},
			onComplete: (parsedRows: unknown[][]) => {
				const aoa: unknown[][] = [headers, ...parsedRows];
				resolve(aoa);
			},
		}).catch(reject);
	});
}

/** Converts any tabular data buffer (XLSX, CSV, TSV, Parquet, JSON) into a standard workbook */
export async function bufferToWorkbook(
	data: ArrayBuffer,
	name: string,
): Promise<XLSX.WorkBook> {
	const ext = extensionOf(name);
	if (ext === "parquet" || ext === "pq") {
		const aoa = await parseParquetToAoa(data);
		const wb = XLSX.utils.book_new();
		const ws = XLSX.utils.aoa_to_sheet(aoa);
		XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
		return wb;
	}

	if (ext === "json") {
		const str = decodeText(data);
		const json = JSON.parse(str);
		const rows = Array.isArray(json) ? json : [json];
		const wb = XLSX.utils.book_new();
		const ws = XLSX.utils.json_to_sheet(rows);
		XLSX.utils.book_append_sheet(wb, ws, "Data");
		return wb;
	}

	if (ext === "csv" || ext === "tsv") {
		const text = decodeText(data);
		return XLSX.read(text, { type: "string" });
	}

	return XLSX.read(data, { type: "array" });
}

/**
 * Universal convert document function.
 * Given a file's buffer, filename, and desired target format, generates converted file data.
 */
export async function convertDocument(
	data: ArrayBuffer,
	name: string,
	target: ConvertTarget,
): Promise<{
	data: Uint8Array;
	mime: string;
	extension: string;
	filename: string;
}> {
	const ext = extensionOf(name);
	const baseName = name.replace(/\.[^/.]+$/, "");
	const option = TARGETS[target];

	// 1. Tabular / Spreadsheet conversions
	const isTabular =
		["xlsx", "xls", "ods", "csv", "tsv", "parquet", "pq", "json"].includes(
			ext,
		) || ["xlsx", "csv", "tsv", "json"].includes(target);

	if (isTabular) {
		const wb = await bufferToWorkbook(data, name);
		const firstSheetName = wb.SheetNames[0] ?? "Sheet1";
		const ws = wb.Sheets[firstSheetName] ?? {};

		if (target === "xlsx") {
			const buf = XLSX.write(wb, {
				type: "array",
				bookType: "xlsx",
			}) as Uint8Array;
			return {
				data: new Uint8Array(buf),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "csv") {
			const csv = XLSX.utils.sheet_to_csv(ws);
			return {
				data: new TextEncoder().encode(csv),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "tsv") {
			const tsv = XLSX.utils.sheet_to_csv(ws, { FS: "\t" });
			return {
				data: new TextEncoder().encode(tsv),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "json") {
			const json = XLSX.utils.sheet_to_json(ws);
			const formatted = JSON.stringify(json, null, 2);
			return {
				data: new TextEncoder().encode(formatted),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "html") {
			const html = XLSX.utils.sheet_to_html(ws);
			return {
				data: new TextEncoder().encode(html),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "txt") {
			const txt = XLSX.utils.sheet_to_txt(ws);
			return {
				data: new TextEncoder().encode(txt),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}

		if (target === "pdf") {
			const txt = XLSX.utils.sheet_to_txt(ws);
			const pdfData = await textToPdf(txt);
			return {
				data: pdfData,
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}
	}

	// 2. Text / Markdown / Code conversions
	if (
		["md", "mdx", "txt", "html", "xml", "json"].includes(ext) ||
		["txt", "md", "html", "pdf"].includes(target)
	) {
		const text = decodeText(data);
		if (target === "txt") {
			return {
				data: new TextEncoder().encode(text),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}
		if (target === "md") {
			return {
				data: new TextEncoder().encode(text),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}
		if (target === "html") {
			const { marked } = await import("marked");
			const html = marked.parse(text) as string;
			const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;}</style></head><body>${html}</body></html>`;
			return {
				data: new TextEncoder().encode(fullHtml),
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}
		if (target === "pdf") {
			const pdfData = await textToPdf(text);
			return {
				data: pdfData,
				mime: option.mime,
				extension: option.extension,
				filename: `${baseName}.${option.extension}`,
			};
		}
	}

	// 3. Fallback: plain text conversion
	const fallbackText = decodeText(data);
	return {
		data: new TextEncoder().encode(fallbackText),
		mime: "text/plain",
		extension: "txt",
		filename: `${baseName}.txt`,
	};
}

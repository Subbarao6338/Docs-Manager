/**
 * Document creation helpers for Sark Docs Manager:
 * Enables creation of blank or templated PDF, Word (.docx),
 * Excel (.xlsx), and PowerPoint (.pptx) documents.
 */
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { zipSync, strToU8 } from "fflate";
import * as XLSX from "xlsx";

/** Create a new blank PDF document */
export async function createNewPdf(title = "Untitled Document"): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595.28, 841.89]); // A4
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

	page.drawText(title, {
		x: 50,
		y: 841.89 - 60,
		size: 20,
		font: fontBold,
		color: rgb(0.15, 0.15, 0.15),
	});

	page.drawText("Start typing or add text, images, and annotations.", {
		x: 50,
		y: 841.89 - 95,
		size: 11,
		font,
		color: rgb(0.4, 0.4, 0.4),
	});

	return doc.save();
}

/** Create a new Word (.docx) document */
export function createNewWordDoc(title = "Untitled Document"): Uint8Array {
	const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="40"/></w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Welcome to your new document created with Sark Docs Manager.</w:t>
      </w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

	const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

	const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

	const zipEntries: Record<string, Uint8Array> = {
		"[Content_Types].xml": strToU8(contentTypesXml),
		"_rels/.rels": strToU8(relsXml),
		"word/document.xml": strToU8(documentXml),
	};

	return zipSync(zipEntries);
}

/** Create a new Excel (.xlsx) workbook */
export function createNewWorkbook(sheetName = "Sheet1"): Uint8Array {
	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.aoa_to_sheet([
		["Title", "Quantity", "Price", "Total"],
		["Item 1", 10, 25, 250],
		["Item 2", 5, 40, 200],
	]);
	XLSX.utils.book_append_sheet(wb, ws, sheetName);
	const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
	return new Uint8Array(out);
}

/** Create a new PowerPoint (.pptx) presentation */
export function createNewPresentation(title = "Untitled Presentation"): Uint8Array {
	const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="ctrTitle"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1524000" y="2743200"/><a:ext cx="9144000" cy="1828800"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr sz="4400" b="1"/>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

	const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`;

	const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

	const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

	const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

	const zipEntries: Record<string, Uint8Array> = {
		"[Content_Types].xml": strToU8(contentTypesXml),
		"_rels/.rels": strToU8(rootRels),
		"ppt/presentation.xml": strToU8(presentationXml),
		"ppt/_rels/presentation.xml.rels": strToU8(presentationRels),
		"ppt/slides/slide1.xml": strToU8(slideXml),
	};

	return zipSync(zipEntries);
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

import { formatBytes } from "@/lib/backend";
import {
	type ConvertTarget,
	convertDocument,
	getAvailableTargets,
} from "@/lib/converter";
import { contentKey, fileSample } from "@/lib/docMarks";
import { unreadNote } from "@/lib/errors";
import { copyName, splitName } from "@/lib/fileName";
import { msg, t, tn } from "@/lib/i18n";
import { drawPage } from "@/lib/pagePicture";
import {
	MARK_COLORS,
	type MarkSize,
	type NumberSpot,
	type PAPER,
	type PagePick,
	type PaperTurn,
	addPageNumbers,
	addWatermark,
	blankPagePdf,
	buildPdf,
	compressPdf,
	cropPdf,
	deletePagesPdf,
	digitallySigned,
	flattenPdf,
	imagesToPdf,
	parsePages,
	pdfMetadata,
	protect,
	removeAnnotations,
	repairPdf,
	reversePdf,
	rotateAllPages,
	standardText,
	unlock,
} from "@/lib/pdfTools";
import { sniffFormat } from "@/lib/sniff";
import { decodeText } from "@/lib/text";
import type { OpenRequest } from "@/lib/types";
import { useBackClose, useNav } from "@/state/navigation";
import { Button, IconButton, toast } from "@/ui";
import { zipSync } from "fflate";
import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
	ArrowUpDown,
	BarChart2,
	Braces,
	Camera,
	Check,
	Combine,
	Crop,
	Droplet,
	Eraser,
	FileCheck,
	FileDown,
	FileImage,
	FilePlus2,
	FileText,
	Hash,
	Highlighter,
	Images,
	LayoutGrid,
	LockKeyhole,
	LockKeyholeOpen,
	PenLine,
	RotateCcw,
	RotateCw,
	ScanLine,
	Scissors,
	ShieldCheck,
	Sparkles,
	Tag,
	TextSearch,
	Trash2,
	Wrench,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useDocMarks } from "../viewer/useDocMarks";
import { FillSign } from "./FillSign";
import { MarkUp } from "./MarkUp";
import { ReadText } from "./ReadText";
import s from "./Tools.module.css";
import {
	Choice,
	FileList,
	Go,
	PageThumb,
	type ToolFile,
	usePdf,
	useRun,
	useToolFiles,
} from "./kit";
import { recodePicture } from "./pdfFiles";
import { type ReadSource, bytesSource, pdfSource } from "./readSource";
import { announceSaved } from "./saved";
import { ScanTool } from "./scan/ScanTool";

export type ToolId =
	| "convert"
	| "stats"
	| "formatData"
	| "sign"
	| "scan"
	| "markup"
	| "compress"
	| "ocr"
	| "merge"
	| "organize"
	| "extract"
	| "images"
	| "pictures"
	| "numbers"
	| "watermark"
	| "protect"
	| "unlock"
	| "rotateAll"
	| "reverse"
	| "deletePages"
	| "crop"
	| "flatten"
	| "removeAnnots"
	| "extractText"
	| "blankPage"
	| "metadata"
	| "repair";

const PDF = "application/pdf";

/** The tools, as the list shows them. */
const TOOLS: Array<{
	id: ToolId;
	icon: ReactNode;
	title: string;
	hint: string;
}> = [
	{
		id: "convert",
		icon: <ArrowLeftRight size={22} />,
		title: msg("Document converter"),
		hint: msg("Convert documents, spreadsheets, text, and images"),
	},
	{
		id: "stats",
		icon: <BarChart2 size={22} />,
		title: msg("Document statistics"),
		hint: msg("Word count, character count, and reading metrics"),
	},
	{
		id: "formatData",
		icon: <Braces size={22} />,
		title: msg("Format & validate data"),
		hint: msg("Beautify, format, and validate JSON or data"),
	},
	{
		id: "sign",
		icon: <PenLine size={22} />,
		title: msg("Fill & sign"),
		hint: msg("Fill in a form and sign it"),
	},
	{
		id: "scan",
		icon: <ScanLine size={22} />,
		title: msg("Scan a document"),
		hint: msg("Photos of paper as a clean, straight PDF"),
	},
	{
		id: "markup",
		icon: <Highlighter size={22} />,
		title: msg("Mark up"),
		hint: msg("Write on a PDF, highlight words, add notes"),
	},
	{
		id: "compress",
		icon: <FileDown size={22} />,
		title: msg("Compress PDF"),
		hint: msg("A smaller copy, easier to send"),
	},
	{
		id: "ocr",
		icon: <TextSearch size={22} />,
		title: msg("Read text"),
		hint: msg("Get the words from a PDF, a scan or a photo"),
	},
	{
		id: "merge",
		icon: <Combine size={22} />,
		title: msg("Merge PDFs"),
		hint: msg("Put several PDFs together, in the order you choose"),
	},
	{
		id: "organize",
		icon: <LayoutGrid size={22} />,
		title: msg("Organize pages"),
		hint: msg("Turn, move or take out pages"),
	},
	{
		id: "extract",
		icon: <Scissors size={22} />,
		title: msg("Split or extract pages"),
		hint: msg("Some pages as a new PDF, or every page as its own"),
	},
	{
		id: "images",
		icon: <Images size={22} />,
		title: msg("Pictures to PDF"),
		hint: msg("Photos or scans as the pages of one PDF"),
	},
	{
		id: "pictures",
		icon: <FileImage size={22} />,
		title: msg("PDF to pictures"),
		hint: msg("Each page as a JPEG or PNG picture"),
	},
	{
		id: "numbers",
		icon: <Hash size={22} />,
		title: msg("Page numbers"),
		hint: msg("Number every page"),
	},
	{
		id: "watermark",
		icon: <Droplet size={22} />,
		title: msg("Watermark"),
		hint: msg("A word such as DRAFT across every page"),
	},
	{
		id: "protect",
		icon: <LockKeyhole size={22} />,
		title: msg("Add a password"),
		hint: msg("A copy that asks for a password to open"),
	},
	{
		id: "unlock",
		icon: <LockKeyholeOpen size={22} />,
		title: msg("Remove a password"),
		hint: msg("A copy that opens without one, if you know it"),
	},
	{
		id: "rotateAll",
		icon: <RotateCw size={22} />,
		title: msg("Rotate all pages"),
		hint: msg("Turn all pages clockwise or upside-down"),
	},
	{
		id: "reverse",
		icon: <ArrowUpDown size={22} />,
		title: msg("Reverse page order"),
		hint: msg("Flip pages backwards from end to beginning"),
	},
	{
		id: "deletePages",
		icon: <Trash2 size={22} />,
		title: msg("Delete pages"),
		hint: msg("Remove unwanted pages from your document"),
	},
	{
		id: "crop",
		icon: <Crop size={22} />,
		title: msg("Crop margins"),
		hint: msg("Trim blank margins from every page"),
	},
	{
		id: "flatten",
		icon: <FileCheck size={22} />,
		title: msg("Flatten forms & marks"),
		hint: msg("Make all form fields and annotations permanent"),
	},
	{
		id: "removeAnnots",
		icon: <Eraser size={22} />,
		title: msg("Remove annotations"),
		hint: msg("Clear all ink, notes, and highlights"),
	},
	{
		id: "extractText",
		icon: <FileText size={22} />,
		title: msg("Extract text (.txt)"),
		hint: msg("Save all readable text as a plain text file"),
	},
	{
		id: "blankPage",
		icon: <FilePlus2 size={22} />,
		title: msg("Insert blank pages"),
		hint: msg("Add blank sheets at start, end, or between pages"),
	},
	{
		id: "metadata",
		icon: <Tag size={22} />,
		title: msg("Edit document info"),
		hint: msg("Change title, author, and description"),
	},
	{
		id: "repair",
		icon: <Wrench size={22} />,
		title: msg("Repair document"),
		hint: msg("Rebuild structure to fix corrupted or damaged PDFs"),
	},
];

const GROUPS = [
	{
		title: msg("Arrange your pages"),
		ids: [
			"merge",
			"organize",
			"extract",
			"rotateAll",
			"reverse",
			"deletePages",
			"blankPage",
		],
	},
	{
		title: msg("Convert your files"),
		ids: [
			"convert",
			"stats",
			"formatData",
			"ocr",
			"compress",
			"images",
			"pictures",
			"extractText",
		],
	},
	{
		title: msg("Add the finishing touches"),
		ids: [
			"markup",
			"numbers",
			"watermark",
			"protect",
			"unlock",
			"metadata",
			"crop",
		],
	},
	{
		title: msg("Document cleanup & privacy"),
		ids: ["flatten", "removeAnnots", "repair"],
	},
];

const GUIDANCE: Record<ToolId, string> = {
	convert: msg(
		"Choose any document, spreadsheet, data file or image, choose target format, and save the converted file.",
	),
	stats: msg(
		"Choose any document or text file to analyze word count, character count, lines, and reading time.",
	),
	formatData: msg(
		"Validate, format, prettify, or minify JSON data, spreadsheets, and structured text.",
	),
	sign: msg(
		"Choose your PDF, add your details and signature, then save a copy.",
	),
	scan: msg(
		"Photograph each page, check its edges and pick a look, then save them all as one PDF.",
	),
	markup: msg(
		"Choose a PDF, write on it or highlight its words, then save a copy.",
	),
	compress: msg(
		"Choose a PDF and how small to make it. Its pictures are stored again at a lower quality.",
	),
	ocr: msg(
		"Choose a PDF or a picture. You'll watch it being read, and its text will appear on the screen.",
	),
	merge: msg(
		"Add at least two PDFs. Arrange them from top to bottom, then save them as one file.",
	),
	organize: msg(
		"Choose a PDF, select the pages you want to change, then save a copy.",
	),
	extract: msg("Choose a PDF and enter the page numbers you want to keep."),
	images: msg(
		"Add your pictures in the order you want them to appear in the PDF.",
	),
	pictures: msg(
		"Choose a PDF to save its pages as pictures, together in a ZIP file.",
	),
	numbers: msg(
		"Choose a PDF, then choose where and how the page numbers appear.",
	),
	watermark: msg(
		"Choose a PDF and enter a word, such as DRAFT, to put across every page.",
	),
	protect: msg("Choose a PDF and set a password for the new copy."),
	unlock: msg(
		"Choose a locked PDF and enter its current password to save an unlocked copy.",
	),
	rotateAll: msg("Choose a PDF and the angle to rotate all its pages at once."),
	reverse: msg("Choose a PDF to reverse its entire page sequence."),
	deletePages: msg("Choose a PDF and specify the page numbers to remove."),
	crop: msg("Choose a PDF and specify margin amounts to trim from the pages."),
	flatten: msg(
		"Choose a PDF to convert all form fields and annotations into permanent content.",
	),
	removeAnnots: msg(
		"Choose a PDF to remove all comments, notes, ink and highlights.",
	),
	extractText: msg(
		"Choose a PDF to extract its entire text content as a plain text file.",
	),
	blankPage: msg("Choose a PDF and where to insert clean blank pages."),
	metadata: msg(
		"Choose a PDF and customize its title, author, and description.",
	),
	repair: msg(
		"Choose a PDF to rebuild and repair its internal document structure.",
	),
};

/**
 * The tools people otherwise find a website or another app for, on the
 * device: fill in and sign a form, put PDFs together and apart, turn
 * pictures into a PDF and back, number pages, mark them, lock and
 * unlock them. Each one makes a new file the reader saves where they
 * like; nothing leaves the device and the files picked stay as they are.
 */
export function ToolsScreen({
	start,
	file,
	onOpen,
}: {
	/** Open straight into one tool... */
	start?: ToolId;
	/** ...with this file in it. */
	file?: OpenRequest;
	onOpen: (request: OpenRequest) => void;
}) {
	const { back } = useNav();
	const [tool, setTool] = useState<ToolId | null>(start ?? null);
	// Back from a tool opened from the list returns to the list.
	useBackClose("tool", !!tool && !start, () => setTool(null));
	const shown = TOOLS.find((x) => x.id === tool);
	const heading = useRef<HTMLHeadingElement>(null);
	const previousTool = useRef(tool);
	useEffect(() => {
		if (previousTool.current === tool) return;
		if (tool) heading.current?.focus();
		else
			document
				.querySelector<HTMLButtonElement>(
					`[data-testid="tool-${previousTool.current}"]`,
				)
				?.focus();
		previousTool.current = tool;
	}, [tool]);
	const card = (x: (typeof TOOLS)[number], featured = false) => (
		<button
			key={x.id}
			type="button"
			className={featured ? s.featured : s.toolCard}
			onClick={() => setTool(x.id)}
			data-testid={`tool-${x.id}`}
		>
			<span className={s.toolIcon}>{x.icon}</span>
			<span className={s.toolText}>
				{featured && (
					<span className={s.eyebrow}>
						{x.id === "scan" ? t("Paper to PDF") : t("Forms made simple")}
					</span>
				)}
				<strong>{t(x.title)}</strong>
				<span>{t(x.hint)}</span>
				{featured && (
					<span className={s.featuredAction}>
						{t("Get started")} <ArrowRight size={16} className="pw-flip" />
					</span>
				)}
			</span>
			{featured ? (
				<span
					className={s.paperArt}
					data-art={x.id === "scan" ? "scan" : undefined}
					aria-hidden="true"
				>
					<span />
					<span />
					{x.id === "scan" ? <Camera size={26} /> : <PenLine size={28} />}
					{x.id === "scan" ? <Sparkles size={18} /> : <Check size={18} />}
				</span>
			) : (
				<ArrowRight className={`${s.cardArrow} pw-flip`} size={18} />
			)}
		</button>
	);

	return (
		<div className={s.screen} data-testid="tools">
			<header className={s.screenBar} data-tauri-drag-region="deep">
				<IconButton
					label={t("Back")}
					onClick={() => (tool && !start ? setTool(null) : back())}
					data-testid="tools-back"
				>
					<ArrowLeft size={22} className="pw-flip" />
				</IconButton>
				<h1 ref={heading} tabIndex={-1} className={s.screenTitle}>
					{shown ? t(shown.title) : t("Tools")}
				</h1>
			</header>
			<main className={s.screenScroll}>
				<div className={`${s.column} ${tool ? s.workspace : ""}`}>
					{!tool && (
						<>
							<div className={s.intro}>
								<div>
									<p className={s.eyebrow}>
										{t("A little help with your paperwork")}
									</p>
									<h2>{t("What would you like to do?")}</h2>
									<p className={s.lead}>
										{t("Choose a tool below. We'll guide you through it.")}
									</p>
								</div>
								<span className={s.privacy}>
									<ShieldCheck size={18} />
									{t("Private. On your device.")}
								</span>
							</div>
							<div className={s.featuredRow}>
								{card(TOOLS[0], true)}
								{card(TOOLS[1], true)}
							</div>
							{GROUPS.map((group) => (
								<section
									className={s.toolGroup}
									key={group.title}
									aria-label={t(group.title)}
								>
									<h3>{t(group.title)}</h3>
									<div className={s.toolList}>
										{TOOLS.filter((x) => group.ids.includes(x.id)).map((x) =>
											card(x),
										)}
									</div>
								</section>
							))}
							<p className={s.safetyNote}>
								<ShieldCheck size={16} />
								{t(
									"Everything happens on this device. The files you pick stay as they are: each tool saves a new one.",
								)}
							</p>
						</>
					)}
					{tool && shown && (
						<div className={s.taskIntro}>
							<span className={s.toolIcon}>{shown.icon}</span>
							<div>
								<h2>{t(shown.hint)}</h2>
								<p>{t(GUIDANCE[tool])}</p>
							</div>
						</div>
					)}
					<div className={tool ? s.taskPanel : undefined}>
						{tool === "convert" && <ConvertTool file={file} onOpen={onOpen} />}
						{tool === "stats" && <StatsTool file={file} onOpen={onOpen} />}
						{tool === "formatData" && (
							<FormatDataTool file={file} onOpen={onOpen} />
						)}
						{tool === "sign" && <SignTool file={file} onOpen={onOpen} />}
						{tool === "scan" && <ScanTool file={file} onOpen={onOpen} />}
						{tool === "markup" && <MarkUpTool file={file} onOpen={onOpen} />}
						{tool === "compress" && (
							<CompressTool file={file} onOpen={onOpen} />
						)}
						{tool === "ocr" && <ReadTool file={file} onOpen={onOpen} />}
						{tool === "merge" && <MergeTool file={file} onOpen={onOpen} />}
						{tool === "organize" && (
							<OrganizeTool file={file} onOpen={onOpen} />
						)}
						{tool === "extract" && <ExtractTool file={file} onOpen={onOpen} />}
						{tool === "images" && <ImagesTool file={file} onOpen={onOpen} />}
						{tool === "pictures" && (
							<PicturesTool file={file} onOpen={onOpen} />
						)}
						{tool === "numbers" && <NumbersTool file={file} onOpen={onOpen} />}
						{tool === "watermark" && (
							<WatermarkTool file={file} onOpen={onOpen} />
						)}
						{tool === "protect" && <ProtectTool file={file} onOpen={onOpen} />}
						{tool === "unlock" && <UnlockTool file={file} onOpen={onOpen} />}
						{tool === "rotateAll" && (
							<RotateAllTool file={file} onOpen={onOpen} />
						)}
						{tool === "reverse" && <ReverseTool file={file} onOpen={onOpen} />}
						{tool === "deletePages" && (
							<DeletePagesTool file={file} onOpen={onOpen} />
						)}
						{tool === "crop" && <CropTool file={file} onOpen={onOpen} />}
						{tool === "flatten" && <FlattenTool file={file} onOpen={onOpen} />}
						{tool === "removeAnnots" && (
							<RemoveAnnotsTool file={file} onOpen={onOpen} />
						)}
						{tool === "extractText" && (
							<ExtractTextTool file={file} onOpen={onOpen} />
						)}
						{tool === "blankPage" && (
							<BlankPageTool file={file} onOpen={onOpen} />
						)}
						{tool === "metadata" && (
							<MetadataTool file={file} onOpen={onOpen} />
						)}
						{tool === "repair" && <RepairTool file={file} onOpen={onOpen} />}
					</div>
					{tool && (
						<p className={s.safetyNote}>
							<ShieldCheck size={16} />
							{t("Your original files stay unchanged.")}
						</p>
					)}
				</div>
			</main>
		</div>
	);
}

interface ToolProps {
	file?: OpenRequest;
	onOpen: (request: OpenRequest) => void;
}

function ConvertTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("all", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const targets = useMemo(
		() => (picked ? getAvailableTargets(picked.name) : []),
		[picked],
	);
	const [target, setTarget] = useState<ConvertTarget>("pdf");

	useEffect(() => {
		if (targets.length > 0 && !targets.some((t) => t.id === target)) {
			setTarget(targets[0].id);
		}
	}, [targets, target]);

	return (
		<>
			<FileList
				kit={kit}
				several={false}
				addLabel={t("Choose any document or file")}
			/>
			{picked && targets.length > 0 && (
				<Choice
					label={t("Convert to")}
					options={targets.map((tg) => [tg.id, tg.label] as [ConvertTarget, string])}
					value={target}
					onChange={(val) => setTarget(val as ConvertTarget)}
					testId="tool-convert-target"
				/>
			)}
			{feedback}
			<Go
				label={t("Convert & Save")}
				disabled={!picked || targets.length === 0}
				running={running}
				onClick={() =>
					run(async () => {
						const res = await convertDocument(
							picked.bytes.buffer as ArrayBuffer,
							picked.name,
							target,
						);
						return {
							name: res.filename,
							bytes: res.data,
							mime: res.mime,
						};
					})
				}
			/>
		</>
	);
}

function StatsTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("all", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);

	const stats = useMemo(() => {
		if (!picked) return null;
		const text = decodeText(picked.bytes.buffer as ArrayBuffer);
		const chars = text.length;
		const charsNoSpace = text.replace(/\s+/g, "").length;
		const words = (text.match(/[\p{L}\p{N}_]+/gu) || []).length;
		const lines = text.split(/\r?\n/).length;
		const paragraphs = text
			.split(/\n\s*\n/)
			.filter((p) => p.trim().length > 0).length;
		const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

		return {
			chars,
			charsNoSpace,
			words,
			lines,
			paragraphs,
			readingTimeMinutes,
		};
	}, [picked]);

	return (
		<>
			<FileList
				kit={kit}
				several={false}
				addLabel={t("Choose a document to analyze")}
			/>
			{stats && (
				<div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
					<div className={s.choiceItem}>
						<strong>{t("Words")}:</strong>{" "}
						<span>{stats.words.toLocaleString()}</span>
					</div>
					<div className={s.choiceItem}>
						<strong>{t("Characters (with spaces)")}:</strong>{" "}
						<span>{stats.chars.toLocaleString()}</span>
					</div>
					<div className={s.choiceItem}>
						<strong>{t("Characters (no spaces)")}:</strong>{" "}
						<span>{stats.charsNoSpace.toLocaleString()}</span>
					</div>
					<div className={s.choiceItem}>
						<strong>{t("Lines")}:</strong>{" "}
						<span>{stats.lines.toLocaleString()}</span>
					</div>
					<div className={s.choiceItem}>
						<strong>{t("Paragraphs")}:</strong>{" "}
						<span>{stats.paragraphs.toLocaleString()}</span>
					</div>
					<div className={s.choiceItem}>
						<strong>{t("Estimated reading time")}:</strong>{" "}
						<span>{t("{m} min", { m: stats.readingTimeMinutes })}</span>
					</div>
				</div>
			)}
			{feedback}
			{stats && (
				<Go
					label={t("Save statistics report")}
					disabled={!picked}
					running={running}
					onClick={() =>
						run(async () => {
							const report = `Document Statistics Report
File: ${picked.name}
Words: ${stats.words}
Characters: ${stats.chars}
Characters (no spaces): ${stats.charsNoSpace}
Lines: ${stats.lines}
Paragraphs: ${stats.paragraphs}
Reading Time: ~${stats.readingTimeMinutes} min
Generated by Sark Docs Manager
`;
							return {
								name: copyName(picked.name, "stats.txt"),
								bytes: new TextEncoder().encode(report),
								mime: "text/plain",
							};
						})
					}
				/>
			)}
		</>
	);
}

function FormatDataTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("all", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [mode, setMode] = useState<"pretty" | "minify">("pretty");
	const [error, setError] = useState<string | null>(null);

	return (
		<>
			<FileList
				kit={kit}
				several={false}
				addLabel={t("Choose JSON or structured data")}
			/>
			{picked && (
				<>
					<Choice
						label={t("Formatting mode")}
						options={[
							["pretty", t("Prettify / Beautify (Indent 2 spaces)")],
							["minify", t("Minify (Compact single line)")],
						]}
						value={mode}
						onChange={(m) => setMode(m as "pretty" | "minify")}
						testId="tool-format-mode"
					/>
					{error && (
						<p className={s.hint} style={{ color: "var(--pw-danger)" }}>
							{error}
						</p>
					)}
				</>
			)}
			{feedback}
			<Go
				label={t("Format & Save")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => {
						setError(null);
						const text = decodeText(picked.bytes.buffer as ArrayBuffer);
						try {
							const parsed = JSON.parse(text);
							const formatted =
								mode === "pretty"
									? JSON.stringify(parsed, null, 2)
									: JSON.stringify(parsed);
							return {
								name: copyName(
									picked.name,
									mode === "pretty" ? "formatted" : "minified",
								),
								bytes: new TextEncoder().encode(formatted),
								mime: "application/json",
							};
						} catch (e) {
							setError(t("Invalid JSON syntax: ") + String(e));
							throw e;
						}
					})
				}
			/>
		</>
	);
}

function OnePdf({
	kit,
}: {
	kit: ReturnType<typeof useToolFiles>;
}) {
	return (
		<>
			<FileList kit={kit} several={false} addLabel={t("Choose a PDF")} />
			{kit.dialog}
		</>
	);
}

function RotateAllTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [angle, setAngle] = useState<"90" | "180" | "270">("90");
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<Choice
					label={t("Rotation angle")}
					value={angle}
					onChange={setAngle}
					options={[
						["90", t("90° Clockwise")],
						["180", t("180° Half turn")],
						["270", t("270° Counter-clockwise")],
					]}
					testId="rotate-all-angle"
				/>
			)}
			{feedback}
			<Go
				label={t("Rotate pages")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("rotated")),
						bytes: await rotateAllPages(
							picked.bytes,
							Number(angle),
							picked.password,
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function ReverseTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<p className={s.hint}>
					{t(
						"The pages of this document will be arranged in reverse order (last page first).",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Reverse pages")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("reversed")),
						bytes: await reversePdf(picked.bytes, picked.password),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function DeletePagesTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [which, setWhich] = useState("");
	const pages = picked?.pages ?? 0;
	const list = picked && which.trim() ? parsePages(which, pages) : null;
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<>
					<label className={s.label} htmlFor="tool-delete-pages">
						{t("Pages to delete")}
					</label>
					<input
						id="tool-delete-pages"
						className={s.field}
						value={which}
						onChange={(e) => setWhich(e.target.value)}
						placeholder={t("For example 1, 3-5")}
						dir="ltr"
						data-testid="tool-delete-pages"
					/>
					<p className={s.hint}>
						{which && !list
							? t("The document has {n} pages", { n: pages })
							: t(
									"The pages named will be permanently excluded from the new copy.",
								)}
					</p>
				</>
			)}
			{feedback}
			<Go
				label={t("Delete pages")}
				disabled={!picked || !list || list.length === pages}
				running={running}
				onClick={() =>
					run(async () => {
						if (!list) throw new Error("no pages");
						return {
							name: copyName(picked.name, t("trimmed")),
							bytes: await deletePagesPdf(picked.bytes, list, picked.password),
							mime: PDF,
						};
					})
				}
			/>
		</>
	);
}

function CropTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [amount, setAmount] = useState<"small" | "medium" | "large">("medium");
	const marginsMap = {
		small: { top: 20, bottom: 20, left: 20, right: 20 },
		medium: { top: 40, bottom: 40, left: 40, right: 40 },
		large: { top: 72, bottom: 72, left: 72, right: 72 },
	};
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<Choice
					label={t("Trim margin")}
					value={amount}
					onChange={setAmount}
					options={[
						["small", t("Slight (20pt)")],
						["medium", t("Standard (40pt)")],
						["large", t("Deep (1 inch)")],
					]}
					testId="crop-amount"
				/>
			)}
			{feedback}
			<Go
				label={t("Crop document")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("cropped")),
						bytes: await cropPdf(
							picked.bytes,
							marginsMap[amount],
							picked.password,
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function FlattenTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<p className={s.hint}>
					{t(
						"Permanently merges form inputs, comments, and marks into the page layers so they cannot be altered.",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Flatten PDF")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("flattened")),
						bytes: await flattenPdf(picked.bytes, picked.password),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function RemoveAnnotsTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<p className={s.hint}>
					{t(
						"Strips out all interactive annotations, drawings, popups, and sticky notes from every page.",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Remove annotations")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("clean")),
						bytes: await removeAnnotations(picked.bytes, picked.password),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function ExtractTextTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const doc = usePdf(picked);
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<p className={s.hint}>
					{t(
						"Pulls all embedded plain text out of each page and saves it as a standard .txt document.",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Extract text")}
				disabled={!picked || !doc}
				running={running}
				onClick={() =>
					run(async () => {
						if (!doc) throw new Error("no doc");
						const total = doc.numPages;
						const lines: string[] = [];
						for (let i = 1; i <= total; i++) {
							const page = await doc.getPage(i);
							const content = await page.getTextContent();
							const pageStr = content.items
								.map((item) => ("str" in item ? item.str : ""))
								.join(" ");
							lines.push(`--- Page ${i} ---\n${pageStr}\n`);
						}
						const textData = lines.join("\n");
						const bytes = new TextEncoder().encode(textData);
						return {
							name: copyName(picked.name, t("text"), ".txt"),
							bytes,
							mime: "text/plain",
						};
					})
				}
			/>
		</>
	);
}

function BlankPageTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [position, setPosition] = useState<"end" | "start" | "between">("end");
	const [size, setSize] = useState<"a4" | "letter" | "fit">("fit");
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<>
					<Choice
						label={t("Placement")}
						value={position}
						onChange={setPosition}
						options={[
							["end", t("At the end")],
							["start", t("At the beginning")],
							["between", t("Between every page")],
						]}
						testId="blank-page-position"
					/>
					<Choice
						label={t("Page size")}
						value={size}
						onChange={setSize}
						options={[
							["fit", t("Match document")],
							["a4", "A4"],
							["letter", "Letter"],
						]}
						testId="blank-page-size"
					/>
				</>
			)}
			{feedback}
			<Go
				label={t("Insert blank page")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("expanded")),
						bytes: await blankPagePdf(
							picked.bytes,
							{ position, size },
							picked.password,
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function MetadataTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [title, setTitle] = useState("");
	const [author, setAuthor] = useState("");
	const [subject, setSubject] = useState("");
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<>
					<label className={s.label} htmlFor="meta-title">
						{t("Title")}
					</label>
					<input
						id="meta-title"
						className={s.field}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={picked.name}
						data-testid="meta-title"
					/>
					<label className={s.label} htmlFor="meta-author">
						{t("Author")}
					</label>
					<input
						id="meta-author"
						className={s.field}
						value={author}
						onChange={(e) => setAuthor(e.target.value)}
						placeholder={t("Author name")}
						data-testid="meta-author"
					/>
					<label className={s.label} htmlFor="meta-subject">
						{t("Subject / Description")}
					</label>
					<input
						id="meta-subject"
						className={s.field}
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
						placeholder={t("Document subject")}
						data-testid="meta-subject"
					/>
				</>
			)}
			{feedback}
			<Go
				label={t("Update metadata")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("metadata")),
						bytes: await pdfMetadata(
							picked.bytes,
							{
								title: title.trim() || undefined,
								author: author.trim() || undefined,
								subject: subject.trim() || undefined,
							},
							picked.password,
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function RepairTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<p className={s.hint}>
					{t(
						"Re-reads and re-constructs every object in the PDF, fixing invalid xref tables, corrupted trailer dictionaries, and stream anomalies.",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Repair PDF")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("repaired")),
						bytes: await repairPdf(picked.bytes, picked.password),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function SignTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const doc = usePdf(kit.files[0]);
	const [open, setOpen] = useState(false);
	const picked = kit.files[0];
	return (
		<>
			<OnePdf kit={kit} />
			<div className={s.signGuide}>
				{doc && (
					<div className={s.previewPage}>
						<PageThumb doc={doc} page={0} width={100} />
						<span>{t("Page {n}", { n: 1 })}</span>
					</div>
				)}
				<div>
					<h3>{picked ? t("Your PDF is ready") : t("How it works")}</h3>
					<ol className={s.steps}>
						<li data-current={!picked || undefined}>
							<span>{picked ? <Check size={13} /> : 1}</span>
							{t("Choose a PDF")}
						</li>
						<li data-current={!!picked || undefined}>
							<span>2</span>
							{t("Add text, dates or your signature")}
						</li>
						<li>
							<span>3</span>
							{t("Save a copy")}
						</li>
					</ol>
				</div>
			</div>
			{picked && (
				<Go
					label={picked && !doc ? t("Opening…") : t("Open editor")}
					disabled={!doc}
					running={false}
					onClick={() => setOpen(true)}
				/>
			)}
			{open && doc && picked && (
				<FillSign
					doc={doc}
					name={picked.name}
					password={picked.password}
					canMark
					signed={digitallySigned(picked.bytes)}
					onClose={() => setOpen(false)}
					onSaved={(saved) => announceSaved(saved, onOpen)}
				/>
			)}
		</>
	);
}

function MarkUpTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const doc = usePdf(kit.files[0]);
	const [open, setOpen] = useState(false);
	const picked = kit.files[0];
	const key = useMemo(
		() => (picked ? contentKey(fileSample(picked.bytes)) : null),
		[picked],
	);
	const store = useDocMarks(key, picked?.name ?? "", !picked?.password);
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<Go
					label={doc ? t("Open editor") : t("Opening…")}
					disabled={!doc}
					running={false}
					onClick={() => setOpen(true)}
				/>
			)}
			{open && doc && picked && (
				<MarkUp
					doc={doc}
					name={picked.name}
					password={picked.password}
					store={store}
					signed={digitallySigned(picked.bytes)}
					onClose={() => setOpen(false)}
					onSaved={(saved) => announceSaved(saved, onOpen)}
				/>
			)}
		</>
	);
}

/** How far each choice goes: the longest side a picture may keep, and
 * its JPEG quality. */
const SQUEEZE = {
	light: { side: 2200, quality: 0.8 },
	balanced: { side: 1600, quality: 0.68 },
	small: { side: 1100, quality: 0.5 },
} as const;

function CompressTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const { running, run, feedback } = useRun(onOpen);
	const [level, setLevel] = useState<keyof typeof SQUEEZE>("balanced");
	const [outcome, setOutcome] = useState("");
	const picked = kit.files[0];
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<Choice
					label={t("How small")}
					value={level}
					onChange={setLevel}
					options={[
						["light", t("Best quality")],
						["balanced", t("Balanced")],
						["small", t("Smallest file")],
					]}
					testId="compress-level"
				/>
			)}
			{outcome && (
				<p className={s.hint} data-testid="compress-outcome">
					{outcome}
				</p>
			)}
			{feedback}
			<Go
				label={t("Compress")}
				disabled={!picked}
				running={running}
				onClick={() =>
					run(async () => {
						setOutcome("");
						const bytes = await compressPdf(
							picked.bytes,
							(picture) => recodePicture(picture, SQUEEZE[level]),
							{ password: picked.password },
						);
						const was = picked.bytes.length;
						if (bytes.length >= was * 0.97) {
							setOutcome(
								t(
									"This PDF is already about as small as it can be, so no copy was made.",
								),
							);
							return null;
						}
						setOutcome(
							t("{was} down to {now}, {n}% smaller", {
								was: formatBytes(was),
								now: formatBytes(bytes.length),
								// Never "100%": the copy still has something in it.
								n: Math.min(99, Math.round((1 - bytes.length / was) * 100)),
							}),
						);
						return {
							name: copyName(picked.name, t("compressed")),
							bytes,
							mime: PDF,
						};
					})
				}
			/>
		</>
	);
}

function ReadTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("any", file);
	const picked = kit.files[0];
	const isPdf = picked?.pages !== undefined;
	const doc = usePdf(isPdf ? picked : undefined);
	const [source, setSource] = useState<ReadSource | null>(null);
	useEffect(() => {
		setSource(null);
		if (!picked) return;
		if (isPdf) {
			if (doc) setSource(pdfSource(doc, picked.name, picked.password));
			return;
		}
		let alive = true;
		bytesSource(picked.bytes, picked.name)
			.then((made) => alive && setSource(made))
			.catch((err) => toast(unreadNote(err, picked.name)));
		return () => {
			alive = false;
		};
	}, [picked, isPdf, doc]);
	const key = useMemo(
		() =>
			picked && !picked.password ? contentKey(fileSample(picked.bytes)) : null,
		[picked],
	);
	return (
		<>
			<FileList kit={kit} several={false} addLabel={t("Choose a file")} />
			{kit.dialog}
			{source && picked && (
				<ReadText
					source={source}
					docKey={key}
					onClose={() => {
						setSource(null);
						kit.remove(picked.key);
					}}
					onSaved={(saved) => announceSaved(saved, onOpen)}
				/>
			)}
		</>
	);
}

function MergeTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const { running, run, feedback } = useRun(onOpen);
	const total = kit.files.reduce((n, f) => n + (f.pages ?? 0), 0);
	return (
		<>
			<FileList kit={kit} several addLabel={t("Add a PDF")} />
			{kit.dialog}
			{kit.files.length < 2 && (
				<p className={s.hint}>{t("Add at least two PDFs to continue.")}</p>
			)}
			{kit.files.length > 0 && (
				<p className={s.hint}>
					{tn(total, "{n} page in all", "{n} pages in all")}
				</p>
			)}
			{feedback}
			<Go
				label={t("Merge")}
				disabled={kit.files.length < 2}
				running={running}
				onClick={() =>
					run(async () => {
						const picks: PagePick[] = kit.files.flatMap((f, i) =>
							Array.from({ length: f.pages ?? 0 }, (_, page) => ({
								file: i,
								page,
							})),
						);
						return {
							name: copyName(kit.files[0].name, t("merged")),
							bytes: await buildPdf(kit.files, picks),
							mime: PDF,
						};
					})
				}
			/>
		</>
	);
}

/** Pages to pick from, drawn small: tap to select. */
function PageGrid({
	doc,
	order,
	selected,
	onToggle,
}: {
	doc: PDFDocumentProxy;
	order: Array<{ page: number; turn: number }>;
	selected: Set<number>;
	onToggle: (index: number) => void;
}) {
	return (
		<div className={s.grid} data-testid="tool-pages">
			{order.map((p, i) => (
				<button
					key={`${p.page}-${i}`}
					type="button"
					className={s.cell}
					aria-pressed={selected.has(i)}
					aria-label={t("Page {n}", { n: p.page + 1 })}
					onClick={() => onToggle(i)}
					data-testid="tool-page"
				>
					<PageThumb doc={doc} page={p.page} turn={p.turn} />
					<span className={s.cellNumber}>{p.page + 1}</span>
				</button>
			))}
		</div>
	);
}

function OrganizeTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const doc = usePdf(picked);
	const { running, run, feedback } = useRun(onOpen);
	const [order, setOrder] = useState<Array<{
		page: number;
		turn: number;
	}> | null>(null);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const fileKey = picked?.key;
	// A replacement file starts with its own pages, never the old selection.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset when the selected file changes
	useEffect(() => {
		setOrder(null);
		setSelected(new Set());
	}, [fileKey]);
	const pages =
		order ??
		Array.from({ length: picked?.pages ?? 0 }, (_, page) => ({
			page,
			turn: 0,
		}));
	const change = (next: Array<{ page: number; turn: number }>) =>
		setOrder(next);
	const sel = [...selected].sort((a, b) => a - b);
	const turn = (by: number) =>
		change(
			pages.map((p, i) =>
				selected.has(i) ? { ...p, turn: (p.turn + by + 360) % 360 } : p,
			),
		);
	const shift = (by: -1 | 1) => {
		if (!sel.length) return;
		const next = [...pages];
		const moving = by < 0 ? sel : [...sel].reverse();
		const edge =
			by < 0 ? sel[0] === 0 : sel[sel.length - 1] === pages.length - 1;
		if (edge) return;
		for (const i of moving) [next[i], next[i + by]] = [next[i + by], next[i]];
		change(next);
		setSelected(new Set(sel.map((i) => i + by)));
	};
	const changed =
		!!order &&
		(order.length !== (picked?.pages ?? 0) ||
			order.some((p, i) => p.page !== i || p.turn !== 0));
	return (
		<>
			<OnePdf kit={kit} />
			{doc && picked && (
				<>
					<div className={s.actions} role="toolbar" aria-label={t("Pages")}>
						<Button
							variant="ghost"
							onClick={() =>
								setSelected(
									selected.size === pages.length
										? new Set()
										: new Set(pages.map((_, i) => i)),
								)
							}
						>
							{selected.size === pages.length
								? t("Select none")
								: t("Select all")}
						</Button>
						<Button
							variant="secondary"
							disabled={!selected.size}
							onClick={() => turn(-90)}
						>
							<RotateCcw size={18} />
							{t("Turn left")}
						</Button>
						<Button
							variant="secondary"
							disabled={!selected.size}
							onClick={() => turn(90)}
							data-testid="tool-turn-right"
						>
							<RotateCw size={18} />
							{t("Turn right")}
						</Button>
						<Button
							variant="ghost"
							disabled={!selected.size || sel[0] === 0}
							onClick={() => shift(-1)}
							data-testid="tool-earlier"
						>
							{t("Earlier")}
						</Button>
						<Button
							variant="ghost"
							disabled={
								!selected.size || sel[sel.length - 1] === pages.length - 1
							}
							onClick={() => shift(1)}
						>
							{t("Later")}
						</Button>
						<Button
							variant="danger"
							disabled={!selected.size || selected.size === pages.length}
							onClick={() => {
								change(pages.filter((_, i) => !selected.has(i)));
								setSelected(new Set());
							}}
							data-testid="tool-delete"
						>
							<Trash2 size={18} />
							{t("Take out")}
						</Button>
						{changed && (
							<Button
								variant="ghost"
								onClick={() => {
									setOrder(null);
									setSelected(new Set());
								}}
							>
								{t("Reset pages")}
							</Button>
						)}
					</div>
					<p className={s.hint}>
						{selected.size
							? tn(selected.size, "{n} page selected", "{n} pages selected")
							: t("Tap pages to select them")}
					</p>
					<PageGrid
						doc={doc}
						order={pages}
						selected={selected}
						onToggle={(i) =>
							setSelected((was) => {
								const next = new Set(was);
								if (next.has(i)) next.delete(i);
								else next.add(i);
								return next;
							})
						}
					/>
				</>
			)}
			{feedback}
			<Go
				label={t("Save a copy")}
				disabled={!changed}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("organized")),
						bytes: await buildPdf(
							[picked],
							pages.map((p) => ({ file: 0, page: p.page, turn: p.turn })),
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function ExtractTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [which, setWhich] = useState("");
	const [each, setEach] = useState(false);
	const pages = picked?.pages ?? 0;
	const list = picked
		? parsePages(which || (each ? `1-${pages}` : ""), pages)
		: null;
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<>
					<label className={s.label} htmlFor="tool-pages-field">
						{t("Pages")}
					</label>
					<input
						id="tool-pages-field"
						className={s.field}
						value={which}
						onChange={(e) => setWhich(e.target.value)}
						placeholder={t("For example 1-3, 5")}
						dir="ltr"
						data-testid="tool-pages-field"
					/>
					<p className={s.hint}>
						{which && !list
							? t("The document has {n} pages", { n: pages })
							: each
								? t(
										"Each page is saved as a PDF of its own, together in a ZIP file.",
									)
								: t(
										"The pages you name are saved, in that order, as a new PDF.",
									)}
					</p>
					<label className={s.keep}>
						<input
							type="checkbox"
							checked={each}
							onChange={(e) => setEach(e.target.checked)}
							data-testid="tool-each"
						/>
						{t("Every page as its own PDF")}
					</label>
				</>
			)}
			{feedback}
			<Go
				label={each ? t("Split") : t("Extract")}
				disabled={!list}
				running={running}
				onClick={() =>
					run(async () => {
						if (!list) throw new Error("no pages");
						if (!each)
							return {
								name: copyName(picked.name, t("pages")),
								bytes: await buildPdf(
									[picked],
									list.map((page) => ({ file: 0, page })),
								),
								mime: PDF,
							};
						const [stem] = splitName(picked.name);
						const parts: Record<string, Uint8Array> = {};
						for (const page of list)
							parts[`${stem} - ${t("page {n}", { n: page + 1 })}.pdf`] =
								await buildPdf([picked], [{ file: 0, page }]);
						return {
							name: copyName(picked.name, t("pages"), ".zip"),
							bytes: zipSync(parts, { level: 0 }),
							mime: "application/zip",
						};
					})
				}
			/>
		</>
	);
}

/** A picture's pixels as a JPEG or a PNG, the two a PDF can hold: a
 * JPEG or PNG is kept as it is; anything else is drawn into a JPEG. */
async function asPageImage(
	file: ToolFile,
): Promise<{ bytes: Uint8Array; type: "jpg" | "png" }> {
	const b = file.bytes;
	if (b[0] === 0xff && b[1] === 0xd8) return { bytes: b, type: "jpg" };
	if (b[0] === 0x89 && b[1] === 0x50) return { bytes: b, type: "png" };
	const bitmap = await createImageBitmap(new Blob([b as BlobPart]));
	const canvas = document.createElement("canvas");
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("no canvas");
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(bitmap, 0, 0);
	const blob = await new Promise<Blob | null>((done) =>
		canvas.toBlob(done, "image/jpeg", 0.92),
	);
	if (!blob) throw new Error("no picture");
	return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "jpg" };
}

function ImagesTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("image", file);
	const { running, run, feedback } = useRun(onOpen);
	const [paper, setPaper] = useState<"fit" | keyof typeof PAPER>("a4");
	const [turn, setTurn] = useState<PaperTurn>("auto");
	const [margin, setMargin] = useState<"0" | "12" | "24">("24");
	return (
		<>
			<FileList kit={kit} several addLabel={t("Add a picture")} />
			<Choice
				label={t("Page size")}
				value={paper}
				onChange={setPaper}
				options={[
					["a4", "A4"],
					["letter", "Letter"],
					["legal", "Legal"],
					["fit", t("Picture size")],
				]}
				testId="tool-paper"
			/>
			{paper !== "fit" && (
				<>
					<Choice
						label={t("Orientation")}
						value={turn}
						onChange={setTurn}
						options={[
							["auto", t("Auto")],
							["portrait", t("Portrait")],
							["landscape", t("Landscape")],
						]}
						testId="tool-turn"
					/>
					<Choice
						label={t("Margin")}
						value={margin}
						onChange={setMargin}
						options={[
							["0", t("None")],
							["12", t("Narrow")],
							["24", t("Normal")],
						]}
						testId="tool-margin"
					/>
				</>
			)}
			{feedback}
			<Go
				label={t("Make a PDF")}
				disabled={!kit.files.length}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(kit.files[0].name, t("pictures"), ".pdf"),
						bytes: await imagesToPdf(
							await Promise.all(kit.files.map(asPageImage)),
							paper,
							{ turn, margin: Number(margin) },
						),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function PicturesTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const doc = usePdf(picked);
	const { running, run, feedback } = useRun(onOpen);
	const [which, setWhich] = useState("");
	const [format, setFormat] = useState<"jpg" | "png">("jpg");
	const [dpi, setDpi] = useState<"96" | "150" | "300">("150");
	const pages = picked?.pages ?? 0;
	const list = picked ? parsePages(which || `1-${pages}`, pages) : null;
	return (
		<>
			<OnePdf kit={kit} />
			{picked && (
				<>
					<label className={s.label} htmlFor="tool-pictures-field">
						{t("Pages")}
					</label>
					<input
						id="tool-pictures-field"
						className={s.field}
						value={which}
						onChange={(e) => setWhich(e.target.value)}
						placeholder={t("All of them")}
						dir="ltr"
						data-testid="tool-pages-field"
					/>
					{list && list.length > 1 && (
						<p className={s.hint}>
							{t("The pictures are saved together in a ZIP file.")}
						</p>
					)}
					<Choice
						label={t("Format")}
						value={format}
						onChange={setFormat}
						options={[
							["jpg", "JPEG"],
							["png", "PNG"],
						]}
						testId="tool-format"
					/>
					<Choice
						label={t("Quality")}
						value={dpi}
						onChange={setDpi}
						options={[
							["96", t("For screens")],
							["150", t("Standard")],
							["300", t("For printing")],
						]}
						testId="tool-dpi"
					/>
					<p className={s.hint}>
						{t("Pages are drawn at {n} dots to the inch.", { n: dpi })}
					</p>
				</>
			)}
			{feedback}
			<Go
				label={t("Make pictures")}
				disabled={!doc || !list}
				running={running}
				onClick={() =>
					run(async () => {
						if (!doc || !list) throw new Error("no pages");
						const [stem] = splitName(picked.name);
						const type = format === "png" ? "image/png" : "image/jpeg";
						const shots: Record<string, Uint8Array> = {};
						for (const page of list) {
							const sheet = await doc.getPage(page + 1);
							const { width, height } = sheet.getViewport({ scale: 1 });
							// No more than about 16 million pixels, which a phone can
							// still draw: a large page at print sharpness is drawn
							// less sharply.
							const most = 72 * Math.sqrt(16e6 / Math.max(1, width * height));
							const { bytes } = await drawPage(sheet, {
								dpi: Math.min(Number(dpi), most),
								type,
							});
							shots[`${stem} - ${t("page {n}", { n: page + 1 })}.${format}`] =
								bytes;
						}
						const names = Object.keys(shots);
						if (names.length === 1)
							return {
								name: names[0],
								bytes: shots[names[0]],
								mime: type,
							};
						return {
							name: copyName(picked.name, t("pictures"), ".zip"),
							bytes: zipSync(shots, { level: 0 }),
							mime: "application/zip",
						};
					})
				}
			/>
		</>
	);
}

function NumbersTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [spot, setSpot] = useState<NumberSpot>("bottom-center");
	const [edge, side] = spot.split("-") as [
		"top" | "bottom",
		"left" | "center" | "right",
	];
	const [style, setStyle] = useState<"n" | "of">("n");
	const [size, setSize] = useState<"8" | "10" | "14">("10");
	const [start, setStart] = useState("1");
	const [skipFirst, setSkipFirst] = useState(false);
	// "Page 1 of 9" in the reader's language, where Helvetica can write it.
	const words = t("Page {n} of {total}");
	const fullPattern = standardText(words) ? words : "{n} / {total}";
	const pattern = style === "n" ? "{n}" : fullPattern;
	// A whole number from 1, as typed.
	const first = /^\d{1,6}$/.test(start.trim()) ? Number(start) : 0;
	return (
		<>
			<OnePdf kit={kit} />
			{/* Two short rows, not six cramped buttons on a phone. */}
			<Choice
				label={t("Where")}
				value={edge}
				onChange={(next) => setSpot(`${next}-${side}` as NumberSpot)}
				options={[
					["top", t("Top")],
					["bottom", t("Foot")],
				]}
				testId="tool-spot-edge"
			/>
			<Choice
				label={t("Align")}
				value={side}
				onChange={(next) => setSpot(`${edge}-${next}` as NumberSpot)}
				options={[
					["left", t("Left")],
					["center", t("Middle")],
					["right", t("Right")],
				]}
				testId="tool-spot-side"
			/>
			<Choice
				label={t("How")}
				value={style}
				onChange={setStyle}
				options={[
					["n", "1, 2, 3"],
					["of", fullPattern.replace("{n}", "1").replace("{total}", "9")],
				]}
				testId="tool-style"
			/>
			<Choice
				label={t("Size")}
				value={size}
				onChange={setSize}
				options={[
					["8", t("Small")],
					["10", t("Medium")],
					["14", t("Large")],
				]}
				testId="tool-number-size"
			/>
			<label className={s.label} htmlFor="tool-start">
				{t("Start at")}
			</label>
			<input
				id="tool-start"
				className={s.field}
				value={start}
				inputMode="numeric"
				maxLength={6}
				onChange={(e) => setStart(e.target.value)}
				dir="ltr"
				data-testid="tool-start"
			/>
			{first < 1 && (
				<p className={s.hint}>{t("Use a whole number, 1 or more.")}</p>
			)}
			<label className={s.keep}>
				<input
					type="checkbox"
					checked={skipFirst}
					onChange={(e) => setSkipFirst(e.target.checked)}
					data-testid="tool-skip-first"
				/>
				{t("No number on the first page")}
			</label>
			{feedback}
			<Go
				label={t("Number the pages")}
				disabled={!picked || first < 1}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("numbered")),
						bytes: await addPageNumbers(picked.bytes, {
							password: picked.password,
							spot,
							pattern,
							first,
							size: Number(size),
							skipFirst,
						}),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function WatermarkTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [text, setText] = useState(t("DRAFT"));
	const [size, setSize] = useState<MarkSize>("large");
	const [tiled, setTiled] = useState<"one" | "tiled">("one");
	const [opacity, setOpacity] = useState<"0.12" | "0.18" | "0.35">("0.18");
	const [color, setColor] = useState<keyof typeof MARK_COLORS>("red");
	const [slant, setSlant] = useState<"slant" | "level">("slant");
	const [which, setWhich] = useState("");
	const pages = picked?.pages ?? 0;
	// Every page, unless some are named.
	const list = which.trim() ? parsePages(which, pages) : undefined;
	const usable = !!text.trim() && standardText(text);
	return (
		<>
			<OnePdf kit={kit} />
			<label className={s.label} htmlFor="tool-mark">
				{t("Words")}
			</label>
			<input
				id="tool-mark"
				className={s.field}
				value={text}
				maxLength={40}
				onChange={(e) => setText(e.target.value)}
				data-testid="tool-mark"
			/>
			{!usable && text.trim() && (
				<p className={s.hint}>
					{t("Use Latin letters: a PDF's standard fonts have no others.")}
				</p>
			)}
			<Choice
				label={t("How many")}
				value={tiled}
				onChange={setTiled}
				options={[
					["one", t("One")],
					["tiled", t("Repeated")],
				]}
				testId="tool-mark-layout"
			/>
			<Choice
				label={t("Size")}
				value={size}
				onChange={setSize}
				options={[
					["small", t("Small")],
					["medium", t("Medium")],
					["large", t("Large")],
				]}
				testId="tool-mark-size"
			/>
			<Choice
				label={t("Strength")}
				value={opacity}
				onChange={setOpacity}
				options={[
					["0.12", t("Faint")],
					["0.18", t("Medium")],
					["0.35", t("Strong")],
				]}
				testId="tool-mark-strength"
			/>
			<Choice
				label={t("Colour")}
				value={color}
				onChange={setColor}
				options={[
					["grey", t("Grey")],
					["red", t("Red")],
					["blue", t("Blue")],
				]}
				testId="tool-mark-colour"
			/>
			<Choice
				label={t("Angle")}
				value={slant}
				onChange={setSlant}
				options={[
					["slant", t("Slanted")],
					["level", t("Straight")],
				]}
				testId="tool-mark-angle"
			/>
			{picked && (
				<>
					<label className={s.label} htmlFor="tool-mark-pages">
						{t("Pages")}
					</label>
					<input
						id="tool-mark-pages"
						className={s.field}
						value={which}
						onChange={(e) => setWhich(e.target.value)}
						placeholder={t("All of them")}
						dir="ltr"
						data-testid="tool-mark-pages"
					/>
					{list === null && (
						<p className={s.hint}>
							{t("The document has {n} pages", { n: pages })}
						</p>
					)}
				</>
			)}
			{feedback}
			<Go
				label={t("Add the watermark")}
				disabled={!picked || !usable || list === null}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("watermarked")),
						bytes: await addWatermark(picked.bytes, {
							text: text.trim(),
							password: picked.password,
							size,
							tiled: tiled === "tiled",
							opacity: Number(opacity),
							color: MARK_COLORS[color],
							slant: slant === "slant",
							pages: list ?? undefined,
						}),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function ProtectTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	const [one, setOne] = useState("");
	const [two, setTwo] = useState("");
	const [printing, setPrinting] = useState(true);
	const [copying, setCopying] = useState(true);
	const [changes, setChanges] = useState(true);
	const same = one === two;
	const allows: Array<[string, boolean, (on: boolean) => void, string]> = [
		[t("Allow printing"), printing, setPrinting, "tool-allow-print"],
		[t("Allow copying text"), copying, setCopying, "tool-allow-copy"],
		[t("Allow changes"), changes, setChanges, "tool-allow-change"],
	];
	return (
		<>
			<OnePdf kit={kit} />
			<label className={s.label} htmlFor="tool-password">
				{t("Password")}
			</label>
			<input
				id="tool-password"
				className={s.field}
				type="password"
				autoComplete="new-password"
				value={one}
				onChange={(e) => setOne(e.target.value)}
				data-testid="tool-new-password"
			/>
			<label className={s.label} htmlFor="tool-password-again">
				{t("The same password again")}
			</label>
			<input
				id="tool-password-again"
				className={s.field}
				type="password"
				autoComplete="new-password"
				value={two}
				onChange={(e) => setTwo(e.target.value)}
				data-testid="tool-new-password-again"
			/>
			<p className={s.hint}>
				{!same && two
					? t("The two passwords are not the same")
					: t(
							"Keep it somewhere safe: without it the copy cannot be opened. Sark Docs does not keep it.",
						)}
			</p>
			{allows.map(([label, on, set, testId]) => (
				<label key={testId} className={s.keep}>
					<input
						type="checkbox"
						checked={on}
						onChange={(e) => set(e.target.checked)}
						data-testid={testId}
					/>
					{label}
				</label>
			))}
			{!(printing && copying && changes) && (
				<p className={s.hint}>
					{t(
						"Most PDF readers keep to these limits, but a reader can choose to ignore them.",
					)}
				</p>
			)}
			{feedback}
			<Go
				label={t("Save a locked copy")}
				disabled={!picked || !one || !same}
				running={running}
				onClick={() =>
					run(async () => ({
						name: copyName(picked.name, t("locked")),
						bytes: await protect(picked.bytes, one, {
							password: picked.password,
							allow: { printing, copying, changes },
						}),
						mime: PDF,
					}))
				}
			/>
		</>
	);
}

function UnlockTool({ file, onOpen }: ToolProps) {
	const kit = useToolFiles("pdf", file);
	const picked = kit.files[0];
	const { running, run, feedback } = useRun(onOpen);
	return (
		<>
			<OnePdf kit={kit} />
			<p className={s.hint}>
				{picked && !picked.password
					? t("This PDF has no password to remove.")
					: t("Pick the PDF and type its password; the copy opens without it.")}
			</p>
			{feedback}
			<Go
				label={t("Save an unlocked copy")}
				disabled={!picked?.password}
				running={running}
				onClick={() =>
					run(async () => {
						const password = picked.password ?? "";
						const bytes = await unlock(picked.bytes, password);
						if (sniffFormat(bytes.buffer as ArrayBuffer) !== "pdf")
							throw new Error("bad");
						return {
							name: copyName(picked.name, t("unlocked")),
							bytes,
							mime: PDF,
						};
					})
				}
			/>
		</>
	);
}

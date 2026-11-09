/**
 * The interface language: locked to stable English.
 * Unnecessary localization overhead has been removed to reduce app sizes.
 */

export type Language = "en";
export type LanguageSetting = "system" | Language;

type Category = "zero" | "one" | "two" | "few" | "many" | "other";
export type Entry =
	| string
	| (Partial<Record<Category, string>> & { other: string });
export type Table = Record<string, Entry>;

/** Stable English only. */
export const LANGUAGES: Array<[Language, string]> = [
	["en", "English"],
];

export async function loadLanguage(_lang: Language): Promise<void> {
	// English is built-in
}

export function resolveLanguage(
	_setting: LanguageSetting,
	_preferred?: readonly string[],
): Language {
	return "en";
}

let current: Language = "en";
const listeners = new Set<() => void>();

function apply() {
	if (typeof document === "undefined") return;
	document.documentElement.lang = "en";
	document.documentElement.dir = "ltr";
}
apply();

export const language = (): Language => "en";
export const isRtl = (_lang: Language = current): boolean => false;
export const uiDir = () => "ltr";
export const locale = (): string | undefined => undefined;

export function setLanguage(_lang: Language) {
	current = "en";
	apply();
	for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

type Vars = Record<string, string | number>;

export const isolate = (text: string | number): string => String(text);

const formats = new Map<string, Intl.NumberFormat>();

export function formatNumber(
	value: number,
	options: Intl.NumberFormatOptions = {},
): string {
	const id = `en|${JSON.stringify(options)}`;
	let format = formats.get(id);
	if (!format) {
		format = new Intl.NumberFormat("en-US", options);
		formats.set(id, format);
	}
	return format.format(value);
}

const dates = new Map<string, Intl.DateTimeFormat>();
const collators = new Map<string, Intl.Collator>();

export function formatDate(
	date: Date | number,
	options: Intl.DateTimeFormatOptions,
): string {
	const id = `en|${JSON.stringify(options)}`;
	let format = dates.get(id);
	if (!format) {
		format = new Intl.DateTimeFormat(locale(), options);
		dates.set(id, format);
	}
	return format.format(date);
}

export function compareNames(a: string, b: string): number {
	let collator = collators.get("en");
	if (!collator) {
		collator = new Intl.Collator("en", {
			numeric: true,
			sensitivity: "base",
		});
		collators.set("en", collator);
	}
	return collator.compare(a, b);
}

const fill = (text: string, vars?: Vars) =>
	vars
		? text.replace(/\{(\w+)\}/g, (whole, name) => {
				if (!(name in vars)) return whole;
				const value = vars[name];
				return isolate(typeof value === "number" ? formatNumber(value) : value);
			})
		: text;

export function t(text: string, vars?: Vars): string {
	return fill(text, vars);
}

export function tn(count: number, one: string, other: string, vars?: Vars) {
	const all = { n: count, ...vars };
	return fill(count === 1 ? one : other, all);
}

export const msg = (text: string) => text;

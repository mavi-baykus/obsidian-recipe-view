// Languages for bilingual recipes. Pure helpers with no runtime dependency on Obsidian.

export interface LanguageConfig {
    /** Short code, e.g. "tr" */
    code: string;
    /** Names used as labels in notes; the first is shown in the recipe card */
    names: string[];
}

/** Show every language, one after the other, as in the note */
export const ALL_LANGUAGES = "both";

/**
 * Normalise a language name for matching: ignore case, accents and surrounding
 * punctuation, so "Türkçe", "TÜRKÇE" and "Turkce:" all match. Turkish dotted and dotless
 * i are treated as the same letter.
 */
export function normaliseLanguageName(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ı/g, "i")
        .toLowerCase()
        .replace(/^[\s:.,;()[\]-]+|[\s:.,;()[\]-]+$/g, "");
}

/**
 * Parse the languages setting: one language per line, as "code: Name, Other name". A line
 * without a code uses its first name, normalised, as the code.
 */
export function parseLanguages(setting: string): LanguageConfig[] {
    const languages: LanguageConfig[] = [];
    for (const line of setting.split("\n")) {
        const colon = line.indexOf(":");
        const code = colon >= 0 ? line.slice(0, colon).trim() : "";
        const names = (colon >= 0 ? line.slice(colon + 1) : line)
            .split(",")
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
        if (names.length == 0) continue;
        languages.push({ code: code || normaliseLanguageName(names[0]), names });
    }
    return languages;
}

/** The code of the language a label names, if any */
export function matchLanguage(text: string, languages: LanguageConfig[]): string | null {
    const wanted = normaliseLanguageName(text);
    if (!wanted) return null;
    for (const language of languages) {
        if (
            normaliseLanguageName(language.code) == wanted ||
            language.names.some((n) => normaliseLanguageName(n) == wanted)
        ) {
            return language.code;
        }
    }
    return null;
}

export function languageName(code: string, languages: LanguageConfig[]): string {
    return languages.find((l) => l.code == code)?.names[0] || code;
}

export interface LanguageChoice {
    /** Asked for explicitly, e.g. by a command or a restored view */
    requested?: string | null;
    /** Set in the note's frontmatter */
    noteDefault?: string | null;
    /** Last chosen for this note */
    lastUsed?: string | null;
    /** The default language setting */
    defaultLanguage?: string | null;
}

/**
 * Pick the language to show a recipe in, from the languages it has. Each option can be a
 * code or a name, and is skipped if the recipe doesn't have that language. Falls back
 * to the first language in the recipe.
 */
export function chooseLanguage(
    available: string[],
    choice: LanguageChoice,
    languages: LanguageConfig[],
): string {
    if (available.length < 2) return ALL_LANGUAGES;
    for (const option of [choice.requested, choice.noteDefault, choice.lastUsed, choice.defaultLanguage]) {
        if (!option) continue;
        if (option == ALL_LANGUAGES) return ALL_LANGUAGES;
        const code = available.includes(option) ? option : matchLanguage(option, languages);
        if (code && available.includes(code)) return code;
    }
    return available[0];
}

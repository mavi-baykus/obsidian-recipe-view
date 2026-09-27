// Translations of the headings that bilingual recipes share between their languages, like
// "Ingredients" and "Malzemeler". Uses only standard DOM APIs, so it can be unit tested
// outside of Obsidian.

import { LanguageConfig, normaliseLanguageName } from "./languages";
import { RecipeBlock } from "./model";

/** A heading's name in each language, by language code */
export type HeadingNames = Record<string, string>;

/** A heading that can be shown in the selected language */
export interface HeadingTranslation {
    /** The text node holding the heading's name */
    text: Text;
    /** The heading's text as written in the note */
    original: string;
    names: HeadingNames;
}

/**
 * Parse the heading translations setting: one heading per line, with its names separated
 * by "|" in the same order as the languages setting, e.g. "Ingredients | Malzemeler".
 */
export function parseHeadingTranslations(setting: string, languages: LanguageConfig[]): HeadingNames[] {
    const headings: HeadingNames[] = [];
    for (const line of setting.split("\n")) {
        const names = line.split("|").map((n) => n.trim());
        const heading: HeadingNames = {};
        languages.forEach((language, i) => {
            if (names[i]) heading[language.code] = names[i];
        });
        if (Object.keys(heading).length > 0) headings.push(heading);
    }
    return headings;
}

/**
 * The names of a heading in each language, if its text is one of them. Case, accents and
 * a trailing colon are ignored, as for language labels.
 */
export function matchHeading(text: string, headings: HeadingNames[]): HeadingNames | null {
    const wanted = normaliseLanguageName(text);
    if (!wanted) return null;
    return headings.find((h) => Object.values(h).some((n) => normaliseLanguageName(n) == wanted)) || null;
}

/** Give a heading another name, keeping the whitespace and colon around it */
export function renameHeading(text: string, name: string): string {
    const [, before, , after] = text.match(/^(\s*)([\s\S]*?)(\s*:?\s*)$/) || [];
    return (before || "") + name + (after || "");
}

/**
 * The heading translation for a block, if it is a heading or sub-heading shared by all
 * languages (not in a language section) whose text is one of the translated headings.
 * Headings whose name is split up by formatting, like "Ingre*dients*", are left alone.
 */
export function headingTranslation(block: RecipeBlock, headings: HeadingNames[]): HeadingTranslation | null {
    if (block.lang || (block.kind != "heading" && block.kind != "label")) return null;
    const [el] = block.elements;
    const names = matchHeading(el.textContent || "", headings);
    if (!names) return null;
    // Punctuation, like the colon in "**Notes**:", stays as it is
    const texts = textNodes(el).filter((t) => normaliseLanguageName(t.data).length > 0);
    if (texts.length != 1) return null;
    return { text: texts[0], original: texts[0].data, names };
}

/** Show a heading's name in a language, or as written in the note if it has none */
export function showHeading(heading: HeadingTranslation, language: string) {
    const name = heading.names[language];
    heading.text.data = name ? renameHeading(heading.original, name) : heading.original;
}

function textNodes(el: Node): Text[] {
    const texts: Text[] = [];
    const walker = (el.ownerDocument || document).createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    return texts;
}

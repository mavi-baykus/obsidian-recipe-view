// Works out the structure of a recipe from its rendered markdown: which blocks go in
// which section and column, and what each block is. Uses only standard DOM APIs, so it
// can be unit tested outside of Obsidian.

import { LanguageConfig, languageName, matchLanguage } from "./languages";

export type RecipeColumn = "side" | "main";

export type RecipeBlockKind =
    /** A heading that is not a sub-heading (level 1-3) */
    | "heading"
    /**
     * A sub-heading within a section: a level 4-6 heading, or a paragraph that is only
     * bold text (e.g. "**Dough**" or "**English**")
     */
    | "label"
    /** An unordered list that becomes a checkable ingredient list */
    | "ingredients"
    /** An ordered list in the main column that becomes selectable steps */
    | "steps"
    /** A run of paragraphs in the main column that become selectable steps */
    | "paragraphs"
    /** A callout, which needs wrapping to keep its outer element */
    | "callout"
    /** Anything else, shown as-is */
    | "other"
    /** A note that items couldn't be matched between languages */
    | "warning";

export interface RecipeBlock {
    kind: RecipeBlockKind;
    column: RecipeColumn;
    /** The rendered elements, in order; several only for "paragraphs" */
    elements: HTMLElement[];
    /** Position of the first element in the rendered markdown */
    origIndex: number;
    /** Heading level, for "heading" and heading "label" blocks */
    level?: number;
    /** The language this block is in, if it is in a language section */
    lang?: string;
    /** Whether this block is the label naming its language, e.g. "**English**" */
    languageLabel?: boolean;
    /** The text of a "warning" block */
    message?: string;
}

export interface RecipeSection {
    containsHeader: boolean;
    blocks: RecipeBlock[];
}

/** An ingredient or step, in one of the languages of a recipe */
export interface Translation {
    lang: string;
    el: HTMLElement;
}

export interface RecipeModel {
    title: string;
    thumbnailPath: string;
    sections: RecipeSection[];
    /** Codes of the languages the recipe has labels for, in order */
    languages: string[];
    /**
     * Ingredients and steps (list items or paragraphs) matched between languages: the
     * same item in each language
     */
    translations: Map<HTMLElement, Translation[]>;
}

export interface RecipeModelOptions {
    /** Headings matching this send the following content to the side column */
    sideColumnRegex: RegExp;
    /** Use the first level one heading as the title */
    treatH1AsFilename: boolean;
    /** Languages whose names mark language sections in bilingual recipes */
    languages?: LanguageConfig[];
}

/** Lowest heading level treated as a sub-heading ("label") rather than a section heading */
export const LABEL_HEADING_LEVEL = 4;

/**
 * Whether an element is a paragraph containing only bold text, like "**Dough**" or
 * "**Frosting:**", which acts as a sub-heading rather than a step.
 */
export function isBoldLabel(el: Element): boolean {
    if (el.nodeName != "P") return false;
    let bold: Element | null = null;
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType == Node.TEXT_NODE) {
            // Allow surrounding whitespace, and a colon after the bold text
            if (!/^[\s:]*$/.test(node.textContent || "")) return false;
        } else if (
            node.nodeType == Node.ELEMENT_NODE &&
            !bold &&
            ["STRONG", "B"].includes(node.nodeName)
        ) {
            bold = node as Element;
        } else {
            return false;
        }
    }
    return !!bold && (bold.textContent || "").trim().length > 0;
}

/**
 * Whether an element is a paragraph starting with a line of only bold text, like
 * "**Notes**" followed by more text on the next line
 */
export function startsWithBoldLine(el: Element): boolean {
    if (el.nodeName != "P") return false;
    const nodes = Array.from(el.childNodes).filter(
        (n) => !(n.nodeType == Node.TEXT_NODE && /^[\s:]*$/.test(n.textContent || ""))
    );
    return nodes.length > 1 && ["STRONG", "B"].includes(nodes[0].nodeName) && nodes[1].nodeName == "BR";
}

function headingLevel(el: Element): number | null {
    const match = el.nodeName.match(/^H([1-6])$/);
    return match ? parseInt(match[1]) : null;
}

export function buildRecipeModel(root: HTMLElement, options: RecipeModelOptions): RecipeModel {
    const model: RecipeModel = {
        title: "",
        thumbnailPath: "",
        sections: [{ containsHeader: false, blocks: [] }],
        languages: [],
        translations: new Map(),
    };
    let section = model.sections[0];
    let column: RecipeColumn = "main";
    let sendToSideUntilLevel = 7;

    const add = (block: RecipeBlock) => section.blocks.push(block);
    const lastInColumn = () => {
        for (let b = section.blocks.length - 1; b >= 0; b--) {
            if (section.blocks[b].column == column) return section.blocks[b];
        }
        return undefined;
    };

    const children = Array.from(root.children) as HTMLElement[];
    children.forEach((item, i) => {
        // Horizontal rules will create a new section
        if (item.nodeName == "HR") {
            section = { containsHeader: false, blocks: [] };
            model.sections.push(section);
            column = "main";
            sendToSideUntilLevel = 7;
            return; // Don't include the HR to be rendered
        }

        // Headers can change which column to send items to
        const level = headingLevel(item);
        if (level) {
            if (options.treatH1AsFilename && level == 1 && !section.containsHeader) {
                model.title = item.textContent || "";
                return;
            }
            section.containsHeader = true;
            if (item.textContent?.match(options.sideColumnRegex)) {
                column = "side";
                sendToSideUntilLevel = level;
            } else if (column == "side" && level <= sendToSideUntilLevel) {
                column = "main";
                sendToSideUntilLevel = 7;
            }
            add({
                kind: level >= LABEL_HEADING_LEVEL ? "label" : "heading",
                column,
                elements: [item],
                origIndex: i,
                level,
            });
            return;
        }

        // To stop margins from not collapsing below the title block,
        // get rid of the display: none frontmatter
        if (item.matches("pre.frontmatter")) {
            return;
        }

        // Extract the first image as a thumbnail
        const img = item.getElementsByTagName("IMG").item(0);
        if (
            img &&
            model.sections.length == 1 &&
            !model.thumbnailPath &&
            !section.containsHeader
        ) {
            model.thumbnailPath = img.getAttribute("src") || "";
            return; // Don't send to either column
        }

        // If it's an unordered list, make it checkable if either:
        // 1. it's going to the sidebar, or
        // 2. we haven't seen a header yet (and then send it there)
        if (item.nodeName == "UL" && (column == "side" || !section.containsHeader)) {
            add({ kind: "ingredients", column: "side", elements: [item], origIndex: i });
            return;
        }

        if (isBoldLabel(item)) {
            add({ kind: "label", column, elements: [item], origIndex: i });
            return;
        }

        // If we're sending an ordered list to the main column, then make it selectable
        if (item.nodeName == "OL" && column == "main") {
            add({ kind: "steps", column, elements: [item], origIndex: i });
            return;
        }

        // If we're sending a paragraph to the main column, then make it selectable,
        // joining it to the paragraphs straight before it
        if (item.nodeName == "P" && column == "main") {
            const prev = lastInColumn();
            if (prev && prev.kind == "paragraphs") {
                prev.elements.push(item);
            } else {
                add({ kind: "paragraphs", column, elements: [item], origIndex: i });
            }
            return;
        }

        if (item.classList.contains("callout")) {
            add({ kind: "callout", column, elements: [item], origIndex: i });
            return;
        }

        add({ kind: "other", column, elements: [item], origIndex: i });
    });

    if (options.languages?.length) {
        assignLanguages(model, options.languages);
    }

    return model;
}

type TranslatableKind = "ingredients" | "steps";

/** The ingredients or steps in a block that can be matched between languages */
function translatableItems(block: RecipeBlock): [TranslatableKind, HTMLElement[]] | null {
    switch (block.kind) {
        case "ingredients":
            return ["ingredients", Array.from(block.elements[0].children) as HTMLElement[]];
        case "steps":
            return ["steps", Array.from(block.elements[0].children) as HTMLElement[]];
        case "paragraphs":
            return ["steps", block.elements];
        default:
            return null;
    }
}

/** A run of language sections under one heading, e.g. "**Türkçe**" then "**English**" */
interface LanguageGroup {
    /**
     * For each language: its label block, its ingredients and steps in order, the column
     * its items are in, and how many sub-headings (like "**Dough**") it has
     */
    languages: Map<string, {
        label: RecipeBlock;
        items: Record<TranslatableKind, HTMLElement[]>;
        itemColumn?: RecipeColumn;
        subLabels: number;
    }>;
}

/**
 * Mark which blocks are in which language, and match up the ingredients and steps of
 * each language by position.
 *
 * A language section starts at a label naming a language: a bold paragraph, or a heading
 * of any level. It runs until the next language label, or a heading that ends it: for a
 * bold label, a heading of the same or a higher level than the heading it is under (e.g.
 * "### Directions" after "### Ingredients"); for a heading label, a heading of the same
 * or a higher level. Sections split by horizontal rules also end it.
 *
 * A bold sub-heading in the last language that the other languages don't have, like a
 * "**Notes**" after the English steps, ends the section too: it is shared by all languages.
 * That includes a paragraph starting with a bold line, as "**Notes**" followed directly by
 * text is rendered.
 */
function assignLanguages(model: RecipeModel, languages: LanguageConfig[]) {
    const groups: LanguageGroup[] = [];

    for (const section of model.sections) {
        let current: { lang: string; endLevel: number; group: LanguageGroup } | null = null;
        // Level of the last section heading, which bold language labels sit under
        let headingLevel = LABEL_HEADING_LEVEL - 1;
        for (const block of section.blocks) {
            const isHeading = block.kind == "heading" || block.kind == "label";
            const lang = isHeading ? matchLanguage(block.elements[0].textContent || "", languages) : null;
            if (lang) {
                const group: LanguageGroup = current?.group || { languages: new Map() };
                if (!current) groups.push(group);
                const endLevel: number = block.level || current?.endLevel || headingLevel;
                current = { lang, endLevel, group };
                block.lang = lang;
                block.languageLabel = true;
                if (!model.languages.includes(lang)) model.languages.push(lang);
                if (!group.languages.has(lang)) {
                    group.languages.set(lang, { label: block, items: { ingredients: [], steps: [] }, subLabels: 0 });
                }
                continue;
            }
            if (current && isHeading && block.level && block.level <= current.endLevel) {
                current = null;
            }
            const isBoldSubHeading = (block.kind == "label" && !block.level) ||
                (block.kind == "paragraphs" && startsWithBoldLine(block.elements[0]));
            if (current && isBoldSubHeading) {
                // A bold sub-heading the other languages don't have is shared by all of them
                const others = Array.from(current.group.languages.entries()).filter(([l]) => l != current?.lang);
                const mine = current.group.languages.get(current.lang);
                if (mine && others.length > 0 && mine.subLabels >= Math.max(...others.map(([, o]) => o.subLabels))) {
                    current = null;
                } else if (mine) {
                    mine.subLabels++;
                }
            }
            if (block.kind == "heading" && block.level) headingLevel = block.level;
            if (!current) continue;
            block.lang = current.lang;
            const items = translatableItems(block);
            const language = current.group.languages.get(current.lang);
            if (items && language) {
                language.items[items[0]].push(...items[1]);
                language.itemColumn ??= block.column;
            }
        }
    }

    const warnings: { label: RecipeBlock; warning: RecipeBlock }[] = [];
    for (const group of groups) {
        if (group.languages.size < 2) continue;
        const entries = Array.from(group.languages.entries());
        for (const kind of ["ingredients", "steps"] as TranslatableKind[]) {
            const counts = entries.map(([, l]) => l.items[kind].length);
            if (counts.every((c) => c == 0)) continue;
            if (counts.every((c) => c == counts[0])) {
                for (let i = 0; i < counts[0]; i++) {
                    const translation = entries.map(([lang, l]) => ({ lang, el: l.items[kind][i] }));
                    translation.forEach(({ el }) => model.translations.set(el, translation));
                }
            } else {
                const message = `Can't match ${kind} between languages: ` + entries
                    .map(([lang, l]) => `${languageName(lang, languages)} has ${l.items[kind].length}`)
                    .join(", ");
                for (const [lang, l] of entries) {
                    warnings.push({
                        label: l.label,
                        warning: {
                            kind: "warning",
                            // Next to the items, which may be in the side column when the label isn't
                            column: l.itemColumn || l.label.column,
                            elements: [],
                            origIndex: l.label.origIndex + 0.5,
                            lang,
                            message,
                        },
                    });
                }
            }
        }
    }
    // Show each warning straight after its language's label
    for (const { label, warning } of warnings) {
        for (const section of model.sections) {
            const labelIndex = section.blocks.indexOf(label);
            if (labelIndex >= 0) {
                let at = labelIndex + 1;
                while (section.blocks[at]?.kind == "warning") at++;
                section.blocks.splice(at, 0, warning);
                break;
            }
        }
    }
}

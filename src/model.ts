// Works out the structure of a recipe from its rendered markdown: which blocks go in
// which section and column, and what each block is. Uses only standard DOM APIs, so it
// can be unit tested outside of Obsidian.

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
    | "other";

export interface RecipeBlock {
    kind: RecipeBlockKind;
    column: RecipeColumn;
    /** The rendered elements, in order; several only for "paragraphs" */
    elements: HTMLElement[];
    /** Position of the first element in the rendered markdown */
    origIndex: number;
    /** Heading level, for "heading" and heading "label" blocks */
    level?: number;
}

export interface RecipeSection {
    containsHeader: boolean;
    blocks: RecipeBlock[];
}

export interface RecipeModel {
    title: string;
    thumbnailPath: string;
    sections: RecipeSection[];
}

export interface RecipeModelOptions {
    /** Headings matching this send the following content to the side column */
    sideColumnRegex: RegExp;
    /** Use the first level one heading as the title */
    treatH1AsFilename: boolean;
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

function headingLevel(el: Element): number | null {
    const match = el.nodeName.match(/^H([1-6])$/);
    return match ? parseInt(match[1]) : null;
}

export function buildRecipeModel(root: HTMLElement, options: RecipeModelOptions): RecipeModel {
    const model: RecipeModel = {
        title: "",
        thumbnailPath: "",
        sections: [{ containsHeader: false, blocks: [] }],
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

    return model;
}

// Pure helpers with no runtime dependency on Obsidian, so they can be unit tested.

/** Split a comma- or newline-separated setting into its trimmed, non-empty entries */
export function parseList(setting: string): string[] {
    return setting
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Whether a note counts as a recipe: it has one of `recipeTags` (or a nested tag below
 * one, e.g. #recipe/dessert), or it is inside one of `recipeFolders`.
 */
export function isRecipeNote(
    path: string,
    noteTags: string[],
    recipeTags: string[],
    recipeFolders: string[],
): boolean {
    const normaliseTag = (t: string) => t.replace(/^#/, "").toLowerCase();
    const wanted = recipeTags.map(normaliseTag).filter((t) => t.length > 0);
    const hasTag = noteTags.map(normaliseTag).some((tag) =>
        wanted.some((w) => tag == w || tag.startsWith(w + "/"))
    );
    const inFolder = recipeFolders
        .map((f) => f.replace(/^\/+|\/+$/g, ""))
        .filter((f) => f.length > 0)
        .some((f) => path.startsWith(f + "/"));
    return hasTag || inFolder;
}

/** Which markdown mode to open when leaving recipe view */
export type ReturnMode = "previous" | "reading" | "live";

/** The parts of a markdown view's state that control Reading view / Live Preview / Source */
export interface MarkdownModeState {
    mode?: string;
    source?: boolean;
}

/** Pick the mode out of a markdown view's state, if it has one */
export function pickMarkdownMode(state: unknown): MarkdownModeState | null {
    if (!state || typeof state != "object") return null;
    const { mode, source } = state as Record<string, unknown>;
    if (typeof mode != "string") return null;
    return typeof source == "boolean" ? { mode, source } : { mode };
}

interface EditorPosition {
    line: number;
    ch: number;
}

/** The parts of a markdown view's ephemeral state that say where the reader was */
export interface MarkdownPosition {
    cursor?: { from: EditorPosition; to: EditorPosition };
    scroll?: number;
}

function isEditorPosition(p: unknown): p is EditorPosition {
    return !!p && typeof p == "object"
        && typeof (p as EditorPosition).line == "number"
        && typeof (p as EditorPosition).ch == "number";
}

/**
 * Pick the cursor and scroll position out of a markdown view's ephemeral state, if it
 * has them, so the note can be reopened where it was left.
 */
export function pickMarkdownPosition(eState: unknown): MarkdownPosition | null {
    if (!eState || typeof eState != "object") return null;
    const { cursor, scroll } = eState as Record<string, unknown>;
    const position: MarkdownPosition = {};
    if (cursor && typeof cursor == "object") {
        const { from, to } = cursor as Record<string, unknown>;
        if (isEditorPosition(from) && isEditorPosition(to)) {
            position.cursor = { from: { line: from.line, ch: from.ch }, to: { line: to.line, ch: to.ch } };
        }
    }
    if (typeof scroll == "number") position.scroll = scroll;
    return Object.keys(position).length > 0 ? position : null;
}

/**
 * The mode state to open a markdown view with when leaving recipe view. For "previous",
 * that is the mode the note was in before switching to recipe view, if known; an empty
 * object lets Obsidian use its default mode for new tabs.
 */
export function markdownModeForReturn(
    returnMode: ReturnMode,
    previous: MarkdownModeState | null,
): MarkdownModeState {
    switch (returnMode) {
        case "reading":
            return { mode: "preview" };
        case "live":
            return { mode: "source", source: false };
        default:
            return previous ? { ...previous } : {};
    }
}

/**
 * Remove inline code spans whose content is exactly one of `tokens`, e.g. the Buttons
 * plugin's `button-RecipeView`, outside of fenced code blocks.
 */
export function stripInlineCodeTokens(text: string, tokens: string[]): string {
    if (tokens.length == 0) return text;
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp("(?<!`)`(?:" + escaped.join("|") + ")`(?!`)", "g");
    let fence: string | null = null;
    return text
        .split("\n")
        .map((line) => {
            const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
            if (fence) {
                if (fenceMatch && fenceMatch[1][0] == fence[0] && fenceMatch[1].length >= fence.length) {
                    fence = null;
                }
                return line;
            }
            if (fenceMatch) {
                fence = fenceMatch[1];
                return line;
            }
            return line.replace(pattern, "");
        })
        .join("\n");
}

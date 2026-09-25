import { describe, expect, test } from '@jest/globals';
import {
    isRecipeNote,
    markdownModeForReturn,
    parseList,
    pickMarkdownMode,
    pickMarkdownPosition,
    stripInlineCodeTokens,
} from './helpers';

describe('parsing list settings', () => {
    test('splits on commas and newlines', () => {
        expect(parseList("recipe, food\ncooking ,")).toStrictEqual(["recipe", "food", "cooking"]);
    });
    test('empty setting is an empty list', () => {
        expect(parseList("")).toStrictEqual([]);
        expect(parseList(" , \n ")).toStrictEqual([]);
    });
});

describe('detecting recipe notes', () => {
    test('matches a tag with or without #, ignoring case', () => {
        expect(isRecipeNote("Soup.md", ["#recipe", "#soup"], ["recipe"], [])).toBe(true);
        expect(isRecipeNote("Soup.md", ["#Recipe"], ["#recipe"], [])).toBe(true);
    });
    test('matches nested tags', () => {
        expect(isRecipeNote("Soup.md", ["#recipe/soup"], ["recipe"], [])).toBe(true);
    });
    test('does not match tags that only share a prefix', () => {
        expect(isRecipeNote("Soup.md", ["#recipes"], ["recipe"], [])).toBe(false);
    });
    test('matches folders', () => {
        expect(isRecipeNote("Recipes/Soups/Ezogelin.md", [], [], ["Recipes"])).toBe(true);
        expect(isRecipeNote("Recipes/Soups/Ezogelin.md", [], [], ["/Recipes/Soups/"])).toBe(true);
        expect(isRecipeNote("Recipes Archive/Soup.md", [], [], ["Recipes"])).toBe(false);
    });
    test('nothing matches with no tags or folders configured', () => {
        expect(isRecipeNote("Recipes/Soup.md", ["#recipe"], [], [])).toBe(false);
        expect(isRecipeNote("Recipes/Soup.md", ["#recipe"], [""], ["/"])).toBe(false);
    });
});

describe('choosing the markdown mode to return to', () => {
    test('picks the mode out of a markdown view state', () => {
        expect(pickMarkdownMode({ file: "a.md", mode: "source", source: false, backlinks: true }))
            .toStrictEqual({ mode: "source", source: false });
        expect(pickMarkdownMode({ file: "a.md", mode: "preview" }))
            .toStrictEqual({ mode: "preview" });
        expect(pickMarkdownMode({ file: "a.md" })).toBeNull();
        expect(pickMarkdownMode(undefined)).toBeNull();
    });
    test('previous mode is restored', () => {
        expect(markdownModeForReturn("previous", { mode: "preview" }))
            .toStrictEqual({ mode: "preview" });
        expect(markdownModeForReturn("previous", { mode: "source", source: true }))
            .toStrictEqual({ mode: "source", source: true });
    });
    test('unknown previous mode uses the default', () => {
        expect(markdownModeForReturn("previous", null)).toStrictEqual({});
    });
    test('forced modes ignore the previous mode', () => {
        expect(markdownModeForReturn("reading", { mode: "source", source: false }))
            .toStrictEqual({ mode: "preview" });
        expect(markdownModeForReturn("live", { mode: "preview" }))
            .toStrictEqual({ mode: "source", source: false });
    });
});

describe('remembering the position in the note', () => {
    test('keeps the cursor and scroll of an editing view', () => {
        const cursor = { from: { line: 30, ch: 3 }, to: { line: 31, ch: 0 } };
        expect(pickMarkdownPosition({ cursor, scroll: 4.2, focus: true }))
            .toStrictEqual({ cursor, scroll: 4.2 });
    });
    test('keeps the scroll of a reading view', () => {
        expect(pickMarkdownPosition({ scroll: 12 })).toStrictEqual({ scroll: 12 });
    });
    test('ignores malformed or missing positions', () => {
        expect(pickMarkdownPosition({ cursor: { from: { line: 1 } }, scroll: "top" })).toBeNull();
        expect(pickMarkdownPosition({})).toBeNull();
        expect(pickMarkdownPosition(null)).toBeNull();
    });
});

describe('stripping inline code tokens', () => {
    const note = [
        "---",
        "tags: [recipe]",
        "---",
        "`button-RecipeView`",
        "",
        "Some `inline code` and `button-RecipeView` here",
        "```",
        "`button-RecipeView`",
        "```",
        "~~~~",
        "`button-RecipeView`",
        "```",
        "~~~~",
        "``button-RecipeView``",
        "`button-RecipeViewer`",
    ].join("\n");

    test('removes tokens outside code blocks only', () => {
        expect(stripInlineCodeTokens(note, ["button-RecipeView"])).toBe([
            "---",
            "tags: [recipe]",
            "---",
            "",
            "",
            "Some `inline code` and  here",
            "```",
            "`button-RecipeView`",
            "```",
            "~~~~",
            "`button-RecipeView`",
            "```",
            "~~~~",
            "``button-RecipeView``",
            "`button-RecipeViewer`",
        ].join("\n"));
    });
    test('handles several tokens and regex characters', () => {
        expect(stripInlineCodeTokens("`a.b` `a-b` `axb`", ["a.b", "a-b"])).toBe("  `axb`");
    });
    test('no tokens leaves text unchanged', () => {
        expect(stripInlineCodeTokens(note, [])).toBe(note);
    });
});

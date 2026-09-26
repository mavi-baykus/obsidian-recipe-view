/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { RecipeModel, buildRecipeModel, isBoldLabel } from './model';

// Fixtures are markdown rendered by Obsidian's MarkdownRenderer
function render(fixture: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = fs.readFileSync(path.join(__dirname, "fixtures", fixture + ".html"), "utf8");
    return root;
}

function build(fixture: string, treatH1AsFilename = false) {
    return buildRecipeModel(render(fixture), {
        sideColumnRegex: /Ingredients|Nutrition/i,
        treatH1AsFilename,
    });
}

/** Summarise blocks as "column kind: text" for readability */
function summarise(model: RecipeModel) {
    return model.sections.map((s) => s.blocks.map((b) =>
        `${b.column} ${b.kind}: ` + b.elements.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")).join(" | ")
    ));
}

function paragraph(html: string) {
    const p = document.createElement("p");
    p.innerHTML = html;
    return p;
}

describe('detecting bold labels', () => {
    test('a paragraph of only bold text is a label', () => {
        expect(isBoldLabel(paragraph("<strong>Dough</strong>"))).toBe(true);
        expect(isBoldLabel(paragraph(" <b>English</b> "))).toBe(true);
        expect(isBoldLabel(paragraph("<strong>Frosting:</strong>"))).toBe(true);
        expect(isBoldLabel(paragraph("<strong>Frosting</strong>:"))).toBe(true);
        expect(isBoldLabel(paragraph("<strong><em>Dough</em></strong>"))).toBe(true);
    });
    test('a paragraph with other text is not a label', () => {
        expect(isBoldLabel(paragraph("Plain <strong>bold</strong> note."))).toBe(false);
        expect(isBoldLabel(paragraph("<strong>Filling</strong><br>8. Roll it up."))).toBe(false);
        expect(isBoldLabel(paragraph("<strong>One</strong> <strong>Two</strong>"))).toBe(false);
        expect(isBoldLabel(paragraph("<em>Dough</em>"))).toBe(false);
        expect(isBoldLabel(paragraph("<strong> </strong>"))).toBe(false);
    });
    test('only paragraphs can be labels', () => {
        const div = document.createElement("div");
        div.innerHTML = "<strong>Dough</strong>";
        expect(isBoldLabel(div)).toBe(false);
    });
});

describe('building the recipe model', () => {
    test('bilingual recipe: bold language labels are sub-headings, not steps', () => {
        expect(summarise(build("bilingual"))).toStrictEqual([[
            "side heading: Ingredients",
            "side label: Türkçe",
            "side ingredients: 1 kuru soğan 2 su bardağı su",
            "side label: English",
            "side ingredients: 1 onion 2 cups water",
            "main heading: Directions",
            "main label: Türkçe",
            "main steps: Soğanı doğrayın. Suyu ekleyin.",
            "main label: English",
            "main steps: Chop the onion. Add the water.",
            "main heading: Notes",
            "main paragraphs: Afiyet olsun.",
        ]]);
    });

    test('level 4 headings are sub-headings that stay in their column', () => {
        const model = build("sublabels");
        expect(model.thumbnailPath).toBe("https://example.com/thumb.png");
        expect(summarise(model)).toStrictEqual([[
            "main paragraphs: Intro paragraph.",
            "side heading: Ingredients",
            "side label: Dough",
            "side ingredients: 1 cup flour 1 tsp salt",
            "side label: Filling",
            "side ingredients: 2 tbsp sugar",
            "main heading: Directions",
            "main label: Dough",
            "main steps: Mix. Knead.",
            "main label: Filling",
            "main paragraphs: Stir the sugar. | Spread it.",
            "main label: Frosting:",
            "main paragraphs: Beat the butter. | Filling & Shaping 8. Roll it up. 9. Cut it.",
            "main callout: Tip Chill first.",
            "main heading: Notes",
            "main paragraphs: Plain bold note.",
        ]]);
        const levels = model.sections[0].blocks.filter((b) => b.level).map((b) => `${b.kind} ${b.level}`);
        expect(levels).toStrictEqual(["heading 2", "label 4", "label 4", "heading 2", "label 4", "label 4", "heading 2"]);
    });

    test('horizontal rules split sections, and unheaded lists go to the side', () => {
        expect(summarise(build("splitsteps"))).toStrictEqual([
            [
                // The H1 counts as a header, so this list stays in the main column as-is
                "main heading: Cookies",
                "main other: 100 g sugar 1 tsp salt",
                "main paragraphs: Whisk together.",
            ],
            [
                "side ingredients: 1 egg",
                "main label: Then",
                "main paragraphs: Whisk in the egg.",
            ],
        ]);
    });

    test('level one heading can be the title', () => {
        const model = build("splitsteps", true);
        expect(model.title).toBe("Cookies");
        expect(summarise(model)[0][0]).toBe("side ingredients: 100 g sugar 1 tsp salt");
    });

    test('an H1 heading counts as a header, so a later list is not checkable', () => {
        const model = build("splitsteps");
        expect(model.sections[0].containsHeader).toBe(true);
        expect(model.sections[1].containsHeader).toBe(false);
    });

    test('origIndex keeps the rendered order', () => {
        const indexes = build("sublabels").sections[0].blocks.map((b) => b.origIndex);
        expect([...indexes].sort((a, b) => a - b)).toStrictEqual(indexes);
    });
});

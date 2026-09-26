/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { RecipeModel, buildRecipeModel, isBoldLabel } from './model';
import { parseLanguages } from './languages';

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

describe('bilingual recipes', () => {
    const languages = parseLanguages("en: English\ntr: Türkçe, Turkish");
    const html = (s: string) => {
        const root = document.createElement("div");
        root.innerHTML = s.trim();
        return root;
    };
    const buildLanguages = (root: HTMLElement) => buildRecipeModel(root, {
        sideColumnRegex: /Ingredients|Nutrition/i,
        treatH1AsFilename: false,
        languages,
    });
    const langs = (model: RecipeModel) => model.sections.map((s) => s.blocks.map((b) =>
        `${b.kind}${b.languageLabel ? "*" : ""} ${b.lang || "-"}`
    ));
    const translationText = (model: RecipeModel, el: Element | null | undefined) =>
        (model.translations.get(el as HTMLElement) || []).map((t) => `${t.lang}: ${t.el.textContent}`);

    test('bold language labels mark language sections, matched by position', () => {
        const root = render("bilingual");
        const model = buildLanguages(root);
        expect(model.languages).toStrictEqual(["tr", "en"]);
        expect(langs(model)).toStrictEqual([[
            "heading -",
            "label* tr", "ingredients tr",
            "label* en", "ingredients en",
            "heading -",
            "label* tr", "steps tr",
            "label* en", "steps en",
            "heading -",
            "paragraphs -",
        ]]);
        const onion = root.querySelectorAll("ul")[0].children[0];
        expect(translationText(model, onion)).toStrictEqual(["tr: 1 kuru soğan", "en: 1 onion"]);
        const water = root.querySelectorAll("ul")[1].children[1];
        expect(translationText(model, water)).toStrictEqual(["tr: 2 su bardağı su", "en: 2 cups water"]);
        const step = root.querySelectorAll("ol")[1].children[0];
        expect(translationText(model, step)).toStrictEqual(["tr: Soğanı doğrayın.", "en: Chop the onion."]);
        // The same array is shared by every translation of an item
        expect(model.translations.get(onion as HTMLElement)).toBe(model.translations.get(root.querySelectorAll("ul")[1].children[0] as HTMLElement));
    });

    test('recipes without language labels are unchanged', () => {
        const model = buildLanguages(render("sublabels"));
        expect(model.languages).toStrictEqual([]);
        expect(model.translations.size).toBe(0);
        expect(model.sections[0].blocks.every((b) => b.lang === undefined)).toBe(true);
    });

    test('heading language labels, with sub-sections and paragraph steps', () => {
        const root = html(`
<h2>Ingredients</h2>
<h4>Türkçe</h4><p><strong>Hamur</strong></p><ul><li>un</li></ul><p><strong>Dolgu</strong></p><ul><li>şeker</li><li>tarçın</li></ul>
<h4>English</h4><p><strong>Dough</strong></p><ul><li>flour</li></ul><p><strong>Filling</strong></p><ul><li>sugar</li><li>cinnamon</li></ul>
<h2>Directions</h2>
<h4>Turkish</h4><p>Karıştır.</p><p>Pişir.</p>
<h4>English</h4><p>Mix.</p><p>Bake.</p>
<h2>Notes</h2><p>Shared.</p>`);
        const model = buildLanguages(root);
        expect(langs(model)).toStrictEqual([[
            "heading -",
            "label* tr", "label tr", "ingredients tr", "label tr", "ingredients tr",
            "label* en", "label en", "ingredients en", "label en", "ingredients en",
            "heading -",
            "label* tr", "paragraphs tr",
            "label* en", "paragraphs en",
            "heading -", "paragraphs -",
        ]]);
        expect(translationText(model, root.querySelectorAll("li")[2])).toStrictEqual(["tr: tarçın", "en: cinnamon"]);
        expect(translationText(model, root.querySelectorAll("p")[5])).toStrictEqual(["tr: Pişir.", "en: Bake."]);
    });

    test('a level 4 heading ends a level 4 language section', () => {
        const root = html(`
<h3>Directions</h3>
<h4>Türkçe</h4><ol><li>Karıştır.</li></ol>
<h4>English</h4><ol><li>Mix.</li></ol>
<h4>Serving</h4><p>Serve hot.</p>`);
        expect(langs(buildLanguages(root))).toStrictEqual([[
            "heading -", "label* tr", "steps tr", "label* en", "steps en", "label -", "paragraphs -",
        ]]);
    });

    test('mismatched counts are not matched, with a warning in each language', () => {
        const root = html(`
<h3>Ingredients</h3>
<p><strong>Türkçe</strong></p><ul><li>soğan</li><li>tuz</li></ul>
<p><strong>English</strong></p><ul><li>onion</li></ul>
<h3>Directions</h3>
<p><strong>Türkçe</strong></p><ol><li>Doğra.</li></ol>
<p><strong>English</strong></p><ol><li>Chop.</li></ol>`);
        const model = buildLanguages(root);
        expect(langs(model)).toStrictEqual([[
            "heading -",
            "label* tr", "warning tr", "ingredients tr",
            "label* en", "warning en", "ingredients en",
            "heading -",
            "label* tr", "steps tr",
            "label* en", "steps en",
        ]]);
        const warning = model.sections[0].blocks[2];
        expect(warning.message).toBe("Can't match ingredients between languages: Türkçe has 2, English has 1");
        expect(warning.column).toBe("side");
        expect(warning.origIndex).toBe(1.5);
        expect(translationText(model, root.querySelector("li"))).toStrictEqual([]);
        expect(translationText(model, root.querySelectorAll("ol li")[1])).toStrictEqual(["tr: Doğra.", "en: Chop."]);
    });

    test('a single language label has nothing to match', () => {
        const root = html(`<h3>Ingredients</h3><p><strong>English</strong></p><ul><li>onion</li></ul>`);
        const model = buildLanguages(root);
        expect(model.languages).toStrictEqual(["en"]);
        expect(model.translations.size).toBe(0);
    });

    test('horizontal rules end language sections', () => {
        const root = html(`
<p><strong>Türkçe</strong></p><ul><li>soğan</li></ul>
<p><strong>English</strong></p><ul><li>onion</li></ul>
<hr>
<ul><li>salt</li></ul>`);
        expect(langs(buildLanguages(root))).toStrictEqual([
            ["label* tr", "ingredients tr", "label* en", "ingredients en"],
            ["ingredients -"],
        ]);
    });
});

describe('bilingual recipe edge cases', () => {
    const languages = parseLanguages("en: English\ntr: Türkçe");
    const build = (s: string) => {
        const root = document.createElement("div");
        root.innerHTML = s.trim();
        return { root, model: buildRecipeModel(root, { sideColumnRegex: /Ingredients/i, treatH1AsFilename: false, languages }) };
    };
    const langs = (model: RecipeModel) => model.sections[0].blocks.map((b) => `${b.kind} ${b.lang || "-"}`);

    test('bold labels under a level 2 heading keep level 3 sub-headings', () => {
        const { root, model } = build(`
<h2>Ingredients</h2>
<p><strong>Türkçe</strong></p><h3>Hamur</h3><ul><li>un</li></ul>
<p><strong>English</strong></p><h3>Dough</h3><ul><li>flour</li></ul>
<h2>Directions</h2><p>Mix.</p>`);
        expect(langs(model)).toStrictEqual([
            "heading -", "label tr", "heading tr", "ingredients tr",
            "label en", "heading en", "ingredients en",
            "heading -", "paragraphs -",
        ]);
        expect(model.translations.get(root.querySelector("li") as HTMLElement)?.map((t) => t.el.textContent))
            .toStrictEqual(["un", "flour"]);
    });

    test('a bold label after the last language is shared', () => {
        const { root, model } = build(`
<h3>Directions</h3>
<p><strong>Türkçe</strong></p><ol><li>a</li></ol>
<p><strong>English</strong></p><ol><li>A</li></ol>
<p><strong>Notes</strong></p><p>Some note.</p>`);
        expect(langs(model)).toStrictEqual([
            "heading -", "label tr", "steps tr", "label en", "steps en", "label -", "paragraphs -",
        ]);
        expect(model.translations.get(root.querySelector("li") as HTMLElement)?.length).toBe(2);
    });

    test('a paragraph starting with a bold line after the last language is shared', () => {
        const { root, model } = build(`
<h3>Directions</h3>
<p><strong>Türkçe</strong></p><ol><li>a</li></ol>
<p><strong>English</strong></p><ol><li>A</li></ol>
<p><strong>Notes</strong><br>
Serve hot.</p>`);
        expect(langs(model)).toStrictEqual([
            "heading -", "label tr", "steps tr", "label en", "steps en", "paragraphs -",
        ]);
        expect(model.translations.get(root.querySelector("li") as HTMLElement)?.length).toBe(2);
    });

    test('paragraphs starting with matching bold lines stay in their languages', () => {
        const { model } = build(`
<h3>Directions</h3>
<p><strong>Türkçe</strong></p><p><strong>Hamur</strong><br>Karıştır.</p>
<p><strong>English</strong></p><p><strong>Dough</strong><br>Mix.</p>`);
        expect(langs(model)).toStrictEqual([
            "heading -", "label tr", "paragraphs tr", "label en", "paragraphs en",
        ]);
    });

    test('matching bold sub-headings stay in their languages', () => {
        const { model } = build(`
<h3>Directions</h3>
<p><strong>Türkçe</strong></p><p><strong>Hamur</strong></p><ol><li>a</li></ol>
<p><strong>English</strong></p><p><strong>Dough</strong></p><ol><li>A</li></ol>
<p><strong>Notes</strong></p><p>Shared.</p>`);
        expect(langs(model)).toStrictEqual([
            "heading -", "label tr", "label tr", "steps tr",
            "label en", "label en", "steps en", "label -", "paragraphs -",
        ]);
    });

    test('warnings go in the column of the items', () => {
        const { model } = build(`
<p><strong>Türkçe</strong></p><ul><li>soğan</li><li>tuz</li></ul>
<p><strong>English</strong></p><ul><li>onion</li></ul>`);
        const warnings = model.sections[0].blocks.filter((b) => b.kind == "warning");
        expect(warnings.map((w) => `${w.lang} ${w.column}`)).toStrictEqual(["tr side", "en side"]);
    });
});

/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { buildRecipeModel, RecipeBlock } from './model';
import { ALL_LANGUAGES, parseLanguages } from './languages';
import {
    headingTranslation, matchHeading, parseHeadingTranslations, renameHeading, showHeading,
} from './headings';

const languages = parseLanguages("en: English, İngilizce\ntr: Türkçe, Turkish");
const headings = parseHeadingTranslations(
    "Ingredients | Malzemeler\nDirections | Hazırlanışı\nNotes | Notlar", languages);

function model(html: string) {
    const root = document.createElement("div");
    root.innerHTML = html;
    return buildRecipeModel(root, { sideColumnRegex: /Ingredients|Malzemeler/i, treatH1AsFilename: false, languages });
}

/** Fails the test if a block or heading wasn't found */
function found<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) throw new Error("not found");
    return value;
}

function blocks(html: string): RecipeBlock[] {
    return model(html).sections.flatMap((s) => s.blocks);
}

/** The text of each block that is translated, as shown in Turkish */
function translatedInTurkish(html: string) {
    return blocks(html).flatMap((b) => {
        const heading = headingTranslation(b, headings);
        if (!heading) return [];
        showHeading(heading, "tr");
        return [b.elements[0].textContent];
    });
}

describe('reading the heading translations setting', () => {
    test('names are matched to languages in order', () => {
        expect(headings).toStrictEqual([
            { en: "Ingredients", tr: "Malzemeler" },
            { en: "Directions", tr: "Hazırlanışı" },
            { en: "Notes", tr: "Notlar" },
        ]);
    });
    test('blank lines and names are skipped, and extra names ignored', () => {
        expect(parseHeadingTranslations("\n  Serving |  \n| Ekipman\nA | B | C\n", languages)).toStrictEqual([
            { en: "Serving" },
            { tr: "Ekipman" },
            { en: "A", tr: "B" },
        ]);
    });
});

describe('matching headings', () => {
    test('any name matches, ignoring case, accents and a colon', () => {
        for (const text of ["Ingredients", "INGREDIENTS", "ingredients:", "Malzemeler", " malzemeler "]) {
            expect(matchHeading(text, headings)).toStrictEqual({ en: "Ingredients", tr: "Malzemeler" });
        }
        expect(matchHeading("Hazirlanisi", headings)?.en).toBe("Directions");
    });
    test('the whole heading has to match', () => {
        expect(matchHeading("Ingredients for the dough", headings)).toBeNull();
        expect(matchHeading("", headings)).toBeNull();
        expect(matchHeading(":", headings)).toBeNull();
    });
    test('renaming keeps the space and colon around the name', () => {
        expect(renameHeading("Notes:", "Notlar")).toBe("Notlar:");
        expect(renameHeading(" Ingredients ", "Malzemeler")).toBe(" Malzemeler ");
        expect(renameHeading("Directions", "Hazırlanışı")).toBe("Hazırlanışı");
    });
});

describe('translating the headings of a recipe', () => {
    const bilingual = fs.readFileSync(path.join(__dirname, "fixtures", "bilingual.html"), "utf8");

    test('shared headings are translated, language labels are not', () => {
        expect(translatedInTurkish(bilingual)).toStrictEqual(["Malzemeler", "Hazırlanışı", "Notlar"]);
    });
    test('the layout is chosen from the heading as written', () => {
        const ingredients = blocks(bilingual).filter((b) => b.kind == "ingredients");
        expect(ingredients.map((b) => b.column)).toStrictEqual(["side", "side"]);
    });
    test('sub-headings inside a language section are not translated', () => {
        expect(translatedInTurkish(`
            <h3>Ingredients</h3>
            <p><strong>Türkçe</strong></p><h4>Notes</h4><ul><li>su</li></ul>
            <p><strong>English</strong></p><h4>Notes</h4><ul><li>water</li></ul>
            <h3>Directions</h3><ol><li>Boil.</li></ol>`)).toStrictEqual(["Malzemeler", "Hazırlanışı"]);
    });
    test('shared bold labels are translated, keeping their formatting', () => {
        const html = `
            <h3>Ingredients</h3>
            <p><strong>Türkçe</strong></p><ul><li>su</li></ul>
            <p><strong>English</strong></p><ul><li>water</li></ul>
            <h3>Directions</h3><ol><li>Boil.</li></ol>
            <p><strong>Notes</strong>:</p>`;
        const block = found(blocks(html).find((b) => b.elements[0].textContent == "Notes:"));
        const heading = found(headingTranslation(block, headings));
        showHeading(heading, "tr");
        expect(block.elements[0].innerHTML).toBe("<strong>Notlar</strong>:");
    });
    test('headings split up by formatting are left alone', () => {
        const [block] = blocks("<h3>Ingre<em>dients</em></h3><ul><li>water</li></ul>");
        expect(headingTranslation(block, headings)).toBeNull();
    });
    test('switching back shows the heading as written', () => {
        const block = found(blocks(bilingual).find((b) => b.kind == "heading"));
        const heading = found(headingTranslation(block, headings));
        showHeading(heading, "tr");
        expect(block.elements[0].textContent).toBe("Malzemeler");
        showHeading(heading, ALL_LANGUAGES);
        expect(block.elements[0].textContent).toBe("Ingredients");
        showHeading(heading, "tr");
        showHeading(heading, "en");
        expect(block.elements[0].textContent).toBe("Ingredients");
    });
    test('a language without a name shows the heading as written', () => {
        const [only] = parseHeadingTranslations("Ingredients", languages);
        const block = found(blocks(bilingual).find((b) => b.kind == "heading"));
        const heading = found(headingTranslation(block, [only]));
        showHeading(heading, "tr");
        expect(block.elements[0].textContent).toBe("Ingredients");
    });
});

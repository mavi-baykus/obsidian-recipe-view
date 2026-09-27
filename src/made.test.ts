import { describe, expect, test } from '@jest/globals';
import { Frontmatter, isMadeOn, localDate, markMade, MadeProperties, undoMarkMade } from './made';

const names: MadeProperties = { made: "made", lastMade: "last made", previouslyMade: "previously made" };
const today = "2026-09-27";

describe('the date', () => {
    test('is the local date, even late in the evening', () => {
        expect(localDate(new Date(2026, 8, 27, 23, 59))).toBe("2026-09-27");
        expect(localDate(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
    });
});

describe('marking a recipe as made', () => {
    test('creates the properties that are missing', () => {
        const fm: Frontmatter = { title: "Ezogelin Çorbası" };
        expect(markMade(fm, names, today).changed).toBe(true);
        expect(fm).toStrictEqual({
            title: "Ezogelin Çorbası",
            made: true,
            "last made": today,
            "previously made": [today],
        });
    });
    test('fills in empty properties, like those of a new note from a template', () => {
        const fm: Frontmatter = { made: null, "last made": null, "previously made": null };
        markMade(fm, names, today);
        expect(fm).toStrictEqual({ made: true, "last made": today, "previously made": [today] });
    });
    test('replaces the last made date and adds to the previous ones', () => {
        const fm: Frontmatter = { made: false, "last made": "2026-08-12", "previously made": ["2026-03-01", "2026-08-12"] };
        markMade(fm, names, today);
        expect(fm).toStrictEqual({
            made: true,
            "last made": today,
            "previously made": ["2026-03-01", "2026-08-12", today],
        });
    });
    test('turns a single previous date into a list', () => {
        const fm: Frontmatter = { "previously made": "2026-08-12" };
        markMade(fm, names, today);
        expect(fm["previously made"]).toStrictEqual(["2026-08-12", today]);
    });
    test('reads dates that YAML turned into Date objects', () => {
        const fm: Frontmatter = { "last made": new Date("2026-08-12"), "previously made": [new Date("2026-08-12")] };
        expect(isMadeOn(fm, names, "2026-08-12")).toBe(true);
        markMade(fm, names, today);
        expect(fm["previously made"]).toStrictEqual(["2026-08-12", today]);
    });
    test("doesn't add the same day twice", () => {
        const fm: Frontmatter = { made: true, "last made": today, "previously made": ["2026-08-12", today] };
        expect(markMade(fm, names, today).changed).toBe(false);
        expect(fm["previously made"]).toStrictEqual(["2026-08-12", today]);
    });
    test('checks "made" again even when already marked today', () => {
        const fm: Frontmatter = { made: false, "last made": today, "previously made": [today] };
        expect(markMade(fm, names, today).changed).toBe(true);
        expect(fm.made).toBe(true);
    });
    test('uses existing properties whatever their case', () => {
        const fm: Frontmatter = { Made: false, "Last Made": "2026-08-12" };
        markMade(fm, names, today);
        expect(fm).toStrictEqual({ Made: true, "Last Made": today, "previously made": [today] });
    });
    test('uses the property names from the settings', () => {
        const fm: Frontmatter = {};
        markMade(fm, { made: "cooked", lastMade: "last cooked", previouslyMade: "cooked on" }, today);
        expect(fm).toStrictEqual({ cooked: true, "last cooked": today, "cooked on": [today] });
    });
});

describe('undoing', () => {
    test('puts the properties back exactly as they were', () => {
        const before = { title: "Soup", made: false, "last made": "2026-08-12", "previously made": ["2026-08-12"] };
        const fm: Frontmatter = { ...before, "previously made": [...before["previously made"]] };
        const change = markMade(fm, names, today);
        undoMarkMade(fm, change);
        expect(fm).toStrictEqual(before);
    });
    test('removes the properties it created', () => {
        const fm: Frontmatter = { title: "Soup", made: null };
        const change = markMade(fm, names, today);
        undoMarkMade(fm, change);
        expect(fm).toStrictEqual({ title: "Soup", made: null });
    });
});

describe('whether a recipe was made today', () => {
    test('goes by the last made date', () => {
        expect(isMadeOn({ "last made": today }, names, today)).toBe(true);
        expect(isMadeOn({ "Last made": today }, names, today)).toBe(true);
        expect(isMadeOn({ "last made": "2026-08-12", "previously made": [today] }, names, today)).toBe(false);
        expect(isMadeOn({}, names, today)).toBe(false);
        expect(isMadeOn(undefined, names, today)).toBe(false);
    });
});

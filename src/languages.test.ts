import { describe, expect, test } from '@jest/globals';
import {
    ALL_LANGUAGES,
    chooseLanguage,
    languageName,
    matchLanguage,
    normaliseLanguageName,
    parseLanguages,
} from './languages';

const languages = parseLanguages("en: English, İngilizce\ntr: Türkçe, Turkish\n\nDeutsch");

describe('parsing the languages setting', () => {
    test('codes and names', () => {
        expect(languages).toStrictEqual([
            { code: "en", names: ["English", "İngilizce"] },
            { code: "tr", names: ["Türkçe", "Turkish"] },
            { code: "deutsch", names: ["Deutsch"] },
        ]);
    });
    test('display names', () => {
        expect(languageName("tr", languages)).toBe("Türkçe");
        expect(languageName("xx", languages)).toBe("xx");
    });
});

describe('matching language labels', () => {
    test('ignores case, accents and punctuation', () => {
        expect(normaliseLanguageName(" TÜRKÇE: ")).toBe("turkce");
        expect(normaliseLanguageName("İngilizce")).toBe("ingilizce");
        expect(normaliseLanguageName("INGILIZCE")).toBe("ingilizce");
        expect(normaliseLanguageName("(English)")).toBe("english");
    });
    test('matches any name or the code', () => {
        expect(matchLanguage("Türkçe", languages)).toBe("tr");
        expect(matchLanguage("turkish", languages)).toBe("tr");
        expect(matchLanguage("English:", languages)).toBe("en");
        expect(matchLanguage("İNGİLİZCE", languages)).toBe("en");
        expect(matchLanguage("TR", languages)).toBe("tr");
        expect(matchLanguage("deutsch", languages)).toBe("deutsch");
    });
    test('other labels are not languages', () => {
        expect(matchLanguage("Dough", languages)).toBeNull();
        expect(matchLanguage("English muffins", languages)).toBeNull();
        expect(matchLanguage("", languages)).toBeNull();
    });
});

describe('choosing the language to open', () => {
    const available = ["tr", "en"];
    test('single-language recipes show everything', () => {
        expect(chooseLanguage(["en"], { requested: "en" }, languages)).toBe(ALL_LANGUAGES);
        expect(chooseLanguage([], {}, languages)).toBe(ALL_LANGUAGES);
    });
    test('first available option wins', () => {
        expect(chooseLanguage(available, { requested: "en", noteDefault: "tr" }, languages)).toBe("en");
        expect(chooseLanguage(available, { noteDefault: "Turkish", lastUsed: "en" }, languages)).toBe("tr");
        expect(chooseLanguage(available, { lastUsed: "en", defaultLanguage: "tr" }, languages)).toBe("en");
        expect(chooseLanguage(available, { defaultLanguage: "English" }, languages)).toBe("en");
    });
    test('options the recipe does not have are skipped', () => {
        expect(chooseLanguage(available, { requested: "deutsch", defaultLanguage: "en" }, languages)).toBe("en");
        expect(chooseLanguage(available, { lastUsed: "fr" }, languages)).toBe("tr");
    });
    test('showing all languages can be requested', () => {
        expect(chooseLanguage(available, { requested: ALL_LANGUAGES }, languages)).toBe(ALL_LANGUAGES);
        expect(chooseLanguage(available, { lastUsed: ALL_LANGUAGES }, languages)).toBe(ALL_LANGUAGES);
    });
    test('falls back to the first language in the recipe', () => {
        expect(chooseLanguage(available, {}, languages)).toBe("tr");
    });
});

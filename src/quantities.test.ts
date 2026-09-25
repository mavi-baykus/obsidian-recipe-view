import { describe, expect, test } from '@jest/globals';
import Fraction from "fraction.js";
import { reUnicodeFractions, matchQuantities, normaliseFractions, QtyFormatType, formatQuantity } from './quantities'

describe('re-unicoding fractions', () => {
    test('converts a lone fraction', () => {
        expect(reUnicodeFractions("1/2")).toBe("\u00B9\u2044\u2082");
    });
    test('converts a fraction in text', () => {
        expect(reUnicodeFractions("one half 1/2")).toBe("one half \u00B9\u2044\u2082");
    });
    test('converts two fractions in text', () => {
        expect(reUnicodeFractions("2/3 fractions 1/2")).toBe("\u00B2\u2044\u2083 fractions \u00B9\u2044\u2082");
    });
    test('converts multi-digit fractions in text', () => {
        expect(reUnicodeFractions("them: 3/100 us: 99/100"))
            .toBe("them: \u00B3\u2044\u2081\u2080\u2080 us: \u2079\u2079\u2044\u2081\u2080\u2080");
    });
    test('converts mixed numbers in text', () => {
        expect(reUnicodeFractions("them: 23 3/100"))
            .toBe("them: 23 \u00B3\u2044\u2081\u2080\u2080");
    });
});

describe('matching single quantities in strings', () => {
    test('matches a decimal number', () => {
        expect(matchQuantities("2.67"))
            .toStrictEqual([{
                index: 0,
                length: 4,
                value: { value: new Fraction(267, 100), format: QtyFormatType.DECIMAL },
                unit: null,
            }]);
    });
    test('matches a fraction', () => {
        expect(matchQuantities("3/4"))
            .toStrictEqual([{
                index: 0,
                length: 3,
                value: { value: new Fraction(3, 4), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches integer with unit', () => {
        expect(matchQuantities("xxx 200g"))
            .toStrictEqual([{
                index: 4,
                length: 4,
                value: { value: new Fraction(200, 1), format: QtyFormatType.DECIMAL },
                unit: "g",
            }]);
    });
    test('unit at start is retained', () => {
        expect(matchQuantities("200g of flour"))
            .toStrictEqual([{
                index: 0,
                length: 4,
                value: { value: new Fraction(200, 1), format: QtyFormatType.DECIMAL },
                unit: "g",
            }]);
    });
    test('matches integer at start', () => {
        expect(matchQuantities("12 eggs"))
            .toStrictEqual([{
                index: 0,
                length: 2,
                value: { value: new Fraction(12, 1), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches ASCII fraction with unit', () => {
        expect(matchQuantities("xxx 1/2 cup"))
            .toStrictEqual([{
                index: 4,
                length: 7,
                value: { value: new Fraction(1, 2), format: QtyFormatType.FRACTION },
                unit: "cup",
            }]);
    });
    test('matches ASCII fraction at start', () => {
        expect(matchQuantities("3/16 sprig"))
            .toStrictEqual([{
                index: 0,
                length: 4,
                value: { value: new Fraction(3, 16), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches normalised Unicode fraction with unit', () => {
        expect(matchQuantities("xxx \u00BD lb".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 4,
                length: 6,
                value: { value: new Fraction(1, 2), format: QtyFormatType.FRACTION },
                unit: "lb",
            }]);
    });
    test('matches normalised Unicode fraction at start', () => {
        expect(matchQuantities("\u2075\u2044\u2086 bunch".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 0,
                length: 3,
                value: { value: new Fraction(5, 6), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches decimal with unit', () => {
        expect(matchQuantities("xxx 3.5L"))
            .toStrictEqual([{
                index: 4,
                length: 4,
                value: { value: new Fraction(35, 10), format: QtyFormatType.DECIMAL },
                unit: "L",
            }]);
    });
    test('matches decimal at start', () => {
        expect(matchQuantities("1.92 something"))
            .toStrictEqual([{
                index: 0,
                length: 4,
                value: { value: new Fraction(192, 100), format: QtyFormatType.DECIMAL },
                unit: null,
            }]);
    });
    test('matches mixed ASCII number with space with unit', () => {
        expect(matchQuantities("xxx 2 3/4 tablespoons"))
            .toStrictEqual([{
                index: 4,
                length: 17,
                value: { value: new Fraction(11, 4), format: QtyFormatType.FRACTION },
                unit: "tablespoons",
            }]);
    });
    test('matches mixed ASCII number with space at start', () => {
        expect(matchQuantities("10 3/8 unitless"))
            .toStrictEqual([{
                index: 0,
                length: 6,
                value: { value: new Fraction(83, 8), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches mixed ASCII number with dash with unit', () => {
        expect(matchQuantities("xxx 2-3/4 tablespoons"))
            .toStrictEqual([{
                index: 4,
                length: 17,
                value: { value: new Fraction(11, 4), format: QtyFormatType.FRACTION },
                unit: "tablespoons",
            }]);
    });
    test('matches mixed ASCII number with dash at start', () => {
        expect(matchQuantities("10-3/8 unitless"))
            .toStrictEqual([{
                index: 0,
                length: 6,
                value: { value: new Fraction(83, 8), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches mixed Unicode number with space with unit', () => {
        expect(matchQuantities("xxx 2 \u00BE tablespoons".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 4,
                length: 17,
                value: { value: new Fraction(11, 4), format: QtyFormatType.FRACTION },
                unit: "tablespoons",
            }]);
    });
    test('matches mixed Unicode number with space at start', () => {
        expect(matchQuantities("10 \u215C unitless".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 0,
                length: 6,
                value: { value: new Fraction(83, 8), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
    test('matches mixed Unicode number with dash with unit', () => {
        expect(matchQuantities("xxx 2-\u00BE tablespoons".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 4,
                length: 17,
                value: { value: new Fraction(11, 4), format: QtyFormatType.FRACTION },
                unit: "tablespoons",
            }]);
    });
    test('matches mixed Unicode number with dash at start', () => {
        expect(matchQuantities("10-\u215C unitless".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([{
                index: 0,
                length: 6,
                value: { value: new Fraction(83, 8), format: QtyFormatType.FRACTION },
                unit: null,
            }]);
    });
});

describe('matching multiple quantities in strings', () => {
    test('decimal and fraction together', () => {
        // https://github.com/lachholden/obsidian-recipe-view/issues/20
        expect(matchQuantities("1.5 g (¼ tsp) vanilla paste".normalize("NFKD").replace("\u2044", "/")))
            .toStrictEqual([
                {
                    index: 0,
                    length: 5,
                    value: { value: new Fraction(3, 2), format: QtyFormatType.DECIMAL },
                    unit: "g"
                },
                {
                    index: 7,
                    length: 7,
                    value: { value: new Fraction(1, 4), format: QtyFormatType.FRACTION },
                    unit: "tsp"
                }
            ]);
    });
});

describe('formatting scaled quantities', () => {
    test('decimal to decimal', () => {
        expect(
            formatQuantity(new Fraction("0.25"), QtyFormatType.DECIMAL, new Fraction("3.0"), false)
        ).toBe(
            "0.75"
        );
    });
    test('int to decimal', () => {
        expect(
            formatQuantity(new Fraction("2"), QtyFormatType.DECIMAL, new Fraction("1.25"), false)
        ).toBe(
            "2.5"
        );
    });
    test('fraction to fraction exact', () => {
        expect(
            formatQuantity(new Fraction("1/3"), QtyFormatType.FRACTION, new Fraction("2"), false)
        ).toBe(
            "2/3"
        );
    });
    test('fraction to fraction nearest 1/16', () => {
        expect(
            formatQuantity(new Fraction("1/7"), QtyFormatType.FRACTION, new Fraction("2"), false)
        ).toBe(
            "5/16"
        );
    });
    test('fraction to fraction not rounding thirds', () => {
        expect(
            formatQuantity(new Fraction("1/6"), QtyFormatType.FRACTION, new Fraction("4"), false)
        ).toBe(
            "2/3"
        );
    });
    test('int to fraction', () => {
        expect(
            formatQuantity(new Fraction("3"), QtyFormatType.FRACTION, new Fraction("0.25"), false)
        ).toBe(
            "3/4"
        );
    });
});
describe('normalising unicode fractions', () => {
    test('converts a lone vulgar fraction', () => {
        expect(normaliseFractions("\u00BD cup")).toBe("1/2 cup");
    });
    test('separates a vulgar fraction from a preceding digit', () => {
        expect(normaliseFractions("2\u00BD teaspoons")).toBe("2 1/2 teaspoons");
        expect(normaliseFractions("10\u00BE cups")).toBe("10 3/4 cups");
    });
    test('keeps an existing space before a vulgar fraction', () => {
        expect(normaliseFractions("1 \u00BE kg")).toBe("1 3/4 kg");
    });
    test('converts super/subscript fractions', () => {
        expect(normaliseFractions("\u00B9\u2044\u2082 tsp")).toBe("1/2 tsp");
        expect(normaliseFractions("2\u00B3\u2044\u2084 cups")).toBe("2 3/4 cups");
    });
    test('converts a fraction slash between ASCII digits', () => {
        expect(normaliseFractions("1\u20442 lb")).toBe("1/2 lb");
    });
    test('leaves other characters untouched', () => {
        const turkish = "1 yemek ka\u015F\u0131\u011F\u0131 s\u0131v\u0131 ya\u011F, \u00C7orba, \u0130stanbul";
        expect(normaliseFractions(turkish)).toBe(turkish);
        expect(normaliseFractions("2 m\u00B2 of pastry, 115\u00B0F")).toBe("2 m\u00B2 of pastry, 115\u00B0F");
    });
});

/** Summarise matches as [matched text, value, unit] for readability */
function summarise(str: string, extraUnits: string[] = []) {
    const normalised = normaliseFractions(str);
    return matchQuantities(normalised, extraUnits).map((m) => [
        normalised.slice(m.index, m.index + m.length),
        m.value.value.toFraction(true),
        m.unit,
    ]);
}

describe('matching quantities in real recipe lines', () => {
    test('mixed unicode number without a space', () => {
        // Was parsed as 21/2 = 10 1/2
        expect(summarise("2\u00BD teaspoons (7 g) instant dry yeast")).toStrictEqual([
            ["2 1/2 teaspoons", "2 1/2", "teaspoons"],
            ["7 g", "7", "g"],
        ]);
    });
    test('mixed unicode number followed by a range', () => {
        expect(summarise("4\u00BD cups (520\u2013585 g) bread flour, divided")).toStrictEqual([
            ["4 1/2 cups", "4 1/2", "cups"],
            ["520", "520", null],
            ["585 g", "585", "g"],
        ]);
    });
    test('ounces unit has no leading space', () => {
        expect(summarise("6 ounces (170 g) cream cheese, softened")).toStrictEqual([
            ["6 ounces", "6", "ounces"],
            ["170 g", "170", "g"],
        ]);
    });
    test('ounces without a space and fluid ounces', () => {
        expect(summarise("xxx 6oz and 2 fl oz and 3 fl. oz.")).toStrictEqual([
            ["6oz", "6", "oz"],
            ["2 fl oz", "2", "fl oz"],
            ["3 fl. oz.", "3", "fl. oz."],
        ]);
    });
    test('unit must not run into another word', () => {
        expect(summarise("xxx 2 garlic cloves and 3 cupcakes")).toStrictEqual([]);
    });
});

describe('matching ranges', () => {
    test('range at start without unit', () => {
        expect(summarise("1-2 eggs")).toStrictEqual([
            ["1", "1", null],
            ["2", "2", null],
        ]);
    });
    test('range with spaces and unit', () => {
        expect(summarise("xxx 1 - 2 tbsp salt")).toStrictEqual([
            ["1", "1", null],
            ["2 tbsp", "2", "tbsp"],
        ]);
    });
    test('range with en dash, em dash and "to"', () => {
        expect(summarise("xxx 1\u20132 cups, 3 \u2014 4 g, 5 to 6 lbs")).toStrictEqual([
            ["1", "1", null],
            ["2 cups", "2", "cups"],
            ["3", "3", null],
            ["4 g", "4", "g"],
            ["5", "5", null],
            ["6 lbs", "6", "lbs"],
        ]);
    });
    test('range of mixed numbers', () => {
        expect(summarise("xxx 1-2\u00BD cups")).toStrictEqual([
            ["1", "1", null],
            ["2 1/2 cups", "2 1/2", "cups"],
        ]);
    });
    test('low end of a range takes its format from the unit', () => {
        const low = matchQuantities("xxx 1-2 cups")[0];
        expect(low.value.format).toBe(QtyFormatType.FRACTION);
        const lowGrams = matchQuantities("xxx 100-200 g")[0];
        expect(lowGrams.value.format).toBe(QtyFormatType.DECIMAL);
    });
    test('hyphenated mixed number is not a range', () => {
        expect(summarise("xxx 1-1/4 oz.")).toStrictEqual([
            ["1-1/4 oz.", "1 1/4", "oz."],
        ]);
    });
});

describe('matching Turkish units', () => {
    test('spoon and glass measures', () => {
        expect(summarise("1 yemek ka\u015F\u0131\u011F\u0131 (15 ml) s\u0131v\u0131 ya\u011F")).toStrictEqual([
            ["1 yemek ka\u015F\u0131\u011F\u0131", "1", "yemek ka\u015F\u0131\u011F\u0131"],
            ["15 ml", "15", "ml"],
        ]);
        expect(summarise("xxx 2 su barda\u011F\u0131, 1\u00BD \u00E7ay ka\u015F\u0131\u011F\u0131, 2 tatl\u0131 ka\u015F\u0131\u011F\u0131")).toStrictEqual([
            ["2 su barda\u011F\u0131", "2", "su barda\u011F\u0131"],
            ["1 1/2 \u00E7ay ka\u015F\u0131\u011F\u0131", "1 1/2", "\u00E7ay ka\u015F\u0131\u011F\u0131"],
            ["2 tatl\u0131 ka\u015F\u0131\u011F\u0131", "2", "tatl\u0131 ka\u015F\u0131\u011F\u0131"],
        ]);
    });
    test('spoon and glass measures prefer fractions', () => {
        expect(matchQuantities("xxx 2 su barda\u011F\u0131")[0].value.format).toBe(QtyFormatType.FRACTION);
    });
    test('gr and lt abbreviations are decimal', () => {
        expect(summarise("xxx 200 gr un, 1.5 lt s\u00FCt")).toStrictEqual([
            ["200 gr", "200", "gr"],
            ["1.5 lt", "1 1/2", "lt"],
        ]);
        expect(matchQuantities("xxx 1 lt")[0].value.format).toBe(QtyFormatType.DECIMAL);
    });
    test('litres are decimal', () => {
        expect(matchQuantities("xxx 2 litres")[0].value.format).toBe(QtyFormatType.DECIMAL);
        expect(matchQuantities("xxx 500 millilitres")[0].value.format).toBe(QtyFormatType.DECIMAL);
    });
});

describe('matching additional units', () => {
    test('extra units are matched', () => {
        expect(summarise("xxx 2 cloves garlic, 1 pinch salt", ["cloves", "pinch"])).toStrictEqual([
            ["2 cloves", "2", "cloves"],
            ["1 pinch", "1", "pinch"],
        ]);
    });
    test('extra units with spaces and regex characters', () => {
        expect(summarise("xxx 3 kahve fincan\u0131 and 2 c.", ["kahve  fincan\u0131", "c."])).toStrictEqual([
            ["3 kahve fincan\u0131", "3", "kahve fincan\u0131"],
            ["2 c.", "2", "c."],
        ]);
    });
    test('extra units are not used when not configured', () => {
        expect(summarise("xxx 2 cloves garlic")).toStrictEqual([]);
    });
});

import Fraction from "fraction.js";

/** Matches numbers of the forms e.g. 1, 1.5, 1/2, 3 1/2, 5-3/4 */
export const NUMBER = new RegExp(/\d+(([\s-]+\d+)?\/\d+|\.\d+)?/)

/** Matches a whole bunch of common units that you would want to scale in recipes */
export const UNIT = new RegExp(/tb?sp?s?\.?|tablespoons?|teaspoons?|k?g|(kilo)?grams?|gr\.?|cups?|m?Ls?|millilit(re|er)s?|lit(re|er)s?|lt\.?|((fl\.?|fluid)\s*)?(oz\.?|ounces?)|pounds?|lbs?\.?|sticks?|(su|çay)\s+bardağı|(yemek|tatlı|çay|kahve)\s+kaşığı|kahve\s+fincanı/i)

/** Units that are usually written with fractions rather than decimals */
const FRACTION_UNIT = new RegExp(/^(tb?sp?s?\.?|tablespoons?|teaspoons?|cups?|sticks?|.*\s(bardağı|kaşığı|fincanı))$/i)

/**
 * Separates the two ends of a range, e.g. 1-2, 520–585, 2 to 3. A hyphen followed by a
 * fraction is left alone, as "1-1/2" is a mixed number rather than a range.
 */
const RANGE_SEPARATOR = "\\s*[\\u2013\\u2014]\\s*|\\s*-\\s*(?!\\d+\\/)|\\s+to\\s+";

/** A unit must not run straight into more letters, e.g. the "g" at the start of "garlic" */
const UNIT_END = "(?![\\p{L}\\p{N}_])";

/**
 * Build the regex that matches either a number (or range) at the start of a string, or
 * otherwise a number (or range) and unit. `extraUnits` are added to the built-in units.
 */
function buildQuantityRegex(extraUnits: string[]) {
    const unit = extraUnits
        .map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\s+/g, "\\s+"))
        .concat(UNIT.source)
        .join("|");
    const number = NUMBER.source;
    const range = (name: string) =>
        `(?<${name}low>${number})(?<${name}sep>${RANGE_SEPARATOR})(?<${name}high>${number})`;
    return new RegExp([
        `${range("range")}\\s*(?<rangeunit>${unit})${UNIT_END}`,
        `^${range("startrange")}\\b`,
        `(?<number>${number})\\s*(?<unit>${unit})${UNIT_END}`,
        `(?<startnumber>^${number})\\b`,
    ].join("|"), "igu");
}

const quantityRegexCache = new Map<string, RegExp>();

function quantityRegex(extraUnits: string[]) {
    const key = extraUnits.join("\n");
    let regex = quantityRegexCache.get(key);
    if (!regex) {
        regex = buildQuantityRegex(extraUnits);
        quantityRegexCache.set(key, regex);
    }
    return regex;
}

/** Matches either a number at the start of a string, or otherwise a number and unit */
export const QUANTITY = quantityRegex([]);

const UNICODE_FRACTION = new RegExp(
    "(\\d?)([\\u00BC-\\u00BE\\u2150-\\u215E\\u2189]|[\\u2070\\u00B9\\u00B2\\u00B3\\u2074-\\u2079]+[\\u2044/][\\u2080-\\u2089]+)",
    "g"
);

/**
 * Convert unicode fractions (e.g. ½ or ¹⁄₂) to ASCII (1/2) so they can be matched as
 * quantities, separating them from a preceding digit so that "2½" becomes "2 1/2" rather
 * than "21/2". All other characters are left untouched.
 */
export function normaliseFractions(str: string) {
    return str
        .replace(UNICODE_FRACTION, (_match, digit: string, fraction: string) =>
            (digit ? digit + " " : "") + fraction.normalize("NFKD")
        )
        .replaceAll("⁄", "/");
}

export enum QtyFormatType {
    FRACTION,
    DECIMAL,
}

export interface QuantityMatch {
    index: number;
    length: number;
    value: { value: Fraction; format: QtyFormatType };
    unit: string | null;
}

/**
 * Replace text fractions in a normalised unicode string with unicode equivalents, built
 * from super- and sub-script characters + \u2044.
 * @param str NFKD-normalised unicode string
 * @returns The same string with text fractions replaced by unicode equivalents
 */
export function reUnicodeFractions(str: string) {
    return str.replace(/\b(?<n>\d+)\/(?<d>\d+)\b/ig, (m, $1, $2) => {
        return $1
            .replaceAll("0", "\u2070")
            .replaceAll("1", "\u00B9")
            .replaceAll("2", "\u00B2")
            .replaceAll("3", "\u00B3")
            .replaceAll("4", "\u2074")
            .replaceAll("5", "\u2075")
            .replaceAll("6", "\u2076")
            .replaceAll("7", "\u2077")
            .replaceAll("8", "\u2078")
            .replaceAll("9", "\u2079") + "\u2044" + $2
                .replaceAll("0", "\u2080")
                .replaceAll("1", "\u2081")
                .replaceAll("2", "\u2082")
                .replaceAll("3", "\u2083")
                .replaceAll("4", "\u2084")
                .replaceAll("5", "\u2085")
                .replaceAll("6", "\u2086")
                .replaceAll("7", "\u2087")
                .replaceAll("8", "\u2088")
                .replaceAll("9", "\u2089")
    });
}

/**
 * Take a string of one of the forms matched by the NUMBER regex and an optional unit,
 * and return an object with the Fraction value of the number and whether, when scaled,
 * it should be represented as a fraction or decimal.
 * 
 * The preferred format will match the input. If the input is an integer, then
 * tablespoons/teaspoons/cups/sticks will be fractions, and all other units (or no unit
 * specified) will be decimals.
 */
function quantityStringsToValue(str: string, unit: string | null) {
    return {
        value: new Fraction(str.replace(/[-\s]+/g, " ")),
        format: (str.includes("/") ||
            unit?.match(FRACTION_UNIT) ||
            (!unit && !str.includes(".")))
            ? QtyFormatType.FRACTION : QtyFormatType.DECIMAL,
    }
}

/**
 * Match all of the quantities present in a string, and return an array of objects
 * describing them. Each end of a range (e.g. "520\u2013585 g") is returned as a separate
 * quantity, with the unit attached to the second one.
 *
 * Requires unicode fractions to have already been normalised to ASCII with
 * `normaliseFractions`.
 */
export function matchQuantities(str: string, extraUnits: string[] = []): QuantityMatch[] {
    return Array.from(str.matchAll(quantityRegex(extraUnits))).flatMap((match) => {
        const groups = match.groups!;
        const index = match.index!;
        const low = groups.rangelow ?? groups.startrangelow;
        if (low !== undefined) {
            const high = groups.rangehigh ?? groups.startrangehigh;
            const highIndex = low.length + (groups.rangesep ?? groups.startrangesep).length;
            const unit = groups.rangeunit?.trim() || null;
            return [
                {
                    index: index,
                    length: low.length,
                    value: quantityStringsToValue(low, unit),
                    unit: null,
                },
                {
                    index: index + highIndex,
                    length: match[0].length - highIndex,
                    value: quantityStringsToValue(high, unit),
                    unit: unit,
                },
            ];
        }
        const unit = groups.unit?.trim() || null;
        return [{
            index: index,
            length: match[0].length,
            value: quantityStringsToValue(groups.number ?? groups.startnumber, unit),
            unit: unit,
        }];
    });
}

export function formatQuantity(value: Fraction, format: QtyFormatType, scale: Fraction, unicodeFractions: boolean) {
    value = value.mul(scale);
    if (format == QtyFormatType.FRACTION) {
        value = value.d == 3 ? value : new Fraction(Math.round(16 * new Fraction(value).valueOf()), 16);
        return unicodeFractions ? reUnicodeFractions(value.toFraction(true)) : value.toFraction(true);
    } else {
        return value.toString();
    }
}
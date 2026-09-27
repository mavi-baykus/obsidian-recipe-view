// Reading and showing durations for timers: a recipe's cook time property, or a time typed
// into a timer. Pure helpers with no runtime dependency on Obsidian.

import { normaliseFractions } from "./quantities";

/** How a clock-style time like "1:30" is read */
export type ClockFormat = "h:mm" | "m:ss";

/** Numbers: 1, 1.5, 1 1/2 or 1/2 (after normalising, so also 1,5 and 1½) */
const NUMBER = "\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+";
/** Numbers in words: "an hour", "half an hour", "bir saat", "yarım saat" */
const NUMBER_WORD = "half(?:\\s+an?)?|an?|one|bir|yarim";
/** "1 and a half hours", "an hour and a half", "bir buçuk saat" */
const AND_A_HALF = "and\\s+a\\s+half|bucuk";

/** Units, longest first, in seconds. Turkish: saat/sa, dakika/dk, saniye/sn. */
const UNITS: Array<[string, number]> = [
    ["hours|hour|hrs|hr|h|saat|sa", 3600],
    ["minutes|minute|mins|min|m|dakika|dak|dk", 60],
    ["seconds|second|secs|sec|s|saniye|sn", 1],
];
const UNIT = UNITS.map(([names], i) => `(?<unit${i}>${names})`).join("|");

/**
 * One part of a duration, like "1 h", "30 minutes", "yarım saat" or "an hour and a half".
 * A unit can end with a dot ("dk.") but must not run into more letters.
 */
const PART = new RegExp(
    `\\s*(?:(?:,|and|ve|&)\\s*)?` +
    `(?<number>${NUMBER}|${NUMBER_WORD})\\s*(?<half>${AND_A_HALF})?\\s*` +
    `(?:${UNIT})\\.?(?![a-z])` +
    `(?:\\s+(?<halfAfter>${AND_A_HALF}))?`,
    "y",
);

/**
 * Lower-case, without accents (Turkish ı and İ become i), with fractions like ½ as 1/2
 * and decimal commas as points
 */
function normalise(text: string): string {
    return normaliseFractions(text)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ı/g, "i")
        .toLowerCase()
        .replace(/(\d),(\d)/g, "$1.$2")
        .trim();
}

function numberValue(text: string): number | null {
    const t = text.trim();
    if (/^(an?|one|bir)$/.test(t)) return 1;
    if (/^(half(\s+an?)?|yarim)$/.test(t)) return 0.5;
    const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[3]) ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : null;
    const fraction = t.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
    const n = Number(t);
    return isFinite(n) ? n : null;
}

/** Seconds from parts like "1 hour 30 minutes", or null if the text isn't only parts */
function parseParts(text: string): number | null {
    let total = 0;
    let at = 0;
    let lastUnit = 0;
    while (at < text.length) {
        PART.lastIndex = at;
        const match = PART.exec(text);
        if (!match?.groups) break;
        const value = numberValue(match.groups.number);
        if (value === null) return null;
        const unit = UNITS.find((_, i) => match.groups?.[`unit${i}`])?.[1] || 0;
        const half = match.groups.half || match.groups.halfAfter ? 0.5 : 0;
        total += (value + half) * unit;
        lastUnit = unit;
        at = PART.lastIndex;
    }
    if (at == 0) return null;
    const rest = text.slice(at).trim();
    if (rest) {
        // Minutes without a unit after hours, as in "1h30" or "1 saat 30"
        if (lastUnit != 3600 || !/^[0-5]?\d$/.test(rest)) return null;
        total += Number(rest) * 60;
    }
    return total;
}

/**
 * Read a duration, in seconds. Accepts, in English or Turkish:
 * - units, with or without spaces: "1h 30m", "1 hr 30 min", "1 hour and 30 minutes",
 *   "90 min", "45 sec", "1 saat 15 dakika", "45 dk.", "1h30";
 * - decimals and fractions: "1.5 h", "1,5 saat", "1½ hours";
 * - words: "an hour", "half an hour", "an hour and a half", "yarım saat", "bir buçuk saat";
 * - clock times, as hours and minutes ("01:30") or minutes and seconds ("12:00") depending
 *   on `clock`, and "1:30:00" as hours, minutes and seconds;
 * - ISO 8601 durations, as copied from recipe websites: "PT1H30M";
 * - a bare number, or a number property value, as minutes: "90".
 *
 * Returns null for anything else, or for no time at all.
 */
export function parseDuration(input: unknown, clock: ClockFormat = "h:mm"): number | null {
    let seconds: number | null = null;
    if (typeof input == "number") {
        seconds = input * 60;
    } else if (typeof input == "string") {
        seconds = parseDurationText(normalise(input), clock);
    }
    if (seconds === null || !isFinite(seconds) || seconds < 1) return null;
    return Math.round(seconds);
}

function parseDurationText(text: string, clock: ClockFormat): number | null {
    if (!text) return null;

    if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 60;

    const clockTime = text.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
    if (clockTime) {
        const [, a, b, c] = clockTime.map(Number);
        if (clockTime[3] !== undefined) return a * 3600 + b * 60 + c;
        return clock == "h:mm" ? a * 3600 + b * 60 : a * 60 + b;
    }

    const iso = text.match(/^p(?:(\d+(?:\.\d+)?)d)?(?:t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?)?$/);
    if (iso && iso.slice(1).some((part) => part !== undefined)) {
        const [days, hours, minutes, secs] = iso.slice(1).map((part) => Number(part || 0));
        return days * 86400 + hours * 3600 + minutes * 60 + secs;
    }

    return parseParts(text);
}

/** Show a duration like a timer: "44:12", or "1:30:00" from an hour */
export function formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

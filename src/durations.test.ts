import { describe, expect, test } from '@jest/globals';
import { formatDuration, parseDuration } from './durations';

const H = 3600;
const M = 60;

describe('reading durations', () => {
    test('every format from the plan', () => {
        const cases: Array<[string, number]> = [
            ["01:30", H + 30 * M],
            ["1:30", H + 30 * M],
            ["1h 30m", H + 30 * M],
            ["1 h 30 m", H + 30 * M],
            ["1hr 30min", H + 30 * M],
            ["1 hr 30 min", H + 30 * M],
            ["1 hour 30 minutes", H + 30 * M],
            ["1hour 30minutes", H + 30 * M],
            ["1h", H],
            ["30m", 30 * M],
            ["1 h", H],
            ["30 m", 30 * M],
            ["30 min", 30 * M],
            ["1 hr", H],
            ["1 hour", H],
            ["30 minutes", 30 * M],
            ["30min", 30 * M],
            ["1hr", H],
        ];
        for (const [text, seconds] of cases) {
            expect([text, parseDuration(text)]).toStrictEqual([text, seconds]);
        }
    });
    test('more English forms', () => {
        const cases: Array<[string, number]> = [
            ["1 hour and 30 minutes", H + 30 * M],
            ["1 hour, 30 minutes", H + 30 * M],
            ["1h30", H + 30 * M],
            ["1h30m", H + 30 * M],
            ["2 hrs", 2 * H],
            ["90 mins", 90 * M],
            ["45 sec", 45],
            ["1 min 30 sec", 90],
            ["1.5 h", 1.5 * H],
            ["1½ hours", 1.5 * H],
            ["1 1/2 hours", 1.5 * H],
            ["½ hour", 30 * M],
            ["an hour", H],
            ["a minute", M],
            ["half an hour", 30 * M],
            ["an hour and a half", 1.5 * H],
            ["1 and a half hours", 1.5 * H],
            ["  1 HOUR  ", H],
            ["10 min.", 10 * M],
        ];
        for (const [text, seconds] of cases) {
            expect([text, parseDuration(text)]).toStrictEqual([text, seconds]);
        }
    });
    test('Turkish', () => {
        const cases: Array<[string, number]> = [
            ["1 saat 15 dakika", H + 15 * M],
            ["1 saat ve 15 dakika", H + 15 * M],
            ["45 dk.", 45 * M],
            ["45 dk", 45 * M],
            ["15 dakika", 15 * M],
            ["30 saniye", 30],
            ["30 sn", 30],
            ["2 sa", 2 * H],
            ["1,5 saat", 1.5 * H],
            ["yarım saat", 30 * M],
            ["Yarım saat", 30 * M],
            ["bir saat", H],
            ["bir buçuk saat", 1.5 * H],
            ["1 saat 30", H + 30 * M],
        ];
        for (const [text, seconds] of cases) {
            expect([text, parseDuration(text)]).toStrictEqual([text, seconds]);
        }
    });
    test('ISO 8601 durations, as on recipe websites', () => {
        expect(parseDuration("PT1H30M")).toBe(H + 30 * M);
        expect(parseDuration("PT45M")).toBe(45 * M);
        expect(parseDuration("pt1h")).toBe(H);
        expect(parseDuration("P0DT1H")).toBe(H);
        expect(parseDuration("PT90S")).toBe(90);
        expect(parseDuration("P")).toBeNull();
    });
    test('clock times as hours or minutes', () => {
        expect(parseDuration("1:30", "h:mm")).toBe(H + 30 * M);
        expect(parseDuration("12:00", "m:ss")).toBe(12 * M);
        expect(parseDuration("1:30", "m:ss")).toBe(90);
        expect(parseDuration("1:30:00", "m:ss")).toBe(H + 30 * M);
        expect(parseDuration("1:30:00", "h:mm")).toBe(H + 30 * M);
        expect(parseDuration("1:75")).toBeNull();
        expect(parseDuration("1:2")).toBeNull();
    });
    test('bare numbers are minutes, whether text or a number property', () => {
        expect(parseDuration("90")).toBe(90 * M);
        expect(parseDuration("1.5")).toBe(90);
        expect(parseDuration(90)).toBe(90 * M);
        expect(parseDuration(0.5)).toBe(30);
    });
    test('anything else is not a duration', () => {
        for (const text of ["", "  ", "abc", "10 apples", "0", "0 min", "1 hour 90", "hour", "1 horses", "30 mint", "-5 min"]) {
            expect([text, parseDuration(text)]).toStrictEqual([text, null]);
        }
        expect(parseDuration(null)).toBeNull();
        expect(parseDuration(undefined)).toBeNull();
        expect(parseDuration(["1h"])).toBeNull();
        expect(parseDuration(0)).toBeNull();
        expect(parseDuration(NaN)).toBeNull();
    });
});

describe('showing durations', () => {
    test('as minutes and seconds, or with hours', () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(59)).toBe("0:59");
        expect(formatDuration(44 * M + 12)).toBe("44:12");
        expect(formatDuration(H + 30 * M)).toBe("1:30:00");
        expect(formatDuration(-5)).toBe("0:00");
    });
    test('round-trips through typing it back in', () => {
        for (const seconds of [59, 600, 44 * M + 12, H + 30 * M, 10 * H + 5]) {
            expect(parseDuration(formatDuration(seconds), "m:ss")).toBe(seconds);
        }
    });
});

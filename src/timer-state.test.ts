import { describe, expect, test } from '@jest/globals';
import {
    addTimer, adjustTimer, createTimer, dismissTimer, isActive, nextTimerLabel, pauseTimer,
    restoreTimers, secondsLeft, setTimerTime, startTimer, tickTimers, Timer,
} from './timer-state';

const T0 = 1_800_000_000_000;
const s = (seconds: number) => seconds * 1000;

function timer(seconds = 600, extra: Partial<Timer> = {}): Timer {
    return { ...createTimer({ id: "a", label: "Cook time", path: "Soup.md", seconds }), ...extra };
}

describe('running a timer', () => {
    test('counts down from when it was started, by the clock', () => {
        const t = startTimer(timer(600), T0);
        expect(t.state).toBe("running");
        expect(secondsLeft(t, T0)).toBe(600);
        expect(secondsLeft(t, T0 + s(90))).toBe(510);
        expect(secondsLeft(t, T0 + s(90) + 400)).toBe(510);
        expect(secondsLeft(t, T0 + s(700))).toBe(0);
    });
    test('pausing keeps the time left, and starting again carries on', () => {
        let t = startTimer(timer(600), T0);
        t = pauseTimer(t, T0 + s(100));
        expect(t).toMatchObject({ state: "paused", remaining: 500, endsAt: null });
        expect(secondsLeft(t, T0 + s(1000))).toBe(500);
        t = startTimer(t, T0 + s(1000));
        expect(secondsLeft(t, T0 + s(1100))).toBe(400);
    });
    test('a timer at zero does not start', () => {
        expect(startTimer(timer(0), T0).state).toBe("idle");
    });
    test('rings when it runs out, even if the app was asleep past the end', () => {
        const running = startTimer(timer(60), T0);
        expect(tickTimers([running], T0 + s(59)).finished).toStrictEqual([]);
        const { timers, finished } = tickTimers([running], T0 + s(3600));
        expect(finished.map((t) => t.id)).toStrictEqual(["a"]);
        expect(timers[0]).toMatchObject({ state: "ringing", remaining: 0, finishedAt: T0 + s(60) });
        expect(tickTimers(timers, T0 + s(4000)).finished).toStrictEqual([]);
    });
    test('dismissing goes back to the time it was set to', () => {
        const ringing = tickTimers([startTimer(timer(60), T0)], T0 + s(61)).timers[0];
        expect(dismissTimer(ringing)).toMatchObject({ state: "idle", remaining: 60, finishedAt: null });
    });
    test('running and ringing timers keep the screen on', () => {
        expect(isActive(timer())).toBe(false);
        expect(isActive(startTimer(timer(), T0))).toBe(true);
        expect(isActive(pauseTimer(startTimer(timer(), T0), T0))).toBe(false);
    });
});

describe('changing the time', () => {
    test('adding and taking away minutes before starting sets the time', () => {
        let t = adjustTimer(timer(600), 300, T0);
        expect(t).toMatchObject({ remaining: 900, duration: 900 });
        t = adjustTimer(t, -1200, T0);
        expect(t).toMatchObject({ remaining: 0, duration: 0 });
    });
    test('adding time to a running timer moves its end', () => {
        const t = adjustTimer(startTimer(timer(600), T0), 60, T0 + s(100));
        expect(secondsLeft(t, T0 + s(100))).toBe(560);
        expect(t.duration).toBe(600);
    });
    test('taking away more than is left makes a running timer ring', () => {
        const t = adjustTimer(startTimer(timer(30), T0), -60, T0);
        expect(tickTimers([t], T0).finished).toHaveLength(1);
    });
    test('adding time to a ringing timer snoozes it; taking time away does nothing', () => {
        const ringing = tickTimers([startTimer(timer(60), T0)], T0 + s(61)).timers[0];
        expect(adjustTimer(ringing, -60, T0 + s(70))).toBe(ringing);
        const snoozed = adjustTimer(ringing, 60, T0 + s(70));
        expect(snoozed).toMatchObject({ state: "running", finishedAt: null });
        expect(secondsLeft(snoozed, T0 + s(70))).toBe(60);
    });
    test('typing a time sets it, and a running timer carries on from it', () => {
        expect(setTimerTime(timer(600), 1200, T0)).toMatchObject({ state: "idle", remaining: 1200, duration: 1200 });
        const running = setTimerTime(startTimer(timer(600), T0), 300, T0 + s(10));
        expect(running.state).toBe("running");
        expect(secondsLeft(running, T0 + s(10))).toBe(300);
        const ringing = tickTimers([startTimer(timer(60), T0)], T0 + s(61)).timers[0];
        expect(setTimerTime(ringing, 120, T0 + s(70))).toMatchObject({ state: "idle", remaining: 120 });
    });
});

describe('adding timers', () => {
    const tapped = (id: string, seconds: number) =>
        createTimer({ id, label: id, path: "Soup.md", seconds, fromTap: true });

    test('a tapped time replaces the last tapped timer if it was not started', () => {
        let timers = addTimer([], tapped("3. Simmer", 45 * 60));
        timers = addTimer(timers, tapped("4. Pressure cooker", 15 * 60));
        expect(timers.map((t) => t.label)).toStrictEqual(["4. Pressure cooker"]);
    });
    test('started or adjusted tapped timers stay', () => {
        let timers = addTimer([], tapped("3. Simmer", 45 * 60));
        timers = [startTimer(timers[0], T0)];
        timers = addTimer(timers, tapped("4. Pressure cooker", 15 * 60));
        expect(timers).toHaveLength(2);
        timers = [timers[0], adjustTimer(timers[1], 60, T0)];
        timers = addTimer(timers, tapped("5. Blend", 60));
        expect(timers).toHaveLength(3);
    });
    test('other timers are always added', () => {
        let timers = addTimer([], tapped("3. Simmer", 45 * 60));
        timers = addTimer(timers, createTimer({ id: "b", label: "Timer 1", path: "Soup.md", seconds: 600 }));
        expect(timers).toHaveLength(2);
    });
    test('new timers are numbered', () => {
        expect(nextTimerLabel([])).toBe("Timer 1");
        expect(nextTimerLabel([timer(1, { label: "Timer 1" }), timer(1, { label: "Cook time" })])).toBe("Timer 2");
        expect(nextTimerLabel([timer(1, { label: "Timer 2" })])).toBe("Timer 1");
    });
});

describe('restoring saved timers', () => {
    test('keeps valid timers, and a running one that ended while closed rings', () => {
        const running = startTimer(timer(60), T0);
        const saved = JSON.parse(JSON.stringify([running, { id: 3 }, null, { ...running, state: "odd" }]));
        const restored = restoreTimers(saved);
        expect(restored).toStrictEqual([running]);
        expect(tickTimers(restored, T0 + s(3600)).finished).toHaveLength(1);
    });
    test('ignores anything that is not a list', () => {
        expect(restoreTimers(null)).toStrictEqual([]);
        expect(restoreTimers("[]")).toStrictEqual([]);
    });
});

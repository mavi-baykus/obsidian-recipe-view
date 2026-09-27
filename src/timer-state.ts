// The state of recipe timers, as pure functions of the current time so they can be unit
// tested. Running timers store when they end rather than counting down, so they stay
// right when Obsidian is paused in the background or restarted.

export type TimerState = "idle" | "running" | "paused" | "ringing";

export interface Timer {
    id: string;
    label: string;
    /** Path of the recipe the timer was added from */
    path: string;
    /** Seconds it was set to, which it goes back to after ringing */
    duration: number;
    /** Seconds left, when not running */
    remaining: number;
    /** When it ends, in milliseconds since the epoch, while running */
    endsAt: number | null;
    state: TimerState;
    /** When it finished, while ringing */
    finishedAt: number | null;
    /** Added by tapping a time in the recipe, and not changed since */
    fromTap: boolean;
}

export interface NewTimer {
    id: string;
    label: string;
    path: string;
    seconds: number;
    fromTap?: boolean;
}

export function createTimer({ id, label, path, seconds, fromTap = false }: NewTimer): Timer {
    const s = Math.max(0, Math.round(seconds));
    return { id, label, path, duration: s, remaining: s, endsAt: null, state: "idle", finishedAt: null, fromTap };
}

/** Seconds left on a timer */
export function secondsLeft(timer: Timer, now: number): number {
    if (timer.state == "running" && timer.endsAt !== null) {
        return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    }
    return timer.state == "ringing" ? 0 : timer.remaining;
}

/**
 * Add a timer at the end. A timer from tapping a time replaces the newest timer if that
 * one also came from a tap and hasn't been touched, so trying out times doesn't pile up.
 */
export function addTimer(timers: Timer[], timer: Timer): Timer[] {
    const last = timers[timers.length - 1];
    if (timer.fromTap && last?.fromTap && last.state == "idle") {
        return [...timers.slice(0, -1), timer];
    }
    return [...timers, timer];
}

/** A label for a new timer that isn't from the recipe: "Timer 1", "Timer 2", … */
export function nextTimerLabel(timers: Timer[]): string {
    const used = new Set(timers.map((t) => t.label));
    let n = 1;
    while (used.has(`Timer ${n}`)) n++;
    return `Timer ${n}`;
}

export function startTimer(timer: Timer, now: number): Timer {
    if ((timer.state != "idle" && timer.state != "paused") || timer.remaining <= 0) return timer;
    return { ...timer, state: "running", endsAt: now + timer.remaining * 1000, fromTap: false };
}

export function pauseTimer(timer: Timer, now: number): Timer {
    if (timer.state != "running") return timer;
    return { ...timer, state: "paused", remaining: secondsLeft(timer, now), endsAt: null };
}

/**
 * Add or take away time. A timer that is set but not started keeps the new time for when
 * it is started again. Adding time to a ringing timer snoozes it.
 */
export function adjustTimer(timer: Timer, deltaSeconds: number, now: number): Timer {
    switch (timer.state) {
        case "running": {
            const left = Math.max(0, secondsLeft(timer, now) + deltaSeconds);
            return { ...timer, endsAt: now + left * 1000, fromTap: false };
        }
        case "ringing":
            if (deltaSeconds <= 0) return timer;
            return { ...timer, state: "running", endsAt: now + deltaSeconds * 1000, finishedAt: null };
        case "paused":
            return { ...timer, remaining: Math.max(0, timer.remaining + deltaSeconds), fromTap: false };
        case "idle": {
            const remaining = Math.max(0, timer.remaining + deltaSeconds);
            return { ...timer, remaining, duration: remaining, fromTap: false };
        }
    }
}

/** Set a timer to a typed time. A running timer carries on from the new time. */
export function setTimerTime(timer: Timer, seconds: number, now: number): Timer {
    const s = Math.max(0, Math.round(seconds));
    const set = { ...timer, duration: s, remaining: s, finishedAt: null, fromTap: false };
    if (timer.state == "running") return { ...set, endsAt: now + s * 1000 };
    return { ...set, state: timer.state == "ringing" ? "idle" : timer.state, endsAt: null };
}

/** Stop a ringing timer, setting it back to its time so it can be started again */
export function dismissTimer(timer: Timer): Timer {
    if (timer.state != "ringing") return timer;
    return { ...timer, state: "idle", remaining: timer.duration, endsAt: null, finishedAt: null };
}

/** Timers that have run out start ringing. Returns the new timers and those that just finished. */
export function tickTimers(timers: Timer[], now: number): { timers: Timer[]; finished: Timer[] } {
    const finished: Timer[] = [];
    const next = timers.map((t) => {
        if (t.state != "running" || t.endsAt === null || t.endsAt > now) return t;
        const done: Timer = { ...t, state: "ringing", remaining: 0, finishedAt: t.endsAt, endsAt: null };
        finished.push(done);
        return done;
    });
    return { timers: finished.length ? next : timers, finished };
}

/** Timers saved earlier, e.g. before Obsidian was closed, skipping anything malformed */
export function restoreTimers(saved: unknown): Timer[] {
    if (!Array.isArray(saved)) return [];
    const states: TimerState[] = ["idle", "running", "paused", "ringing"];
    return saved.filter((t): t is Timer =>
        !!t && typeof t == "object" &&
        typeof t.id == "string" && typeof t.label == "string" && typeof t.path == "string" &&
        typeof t.duration == "number" && typeof t.remaining == "number" &&
        (t.endsAt === null || typeof t.endsAt == "number") &&
        (t.finishedAt === null || typeof t.finishedAt == "number") &&
        states.includes(t.state) &&
        (t.state != "running" || typeof t.endsAt == "number")
    ).map((t) => ({ ...t, fromTap: !!t.fromTap }));
}

/** Timers that need the screen kept on and the app awake: running or ringing */
export function isActive(timer: Timer): boolean {
    return timer.state == "running" || timer.state == "ringing";
}

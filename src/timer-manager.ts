// Runs the recipe timers: keeps them ticking, rings when they finish, keeps the screen on
// while they run, and saves them on this device so they survive Obsidian restarting.
// Timers live here rather than in a recipe card, so re-rendering the card, switching
// layout or language, or leaving the recipe doesn't stop them.

import { App, Notice } from "obsidian";
import { Writable, get, writable } from "svelte/store";
import {
    NewTimer, Timer, addTimer, adjustTimer, createTimer, dismissTimer, isActive, pauseTimer,
    restoreTimers, secondsLeft, setTimerTime, startTimer, tickTimers,
} from "./timer-state";
import { AlarmSound } from "./alarm";
import { KeepAwake } from "./keep-awake";
import { formatDuration } from "./durations";

export interface TimerOptions {
    /** Play a sound when a timer finishes */
    sound: boolean;
    /** Keep the screen on while a timer runs */
    keepScreenOn: boolean;
}

const DEFAULT_SECONDS = 10 * 60;

export class TimerManager {
    readonly timers: Writable<Timer[]> = writable([]);
    /** The time, kept up to date while timers run, for showing the time left */
    readonly now: Writable<number> = writable(Date.now());

    private alarm = new AlarmSound();
    private keepAwake = new KeepAwake();
    private ringing = false;
    /** Notices of ringing timers, by timer id */
    private notices = new Map<string, Notice>();
    private storageKey: string;
    /** The timer started by "Test alarm", removed once dismissed */
    private testId: string | null = null;

    constructor(
        private app: App,
        private options: () => TimerOptions,
        private statusBar: HTMLElement | null,
    ) {
        this.storageKey = `recipe-view-timers:${app.vault.getName()}`;
    }

    /** Bring back the timers saved on this device. Any that finished meanwhile ring. */
    load() {
        this.timers.set(restoreTimers(this.read("timers")));
        this.tick();
        this.refresh();
    }

    destroy() {
        this.alarm.destroy();
        this.keepAwake.destroy();
        this.notices.forEach((n) => n.hide());
        this.notices.clear();
    }

    get lastSeconds(): number {
        const saved = this.read("last");
        return typeof saved == "number" && saved > 0 ? saved : DEFAULT_SECONDS;
    }

    /** Add a timer, set but not started. Call from a tap, so the alarm can ring later. */
    add(timer: Omit<NewTimer, "id">): Timer {
        this.alarm.unlock();
        const added = createTimer({ ...timer, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` });
        this.update((timers) => addTimer(timers, added));
        return added;
    }

    start(id: string) {
        this.alarm.unlock();
        if (this.options().keepScreenOn) this.keepAwake.enable();
        const now = Date.now();
        this.change(id, (t) => startTimer(t, now));
        // New timers start from the last time used, but not from the test's 5 seconds
        const timer = this.find(id);
        if (timer && id != this.testId) this.write("last", timer.duration);
    }

    pause(id: string) {
        const now = Date.now();
        this.change(id, (t) => pauseTimer(t, now));
    }

    adjust(id: string, seconds: number) {
        this.alarm.unlock();
        const now = Date.now();
        this.change(id, (t) => adjustTimer(t, seconds, now));
    }

    setTime(id: string, seconds: number) {
        const now = Date.now();
        this.change(id, (t) => setTimerTime(t, seconds, now));
    }

    remove(id: string) {
        this.update((timers) => timers.filter((t) => t.id != id));
    }

    /** Stop a ringing timer. The "Test alarm" timer goes away instead. */
    dismiss(id: string) {
        if (id == this.testId) {
            this.testId = null;
            this.remove(id);
        } else {
            this.change(id, dismissTimer);
        }
    }

    dismissAll() {
        this.update((timers) => timers
            .filter((t) => !(t.id == this.testId && t.state == "ringing"))
            .map(dismissTimer));
    }

    hasRinging(): boolean {
        return get(this.timers).some((t) => t.state == "ringing");
    }

    /**
     * Try the alarm as a timer would use it: a 5 second timer, started now. Reports whether
     * the screen can be kept on; the ringing notice says if the sound couldn't play.
     */
    async test() {
        const timer = this.add({ label: "Test alarm", path: "", seconds: 5 });
        this.testId = timer.id;
        this.start(timer.id);
        const on = await this.keepAwake.enable();
        const how = this.keepAwake.method == "wake lock" ? "a wake lock" : "a silent video";
        new Notice(on
            ? `Test alarm in 5 seconds. The screen is kept on using ${how}.`
            : `Test alarm in 5 seconds. The screen can't be kept on here (${this.keepAwake.errors.join("; ")}).`,
            8000);
        if (!this.options().keepScreenOn) this.refresh();
    }

    /** Check for finished timers and update the time shown. Runs a few times a second. */
    tick() {
        const now = Date.now();
        const timers = get(this.timers);
        if (!timers.some(isActive)) return;
        this.now.set(now);
        const { timers: next, finished } = tickTimers(timers, now);
        if (finished.length == 0) {
            this.showStatus(next, now);
            return;
        }
        this.update(() => next);
        finished.forEach((t) => this.ring(t, now));
    }

    private ring(timer: Timer, now: number) {
        const late = timer.finishedAt ? Math.floor((now - timer.finishedAt) / 60000) : 0;
        const name = timer.path ? this.recipeName(timer.path) : "";
        const message = createFragment((f) => {
            f.createEl("strong", { text: `⏰ ${timer.label}` });
            f.appendText(late > 0 ? ` finished ${late} min ago.` : " is done.");
            if (name) f.createDiv({ text: name, cls: "recipe-timer-notice-recipe" });
            const warning = f.createDiv({ cls: "recipe-timer-notice-warning" });
            f.createDiv({ text: "Tap to dismiss", cls: "recipe-timer-notice-hint" });
            if (this.options().sound) {
                this.startSound().then((playing) => {
                    if (!playing) warning.setText("The alarm sound couldn't play here.");
                });
            }
        });
        const notice = new Notice(message, 0);
        // Since Obsidian 1.7 the message is inside the notice's box; a tap anywhere on it counts
        const box = (notice as unknown as { containerEl?: HTMLElement }).containerEl || notice.noticeEl;
        box.addEventListener("click", () => {
            this.notices.delete(timer.id);
            this.dismiss(timer.id);
        });
        this.notices.get(timer.id)?.hide();
        this.notices.set(timer.id, notice);

        // A system notification on desktop, when Obsidian isn't in front
        if (!document.hasFocus() && "Notification" in window && Notification.permission == "granted") {
            try {
                new Notification(`${timer.label} is done`, { body: name || undefined, silent: true });
            } catch {
                // Not available
            }
        }
    }

    private async startSound(): Promise<boolean> {
        if (this.ringing) return true;
        this.ringing = true;
        return this.alarm.start();
    }

    private change(id: string, fn: (t: Timer) => Timer) {
        this.update((timers) => timers.map((t) => (t.id == id ? fn(t) : t)));
    }

    private update(fn: (timers: Timer[]) => Timer[]) {
        this.timers.update(fn);
        this.now.set(Date.now());
        this.write("timers", get(this.timers));
        this.refresh();
    }

    /** Stop the sound, notices and screen-on that no timer needs any more */
    private refresh() {
        const timers = get(this.timers);
        const ringing = new Set(timers.filter((t) => t.state == "ringing").map((t) => t.id));
        this.notices.forEach((notice, id) => {
            if (!ringing.has(id)) {
                notice.hide();
                this.notices.delete(id);
            }
        });
        if (ringing.size == 0 && this.ringing) {
            this.ringing = false;
            this.alarm.stop();
        }
        if (this.options().keepScreenOn && timers.some(isActive)) {
            this.keepAwake.enable();
        } else {
            this.keepAwake.disable();
        }
        this.showStatus(timers, Date.now());
    }

    /** On desktop, the soonest timer in the status bar */
    private showStatus(timers: Timer[], now: number) {
        if (!this.statusBar) return;
        const ringing = timers.find((t) => t.state == "ringing");
        const running = timers
            .filter((t) => t.state == "running")
            .sort((a, b) => (a.endsAt || 0) - (b.endsAt || 0))[0];
        const text = ringing
            ? `⏰ ${ringing.label} is done`
            : running ? `⏱ ${formatDuration(secondsLeft(running, now))} ${running.label}` : "";
        this.statusBar.setText(text);
        this.statusBar.toggle(text.length > 0);
    }

    private find(id: string): Timer | undefined {
        return get(this.timers).find((t) => t.id == id);
    }

    recipeName(path: string): string {
        return path.split("/").pop()?.replace(/\.md$/, "") || path;
    }

    private read(key: string): unknown {
        try {
            const value = window.localStorage.getItem(`${this.storageKey}:${key}`);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    }

    private write(key: string, value: unknown) {
        try {
            window.localStorage.setItem(`${this.storageKey}:${key}`, JSON.stringify(value));
        } catch {
            // Storage is full or unavailable; timers still work until Obsidian closes
        }
    }
}

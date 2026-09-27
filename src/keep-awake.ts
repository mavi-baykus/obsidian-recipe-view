// Keeps the screen on while timers run. When the screen locks, iOS and Android pause
// Obsidian, and an alarm can't sound until it's back.
//
// Uses the Screen Wake Lock API where it's available and allowed, and otherwise NoSleep.js's
// technique: a silent, invisible video playing on a loop.

import media from "nosleep.js/src/media.js";

export type KeepAwakeMethod = "wake lock" | "video";

interface WakeLockSentinel {
    release(): Promise<void>;
    addEventListener(type: "release", listener: () => void): void;
}

export class KeepAwake {
    private wanted = false;
    private lock: WakeLockSentinel | null = null;
    private video: HTMLVideoElement | null = null;
    /** How the screen is being kept on, if it is */
    method: KeepAwakeMethod | null = null;
    /** Why the wake lock or the video didn't work, if they didn't */
    errors: string[] = [];

    constructor() {
        document.addEventListener("visibilitychange", this.onVisibilityChange);
    }

    /** Keep the screen on. Works best when called from a tap. Resolves to whether it worked. */
    async enable(): Promise<boolean> {
        this.wanted = true;
        if (this.method == "wake lock" && this.lock) return true;
        if (this.method == "video" && this.video && !this.video.paused) return true;
        this.errors = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wakeLock = (navigator as any).wakeLock;
        if (wakeLock?.request && document.visibilityState == "visible") {
            try {
                const lock: WakeLockSentinel = await wakeLock.request("screen");
                lock.addEventListener("release", () => {
                    if (this.lock == lock) {
                        this.lock = null;
                        this.method = null;
                    }
                });
                this.lock = lock;
                this.method = "wake lock";
                if (!this.wanted) this.disable();
                return true;
            } catch (e) {
                this.errors.push(`Wake lock: ${describe(e)}`);
            }
        } else if (!wakeLock?.request) {
            this.errors.push("Wake lock: not available");
        }

        try {
            await this.getVideo().play();
            this.method = "video";
            if (!this.wanted) this.disable();
            return true;
        } catch (e) {
            this.errors.push(`Video: ${describe(e)}`);
            this.method = null;
            return false;
        }
    }

    disable() {
        this.wanted = false;
        this.lock?.release().catch(() => undefined);
        this.lock = null;
        this.video?.pause();
        this.method = null;
    }

    destroy() {
        this.disable();
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
        this.video?.remove();
        this.video = null;
    }

    // A wake lock is released, and the video paused, when Obsidian goes into the background
    private onVisibilityChange = () => {
        if (document.visibilityState == "visible" && this.wanted) this.enable();
    };

    private getVideo(): HTMLVideoElement {
        if (this.video) return this.video;
        const video = document.createElement("video");
        video.setAttribute("title", "Keeping the screen on for recipe timers");
        video.setAttribute("playsinline", "");
        video.setAttribute("muted", "");
        video.muted = true;
        video.setAttribute("aria-hidden", "true");
        Object.assign(video.style, {
            position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none",
            bottom: "0", right: "0",
        });
        for (const [type, src] of [["webm", media.webm], ["mp4", media.mp4]]) {
            const source = document.createElement("source");
            source.src = src;
            source.type = `video/${type}`;
            video.appendChild(source);
        }
        // As in NoSleep.js: the short webm loops, the mp4 is kept playing near its start
        video.addEventListener("loadedmetadata", () => {
            if (video.duration <= 1) {
                video.loop = true;
            } else {
                video.addEventListener("timeupdate", () => {
                    if (video.currentTime > 0.5) video.currentTime = Math.random();
                });
            }
        });
        document.body.appendChild(video);
        this.video = video;
        return video;
    }
}

function describe(e: unknown): string {
    if (e instanceof Error) return e.name && e.name != "Error" ? `${e.name}: ${e.message}` : e.message;
    return String(e);
}

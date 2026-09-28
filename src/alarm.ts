// The alarm sound for timers: beeps generated as a WAV file, so there's no sound file to
// ship, played through an <audio> element.
//
// iOS only lets a page start sound in response to a tap, so the first time a timer is added
// or started, the element plays a short silent sound (mixed with other apps' sound), which
// lets it ring later on its own. While ringing it asks to play as media, so the ringer
// switch doesn't mute it.

const SAMPLE_RATE = 22050;
const BEEP = 0.15;
const GAP = 0.1;
const PAUSE = 0.7;
const PITCH = 880;

/** A 16-bit mono PCM WAV file of a number of seconds, each sample in -1 to 1 given by `at` */
function wav(seconds: number, at: (t: number) => number): ArrayBuffer {
    const samples = Math.round(seconds * SAMPLE_RATE);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true); // format chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true); // bytes per second
    view.setUint16(32, 2, true); // bytes per sample
    view.setUint16(34, 16, true); // bits per sample
    text(36, "data");
    view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
        view.setInt16(44 + i * 2, Math.round(at(i / SAMPLE_RATE) * 32767), true);
    }
    return buffer;
}

/** Three short beeps then a pause, to play on a loop */
export function beepWav(): ArrayBuffer {
    const beeps = 3 * BEEP + 2 * GAP;
    return wav(beeps + PAUSE, (t) => {
        const intoBeep = t % (BEEP + GAP);
        if (t >= beeps || intoBeep >= BEEP) return 0;
        // Fade in and out over 10ms so the beeps don't click
        const envelope = Math.min(1, intoBeep / 0.01, (BEEP - intoBeep) / 0.01);
        return Math.sin(2 * Math.PI * PITCH * t) * 0.7 * envelope;
    });
}

/** A moment of silence, played to let the alarm ring later */
export function silenceWav(): ArrayBuffer {
    return wav(0.1, () => 0);
}

type AudioSessionType = "auto" | "playback" | "ambient";

/** Safari 17+: how the page's sound mixes with other apps' and the ringer switch */
function setAudioSession(type: AudioSessionType) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (navigator as any).audioSession;
    if (!session) return;
    try {
        session.type = type;
    } catch {
        // Not supported here
    }
}

export class AlarmSound {
    private audio: HTMLAudioElement | null = null;
    private beepUrl: string | null = null;
    private silenceUrl: string | null = null;
    private ringing = false;
    private unlocked = false;

    private element(): HTMLAudioElement {
        if (!this.audio) {
            this.beepUrl = URL.createObjectURL(new Blob([beepWav()], { type: "audio/wav" }));
            this.silenceUrl = URL.createObjectURL(new Blob([silenceWav()], { type: "audio/wav" }));
            this.audio = new Audio();
            this.audio.preload = "auto";
        }
        return this.audio;
    }

    /**
     * Call when the user taps something, e.g. to start a timer, so the alarm can play later
     * without a tap. Plays a moment of silence to the end, once.
     */
    unlock() {
        if (this.unlocked || this.ringing) return;
        const audio = this.element();
        setAudioSession("ambient");
        audio.loop = false;
        audio.src = this.silenceUrl || "";
        audio.play()
            .then(() => {
                this.unlocked = true;
            })
            .catch(() => {
                // Try again on the next tap
            });
    }

    /** Ring until stopped. Resolves to whether the sound is playing. */
    async start(): Promise<boolean> {
        const audio = this.element();
        this.ringing = true;
        setAudioSession("playback");
        audio.loop = true;
        audio.src = this.beepUrl || "";
        try {
            await audio.play();
            return true;
        } catch {
            return false;
        }
    }

    stop() {
        this.ringing = false;
        this.audio?.pause();
        setAudioSession("auto");
    }

    destroy() {
        this.stop();
        if (this.beepUrl) URL.revokeObjectURL(this.beepUrl);
        if (this.silenceUrl) URL.revokeObjectURL(this.silenceUrl);
        this.audio = null;
        this.beepUrl = null;
        this.silenceUrl = null;
    }
}

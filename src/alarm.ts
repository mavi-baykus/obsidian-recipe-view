// The alarm sound for timers: beeps generated as a WAV file, so there's no sound file to
// ship, played through an <audio> element.
//
// iOS only lets a page start sound in response to a tap, so the element is unlocked when a
// timer is started (by playing its silent part) and can then ring later on its own. While
// ringing it asks to play as media, so the ringer switch doesn't mute it.

const SAMPLE_RATE = 22050;
const BEEP = 0.15;
const GAP = 0.1;
const PAUSE = 0.7;
const PITCH = 880;

/** Where the silence after the beeps starts, in seconds */
const SILENCE_START = 3 * BEEP + 2 * GAP;

/** Three short beeps then a pause, as a 16-bit mono PCM WAV file, to play on a loop */
export function beepWav(): ArrayBuffer {
    const samples = Math.round((SILENCE_START + PAUSE) * SAMPLE_RATE);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
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
        const t = i / SAMPLE_RATE;
        const intoBeep = t % (BEEP + GAP);
        let sample = 0;
        if (t < SILENCE_START && intoBeep < BEEP) {
            // Fade in and out over 10ms so the beeps don't click
            const envelope = Math.min(1, intoBeep / 0.01, (BEEP - intoBeep) / 0.01);
            sample = Math.sin(2 * Math.PI * PITCH * t) * 0.7 * envelope;
        }
        view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    return buffer;
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
    private url: string | null = null;
    private ringing = false;

    private element(): HTMLAudioElement {
        if (!this.audio) {
            this.url = URL.createObjectURL(new Blob([beepWav()], { type: "audio/wav" }));
            this.audio = new Audio(this.url);
            this.audio.loop = true;
            this.audio.preload = "auto";
        }
        return this.audio;
    }

    /**
     * Call when the user taps something, e.g. to start a timer, so the alarm can play later
     * without a tap. Plays only the silent part, mixed with other apps' sound.
     */
    unlock() {
        if (this.ringing) return;
        const audio = this.element();
        setAudioSession("ambient");
        audio.currentTime = SILENCE_START;
        audio.play()
            .then(() => {
                if (!this.ringing) {
                    audio.pause();
                    audio.currentTime = 0;
                    setAudioSession("auto");
                }
            })
            .catch(() => {
                // Nothing more can be done until the alarm rings
            });
    }

    /** Ring until stopped. Resolves to whether the sound is playing. */
    async start(): Promise<boolean> {
        const audio = this.element();
        this.ringing = true;
        setAudioSession("playback");
        audio.currentTime = 0;
        try {
            await audio.play();
            return true;
        } catch {
            return false;
        }
    }

    stop() {
        this.ringing = false;
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        setAudioSession("auto");
    }

    destroy() {
        this.stop();
        if (this.url) URL.revokeObjectURL(this.url);
        this.audio = null;
        this.url = null;
    }
}

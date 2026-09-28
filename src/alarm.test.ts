import { describe, expect, test } from '@jest/globals';
import { beepWav, silenceWav } from './alarm';

describe('the alarm sound', () => {
    const wav = new DataView(beepWav());
    const text = (at: number, length: number) =>
        String.fromCharCode(...Array.from({ length }, (_, i) => wav.getUint8(at + i)));
    const sample = (seconds: number) => wav.getInt16(44 + Math.round(seconds * 22050) * 2, true);

    test('is a valid 16-bit mono WAV file', () => {
        expect(text(0, 4)).toBe("RIFF");
        expect(text(8, 4)).toBe("WAVE");
        expect(wav.getUint16(22, true)).toBe(1);
        expect(wav.getUint32(24, true)).toBe(22050);
        expect(wav.getUint32(40, true)).toBe(wav.byteLength - 44);
    });
    test('beeps, then is silent until it loops', () => {
        const loud = (from: number, to: number) => {
            let peak = 0;
            for (let t = from; t < to; t += 1 / 22050) peak = Math.max(peak, Math.abs(sample(t)));
            return peak;
        };
        expect(loud(0.02, 0.13)).toBeGreaterThan(20000);
        expect(loud(0.16, 0.24)).toBe(0);
        expect(loud(0.66, 1.34)).toBe(0);
    });
    test('the sound that lets it ring later is silent', () => {
        const silence = new DataView(silenceWav());
        expect(silence.getUint32(40, true)).toBe(silence.byteLength - 44);
        for (let i = 44; i < silence.byteLength; i += 2) expect(silence.getInt16(i, true)).toBe(0);
    });
});

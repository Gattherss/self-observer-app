class SoundService {
    private ctx: AudioContext | null = null;

    private getContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.ctx;
    }

    playTone(frequency: number, type: OscillatorType = 'sine', duration = 0.1, volume = 0.1) {
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, ctx.currentTime);

            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.error('Audio playback failed', e);
        }
    }

    playClick() {
        this.playTone(800, 'sine', 0.05, 0.05);
    }

    playSuccess() {
        this.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 100);
    }

    playError() {
        this.playTone(200, 'sawtooth', 0.2, 0.1);
    }
}

export const soundService = new SoundService();

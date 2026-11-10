// The audio rendering clock owns the beat, independent of page timers/visibility.
class SingingBowlProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.params = options.processorOptions?.params;
    this.playing = Boolean(options.processorOptions?.playing);
    this.nextFrame = 0;
    this.voices = [];
    this.port.onmessage = ({ data }) => {
      if (data.params) {
        const previousInterval = this.intervalFrames();
        this.params = data.params;
        // A tempo change starts a fresh interval; tone edits keep the beat.
        if (this.playing && previousInterval !== this.intervalFrames()) {
          this.nextFrame = currentFrame + this.intervalFrames();
        }
      }
      if (data.playing !== undefined) {
        if (data.playing && !this.playing) this.nextFrame = currentFrame;
        this.playing = data.playing;
      }
    };
  }
  intervalFrames() {
    const seconds = Number.isFinite(this.params?.interval) ? Math.min(60, Math.max(1, this.params.interval)) : 10;
    return Math.round(seconds * sampleRate);
  }
  strike(frame) {
    const p = this.params;
    const modal = n => (n * n - 1) / Math.sqrt(1 + 1 / (n * n));
    const weights = Array.from({ length: 6 }, (_, i) => i === 0 ? 1 : Math.exp(-i * (1.7 - p.brightness)) * (.35 + .65 * p.hardness));
    const norm = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 6; i++) {
      const duration = Math.round(p.decay / (1 + i * .19) * sampleRate);
      const attack = Math.round((.004 + (1 - p.hardness) * .018) * sampleRate);
      const peak = .18 * p.strength * weights[i] / norm / Math.sqrt(Math.max(1, p.decay / 3));
      for (let side = 0; side < 2; side++) {
        const angle = 2 * Math.PI * (p.frequency * modal(i + 2) / modal(2) + side * p.beat * (1 + i * .12)) / sampleRate;
        this.voices.push({ age: 0, duration, attack, peak, level: peak, decay: Math.exp(Math.log(.00001 / peak) / (duration - attack)), sin: 0, cos: 1, sinStep: Math.sin(angle), cosStep: Math.cos(angle) });
      }
    }
    this.port.postMessage({ time: frame / sampleRate });
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    for (let j = 0; j < out.length; j++) {
      const frame = currentFrame + j;
      if (this.playing && this.params && frame >= this.nextFrame) {
        this.strike(frame);
        this.nextFrame = frame + this.intervalFrames();
      }
      let value = 0;
      for (const v of this.voices) {
        const envelope = v.age < v.attack ? v.peak * v.age / v.attack : v.age < v.duration ? v.level : .00001 * Math.max(0, 1 - (v.age - v.duration) / (sampleRate * .03));
        value += v.sin * envelope;
        const nextSin = v.sin * v.cosStep + v.cos * v.sinStep;
        v.cos = v.cos * v.cosStep - v.sin * v.sinStep;
        v.sin = nextSin;
        if (v.age >= v.attack) v.level *= v.decay;
        v.age++;
      }
      out[j] = value;
    }
    this.voices = this.voices.filter(v => v.age < v.duration + sampleRate * .03);
    return true;
  }
}
registerProcessor('singing-bowl', SingingBowlProcessor);

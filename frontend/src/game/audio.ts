/**
 * Lightweight procedural audio via Web Audio API.
 * Two sounds: flap/jet-boost and crash/death.
 * Gracefully no-ops if Web Audio is unavailable.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  return ctx;
}

/** Resume audio context on first user gesture (browser autoplay policy). */
export function ensureAudioResumed(): void {
  const ac = getContext();
  if (ac && ac.state === 'suspended') {
    ac.resume().catch(() => {});
  }
}

/**
 * Short jet-boost / flap sound.
 * Quick rising tone with white-noise tail.
 */
export function playFlap(): void {
  const ac = getContext();
  if (!ac) return;

  const now = ac.currentTime;

  // Oscillator — quick rising tone
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.12, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  // Noise burst — jet whoosh
  const bufferSize = Math.floor(ac.sampleRate * 0.06);
  const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.08, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.06);
}

/**
 * Crash / death sound.
 * Low thud with distorted noise.
 */
export function playCrash(): void {
  const ac = getContext();
  if (!ac) return;

  const now = ac.currentTime;

  // Low thud oscillator
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);

  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.2, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.3);

  // Noise crunch
  const bufferSize = Math.floor(ac.sampleRate * 0.15);
  const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.12, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 800;

  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

// Sound, synthesized with WebAudio — no audio files, nothing to download.
// Every effect is a short oscillator or noise burst; the engine hum is a sawtooth
// whose pitch follows the car's speed. Audio starts only after the first user
// gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter).connect(gain).connect(ctx.destination);
    } else {
      src.connect(gain).connect(ctx.destination);
    }
    src.start(t);
  }

  return {
    /** Call on the first gesture so later sounds are allowed. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    click() { tone(660, 0.06, 'square', 0.06); },
    pickup() { tone(520, 0.08, 'sine', 0.12); tone(780, 0.12, 'sine', 0.12); },
    cash() { tone(880, 0.07, 'triangle', 0.12); setTimeout(() => tone(1174, 0.1, 'triangle', 0.12), 70); },
    punch() { noise(0.09, 0.18, 900); },
    gunshot() { noise(0.14, 0.3, 2400); tone(160, 0.1, 'square', 0.1, 60); },
    crash() { noise(0.25, 0.3, 700); },
    wanted() { tone(440, 0.18, 'sawtooth', 0.1, 660); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.12), i * 90)); },
    busted() { tone(330, 0.4, 'sawtooth', 0.12, 165); },
    /** A looping engine hum whose pitch follows speed 0..1. */
    engine(speed01) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain).connect(ctx.destination);
        engineOsc.start();
      }
      const target = speed01 > 0.02 ? 0.035 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },
    /** A looping two-tone siren while police are chasing. */
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.03;
        sirenOsc.connect(sirenGain).connect(ctx.destination);
        sirenOsc.start();
        let high = true;
        sirenTimer = setInterval(() => {
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, ctx.currentTime, 0.05);
        }, 380);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        const osc = sirenOsc;
        setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 200);
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}

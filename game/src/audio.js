// Sound, synthesised with WebAudio — no files, no network. Footsteps that tell you
// where a guard is, a coin's clink, a rising sting when the alarm goes up, and a low
// night drone that tightens as the house wakes. Everything is behind a mute toggle.
export function createAudio() {
  let context = null;
  let muted = false;
  let drone = null;
  let droneGain = null;
  let stepTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      // The night drone: two detuned sines, barely there until the alarm rises.
      droneGain = context.createGain();
      droneGain.gain.value = 0.0;
      droneGain.connect(context.destination);
      drone = [];
      for (const freq of [55, 55.7, 110.3]) {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = context.createGain();
        gain.gain.value = 0.33;
        osc.connect(gain);
        gain.connect(droneGain);
        osc.start();
        drone.push(osc);
      }
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, volume, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noiseBurst(seconds, volume, filterFreq) {
    if (!context || muted) return;
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (droneGain) droneGain.gain.value = muted ? 0 : 0.05;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** A soft step: quiet when sneaking, a tap when walking, a thud when sprinting. */
    footstep(gait) {
      if (!context || muted) return;
      stepTimer -= 1;
      if (stepTimer > 0) return;
      stepTimer = gait === 'sprint' ? 14 : gait === 'walk' ? 22 : 30;
      if (gait === 'sneak') noiseBurst(0.05, 0.03, 500);
      else if (gait === 'walk') noiseBurst(0.07, 0.06, 800);
      else noiseBurst(0.09, 0.12, 1200);
    },
    guardStep() {
      if (!context || muted) return;
      noiseBurst(0.06, 0.05, 600);
    },
    coin() {
      tone(2093, 0.12, 'sine', 0.12);
      tone(2637, 0.2, 'sine', 0.1, 0.05);
    },
    clink() {
      tone(1568, 0.08, 'triangle', 0.14);
      noiseBurst(0.05, 0.08, 4000);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.1);
      tone(1318, 0.16, 'sine', 0.1, 0.07);
    },
    prize() {
      tone(523, 0.16, 'sine', 0.12);
      tone(659, 0.16, 'sine', 0.12, 0.1);
      tone(784, 0.3, 'sine', 0.14, 0.2);
    },
    smoke() {
      noiseBurst(0.4, 0.12, 900);
    },
    douse() {
      tone(320, 0.25, 'sine', 0.1);
      tone(180, 0.4, 'sine', 0.08, 0.12);
    },
    chirp() {
      tone(2400, 0.06, 'square', 0.04);
      tone(2900, 0.06, 'square', 0.04, 0.09);
    },
    /** The sting when a guard goes alert: two rising notes and a low hit. */
    spotted() {
      tone(220, 0.35, 'sawtooth', 0.1);
      tone(311, 0.35, 'sawtooth', 0.1, 0.12);
      tone(110, 0.5, 'sine', 0.16, 0.05);
    },
    caught() {
      tone(196, 0.3, 'sawtooth', 0.14);
      tone(147, 0.5, 'sawtooth', 0.14, 0.18);
    },
    complete() {
      tone(523, 0.2, 'sine', 0.12);
      tone(659, 0.2, 'sine', 0.12, 0.14);
      tone(784, 0.2, 'sine', 0.12, 0.28);
      tone(1047, 0.5, 'sine', 0.14, 0.42);
    },
    failed() {
      tone(330, 0.3, 'sine', 0.1);
      tone(262, 0.5, 'sine', 0.1, 0.2);
    },
    /** The drone tightens as the alarm level rises (0..3). */
    setAlarm(level) {
      if (!context || !droneGain) return;
      droneGain.gain.setTargetAtTime(muted ? 0 : 0.03 + level * 0.035, context.currentTime, 0.4);
    },
  };
}

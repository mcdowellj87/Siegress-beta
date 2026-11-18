// One non-spatial music cue; proximity controls its mix level, not its pitch.
export function monsterMusicGain(distance, near = 5, far = 32, volume = 0.65) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  const x = Math.max(0, Math.min(1, (far - d) / (far - near)));
  return x * x * (3 - 2 * x) * volume;
}

export function createMonsterProximityMusic({
  url = './audio/monster-nearby.ogg', nearDistance = 5, farDistance = 32,
  volume = 0.65, fadeInSeconds = 1.5, fadeOutSeconds = 3,
  createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
  fetchAudio = (...args) => fetch(...args),
} = {}) {
  if (!(farDistance > nearDistance && nearDistance >= 0)) throw new Error('Invalid monster-music distances.');
  let context, gain, buffer, source, loading, stopTimer, disposed = false;
  let unlocked = false, target = 0, distance = Infinity, retryAfter = 0;
  function cancelStop() { if (stopTimer !== undefined) clearTimeout(stopTimer); stopTimer = undefined; }
  function ramp() {
    if (!gain) return;
    const param = gain.gain, now = context.currentTime;
    const seconds = target > param.value ? fadeInSeconds : fadeOutSeconds;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.setTargetAtTime(target, now, Math.max(0.01, seconds / 3));
    cancelStop();
    if (target === 0 && source) {
      stopTimer = setTimeout(() => {
        stopTimer = undefined;
        if (target !== 0 || !source) return;
        source.stop(); source.disconnect(); source = undefined;
        param.cancelScheduledValues(context.currentTime); param.setValueAtTime(0, context.currentTime);
      }, (fadeOutSeconds + 1) * 1000);
    }
  }
  async function ensurePlaying() {
    if (disposed || !unlocked || target === 0 || source || context?.state !== 'running') return;
    if (loading) return loading;
    if (Date.now() < retryAfter) return;
    loading = (async () => {
      await Promise.resolve(); // Also defer cached-buffer starts until loading is assigned.
      try {
        if (!buffer) {
          const response = await fetchAudio(url);
          if (!response.ok) throw new Error(`Monster music HTTP ${response.status}`);
          buffer = await context.decodeAudioData(await response.arrayBuffer());
        }
        // The monster may have moved away, died, or gameplay may have paused during loading.
        if (disposed || target === 0 || source || context.state !== 'running') return;
        gain.gain.cancelScheduledValues(context.currentTime); gain.gain.setValueAtTime(0, context.currentTime);
        source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        source.connect(gain); source.start(); ramp();
      } catch (error) {
        retryAfter = Date.now() + 10000;
        console.warn('[audio] Monster proximity music unavailable:', error);
      } finally { loading = undefined; }
    })();
    return loading;
  }
  return {
    // Unlock the audio context in a user gesture, but never start the track while distant.
    unlock() {
      if (disposed) return Promise.resolve();
      try {
        if (!context) { context = createContext(); gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination); }
        unlocked = true;
        const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
        return resumed.then(ensurePlaying).catch(error => console.warn('[audio] Music unlock:', error));
      } catch (error) { console.warn('[audio] Music context unavailable:', error); return Promise.resolve(); }
    },
    update(nextDistance, active = true) {
      if (disposed) return;
      distance = active ? nextDistance : Infinity;
      const next = monsterMusicGain(distance, nearDistance, farDistance, volume);
      if (Math.abs(next - target) > 0.0001) { target = next; ramp(); }
      if (target > 0) { cancelStop(); void ensurePlaying(); }
    },
    silence() { this.update(Infinity, false); },
    dispose() {
      disposed = true; cancelStop(); source?.stop(); source?.disconnect(); source = undefined;
      gain?.disconnect(); void context?.close();
    },
    get state() { return { distance, targetGain: target, playing: !!source, loading: !!loading, ready: !!buffer, audioState: context?.state || 'locked' }; },
  };
}

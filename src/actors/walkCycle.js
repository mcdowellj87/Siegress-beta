const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// One cycle contains two steps; releasing movement immediately returns to idle.
export function createWalkCycle() {
  let active = false, progress = 0, pending = 0, cycles = 0;
  let first = true, held = false, running = false, enabled = true;
  return {
    request() { pending++; },
    setMode(run, moving, grounded) { running = run; held = moving; enabled = grounded; },
    update(dt) {
      if (!enabled || !held) { active = false; progress = 0; pending = 0; first = true; }
      else {
        if (!active && (held || pending)) {
          active = true; progress = 0; first = true;
          if (pending) pending--;
        }
        if (active) {
          progress += Math.max(0, dt) / (running ? 0.62 : 0.96);
          while (progress >= 1 && active) {
            progress -= 1; cycles++; first = false;
            if (pending) pending--;
            else if (!held) { active = false; progress = 0; }
          }
        }
      }
      const blend = active ? (first ? smooth(progress / 0.12) : 1)
        * ((!held && !pending) ? smooth((1 - progress) / 0.12) : 1) : 0;
      return { active, progress, blend, cycles, pending };
    }
  };
}

// Stance: the planted boot travels back relative to the moving body.
// Swing: the boot lifts, passes the support leg, and reaches forward again.
export function sampleLeg(progress) {
  const t = ((progress % 1) + 1) % 1;
  const swing = t >= 0.5;
  const s = (t - 0.5) * 2;
  const lift = swing ? Math.sin(Math.PI * s) : 0;
  const forward = swing ? -1 + 2 * smooth(s) : 1 - 4 * t;
  return { forward, lift, kneeForward: forward * 0.46 + lift * 0.5,
    kneeLift: lift * 0.48, pitch: swing ? Math.sin(TAU * s) * 0.15 : 0 };
}


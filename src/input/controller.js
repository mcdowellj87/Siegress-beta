// Standard Xbox/Gamepad mapping shared by browser and Electron renderers.
export function deadZone(x, y, threshold = .18) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= threshold) return { x: 0, y: 0 };
  const amount = Math.min(1, (magnitude - threshold) / (1 - threshold));
  return { x: x / magnitude * amount, y: y / magnitude * amount };
}
export function createControllerInput({ getGamepads = () => navigator.getGamepads?.() || [], onAction = () => {} } = {}) {
  let previous = [], index = null, running = false;
  const state = { connected: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0, running: false };
  return {
    state,
    poll(focused = true) {
      let pads;
      try { pads = Array.from(getGamepads()); } catch { pads = []; }
      const pad = pads.find(p => p?.connected && p.index === index) || pads.find(p => p?.connected);
      if (!pad || !focused) {
        Object.assign(state, { connected: !!pad, moveX: 0, moveY: 0, lookX: 0, lookY: 0, running: false });
        previous = pad ? pad.buttons.map(b => b.pressed) : []; running = false;
        if (!pad) index = null;
        return state;
      }
      if (index !== pad.index) { previous = []; running = false; index = pad.index; }
      const move = deadZone(pad.axes[0] || 0, pad.axes[1] || 0);
      const look = deadZone(pad.axes[2] || 0, pad.axes[3] || 0);
      const buttons = pad.buttons.map(b => b.pressed);
      const pressed = i => buttons[i] && !previous[i];
      if (pressed(10)) running = !running;
      if (!move.x && !move.y) running = false;
      Object.assign(state, { connected: true, moveX: move.x, moveY: -move.y, lookX: look.x, lookY: look.y, running });
      // A cast, X casting toggle, Y regulation, B exit mode, Start start/restart.
      for (const [button, action] of [[0,'cast'],[2,'casting'],[3,'regulate'],[1,'exit'],[9,'start']]) if (pressed(button)) onAction(action);
      previous = buttons;
      return state;
    }
  };
}

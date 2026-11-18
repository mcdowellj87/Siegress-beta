const DEFAULT_THRESHOLD = 0.60;
const DEFAULT_FILL_SECONDS = 90;
const DEFAULT_REGULATION_SECONDS = 3.4;

export function createPsionicSystem({
  rootEl,
  fillEl,
  valueEl,
  cameraSystem,
  monsterSystem,
  threshold = DEFAULT_THRESHOLD,
  fillSeconds = DEFAULT_FILL_SECONDS,
  regulationSeconds = DEFAULT_REGULATION_SECONDS
}) {
  let godMode = false;
  let followUpStrike = false;
  let criticality = 0;
  let regulating = false;
  let regulationTimer = 0;
  let regulationStartCriticality = 0;

  function render() {
    const percent = Math.round(criticality * 100);
    rootEl.style.setProperty('--psionic-level', `${percent}%`);
    rootEl.style.setProperty('--psionic-threshold', `${threshold * 100}%`);
    rootEl.classList.toggle('is-critical', criticality >= threshold);
    rootEl.classList.toggle('is-overloading', criticality >= 0.90);
    rootEl.classList.toggle('is-regulating', regulating);
    fillEl.style.width = `${percent}%`;
    valueEl.textContent = `${percent}`;
    rootEl.setAttribute('aria-valuenow', String(percent));
  }

  function setCriticality(value) {
    followUpStrike = false;
    if (godMode) { criticality = threshold; render(); return; }
    criticality = Math.max(0, Math.min(1, Number(value) || 0));
    render();
  }

  function startRegulation() {
    if (godMode || regulating || criticality <= 0.005) return false;
    followUpStrike = false;
    regulating = true;
    regulationTimer = regulationSeconds;
    regulationStartCriticality = criticality;
    monsterSystem.beginMushroomAmbush();
    cameraSystem.setViewMode('first');
    render();
    return true;
  }

  function toggleRegulation() {
    if (regulating) {
      cancelRegulation();
      return false;
    }
    return startRegulation();
  }

  function finishRegulation({ restoreView = true } = {}) {
    if (!regulating) return;
    regulating = false;
    regulationTimer = 0;
    criticality = 0;
    if (restoreView) cameraSystem.setViewMode('third');
    render();
  }

  function cancelRegulation() {
    if (!regulating) return;
    regulating = false;
    regulationTimer = 0;
    monsterSystem.setMushroomLureActive(false);
    cameraSystem.setViewMode('third');
    render();
  }

  function reset() {
    followUpStrike = false;
    cancelRegulation();
    monsterSystem.setMushroomLureActive(false);
    criticality = godMode ? threshold : 0;
    render();
  }

  function update(dt, active) {
    if (godMode) { criticality = threshold; render(); return; }
    if (regulating) {
      cameraSystem.setViewMode('first');
      regulationTimer -= dt;
      const remaining = Math.max(0, regulationTimer / regulationSeconds);
      criticality = regulationStartCriticality * remaining;
      if (regulationTimer <= 0) finishRegulation();
      else render();
    } else if (active) {
      criticality = Math.min(1, criticality + dt / fillSeconds);
      render();
    }
  }

  function getSpeedMultiplier() {
    return 1;
  }

  render();

  return {
    update,
    toggleGodMode() {
      cancelRegulation();
      godMode = !godMode;
      followUpStrike = false;
      if (godMode) criticality = threshold;
      render();
      return godMode;
    },
    get isGodMode() { return godMode; },
    reset,
    cancelRegulation,
    startRegulation,
    toggleRegulation,
    setCriticality,
    dischargeStrike() {
      // A critical charge permits a follow-up after the first hit spends psi.
      // Consuming that follow-up ends the pair; passive refill cannot grant extras.
      const grantFollowUp = !followUpStrike && criticality >= threshold;
      setCriticality(criticality - 0.40);
      followUpStrike = !godMode && grantFollowUp && criticality > 0;
    },
    get canCastStrike() { return godMode || criticality >= threshold || followUpStrike; },
    get criticality() {
      return criticality;
    },
    get isCritical() {
      return criticality >= threshold;
    },
    get isRegulating() {
      return regulating;
    },
    get speedMultiplier() {
      return getSpeedMultiplier();
    }
  };
}

export function createPlayerPersistence({ playerStore, logger, delayMs = 500 }) {
  const playerSaveTimers = new Map();
  const pendingPlayerSaves = new Map();
  const retryAttempts = new Map();
  const inFlightSaves = new Map();

  function snapshot(player) {
    return player.toPersistence();
  }

  function schedule(playerId, waitMs = delayMs) {
    if (playerSaveTimers.has(playerId)) return;
    const timer = setTimeout(() => {
      playerSaveTimers.delete(playerId);
      persistLatest(playerId).catch((error) => logger.error('Falha ao salvar jogador', { playerId, error: error.message }));
    }, waitMs);
    playerSaveTimers.set(playerId, timer);
  }

  async function persistLatest(playerId) {
    const inFlight = inFlightSaves.get(playerId);
    if (inFlight) {
      await inFlight;
      return persistLatest(playerId);
    }
    const state = pendingPlayerSaves.get(playerId);
    if (!state) return;
    pendingPlayerSaves.delete(playerId);
    const savePromise = playerStore.saveState(playerId, state);
    inFlightSaves.set(playerId, savePromise);
    try {
      await savePromise;
      retryAttempts.delete(playerId);
    } catch (error) {
      pendingPlayerSaves.set(playerId, state);
      const retryAttempt = (retryAttempts.get(playerId) ?? 0) + 1;
      retryAttempts.set(playerId, retryAttempt);
      logger.error('Falha ao salvar jogador', { playerId, error: error.message });
      schedule(playerId, Math.min(delayMs * (2 ** retryAttempt), 30_000));
      throw error;
    } finally {
      inFlightSaves.delete(playerId);
    }
    if (pendingPlayerSaves.has(playerId)) schedule(playerId);
  }

  function queuePlayerSave(playerId, player) {
    pendingPlayerSaves.set(playerId, snapshot(player));
    schedule(playerId);
  }

  async function savePlayer(playerId, player) {
    const timer = playerSaveTimers.get(playerId);
    if (timer) clearTimeout(timer);
    playerSaveTimers.delete(playerId);
    pendingPlayerSaves.set(playerId, snapshot(player));
    await persistLatest(playerId);
  }

  return { queuePlayerSave, savePlayer };
}

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

import { ServerLogger } from '../logger.js';
import { PlayerStore } from '../player-store.js';
import {
  allowedOrigins,
  host,
  httpRateWindowMs,
  httpRequestsPerWindow,
  port,
  webSocketMaxPayload,
} from './config.js';
import { createRateLimiter } from '../rate-limit.js';
import { GameState } from './game-state.js';
import { createRequestHandler } from './routes.js';
import { createBroadcaster } from './broadcast.js';
import { createCommandManager } from './commands.js';
import { registerConnectionHandler } from './connection.js';
import { createPlayerPersistence } from './persistence.js';
import { isValidMapConfig } from '../world/enemy-areas.js';
import { FixedTickLoop } from './fixed-tick-loop.js';

export function startMultiplayerServer() {
  const state = new GameState();
  const logger = new ServerLogger();
  const playerStore = new PlayerStore();
  const allowHttpRequest = createRateLimiter({
    limit: httpRequestsPerWindow,
    windowMs: httpRateWindowMs,
  });

  const requestHandler = createRequestHandler({
    state,
    playerStore,
    logger,
    allowedOrigins,
    allowRequest: (request) => allowHttpRequest(
      request.socket.remoteAddress ?? 'unknown',
    ),
    onMapConfigChanged: (mapConfig) => state.setMapConfig(mapConfig),
  });

  const server = createServer(requestHandler);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;

  const socketServer = new WebSocketServer({
    server,
    maxPayload: webSocketMaxPayload,
  });
  const { broadcastSnapshot, broadcast } = createBroadcaster(socketServer, state);
  const commandManager = createCommandManager({
    state,
    playerStore,
    broadcastSnapshot,
  });
  const { queuePlayerSave, savePlayer } = createPlayerPersistence({
    playerStore,
    logger,
  });

  registerConnectionHandler({
    socketServer,
    state,
    playerStore,
    logger,
    commandManager,
    broadcastSnapshot,
    broadcast,
    queuePlayerSave,
    savePlayer,
  });

  server.listen(port, host, () => {
    logger.info(`Multiplayer relay ouvindo em ws://${host}:${port}`);
  });

  playerStore.ready
    .then(async () => {
      state.databaseReady = true;
      const savedMapConfig = await playerStore.getMapConfig();

      if (savedMapConfig && isValidMapConfig(savedMapConfig)) {
        state.setMapConfig(savedMapConfig);
      }

      const initialSpawnAt = Date.now();
      for (const area of state.enemyAreas) {
        area.update(initialSpawnAt, [], 0);
      }

      let previousUpdateAt = initialSpawnAt;
      const fixedTickLoop = new FixedTickLoop({
        onTick: () => state.physicsAuthority.tick(),
      });
      setInterval(async () => {
        const now = Date.now();
        const deltaSeconds = Math.min((now - previousUpdateAt) / 1000, 0.25);
        previousUpdateAt = now;
        let changed = false;

        fixedTickLoop.advance(now);
        changed = true;

        for (const area of state.enemyAreas) {
          const result = area.update(
            now,
            state.players.values(),
            deltaSeconds,
          );
          changed = result.changed || changed;

          for (const missedPlayer of result.missedPlayers ?? []) {
            const playerId = state.getPlayerIdByPeerId(missedPlayer.player.peerId);
            const session = state.activeGuestSessions.get(playerId);

            if (session?.socket?.readyState === 1) {
              session.socket.send(JSON.stringify({
                type: 'attack-miss',
                enemyId: missedPlayer.enemyId ?? null,
                position: [...missedPlayer.player.position],
                sentAt: Date.now(),
              }));
            }
          }

          for (const deadPlayer of result.deadPlayers) {
            const deadPlayerId = state.getPlayerIdByPeerId(deadPlayer.peerId);
            const session = state.activeGuestSessions.get(deadPlayerId);

            if (deadPlayerId) {
              await savePlayer(deadPlayerId, deadPlayer);
            }

            if (session?.socket?.readyState === 1) {
              session.socket.send(JSON.stringify({
                type: 'death',
                sentAt: Date.now(),
              }));
            }
          }
        }

        if (changed) broadcastSnapshot();
      }, 50);
    })
    .catch((error) => {
      logger.error('Nao foi possivel inicializar o PostgreSQL', {
        error: error.message,
      });
      process.exitCode = 1;
    });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Encerrando relay por ${signal}; salvando jogadores ativos`);
    await Promise.all([...state.activeGuestSessions].map(async ([playerId, session]) => {
      const player = state.players.get(session.peerId);
      if (!player) return;
      await savePlayer(playerId, player).catch((error) => {
        logger.error('Falha ao salvar jogador no encerramento', { playerId, error: error.message });
      });
    }));
    for (const client of socketServer.clients) client.close(1001, 'Server shutting down');
    socketServer.close();
    await new Promise((resolve) => server.close(resolve));
    await playerStore.pool.end().catch(() => {});
  };
  process.once('SIGTERM', () => { shutdown('SIGTERM').catch((error) => logger.error('Falha no encerramento', { error: error.message })); });
  process.once('SIGINT', () => { shutdown('SIGINT').catch((error) => logger.error('Falha no encerramento', { error: error.message })); });

  return { server, socketServer, state };
}

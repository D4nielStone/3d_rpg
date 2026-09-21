import { randomUUID } from 'node:crypto';
import {
  getConnectionIdentity,
  isChatMessage,
  getUserLabel,
  sendSystemMessage,
} from './utils.js';
import { isValidMapConfig } from '../world/enemy-areas.js';
import { maxWebSocketConnections } from './config.js';

export function registerConnectionHandler({
  socketServer,
  state,
  playerStore,
  logger,
  commandManager,
  broadcastSnapshot,
  broadcast,
  queuePlayerSave,
  savePlayer,
}) {
  socketServer.on('connection', async (socket, request) => {
    const peerId = randomUUID();
    const identity = getConnectionIdentity(request.url, request.headers, state.sessions);
    if (!identity) {
      socket.close(4001, 'Authentication required');
      return;
    }
    if (state.activeGuestSessions.size >= maxWebSocketConnections) {
      socket.close(1013, 'Server busy');
      return;
    }
    const playerId = identity.id;
    const userLabel = getUserLabel(peerId, identity.nickname);

    await playerStore.ready;
    if (!state.publishedMapConfig) {
      const savedMapConfig = await playerStore.getMapConfig();
      if (savedMapConfig && isValidMapConfig(savedMapConfig)) {
        state.setMapConfig(savedMapConfig);
      }
    }

    if (identity.isAdmin !== undefined) {
      try {
        const account = await playerStore.findUser(identity.nickname);
        identity.isAdmin = account?.id === playerId && account.is_admin === true;
      } catch (error) {
        logger.warn('Nao foi possivel atualizar permissao administrativa', {
          peerId,
          error: error.message,
        });
      }
    }

    if (state.activeGuestSessions.has(playerId)) {
      logger.warn('Conexao duplicada recusada', { peerId, playerId });
      socket.close(4008, 'Guest already connected');
      return;
    }
    state.activeGuestSessions.set(playerId, {
      peerId,
      socket,
      isAdmin: identity.isAdmin === true,
    });

    let player;
    let announced = false;
    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      const activeSession = state.activeGuestSessions.get(playerId);
      if (activeSession?.peerId === peerId) state.activeGuestSessions.delete(playerId);
      if (player) {
        state.players.delete(peerId);
        state.physicsAuthority.removePlayer(peerId);
      }
      if (!announced) return;
      if (player) await savePlayer(playerId, player).catch((error) => {
        logger.error('Falha ao salvar jogador na desconexão', { peerId, error: error.message });
      });
      logger.info(`${userLabel} saiu do servidor`, { peerId });
      broadcast({
        type: 'system',
        text: `${userLabel} saiu do servidor.`,
        sentAt: Date.now(),
      });
      broadcastSnapshot();
    };
    socket.on('close', () => { cleanup().catch((error) => logger.error('Falha no encerramento da sessão', { peerId, error: error.message })); });
    try {
      player = await playerStore.get(
        playerId,
        peerId,
        identity.nickname,
        state.publishedMapConfig?.player ?? {},
      );
      if (cleanedUp || socket.readyState !== 1) {
        cleanup();
        return;
      }
    } catch (error) {
      logger.error('Falha ao carregar jogador', { peerId, error: error.message });
      cleanup();
      socket.close(1011, 'Database unavailable');
      return;
    }
    state.players.set(peerId, player);
    state.physicsAuthority.addPlayer(player);
    announced = true;
    // Identidade curta aparece no chat; o UUID completo fica apenas nos logs.
    logger.info(`${userLabel} entrou no servidor`, { peerId });
    socket.send(JSON.stringify({
      type: 'welcome',
      peerId,
      player: player.toSnapshot(),
    }));
    broadcast({
      type: 'system',
      text: `${userLabel} entrou no servidor.`,
      sentAt: Date.now(),
    });
    broadcastSnapshot();
    if (player.dead) socket.send(JSON.stringify({ type: 'death' }));

    socket.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const player = state.players.get(peerId);
        if (!player) return;

        if (message.type === 'ranking-request') {
          const ranking = await playerStore.getRanking();
          socket.send(JSON.stringify({ type: 'ranking', players: ranking }));
          return;
        }

        if (message.type === 'chat' && isChatMessage(message.text)) {
          const text = message.text.trim();
          let isAdmin = identity.isAdmin === true;
          if (identity.isAdmin !== undefined) {
            const account = await playerStore.findUser(identity.nickname);
            isAdmin = account?.id === playerId && account.is_admin === true;
            identity.isAdmin = isAdmin;
            const activeSession = state.activeGuestSessions.get(playerId);
            if (activeSession) activeSession.isAdmin = isAdmin;
          }
          if (await commandManager.execute(text, {
            socket,
            peerId,
            playerId,
            isAdmin,
            sendSystem: (messageText) => sendSystemMessage(socket, messageText),
          })) return;
          logger.info('Mensagem de chat recebida', {
            peerId,
            length: text.length,
          });
          broadcast({
            type: 'chat',
            peerId,
            nickname: player.nickname,
            text,
            isAdmin,
            sentAt: Date.now(),
          });
          return;
        }

        if (message.type === 'attack') {
          if (player.dead) return;
          const attackAt = Date.now();
          let attackResult = { hit: false };
          for (const area of state.enemyAreas) {
            attackResult = area.attack(player, attackAt);
            if (attackResult.hit) break;
          }
          if (attackResult.hit) {
            if (attackResult.enemyId) {
              broadcast({
                type: 'enemy-defeated',
                enemyId: attackResult.enemyId,
                sentAt: Date.now(),
              });
              broadcastSnapshot();
            }
            const strengthLeveledUp = player.combatMode === 'melee'
              ? player.registerMeleeAttack(attackResult.damage, attackAt)
              : false;
            player.registerCombatProgress(attackResult.damage, player.combatMode);
            if (attackResult.rewards) {
              player.money += attackResult.rewards.gold;
              const experience = attackResult.rewards.experience;
              const leveledUp = player.addExperience(experience);
              const promoted = false;
              await playerStore.save(playerId, player);
              sendSystemMessage(
                socket,
                `Rato derrotado: +${attackResult.rewards.gold} ouro e +${attackResult.rewards.experience} XP${leveledUp ? '.' : '.'}`,
              );
              if (leveledUp) {
                socket.send(JSON.stringify({
                  type: 'level-up',
                  level: player.level,
                  sentAt: Date.now(),
                }));
                sendSystemMessage(
                  socket,
                  `Você subiu para o level ${player.level}! Vida e mana restauradas para 100%.`,
                );
              }
              if (promoted) {
                sendSystemMessage(socket, 'Você alcançou o nível 3 e foi teletransportado para a Área dos Ratos 2.');
              }
            } else {
              await playerStore.save(playerId, player);
            }
            if (strengthLeveledUp) {
              sendSystemMessage(
                socket,
                `Sua força subiu para ${player.strength}! Progresso corpo-a-corpo reiniciado.`,
              );
            }
            socket.send(JSON.stringify({
              type: 'attack-hit',
              damage: attackResult.damage,
              enemyId: attackResult.enemyId ?? null,
              projectile: attackResult.projectile ?? null,
              manaCost: attackResult.manaCost ?? 0,
              sentAt: Date.now(),
            }));
            broadcastSnapshot();
          } else if (attackResult.enemyId) {
            socket.send(JSON.stringify({
              type: 'attack-miss',
              enemyId: attackResult.enemyId,
              position: attackResult.position ?? null,
              sentAt: Date.now(),
            }));
          }
          return;
        }

        if (message.type === 'combat-mode') {
          if (player.setCombatMode(message.mode)) {
            await playerStore.save(playerId, player);
            broadcastSnapshot();
          }
          return;
        }

        if (message.type === 'respawn') {
          if (!player.dead) return;
          player.respawn();
          await playerStore.save(playerId, player);
          socket.send(JSON.stringify({
            type: 'respawned',
            position: [...player.position],
            rotation: [...player.rotation],
          }));
          broadcastSnapshot();
          return;
        }

        if (player.dead) return;
        if (message.type === 'player_state') {
          state.physicsAuthority.receiveState(player, message.state ?? message);
          return;
        }
        if (message.type === 'player_input') {
          state.physicsAuthority.receiveInput(player, message.input ?? message);
          return;
        }
        if (!isMovementCommand(message)) {
          logger.warn('Mensagem inválida ignorada', { peerId, type: message.type });
          return;
        }
        logger.warn('Comando de movimento legado rejeitado; use player_input', { peerId });
      } catch (error) {
        logger.warn('Falha ao processar mensagem do jogador', { peerId, error: error.message });
      }
    });

  });
}

function isMovementCommand(message) {
  return message?.type === 'movement'
    && Number.isFinite(message.angle)
    && Number.isFinite(message.magnitude)
    && Math.abs(message.angle) <= Math.PI * 4
    && message.magnitude >= 0
    && message.magnitude <= 1;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function getMovementRotation(currentRotation, angle, magnitude) {
  return magnitude > 0 ? [0, angle, 0] : [...currentRotation];
}

export function getPlayerSpeed(mapConfig) {
  const configuredSpeed = Number(mapConfig?.player?.speed);
  if (!Number.isFinite(configuredSpeed)) return 3;
  return Math.max(0, Math.min(20, configuredSpeed));
}
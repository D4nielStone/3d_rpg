import {
  EnemyHealthBar,
  EnemyIdentity,
  NameTag,
  NetworkIdentity,
  NetworkTransform,
  OutlineRenderer,
  Rigidbody,
  Transform,
} from './components.js';
import { ClientPrediction } from './network/client-prediction.js';
import { RemotePlayerInterpolation } from './network/remote-player-interpolation.js';

const MESSAGE_LIMIT = 32;
const COMBAT_DISTANCE = 1;
const RANGED_ATTACK_DISTANCE = 5;

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function applyLocalTransformOverride(transform, networkTransform, position, rotation) {
  if (!transform) return;
  if (Array.isArray(position)) transform.position = [...position];
  if (Array.isArray(rotation)) transform.rotation = [...rotation];
  if (networkTransform) {
    networkTransform.targetPosition = null;
    networkTransform.targetRotation = null;
  }
}

export class MultiplayerSystem {
  constructor({
    url,
    world,
    input = null,
    physicsSystem = null,
    camera = null,
    canvas = null,
    createRemoteEntity,
    createEnemyEntity = () => null,
    onStatus = () => {},
    onChat = () => {},
    onPlayerState = () => {},
    onDeath = () => {},
    onRespawn = () => {},
    onRanking = () => {},
    onOnlinePlayers = () => {},
    onMapAccess = () => {},
    onAttackTargetChanged = () => {},
    onAttack = () => {},
    onAttackHit = () => {},
    onAttackMiss = () => {},
    onLevelUp = () => {},
  }) {
    this.url = url;
    this.world = world;
    this.input = input;
    this.physicsSystem = physicsSystem;
    this.camera = camera;
    this.canvas = canvas;
    this.createRemoteEntity = createRemoteEntity;
    this.createEnemyEntity = createEnemyEntity;
    this.onStatus = onStatus;
    this.onChat = onChat;
    this.onPlayerState = onPlayerState;
    this.onDeath = onDeath;
    this.onRespawn = onRespawn;
    this.onRanking = onRanking;
    this.onOnlinePlayers = onOnlinePlayers;
    this.onMapAccess = onMapAccess;
    this.onAttackTargetChanged = onAttackTargetChanged;
    this.onAttack = onAttack;
    this.onAttackHit = onAttackHit;
    this.onAttackMiss = onAttackMiss;
    this.onLevelUp = onLevelUp;
    this.socket = null;
    this.localEntity = null;
    this.localPeerId = null;
    this.remoteEntities = new Map();
    this.enemyEntities = new Map();
    this.defeatedEnemyIds = new Set();
    this.lastSentAt = 0;
    this.lastMovementCommand = null;
    this.pendingState = null;
    this.welcomeReceived = false;
    this.localStateRestored = false;
    this.localPlayerDead = false;
    this.deathScreenShown = false;
    this.respawnPending = false;
    this.attackTargetEntity = null;
    this.onAttackTargetChanged(null);
    this.lastAttackRequestAt = 0;
    this.lastFrameTime = null;
    this.localVerticalVelocity = 0;
    this.clickDestination = null;
    this.prediction = new ClientPrediction({
      simulate: (input) => {
        const angle = Math.atan2(input.moveX, input.moveZ);
        const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
        this.physicsSystem?.setMovement(this.localEntity, angle, magnitude);
      },
      getState: () => this.getLocalPhysicsState(),
      setState: (snapshot) => this.setLocalPhysicsState(snapshot),
      send: (input) => this.socket?.send(JSON.stringify({ type: 'player_input', input })),
    });
    this.remoteInterpolation = new Map();
  }

  setLocalEntity(entity) {
    this.localEntity = entity;
    if (!this.world.getComponent(entity, NetworkTransform)) {
      this.world.addComponent(entity, new NetworkTransform({ interpolation: 8 }));
    }
    if (this.localPeerId) {
      this.world.addComponent(entity, new NetworkIdentity({
        peerId: this.localPeerId,
        isLocal: true,
      }));
    }
  }

  getLocalPhysicsState() {
    const transform = this.localEntity
      ? this.world.getComponent(this.localEntity, Transform)
      : null;
    return {
      position: {
        x: transform?.position?.[0] ?? 0,
        y: transform?.position?.[1] ?? 0,
        z: transform?.position?.[2] ?? 0,
      },
    };
  }

  setLocalPhysicsState(snapshot) {
    const transform = this.localEntity
      ? this.world.getComponent(this.localEntity, Transform)
      : null;
    if (!transform || !snapshot?.position) return;
    const position = [snapshot.position.x, snapshot.position.y, snapshot.position.z];
    transform.position = position;
    const body = this.world.getComponent(this.localEntity, Rigidbody);
    if (body) this.physicsSystem?.syncPlayerPosition(this.localEntity, position);
    if (snapshot.rotation) transform.rotation = [0, snapshot.rotation.y ?? 0, 0];
  }

  connect({ retry = true } = {}) {
    if (!this.url) {
      this.onStatus('URL do relay multiplayer nao configurada.');
      return Promise.reject(new Error('URL do relay multiplayer não configurada.'));
    }

    if (!('WebSocket' in window)) {
      this.onStatus('Multiplayer indisponivel neste navegador.');
      return Promise.reject(new Error('Multiplayer indisponível neste navegador.'));
    }

    if (this.socket?.readyState === WebSocket.OPEN && this.welcomeReceived) {
      return Promise.resolve();
    }
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      this.resolveConnection = resolve;
      const attempt = () => {
        this.onStatus('Aguardando conexão com o multiplayer...');
        this.localStateRestored = false;
        this.welcomeReceived = false;
        const socket = new WebSocket(this.url);
        this.socket = socket;
        socket.addEventListener('message', (event) => this.handleMessage(event.data));
        socket.addEventListener('close', (event) => {
          if (this.socket === socket) this.socket = null;
          if (event.code === 4008) {
            this.connectionPromise = null;
            this.resolveConnection = null;
            this.onStatus('Este jogador já está aberto em outra aba.');
            reject(new Error('Este jogador já está aberto em outra aba.'));
            return;
          }
          if (event.code === 4001) {
            this.connectionPromise = null;
            this.resolveConnection = null;
            this.onStatus('O relay recusou a identidade do jogador.');
            reject(new Error('O relay recusou a identidade do jogador.'));
            return;
          }
          if (event.code === 1011) {
            this.onStatus('O relay está sem acesso ao banco de dados. Tentando novamente...');
          } else if (event.code === 1013) {
            this.connectionPromise = null;
            this.resolveConnection = null;
            const message = event.reason === 'Client too slow'
              ? 'O relay encerrou a conexão porque o cliente não conseguiu acompanhar as atualizações.'
              : 'O relay está cheio. Feche outra aba ou aumente MAX_WS_CONNECTIONS.';
            this.onStatus(message);
            reject(new Error(message));
            return;
          } else {
            this.onStatus('Multiplayer offline. Inicie o relay para conectar.');
          }
          if (retry) {
            window.setTimeout(attempt, 3000);
          } else {
            this.connectionPromise = null;
            this.resolveConnection = null;
            reject(new Error('Multiplayer indisponível.'));
          }
        }, { once: true });
        socket.addEventListener('error', () => this.onStatus('Relay multiplayer indisponível.'));
      };
      attempt();
    });
    return this.connectionPromise;
  }

  handleMessage(rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      this.localPeerId = message.peerId;
      if (this.localEntity) this.setLocalEntity(this.localEntity);
      if (message.player) this.applyLocalPlayerState(message.player);
      this.welcomeReceived = true;
      this.connectionPromise = null;
      this.resolveConnection?.();
      this.resolveConnection = null;
      this.onStatus('Multiplayer conectado.');
      return;
    }

    if (message.type === 'death') {
      this.localPlayerDead = true;
      if (!this.deathScreenShown) {
        this.deathScreenShown = true;
        this.onDeath();
      }
      return;
    }

    if (message.type === 'attack-hit') {
      this.onAttackHit(message);
      if (message.enemyId) this.removeEnemyEntity(message.enemyId);
      return;
    }

    if (message.type === 'attack-miss') {
      this.onAttackMiss(message);
      return;
    }

    if (message.type === 'enemy-defeated' && message.enemyId) {
      this.defeatedEnemyIds.add(message.enemyId);
      this.removeEnemyEntity(message.enemyId);
      return;
    }

    if (message.type === 'level-up') {
      this.onLevelUp(message);
      return;
    }

    if (message.type === 'respawned') {
      this.pendingState = null;
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      if (Array.isArray(message.position) && Array.isArray(message.rotation)) {
        applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      }
      this.attackTargetEntity = null;
      this.localStateRestored = false;
      this.localPlayerDead = false;
      this.respawnPending = false;
      this.deathScreenShown = false;
      this.onRespawn();
      return;
    }

    if (message.type === 'teleported') {
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      this.localStateRestored = true;
      return;
    }

    if (message.type === 'area-blocked') {
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      this.onChat({
        type: 'system',
        text: 'Acesso bloqueado: alcance o nível 3 para entrar em uma área superior.',
        sentAt: Date.now(),
      });
      return;
    }

    if (message.type === 'water-blocked') {
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      return;
    }

    if (message.type === 'collision-blocked') {
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      this.onChat({
        type: 'system',
        text: `Colisão com: ${message.collider?.name ?? message.collider?.id ?? 'objeto sem nome'}.`,
        sentAt: Date.now(),
      });
      return;
    }

    if (message.type === 'collision-corrected') {
      const transform = this.localEntity
        ? this.world.getComponent(this.localEntity, Transform)
        : null;
      const networkTransform = this.localEntity
        ? this.world.getComponent(this.localEntity, NetworkTransform)
        : null;
      applyLocalTransformOverride(transform, networkTransform, message.position, message.rotation);
      this.onChat({
        type: 'system',
        text: `Correção de colisão: ${message.collider?.name ?? message.collider?.id ?? 'objeto sem nome'}.`,
        sentAt: Date.now(),
      });
      return;
    }

    if (message.type === 'snapshot' && Array.isArray(message.players)) {
      // O snapshot apenas agenda dados; a criacao/remoção ECS ocorre em update().
      this.pendingState = message.players.slice(0, MESSAGE_LIMIT);
      this.onOnlinePlayers(this.pendingState);
      this.pendingEnemies = Array.isArray(message.enemies) ? message.enemies : [];
      return;
    }

    if (message.type === 'ranking' && Array.isArray(message.players)) {
      this.onRanking(message.players);
      return;
    }

    if (message.type === 'map-access' && typeof message.path === 'string') {
      this.onMapAccess(message.path);
      return;
    }

    if (message.type === 'chat' && typeof message.text === 'string') {
      const entity = message.peerId === this.localPeerId
        ? this.localEntity
        : this.remoteEntities.get(message.peerId);
      if (entity) this.world.getComponent(entity, NameTag)?.showSpeech(message.text);
      this.onChat({
        type: 'chat',
        peerId: message.peerId,
        nickname: message.nickname,
        isAdmin: message.isAdmin === true,
        text: message.text,
        sentAt: message.sentAt,
      });
      return;
    }

    if (message.type === 'system' && typeof message.text === 'string') {
      this.onChat({
        type: 'system',
        text: message.text,
        sentAt: message.sentAt,
      });
    }
  }

  applyLocalPlayerState(player) {
    const transform = this.localEntity
      ? this.world.getComponent(this.localEntity, Transform)
      : null;
    const networkTransform = this.localEntity
      ? this.world.getComponent(this.localEntity, NetworkTransform)
      : null;
    if (transform && Array.isArray(player.position) && Array.isArray(player.rotation)) {
      applyLocalTransformOverride(transform, networkTransform, player.position, player.rotation);
    }
    this.localStateRestored = true;
    this.localPlayerDead = Boolean(player.dead);
    this.combatMode = player.combatMode ?? 'melee';
    this.onPlayerState(player);
    if (player.dead && !this.deathScreenShown) {
      this.deathScreenShown = true;
      this.onDeath();
    }
  }

  sendChat(text) {
    const message = text.trim();
    if (!message || !this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    this.socket.send(JSON.stringify({ type: 'chat', text: message }));
    return true;
  }

  requestRanking() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'ranking-request' }));
    return true;
  }

  sendRespawn() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.respawnPending = true;
    this.localPlayerDead = true;
    this.socket.send(JSON.stringify({ type: 'respawn' }));
    return true;
  }

  sendAttack() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'attack', mode: this.combatMode ?? 'melee' }));
    this.onAttack();
    return true;
  }

  setCombatMode(mode) {
    this.combatMode = mode;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'combat-mode', mode }));
    return true;
  }

  setAttackTarget(entity) {
    if (this.attackTargetEntity === entity) return;
    const previous = this.attackTargetEntity;
    const previousOutline = previous ? this.world.getComponent(previous, OutlineRenderer) : null;
    if (previousOutline) previousOutline.selected = false;
    this.attackTargetEntity = entity;
    const targetOutline = entity ? this.world.getComponent(entity, OutlineRenderer) : null;
    if (targetOutline) targetOutline.selected = true;
    this.onAttackTargetChanged(entity);
  }

  removeEnemyEntity(enemyId, world = this.world) {
    const normalizedId = String(enemyId);
    const entity = this.enemyEntities.get(normalizedId)
      ?? world.query(EnemyIdentity).find((candidate) => {
        const identity = world.getComponent(candidate, EnemyIdentity);
        return String(identity?.enemyId) === normalizedId;
      });
    if (!entity) return;

    if (this.attackTargetEntity === entity) this.setAttackTarget(null);
    world.removeEntity(entity);
    this.enemyEntities.delete(normalizedId);
  }

  update(world, time) {
    const deltaSeconds = this.lastFrameTime === null ? 1 / 60 : Math.min((time - this.lastFrameTime) * 0.001, 0.1);
    this.lastFrameTime = time;
    this.applySnapshot(world);
    this.updateAttackTarget(world, time);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.localEntity) return;
    if (this.localPlayerDead || this.respawnPending) return;
    if (this.input?.consumePressed('f')) {
      this.sendAttack();
    }
    if (time - this.lastSentAt < 50) return;

    const click = this.input?.consumeClick?.();
    if (click && this.camera && this.canvas) {
      this.clickDestination = this.camera.screenToGround(click[0], click[1], this.canvas);
    }
    const keyboardMovement = this.input?.getMovementCommand?.() ?? { angle: 0, magnitude: 0 };
    let movement = keyboardMovement;
    let movementIsWorldSpace = false;
    if (movement.magnitude <= 0 && this.clickDestination) {
      const transform = this.world.getComponent(this.localEntity, Transform);
      const deltaX = this.clickDestination[0] - transform.position[0];
      const deltaZ = this.clickDestination[2] - transform.position[2];
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance <= 0.2) {
        this.clickDestination = null;
      } else {
        movement = { angle: Math.atan2(deltaX, deltaZ), magnitude: 1 };
        movementIsWorldSpace = true;
      }
    }
    const worldAngle = movementIsWorldSpace || !this.camera
      ? movement.angle
      : normalizeAngle(this.camera.yaw - Math.PI - movement.angle);
    const command = {
      angle: movement.magnitude > 0 ? worldAngle : 0,
      magnitude: movement.magnitude,
    };
    const input = {
      moveX: Math.max(-1, Math.min(1, Math.sin(command.angle) * command.magnitude)),
      moveZ: Math.max(-1, Math.min(1, Math.cos(command.angle) * command.magnitude)),
      jump: this.input?.consumePressed(' ') ?? false,
      sprint: this.input?.keys?.has('shift') ?? false,
    };
    this.prediction.update(input);
    this.lastMovementCommand = command;
    this.lastSentAt = time;
  }

  updateAttackTarget(world, time) {
    if (!this.attackTargetEntity) return;
    const targetTransform = world.getComponent(this.attackTargetEntity, Transform);
    const playerTransform = world.getComponent(this.localEntity, Transform);
    if (!targetTransform || !playerTransform) {
      this.attackTargetEntity = null;
      this.onAttackTargetChanged(null);
      return;
    }

    const deltaX = targetTransform.position[0] - playerTransform.position[0];
    const deltaZ = targetTransform.position[2] - playerTransform.position[2];
    const distance = Math.hypot(deltaX, deltaZ);
    const attackDistance = this.combatMode === 'melee' ? COMBAT_DISTANCE : RANGED_ATTACK_DISTANCE;
    if (distance > 0.001) {
      playerTransform.rotation[1] = Math.atan2(deltaX, deltaZ);
    }

    if (distance <= attackDistance && time - this.lastAttackRequestAt >= 200) {
      if (this.sendAttack()) this.lastAttackRequestAt = time;
    }
  }

  applySnapshot(world) {
    if (!this.pendingState) return;
    const activePeers = new Set();

    for (const player of this.pendingState) {
      if (player.peerId === this.localPeerId) {
        if (Number.isFinite(player.serverTick) && Number.isFinite(player.lastProcessedInput)) {
          this.prediction.reconcile(player);
        }
        this.localPlayerDead = Boolean(player.dead);
        this.combatMode = player.combatMode ?? 'melee';
        const localNameTag = world.getComponent(this.localEntity, NameTag);
        localNameTag?.update(player.nickname, player.level);
        this.onPlayerState(player);
        if (player.dead && !this.deathScreenShown) {
          this.deathScreenShown = true;
          this.onDeath();
        }
        continue;
      }
      if (!player.peerId) continue;
      activePeers.add(player.peerId);
      let entity = this.remoteEntities.get(player.peerId);
      if (!entity) {
        entity = this.createRemoteEntity(player.peerId, player.nickname, player.level);
        this.remoteEntities.set(player.peerId, entity);
      }

      const nameTag = world.getComponent(entity, NameTag);
      nameTag?.update(player.nickname, player.level);

      let interpolation = this.remoteInterpolation.get(player.peerId);
      if (!interpolation) {
        interpolation = new RemotePlayerInterpolation();
        this.remoteInterpolation.set(player.peerId, interpolation);
      }
      interpolation.add({ ...player, receivedAt: performance.now() });
      const sampled = interpolation.sample(performance.now());
      const networkTransform = world.getComponent(entity, NetworkTransform);
      if (networkTransform && sampled) {
        networkTransform.targetPosition = [sampled.position.x, sampled.position.y, sampled.position.z];
        networkTransform.targetRotation = [0, player.rotation?.y ?? 0, 0];
      }
    }

    const activeEnemies = new Set();
    for (const enemy of this.pendingEnemies ?? []) {
      if (!enemy.id || !Array.isArray(enemy.position)) continue;
      if (this.defeatedEnemyIds.has(enemy.id)) continue;
      activeEnemies.add(enemy.id);
      let entity = this.enemyEntities.get(enemy.id);
      if (!entity) {
        entity = this.createEnemyEntity(enemy);
        if (!entity) continue;
        this.enemyEntities.set(enemy.id, entity);
      }
      const transform = world.getComponent(entity, Transform);
      const networkTransform = world.getComponent(entity, NetworkTransform);
      const enemyScale = Number(enemy.scale);
      if (transform && Number.isFinite(enemyScale) && enemyScale > 0) {
        transform.scale = [enemyScale, enemyScale, enemyScale];
      }
      if (networkTransform) {
        networkTransform.targetPosition = enemy.position;
        networkTransform.targetRotation = [0, enemy.rotationY ?? 0, 0];
      } else if (transform) {
        transform.position = [...enemy.position];
        transform.rotation[1] = enemy.rotationY ?? 0;
      }
      const nameTag = world.getComponent(entity, NameTag);
      nameTag?.update(enemy.name, enemy.level, enemy.alerted);
      const healthBar = world.getComponent(entity, EnemyHealthBar);
      healthBar?.update(enemy.hp, enemy.maxHp);
      const enemyIdentity = world.getComponent(entity, EnemyIdentity);
      if (enemyIdentity) enemyIdentity.type = enemy.type;
      if (this.attackTargetEntity === entity && !enemy.alerted) {
        this.setAttackTarget(null);
      }
    }

    for (const [peerId, entity] of this.remoteEntities) {
      if (!activePeers.has(peerId)) {
        world.removeEntity(entity);
        this.remoteEntities.delete(peerId);
        this.remoteInterpolation.delete(peerId);
      }
    }
    for (const [enemyId, entity] of this.enemyEntities) {
      if (!activeEnemies.has(enemyId)) {
        this.removeEnemyEntity(enemyId, world);
      }
    }
    this.pendingState = null;
  }
}
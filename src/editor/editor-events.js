export function bindEditorEvents(context) {
  const {
    setMode,
    setStatus,
    setPanelOpen,
    setInspectorTab,
    setComponentTab,
    updateEnemyTypeField,
    updateEnemyAreaField,
    updateVector,
    updateSummary,
    renderSounds,
    renderEnemyAreas,
    renderEnemyTypes,
    renderEntities,
    updateInspector,
    updateTerrainInspector,
    updateSceneAtmosphere,
    updateSceneAmbientLight,
    updateLightingInspector,
    updatePlayerInspector,
    readPlayerInspector,
    refreshPlayerPreview,
    applyToGame,
    undo,
    redo,
    loadWorld,
    registerAsset,
    instantiateAsset,
    assetFormat,
    readFileAsDataUrl,
    addEntity,
    createEntity,
    createPrimitive,
    createPointLight,
    createEnemyArea,
    createEnemyType,
    duplicateSelectedEntity,
    removeEntity,
    updateEnemyAreaInspector,
    selectedEnemyArea,
    selectedEntity,
    selectedEntityId,
    selectedEnemyAreaId,
    pushHistory,
    terrainRemoved,
    setTerrainRemoved,
    applyTerrainBrushToGround,
    updateCollisionVisual,
    syncSoundInput,
    verifySoundSource,
    renderSceneTree,
    updateAnimationInspector,
    setAnimationPlaying,
    stopAnimation,
    entityDiffuseColorInput,
    entityTextureFileInput,
    entityReceiveLightInput,
    entityCastShadowInput,
    entityLightColorInput,
    entityLightIntensityInput,
    entityLightDistanceInput,
    animationPlayButton,
    animationPauseButton,
    animationStopButton,
    animationSelect,
    animationLoopInput,
    animationSpeedInput,
    animationSpeedValue,
    componentTabs,
    soundType,
    soundUrl,
    soundList,
    status,
    canvas,
    ground,
    raycaster,
    pointer,
    camera,
    entityGroup,
    materialIndexForObject,
    gizmoDragging,
    mode,
    coordinates,
    hover,
    orbit,
    terrainBrushActive,
    clearCollisionVisual,
    updateCollisionProperty,
    collisionFrictionInput,
    collisionRestitutionInput,
    entityLightIntensityValue,
    entityLightDistanceValue,
    terrainWidthInput,
    terrainDepthInput,
    terrainSegmentsInput,
    terrainAmplitudeInput,
    terrainFrequencyInput,
    terrainColorInput,
    terrainBrushRadiusInput,
    terrainBrushStrengthInput,
    ambientColorInput,
    ambientIntensityInput,
    directionalIntensityInput,
    directionalCastShadowInput,
    directionalInputs,
    directionalValues,
    skyColorInput,
    fogColorInput,
    fogNearInput,
    fogFarInput,
    terrainWidthValue,
    terrainDepthValue,
    terrainSegmentsValue,
    terrainAmplitudeValue,
    terrainFrequencyValue,
    terrainBrushRadiusValue,
    terrainBrushStrengthValue,
    ambientIntensityValue,
    directionalIntensityValue,
    playerPreview,
    player,
    selectedMaterialIndex,
    sceneTree,
    updateSummary,
    exportConfig,
    loadSavedWorld,
    listEditorEntities,
    lights,
    newId,
    entityNameInput,
    collisionEnabledInput,
    collisionShapeInput,
    collisionBodyTypeInput,
    selectedEntityLabel,
    entityInspector,
    emptyInspector,
    playerPreviewInspector,
    pointLightInspector,
    meshCount,
    meshList,
    entityLightIntensityValue,
    entityLightDistanceValue,
    selectedEnemyArea,
    selectedEnemyType,
    selectedEnemyTypeId,
    
  } = context;

  document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelector('#model-file').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    const model = files.find((file) => /\.(glb|gltf|obj)$/i.test(file.name));
    if (!model) return;
    try {
      const dependencies = Object.fromEntries(await Promise.all(files.filter((file) => file !== model).map(async (file) => [file.name, await readFileAsDataUrl(file)])));
      const url = await readFileAsDataUrl(model);
      await registerAsset(url, model.name, `local:${model.name}`, assetFormat(model.name), dependencies);
    } catch (error) {
      setStatus(`Falha ao ler ${model.name}: ${error.message}`);
    }
    event.target.value = '';
  });

  document.querySelector('#add-url-button').addEventListener('click', async () => {
    const input = document.querySelector('#model-url');
    const url = input.value.trim();
    if (!url) return;
    await registerAsset(url, url.split('/').pop() || 'Modelo 3D');
    input.value = '';
  });

  function syncSoundInput() {
    const source = context.sounds[context.soundType.value] ?? '';
    context.soundUrl.value = source.startsWith('data:') ? '' : source;
  }

  context.soundType.addEventListener('change', syncSoundInput);

  async function verifySoundSource(source) {
    if (source.startsWith('data:') || source.startsWith('blob:')) return true;
    try {
      let response = await fetch(source, { method: 'HEAD' });
      if (response.status === 405 || response.status === 501) response = await fetch(source, { headers: { Range: 'bytes=0-0' } });
      return response.ok;
    } catch {
      return false;
    }
  }

  document.querySelector('#sound-url-button').addEventListener('click', async () => {
    const source = context.soundUrl.value.trim();
    if (!source) return;
    if (!(await verifySoundSource(source))) {
      setStatus('Arquivo de som não encontrado ou indisponível');
      return;
    }
    pushHistory();
    context.sounds[context.soundType.value] = source;
    renderSounds();
    updateSummary();
    setStatus(`Som ${context.soundType.value} configurado`);
  });

  document.querySelector('#sound-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      pushHistory();
      context.sounds[context.soundType.value] = await readFileAsDataUrl(file);
      renderSounds();
      syncSoundInput();
      updateSummary();
      setStatus(`Som ${context.soundType.value} importado`);
    } catch (error) {
      setStatus(`Falha ao ler ${file.name}: ${error.message}`);
    }
    event.target.value = '';
  });

  document.querySelector('#create-empty-button').addEventListener('click', () => {
    pushHistory();
    addEntity(createEntity());
    setMode('translate');
    setStatus('Entidade vazia criada');
  });

  document.querySelector('#duplicate-entity-button').addEventListener('click', duplicateSelectedEntity);
  document.querySelector('#create-point-light-button').addEventListener('click', createPointLight);
  document.querySelectorAll('[data-primitive]').forEach((button) => button.addEventListener('click', () => createPrimitive(button.dataset.primitive)));
  document.querySelector('#create-enemy-area-button').addEventListener('click', () => {
    pushHistory();
    const area = createEnemyArea();
    context.enemyAreas.push(area);
    context.selectEnemyArea(area.id);
    updateSummary();
    setStatus('Área inimiga criada');
  });

  document.querySelector('#create-enemy-type-button').addEventListener('click', () => {
    pushHistory();
    createEnemyType();
    setStatus('Tipo de inimigo criado');
  });

  document.querySelectorAll('[data-enemy-type-field]').forEach((input) => input.addEventListener('change', () => updateEnemyTypeField(input)));
  document.querySelector('#delete-enemy-area-button').addEventListener('click', () => {
    if (!context.selectedEnemyAreaId) return;
    pushHistory();
    context.enemyAreas = context.enemyAreas.filter((area) => area.id !== context.selectedEnemyAreaId);
    context.selectedEnemyAreaId = null;
    updateEnemyAreaInspector();
    renderEnemyAreas();
    updateSummary();
    setStatus('Área inimiga excluída');
  });

  document.querySelector('#delete-terrain-button').addEventListener('click', () => {
    pushHistory();
    setTerrainRemoved(!terrainRemoved);
    setStatus(terrainRemoved ? 'Terreno restaurado' : 'Terreno removido');
  });

  document.querySelector('#enemy-area-id').addEventListener('change', (event) => {
    const area = selectedEnemyArea();
    if (!area) return;
    pushHistory();
    area.id = event.target.value.trim() || newId('enemy-area');
    updateEnemyAreaInspector();
    renderEnemyAreas();
    updateSummary();
  });

  document.querySelectorAll('[data-area-field]').forEach((input) => input.addEventListener('change', () => updateEnemyAreaField(input)));

  document.querySelector('#delete-entity-button').addEventListener('click', () => {
    if (!context.selectedEntityId) return;
    pushHistory();
    if (context.selectedEntityId === 'terrain') {
      setTerrainRemoved(!terrainRemoved);
      setStatus(terrainRemoved ? 'Terreno restaurado' : 'Terreno removido');
      return;
    }
    if (context.selectedEntityId === 'directionalLight') {
      context.lighting.directional.enabled = false;
      updateSceneAmbientLight();
      updateSummary();
      context.selectedEntityId = null;
      setStatus('Luz direcional removida');
      updateInspector();
      renderEntities();
      return;
    }
    removeEntity(context.selectedEntityId);
    setStatus('Entidade excluída');
  });

  componentTabs.forEach((tab) => tab.addEventListener('click', () => setComponentTab(tab.dataset.componentTab)));
  animationPlayButton.addEventListener('click', () => setAnimationPlaying(true));
  animationPauseButton.addEventListener('click', () => setAnimationPlaying(false));
  animationStopButton.addEventListener('click', stopAnimation);
  animationSelect.addEventListener('change', () => {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.animation.name = animationSelect.value;
    entity.animation.playing = true;
    if (entity.isPlayerPreview) context.player.animation = { ...entity.animation };
    context.applyEntityAnimation(entity);
    updateAnimationInspector();
    updateSummary();
  });
  animationLoopInput.addEventListener('change', () => {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.animation.loop = animationLoopInput.checked;
    context.applyEntityAnimation(entity);
    if (entity.isPlayerPreview) context.player.animation = { ...entity.animation };
    updateAnimationInspector();
    updateSummary();
  });
  animationSpeedInput.addEventListener('input', () => {
    const entity = selectedEntity();
    if (!entity) return;
    entity.animation.speed = Math.max(0, Number(animationSpeedInput.value) || 0);
    if (entity.animationAction) entity.animationAction.timeScale = entity.animation.speed;
    if (entity.isPlayerPreview) context.player.animation = { ...entity.animation };
    animationSpeedValue.textContent = `${entity.animation.speed.toFixed(2)}x`;
    updateSummary();
  });

  document.querySelector('#entity-name').addEventListener('change', (event) => {
    const entity = selectedEntity();
    if (!entity) return;
    const requestedName = String(event.target.value).trim();
    const duplicate = context.entities.some((item) => item.id !== entity.id && item.name.trim().toLowerCase() === requestedName.toLowerCase());
    if (!requestedName || duplicate) {
      event.target.value = entity.name;
      setStatus(duplicate ? 'Já existe uma entidade com esse nome' : 'O nome da entidade não pode ficar vazio');
      return;
    }
    pushHistory();
    entity.name = requestedName;
    entity.object.name = entity.name;
    selectedEntityLabel.textContent = entity.name;
    renderEntities();
    updateSummary();
  });

  document.querySelector('#collision-enabled').addEventListener('change', (event) => {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.collision.enabled = event.target.checked;
    if (entity.isPlayerPreview) context.player.collision = { ...entity.collision };
    updateCollisionVisual(entity);
    updateSummary();
  });

  document.querySelector('#collision-shape').addEventListener('change', (event) => {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.collision.shape = event.target.value;
    if (entity.isPlayerPreview) context.player.collision = { ...entity.collision };
    updateCollisionVisual(entity);
    updateSummary();
  });

  document.querySelector('#collision-body-type').addEventListener('change', (event) => {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.collision.bodyType = ['rigidBody', 'staticBody', 'characterBody'].includes(event.target.value) ? event.target.value : 'staticBody';
    if (entity.isPlayerPreview) context.player.collision = { ...entity.collision };
    updateCollisionVisual(entity);
    updateSummary();
  });

  function updateCollisionProperty(input, property) {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    context.normalizeCollision(entity);
    entity.collision[property] = Math.min(1, Math.max(0, Number(input.value) || 0));
    if (entity.isPlayerPreview) context.player.collision = { ...entity.collision, offset: [...entity.collision.offset] };
    document.querySelector(`#collision-${property}-value`).textContent = entity.collision[property].toFixed(2);
    updateSummary();
  }

  collisionFrictionInput.addEventListener('input', () => updateCollisionProperty(collisionFrictionInput, 'friction'));
  collisionRestitutionInput.addEventListener('input', () => updateCollisionProperty(collisionRestitutionInput, 'restitution'));

  document.querySelectorAll('[data-collision-vector]').forEach((container) => container.replaceChildren(...['x', 'y', 'z'].map((axis, index) => {
    const label = document.createElement('label');
    label.textContent = axis.toUpperCase();
    const input = document.createElement('input');
    input.type = 'number'; input.step = '0.1'; input.min = container.dataset.collisionVector === 'scale' ? '0.01' : undefined; input.dataset.index = String(index);
    input.addEventListener('change', () => {
      const entity = selectedEntity();
      if (!entity) return;
      const vector = container.dataset.collisionVector;
      pushHistory();
      context.normalizeCollision(entity);
      entity.collision[vector][index] = vector === 'scale' ? Math.max(0.01, Math.abs(Number(input.value) || 1)) : Number(input.value) || 0;
      if (entity.isPlayerPreview) context.player.collision = { ...entity.collision, offset: [...entity.collision.offset], scale: [...entity.collision.scale] };
      updateCollisionVisual(entity); updateInspector(); updateSummary();
    });
    label.append(input); return label;
  })));

  entityDiffuseColorInput.addEventListener('input', () => {
    const entity = selectedEntity();
    if (!entity) return;
    const hex = entityDiffuseColorInput.value.slice(1);
    const color = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    context.normalizeEntityMaterials(entity);
    const material = entity.materials[selectedMaterialIndex];
    if (!material) return;
    material.diffuseColor = [...color];
    context.applyEntityMaterials(entity);
    if (entity.isPlayerPreview) context.syncPlayerFromPreview(entity);
    context.renderMeshList(entity);
    updateSummary();
  });

  function updateEntityShadowSettings() {
    const entity = selectedEntity();
    if (!entity) return;
    pushHistory();
    entity.receiveLight = entityReceiveLightInput.checked;
    entity.castShadow = entityCastShadowInput.checked;
    entity.object?.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = entity.castShadow;
      child.receiveShadow = entity.receiveLight;
    });
    updateSummary();
  }

  entityReceiveLightInput.addEventListener('change', updateEntityShadowSettings);
  entityCastShadowInput.addEventListener('change', updateEntityShadowSettings);
  entityTextureFileInput.addEventListener('change', async () => {
    const entity = selectedEntity();
    const file = entityTextureFileInput.files?.[0];
    if (!entity || !file) return;
    const textureUrl = await readFileAsDataUrl(file);
    const texture = await new THREE.TextureLoader().loadAsync(textureUrl);
    let materialIndex = 0;
    entity.object.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (materialIndex === selectedMaterialIndex) {
          material.map = texture;
          material.needsUpdate = true;
        }
        materialIndex += 1;
      });
    });
    context.normalizeEntityMaterials(entity);
    if (entity.materials[selectedMaterialIndex]) entity.materials[selectedMaterialIndex].texture = textureUrl;
    if (entity.isPlayerPreview) context.syncPlayerFromPreview(entity);
    entityTextureFileInput.value = '';
    updateSummary();
  });

  entityLightColorInput.addEventListener('input', () => {
    const entity = selectedEntity();
    if (!entity || entity.type !== 'pointLight') return;
    const hex = entityLightColorInput.value.slice(1);
    entity.light.color = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    entity.object.color.setRGB(...entity.light.color);
    entity.object.children[0]?.material.color.setRGB(...entity.light.color);
    updateSummary();
  });

  entityLightIntensityInput.addEventListener('input', () => {
    const entity = selectedEntity();
    if (!entity || entity.type !== 'pointLight') return;
    entity.light.intensity = Number(entityLightIntensityInput.value);
    entity.object.intensity = entity.light.intensity;
    entityLightIntensityValue.textContent = entity.light.intensity.toFixed(2);
    updateSummary();
  });

  entityLightDistanceInput.addEventListener('input', () => {
    const entity = selectedEntity();
    if (!entity || entity.type !== 'pointLight') return;
    entity.light.distance = Number(entityLightDistanceInput.value);
    entity.object.distance = entity.light.distance;
    entityLightDistanceValue.textContent = entity.light.distance.toFixed(2);
    updateSummary();
  });

  document.querySelector('#clear-button').addEventListener('click', () => {
    pushHistory();
    context.entities.slice().forEach((entity) => removeEntity(entity.id));
    updateSummary();
    setStatus('Cena limpa');
  });

  document.querySelector('#export-button').addEventListener('click', context.download);
  document.querySelector('#player-asset').addEventListener('change', async () => {
    readPlayerInspector();
    await refreshPlayerPreview();
    setStatus('Preview do player atualizado');
  });

  ['player-model-format', 'player-speed', 'player-hp', 'player-max-hp', 'player-animation', 'player-status', 'player-inventory'].forEach((id) => {
    const input = document.querySelector(`#${id}`);
    input.addEventListener('input', readPlayerInspector);
    input.addEventListener('change', readPlayerInspector);
  });

  document.querySelector('#apply-button').addEventListener('click', applyToGame);
  document.querySelector('#undo-button').addEventListener('click', undo);
  document.querySelector('#redo-button').addEventListener('click', redo);

  terrainWidthInput.addEventListener('input', () => {
    context.terrainConfig.width = Number(terrainWidthInput.value) || 128;
    terrainWidthValue.textContent = context.terrainConfig.width.toFixed(2);
    context.configureTerrainMesh(ground, context.terrainConfig);
    updateSummary();
  });

  terrainDepthInput.addEventListener('input', () => {
    context.terrainConfig.depth = Number(terrainDepthInput.value) || 128;
    terrainDepthValue.textContent = context.terrainConfig.depth.toFixed(2);
    context.configureTerrainMesh(ground, context.terrainConfig);
    updateSummary();
  });

  terrainSegmentsInput.addEventListener('input', () => {
    context.terrainConfig.segments = Number(terrainSegmentsInput.value) || 64;
    terrainSegmentsValue.textContent = String(context.terrainConfig.segments);
    context.configureTerrainMesh(ground, context.terrainConfig);
    updateSummary();
  });

  terrainAmplitudeInput.addEventListener('input', () => {
    context.terrainConfig.amplitude = Number(terrainAmplitudeInput.value) || 0.15;
    terrainAmplitudeValue.textContent = context.terrainConfig.amplitude.toFixed(2);
    context.configureTerrainMesh(ground, context.terrainConfig);
    updateSummary();
  });

  terrainFrequencyInput.addEventListener('input', () => {
    context.terrainConfig.frequency = Number(terrainFrequencyInput.value) || 0.22;
    terrainFrequencyValue.textContent = context.terrainConfig.frequency.toFixed(2);
    context.configureTerrainMesh(ground, context.terrainConfig);
    updateSummary();
  });

  terrainColorInput.addEventListener('input', () => {
    context.terrainConfig.color = terrainColorInput.value;
    ground.material.color.set(context.terrainConfig.color);
    updateSummary();
  });

  terrainBrushRadiusInput.addEventListener('input', () => {
    context.terrainConfig.brushRadius = Number(terrainBrushRadiusInput.value) || 3;
    terrainBrushRadiusValue.textContent = context.terrainConfig.brushRadius.toFixed(2);
    updateSummary();
  });

  terrainBrushStrengthInput.addEventListener('input', () => {
    context.terrainConfig.brushStrength = Number(terrainBrushStrengthInput.value) || 0.8;
    terrainBrushStrengthValue.textContent = context.terrainConfig.brushStrength.toFixed(2);
    updateSummary();
  });

  ambientColorInput.addEventListener('input', () => {
    const hex = ambientColorInput.value.slice(1);
    context.lighting.ambientColor = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    updateSceneAmbientLight();
    updateSummary();
  });

  ambientIntensityInput.addEventListener('input', () => {
    context.lighting.ambientIntensity = Number(ambientIntensityInput.value);
    ambientIntensityValue.textContent = context.lighting.ambientIntensity.toFixed(2);
    updateSceneAmbientLight();
    updateSummary();
  });

  directionalIntensityInput.addEventListener('input', () => {
    context.lighting.directional.intensity = Number(directionalIntensityInput.value);
    directionalIntensityValue.textContent = context.lighting.directional.intensity.toFixed(2);
    updateSceneAmbientLight();
    updateSummary();
  });

  directionalCastShadowInput.addEventListener('change', () => {
    context.lighting.directional.castShadow = directionalCastShadowInput.checked;
    updateSceneAmbientLight();
    updateSummary();
  });

  directionalInputs.forEach((input, index) => input.addEventListener('input', () => {
    context.lighting.directional.direction[index] = Number(input.value);
    directionalValues[index].textContent = context.lighting.directional.direction[index].toFixed(2);
    updateSceneAmbientLight();
    updateSummary();
  }));

  skyColorInput.addEventListener('input', () => {
    const hex = skyColorInput.value.slice(1);
    context.skyColor = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    updateSceneAtmosphere();
    updateSummary();
  });

  fogColorInput.addEventListener('input', () => {
    const hex = fogColorInput.value.slice(1);
    context.fog.color = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    updateSceneAtmosphere();
    updateSummary();
  });

  fogNearInput.addEventListener('input', () => {
    context.fog.near = Number(fogNearInput.value) || 0;
    if (context.fog.near >= context.fog.far) context.fog.far = context.fog.near + 1;
    updateSceneAtmosphere();
    updateSummary();
  });

  fogFarInput.addEventListener('input', () => {
    context.fog.far = Number(fogFarInput.value) || 0;
    if (context.fog.far <= context.fog.near) context.fog.near = Math.max(0, context.fog.far - 1);
    updateSceneAtmosphere();
    updateSummary();
  });

  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const panelId = button.dataset.closePanel;
      setPanelOpen(panelId, false, document.querySelector(`[aria-controls="${panelId}"]`));
    });
  });

  document.querySelector('#import-world').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await loadWorld(JSON.parse(await file.text()));
      setStatus(`Mundo carregado: ${file.name}`);
    } catch {
      setStatus('Arquivo .world inválido');
    }
    event.target.value = '';
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const shortcuts = { w: 'translate', e: 'rotate', r: 'scale' };
    const nextMode = shortcuts[event.key.toLowerCase()];
    if (nextMode) setMode(nextMode);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (context.gizmoDragging) return;
    const rect = canvas.getBoundingClientRect();
    context.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    context.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(context.pointer, camera);
    const groundHit = raycaster.intersectObject(ground, false)[0];
    if (context.mode === 'terrain' && groundHit) {
      context.terrainBrushActive = true;
      canvas.setPointerCapture(event.pointerId);
      pushHistory();
      applyTerrainBrushToGround(groundHit.point);
      setStatus('Terreno deformado');
      return;
    }
    const hit = raycaster.intersectObject(entityGroup, true)[0];
    const id = hit?.object?.userData.entityId;
    if (id) {
      context.selectEntity(id);
      context.selectedMaterialIndex = materialIndexForObject(selectedEntity(), hit.object) + (hit.face?.materialIndex ?? 0);
      updateInspector();
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground, false)[0];
    if (hit) {
      coordinates.textContent = `x: ${hit.point.x.toFixed(1)}, y: ${hit.point.y.toFixed(1)}, z: ${hit.point.z.toFixed(1)}`;
      if (context.terrainBrushActive && context.mode === 'terrain') {
        applyTerrainBrushToGround(hit.point);
        setStatus('Terreno deformado');
      }
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    context.terrainBrushActive = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { context.terrainBrushActive = false; });
  canvas.addEventListener('pointerleave', () => { hover.visible = false; });
  window.addEventListener('resize', context.resize);

  document.querySelectorAll('[data-inspector-tab]').forEach((tab) => tab.addEventListener('click', () => setInspectorTab(tab.dataset.inspectorTab)));
  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', () => { const panelId = button.dataset.closePanel; setPanelOpen(panelId, false, document.querySelector(`[aria-controls="${panelId}"]`)); });
  });

  document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  panelToggles.forEach(([toggleId, panelId]) => {
    const toggle = document.querySelector(`#${toggleId}`);
    toggle.addEventListener('click', () => setPanelOpen(panelId, !document.querySelector(`#${panelId}`).classList.contains('panel-open'), toggle));
  });
}

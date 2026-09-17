export function setStatus(statusNode, message) {
  if (!statusNode) return;
  statusNode.textContent = message;
}

export function setPanelOpen(panelId, open, toggle) {
  const panel = document.querySelector(`#${panelId}`);
  if (!panel) return;
  panel.classList.toggle('panel-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
}

export function setInspectorTab(inspectorTabs, tabId) {
  inspectorTabs.forEach((tab) => {
    const active = tab.dataset.inspectorTab === tabId;
    tab.classList.toggle('inspector-tab-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-inspector-panel]').forEach((panel) => {
    panel.classList.toggle('panel-section-active', panel.dataset.inspectorPanel === tabId);
  });
}

export function renderSounds(soundList, sounds) {
  soundList.replaceChildren(...Object.entries(sounds).map(([name, source]) => {
    const item = document.createElement('div');
    item.className = 'asset-item';

    const label = document.createElement('span');
    label.className = 'asset-icon';
    label.textContent = name[0].toUpperCase();

    const value = document.createElement('span');
    value.textContent = source ? `${name}: ${source.startsWith('data:') ? 'arquivo importado' : source}` : `${name}: padrão do jogo`;

    item.append(label, value);
    return item;
  }));
}

export function createSceneTreeGroup(label, count, children, open = true) {
  const group = document.createElement('details');
  group.className = 'scene-tree-group';
  group.open = open;

  const summary = document.createElement('summary');
  summary.textContent = `${label} (${count})`;
  group.append(summary);

  const childContainer = document.createElement('div');
  childContainer.className = 'scene-tree-children';
  childContainer.append(...children);
  group.append(childContainer);

  return group;
}

export function createSceneTreeNode(icon, label, onClick, selected = false) {
  const node = document.createElement('button');
  node.className = `scene-tree-node${selected ? ' scene-tree-node-selected' : ''}`;
  node.type = 'button';
  node.setAttribute('role', 'treeitem');
  node.innerHTML = `<span class="asset-icon">${icon}</span><span>${label}</span>`;
  node.addEventListener('click', onClick);
  return node;
}

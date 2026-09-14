import test from 'node:test';
import assert from 'node:assert/strict';

import { createUiController } from '../src/ui-controller.js';

function createFakeElement(initial = {}) {
  return {
    textContent: initial.textContent ?? '',
    hidden: initial.hidden ?? false,
    style: {},
    dataset: initial.dataset ?? {},
    classList: {
      add() {},
      remove() {},
      toggle() { return false; },
      contains() { return false; },
    },
    setAttribute() {},
    addEventListener() {},
    append() {},
    appendChild() {},
    replaceChildren() {},
  };
}

function createUiHarness() {
  const menuButton = createFakeElement();
  const attributesMenu = createFakeElement();
  const rankingButton = createFakeElement();
  const rankingMenu = createFakeElement();
  const playerNameValue = createFakeElement();
  const playerLevelValue = createFakeElement();
  const strengthValue = createFakeElement();
  const accuracyValue = createFakeElement();
  const magicValue = createFakeElement();
  const strengthBar = createFakeElement();
  const accuracyBar = createFakeElement();
  const magicBar = createFakeElement();
  const onlinePlayersPanel = createFakeElement();
  const onlinePlayersList = createFakeElement();
  const chatToggle = createFakeElement();
  const chatElement = createFakeElement({ hidden: true });
  const rankingList = createFakeElement();
  const combatModeButtons = [];
  const ui = createUiController({
    menuButton,
    attributesMenu,
    rankingButton,
    rankingMenu,
    rankingList,
    combatModeButtons,
    chatToggle,
    chatElement,
    onlinePlayersPanel,
    onlinePlayersList,
    playerNameValue,
    playerLevelValue,
    strengthValue,
    accuracyValue,
    magicValue,
    strengthBar,
    accuracyBar,
    magicBar,
  });

  return { ui, menuButton, attributesMenu, rankingButton, rankingMenu, playerNameValue, playerLevelValue, strengthValue, accuracyValue, magicValue, strengthBar, accuracyBar, magicBar };
}

test('o menu de atributos mostra nome e nível do jogador', () => {
  globalThis.window = { addEventListener() {} };
  const { ui, attributesMenu, playerNameValue, playerLevelValue, strengthValue, accuracyValue, magicValue } = createUiHarness();

  ui.updatePlayerIdentity({ nickname: 'Ari', level: 9, isAdmin: true });

  assert.equal(attributesMenu.dataset.playerNickname, 'Ari');
  assert.equal(attributesMenu.dataset.playerLevel, '9');
  assert.equal(playerNameValue.textContent, 'Ari');
  assert.equal(playerLevelValue.textContent, '9');
  assert.equal(strengthValue.textContent, '');
  assert.equal(accuracyValue.textContent, '');
  assert.equal(magicValue.textContent, '');
});

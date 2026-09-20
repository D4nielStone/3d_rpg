# Renderização

## Stack

A renderização principal usa Three.js sobre WebGL. O projeto monta a cena, a câmera, as luzes e os objetos 3D dentro de um sistema orientado a entidades.

## Arquivos principais

- `src/three-renderer.js` — renderização, câmera e objetos 3D
- `src/three-game-setup.js` — criação do mundo e integração com o loop
- `src/camera.js` — controle de câmera e orientação
- `src/components.js` — componentes visuais e de cena

## Pipeline

1. A cena é criada com `THREE.Scene`.
2. A câmera desloca o ponto de vista do jogador.
3. Entidades com `MeshRenderer` geram objetos visuais.
4. Sistemas atualizam posição, rotação e escala dos meshes.
5. O renderizador desenha os objetos por frame.

## Luzes e sombras

O renderizador configura:

- luz ambiente
- luz direcional ou pontual
- sombras em objetos ativos
- fog e background da cena

## Objetos visuais

Cada mesh recebe atributos como:

- geometria
- material
- textura
- flags de shadow
- transparência para efeitos especiais

## Observação

A renderização é desacoplada da lógica do jogo: o sistema visual apenas responde a componentes e transformações das entidades, sem decidir a regra do gameplay.

# Física

## Objetivo

A física centraliza no cliente a simulação de movimento, gravidade e colisão do jogador.

## Arquivos principais

- `server/world/physics.js` — implementação compartilhada da simulação física local
- `server/world/movement.js` — regras compartilhadas de deslocamento e movimento
- `shared/collision-shape.js` — formas de colisão compartilhadas
- `shared/player-size.js` — escala e dimensões do jogador

## Modelo

A simulação local usa um mundo de física com:

- gravidade
- formas geométricas como caixa, cápsula e trimesh
- corpos rígidos para entidades móveis
- contato com superfícies do cenário

## Movimento

O movimento do jogador é simulado no cliente a partir de um comando de direção e magnitude. O cliente envia ao relay apenas a transformação resultante para sincronização e persistência; o relay não executa a física do jogador.

## Colisão

A colisão é calculada em função da forma do objeto e das superfícies do mapa. O projeto combina:

- bounding shapes para objetos simples
- colisores em forma de caixa e cápsula

## Aplicação do projeto

A simulação mantém o jogador em um espaço 3D com atualização por passos fixos no navegador. O multiplayer sincroniza a transformação observada pelos outros clientes.

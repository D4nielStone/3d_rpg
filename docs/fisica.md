# Física

## Objetivo

A física centraliza a simulação de movimento, gravidade e colisão para manter a lógica consistente entre o cliente e o servidor.

## Arquivos principais

- `server/world/physics.js` — simulação do mundo físico
- `server/world/movement.js` — regras de deslocamento e movimento
- `shared/collision-shape.js` — formas de colisão compartilhadas
- `shared/player-size.js` — escala e dimensões do jogador

## Modelo

A simulação usa um mundo de física com:

- gravidade
- formas geométricas como caixa, cápsula e trimesh
- corpos rígidos para entidades móveis
- contato com superfícies do cenário

## Movimento

O movimento do jogador é tratado como um comando de direção e magnitude ao invés de coordenadas brutas do cliente. Isso evita que a entrada local seja confiável demais e permite que o servidor valide o resultado.

## Colisão

A colisão é calculada em função da forma do objeto e das superfícies do mapa. O projeto combina:

- bounding shapes para objetos simples
- colisores em forma de caixa e cápsula
- superfícies trianguladas para terreno e estruturas complexas

## Aplicação do projeto

A simulação mantém o jogador em um espaço 3D com atualização por passos fixos. Isso ajuda a reduzir inconsistências no multiplayer e facilita a sincronização entre clientes e servidor.

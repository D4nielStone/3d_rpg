# WebGL RPG

<img width="1298" height="653" alt="image" src="https://github.com/user-attachments/assets/5cf4b03b-adc8-4bc9-aaa5-5b1aa642b307" />

Jogo 3D de navegador com renderização em WebGL, ECS, física e multiplayer autoritativo. O projeto foi desenvolvido com auxílio de inteligência artificial como parte do processo de implementação e refinamento.

## Visão geral

- Mundo 3D em Three.js e WebGL
- Sistema ECS para entidades, componentes e consultas
- Física centralizada para colisão e movimento
- Multiplayer em relay WebSocket com autenticação e estado persistido
- Editor de mapa e configuração local

## Requisitos

- Node.js 18+
- Navegador moderno com suporte a WebGL

## Iniciar localmente

Instale as dependências:

```bash
npm install
```

Em Windows, se necessário:

```powershell
npm.cmd install
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

Ou no PowerShell:

```powershell
npm.cmd run dev
```

Acesse a URL mostrada pelo Vite, normalmente:

```text
http://localhost:5173/
```

## Build e preview

```bash
npm run build
npm run preview
```

## Multiplayer

Em um terminal:

```bash
npm run multiplayer
```

Em outro terminal:

```bash
npm run dev
```

## Documentação

- [docs/README.md](docs/README.md) — índice geral da documentação
- [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md) — configuração do ambiente e deploy
- [docs/ecs.md](docs/ecs.md) — arquitetura ECS
- [docs/fisica.md](docs/fisica.md) — física e colisão
- [docs/renderizacao.md](docs/renderizacao.md) — renderização e câmera
- [docs/multiplayer.md](docs/multiplayer.md) — servidor, autenticação e sincronização
- [docs/world-editor.md](docs/world-editor.md) — editor de mundos, cena e configuração do mapa

## Estrutura principal

```text
src/          Código do cliente e da lógica do jogo
server/       Relay multiplayer e lógica do backend
shared/       Regras comuns entre cliente e servidor
docs/         Documentação do projeto
```

## Observação sobre IA

Este projeto foi criado e iterado com ajuda de inteligência artificial para geração de estrutura, lógica e documentação. A arquitetura final foi revisada e ajustada para manter o código funcional e coerente com o objetivo do jogo.

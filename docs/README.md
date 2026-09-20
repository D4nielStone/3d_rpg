# Documentação do projeto

Este diretório reúne a documentação por categoria para facilitar a compreensão do jogo, da arquitetura e do fluxo de execução.

## Índice

### Fundamentos e arquitetura

- [ECS](./ecs.md) — entidades, componentes e consultas do sistema ECS
- [Física](./fisica.md) — colisão, gravidade, movimento e simulação
- [Renderização](./renderizacao.md) — Three.js, câmera, luzes e scene graph
- [Multiplayer](./multiplayer.md) — relay WebSocket, autenticação e sincronização
- [Editor de mundos](./world-editor.md) — edição de cena, terreno, entidades e configuração do mapa

### Operação e configuração

- [CONFIGURACAO](./CONFIGURACAO.md) — variáveis de ambiente, desenvolvimento local e deploy

## Visão geral do sistema

O projeto combina:

- cliente em JavaScript/Three.js para renderizar o mundo e a interface
- lógica de gameplay em componentes e sistemas
- servidor multiplayer com autenticação e persistência
- compartilhamento de regras entre cliente e servidor em `shared/`

A organização da documentação segue as principais áreas do projeto para manter a leitura direta e separada por responsabilidade.

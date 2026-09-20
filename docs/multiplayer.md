# Multiplayer

## Visão geral

O multiplayer é executado por um relay separado em `server/`, com comunicação por WebSocket. O servidor valida ações, mantém estado e distribui atualizações para os clientes.

## Arquivos principais

- `server/multiplayer.js` — entrada do servidor
- `server/player-store.js` — persistência de jogadores
- `server/auth.js` — autenticação e sessões
- `server/command-manager.js` — gestão de comandos do jogo
- `src/multiplayer.js` — cliente do lado do navegador

## Protocolo

O cliente envia comandos e o servidor processa a ação conforme as regras do jogo. Isso inclui:

- entrada do jogador
- ataques e ações de combate
- atualização do estado dos personagens
- eventos de chat e comunicação

## Autenticação e persistência

O projeto suporta:

- jogadores convidados com `guestId`
- jogadores autenticados por conta
- persistência em banco de dados
- restauração do estado ao reconectar

## Estado sincronizado

O servidor mantém informações como:

- vida e mana
- nível e experiência
- posição e rotação
- inventário e progressão
- ranking e presença online

## Benefícios

- lógica centralizada no servidor
- menos abuso de entrada do cliente
- estado consistente entre jogadores
- melhor base para extensão com regras de gameplay complexas

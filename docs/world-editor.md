# Editor de mundos

## Visão geral

O editor de mundos permite montar uma cena 3D do jogo, ajustar entidades, aplicar materiais, configurar iluminação e exportar a configuração como arquivo `.world` para uso no jogo.

## Acesso

O editor não fica disponível para qualquer jogador. Ele é liberado apenas para administradores por meio do comando `/map` no multiplayer.

Quando o comando é executado, o servidor gera um ticket de acesso temporário e abre a página `map-editor.html` com esse token na URL.

## Ponto de entrada

Os principais arquivos do editor são:

- `map-editor.html` — interface do editor
- `src/editor/map-editor.js` — inicialização e lógica principal
- `src/editor/editor-scene.js` — criação da cena e entidades
- `src/editor/editor-world.js` — gestão de mundo e estado
- `src/editor/editor-events.js` — eventos e interações 3D
- `src/editor/editor-dom.js` — renderização da UI do editor

## Interface principal

A tela do editor possui três blocos principais:

1. Painel de assets
   - importa modelos 3D
   - adiciona modelos por URL
   - define sons por canal
   - gerencia bibliotecas locais

2. Viewport 3D
   - seleciona objetos
   - move, rotaciona e escala entidades
   - navega com camera orbitante

3. Inspector
   - mostra a árvore da cena
   - lista entidades e áreas de inimigos
   - altera transform, colisão, material e luz
   - ajusta configuração geral do mundo
   - exporta ou importa JSON do cenário

## Modos de edição

O editor oferece modos de operação para manipular a cena:

- Selecionar
- Mover
- Rotacionar
- Escalar

Esses modos permitem editar de forma precisa a hierarquia e os valores transformados das entidades.

## Entidades e cenas

A cena pode conter:

- objetos vazios
- primitivas 3D: caixa, esfera, cilindro, cone, cápsula, plano
- modelos importados
- luzes pontuais
- áreas de inimigo
- entidades de player e configurações do mundo

Para cada entidade, o editor permite ajustar:

- posição
- rotação
- escala
- colisão
- material difuso
- textura
- recepção de luz e projeção de sombras
- animação, quando aplicável

## Áreas de inimigo e tipos

O editor também gerencia:

- tipos de inimigo
- áreas de spawn
- níveis e valores de combate
- modelos, drops, vida e velocidade

Essas configurações são essenciais para montar o equilíbrio do mapa e os encontros de combate.

## Sistema de iluminação e ambiente

No painel de configuração do mundo, é possível alterar:

- cor ambiente
- intensidade da luz ambiente
- direção e intensidade da luz principal
- cor do céu
- cor do nevoeiro
- distância do nevoeiro

Esses ajustes influenciam diretamente o mood visual do mapa.

## Exportação e importação

O editor disponibiliza:

- `Exportar .world` para salvar o mapa em JSON
- `Abrir .world` para carregar um mapa previamente criado
- `Aplicar no jogo` para levar a configuração atual para o estado do jogo
- `Limpar cena` para resetar a estrutura atual

Isso permite iterar rapidamente no design do nível sem precisar editar manualmente os arquivos de configuração.

## Fluxo de uso recomendado

1. Importa os assets do mapa.
2. Cria ou ajusta entidades e primitivas.
3. Define iluminação e ambiente.
4. Ajusta áreas de inimigo.
5. Exporta a cena em `.world`.
6. Aplica a configuração no jogo.

## Observação

O editor funciona como ferramenta de conteúdo e prototipagem do mundo, permitindo transformar rapidamente a estrutura do mapa em um cenário jogável sem mexer diretamente em código de geração manual.

# ECS

## Conceito

O projeto usa um modelo de ECS (Entity-Component-System), em que cada entidade é apenas um identificador numérico e a lógica é organizada em componentes e sistemas.

## Entidade

No núcleo do ECS, a classe `World` mantém um mapa de componentes por tipo e associa cada entidade aos componentes relevantes.

```js
const entity = world.createEntity();
world.addComponent(entity, new Transform());
world.addComponent(entity, meshRenderer);
```

A entidade não possui comportamento próprio; seu estado vem dos componentes e as regras de atualização vêm dos sistemas.

## Componentes

Componentes representam dados e não executam lógica de negócio. Exemplos do projeto incluem:

- `Transform`: posição, rotação e escala
- `MeshRenderer`: malha meshável e dados visuais
- `Texture`: textura associada ao objeto
- `PlayerHealthBar`, `EnemyIdentity`, `SwordRenderer` e outros elementos específicos do gameplay

## Sistemas

Os sistemas consultam entidades por tipos de componentes e executam as operações necessárias.

### Exemplo de consulta

```js
const entities = world.query(Transform, MeshRenderer);
```

Esse padrão permite que uma entidade seja atualizada se possuir os dados mínimos necessários para aquela tarefa.

## Fluxo no projeto

1. O mundo cria entidades para jogador, inimigos, itens e objetos do mapa.
2. Cada entidade recebe os componentes adequados.
3. Sistemas iteram sobre as entidades relevantes.
4. A renderização, a física, a IA e o multiplayer usam o mesmo modelo de dados.

## Vantagens

- baixo acoplamento entre dados e lógica
- fácil extensão do gameplay
- manutenção simples de sistemas específicos
- clareza para adicionar novos tipos de entidade

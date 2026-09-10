# Hoje, Agenda/Semana e Estatísticas — Design (Plano 3)

## Contexto e objetivo

Plano 3 do app "Rotina do Casal" (ver `docs/superpowers/specs/2026-08-12-app-rotina-casal-design.md` pro spec geral, Plano 1 e Plano 2 já implementados). Plano 2 entregou CRUD de categorias, CRUD de itens de rotina e o motor de recorrência (`src/lib/recurrence.ts`), mas nenhuma tela consome `item_completions` ainda — a listagem de itens é crua, sem agrupamento por dia nem conclusão. Plano 3 entrega as três telas de uso diário: **Hoje** (checklist do dia), **Agenda/Semana** (visão semanal) e **Estatísticas** (% de conclusão e streaks), junto com a camada de dados de conclusão que faltava.

## Escopo

**Dentro do Plano 3:**
- Nova policy de RLS liberando a leitura da categoria do parceiro quando ela é usada por um item compartilhado.
- API de conclusões (`item_completions`): marcar, desmarcar, listar por intervalo de datas.
- Motor de ocorrências combinado (`src/lib/occurrences.ts`): junta itens + recorrência + conclusões em uma lista de ocorrências prontas pra exibir.
- Tela **Hoje**: itens do dia (pessoais + compartilhados), agrupados por categoria, checkbox de conclusão própria, indicador de conclusão do parceiro em itens compartilhados. Substitui a rota `/` atual.
- Tela **Agenda/Semana**: lista por dia (domingo a sábado), navegável entre semanas, com o mesmo checkbox de conclusão do Hoje.
- Tela **Estatísticas**: % de conclusão por categoria e streak de dias cumpridos, do mês calendário atual, mostrando "Você" e "Parceiro" lado a lado.
- Testes unitários do motor de ocorrências e dos cálculos de estatística; teste de integração da nova policy de RLS de categorias.

**Fora do Plano 3** (fica pra planos futuros):
- Notificações push (Plano 4, já previsto no spec geral).
- Refinamento visual (ícones reais, animações, tema) — o objetivo aqui é funcional e testável, não a versão final de UI.
- Edição de itens a partir da Agenda (continua abrindo `ItemFormPage` via link, como hoje).

## Modelo de dados

Nenhuma tabela nova. `item_completions` já existe (migration `0001_init_schema.sql`, Plano 1) com RLS que já cobre o necessário:
- SELECT: própria conclusão, ou conclusão de qualquer pessoa em item `is_shared = true` visível ao usuário.
- INSERT/DELETE: só a própria (`user_id = auth.uid()`).

**Nova migration** (`0003_partner_shared_categories.sql`): adiciona uma policy de SELECT em `categories` liberando a categoria do parceiro quando ela é referenciada por um item compartilhado — mesmo padrão já usado em `routine_items` e `item_completions`, expondo o mínimo necessário.

```sql
create policy "select partner category used by shared item"
on categories for select
using (
  user_id = partner_id(auth.uid())
  and exists (
    select 1 from routine_items ri
    where ri.category_id = categories.id
      and ri.is_shared = true
  )
);
```

Isso corrige também uma lacuna já existente desde o Plano 2: `ItemsListPage.tsx` já lista itens compartilhados do parceiro (a RLS de `routine_items` sempre permitiu), mas `categoryName()` cai em `'—'` porque a categoria correspondente nunca era visível. Essa lacuna passa a ser resolvida como parte deste plano, não é um novo requisito.

## Camada de dados

### `src/features/completions/completionsApi.ts`

```ts
export type ItemCompletion = {
  id: string
  routine_item_id: string
  user_id: string
  data: string // ISO date
  completed_at: string
}

export async function listCompletions(startDate: string, endDate: string): Promise<ItemCompletion[]>
export async function markComplete(userId: string, routineItemId: string, date: string): Promise<void>
export async function unmarkComplete(routineItemId: string, date: string): Promise<void>
```

- `listCompletions`: `select('*').gte('data', startDate).lte('data', endDate)` — sem filtro de `user_id` no client, a RLS já retorna só o que é visível (próprias + parceiro em compartilhados).
- `markComplete`: insere `{ user_id: userId, routine_item_id: routineItemId, data: date }`. Erro de violação de unicidade (`23505`, já marcado antes) é tratado como sucesso silencioso, não propagado como erro — evita corrida caso o usuário clique duas vezes rápido.
- `unmarkComplete`: `delete().eq('routine_item_id', routineItemId).eq('data', date)` — RLS restringe implicitamente a `auth.uid()`, então só apaga a própria conclusão mesmo que o item seja compartilhado.

### `src/lib/occurrences.ts`

Módulo puro (sem chamada de rede), consumido pelas telas Hoje e Agenda:

```ts
export type Occurrence = {
  item: RoutineItem
  date: string // ISO date
  ownCompletion: boolean
  partnerCompletion: boolean // sempre false se !item.is_shared
}

export function buildOccurrences(
  items: RoutineItem[],
  completions: ItemCompletion[],
  currentUserId: string,
  rangeStart: string,
  rangeEnd: string,
): Occurrence[]
```

Para cada item, chama `getOccurrencesInRange` (já existente em `recurrence.ts`) para obter as datas no intervalo, e cruza com `completions` filtrando por `routine_item_id` + `data` para achar `ownCompletion` (`user_id === currentUserId`) e `partnerCompletion` (`user_id !== currentUserId`, só relevante se `is_shared`). Resultado ordenado por `date`, depois por `horario` do item.

## Tela Hoje

`src/features/today/TodayPage.tsx` — assume a rota `/` (substitui o componente `Home` inline atual de `App.tsx`).

- Carrega em paralelo: `listItems()`, `listCategories()`, `listCompletions(hoje, hoje)`.
- Chama `buildOccurrences(items, completions, user.id, hoje, hoje)`.
- Agrupa as ocorrências por `category_id`, exibindo nome + cor da categoria como cabeçalho de grupo (resolvida via `listCategories()`, que agora também retorna a categoria do parceiro quando aplicável, graças à nova policy).
- Dentro de cada grupo, ordenado por `horario`. Cada linha usa o componente compartilhado `OccurrenceRow` (ver abaixo).
- Estado de loading/erro segue o padrão de `ItemsListPage` (`useState` + `role="alert"`).
- Link de navegação para "Agenda" e "Estatísticas" adicionados ao lugar do antigo `Home`.

### `OccurrenceRow` (compartilhado entre Hoje e Agenda)

`src/features/occurrences/OccurrenceRow.tsx` — recebe uma `Occurrence` e um callback `onToggle(occurrence)`:
- Checkbox "você": estado = `ownCompletion`; ao marcar chama `markComplete`, ao desmarcar chama `unmarkComplete`, depois recarrega os dados da tela pai (sem estado otimista nesta primeira versão — consistente com o padrão simples já usado no resto do app).
- Se `item.is_shared`, mostra um indicador somente-leitura ao lado (`✓` ou `–`) refletindo `partnerCompletion`, sem interação.
- Exibe título, horário e (se presente) a descrição curta de recorrência reaproveitando `describeRecurrence` (movida de `ItemsListPage.tsx` para um util compartilhado, já que Hoje/Agenda/ItemsListPage todas precisam dela).

## Tela Agenda/Semana

`src/features/agenda/AgendaPage.tsx` — rota `/agenda`, atrás de `ProtectedRoute`, link novo na navegação.

- Estado local `weekStart` (ISO date de um domingo), inicializado no domingo da semana atual.
- Botões "← Semana anterior" / "Semana atual" / "Próxima semana →" ajustam `weekStart` em ±7 dias ou resetam pro domingo corrente.
- Carrega `listItems()`, `listCategories()`, `listCompletions(weekStart, weekStart+6)` sempre que `weekStart` muda.
- Chama `buildOccurrences(...)` para o intervalo da semana.
- Renderiza uma seção por dia (Dom, Seg, Ter, Qua, Qui, Sex, Sáb) com a data por extenso; dentro de cada seção, a lista de `OccurrenceRow` daquele dia (mesmo componente do Hoje). Dia sem ocorrências mostra uma linha "Nada programado".

## Tela Estatísticas

`src/features/stats/StatsPage.tsx` — rota `/estatisticas`, atrás de `ProtectedRoute`, link novo na navegação.

- Intervalo fixo: do dia 1 do mês corrente até hoje (mês calendário, não janela rolante).
- Carrega `listItems()`, `listCategories()`, `listCompletions(inicioMes, hoje)`, chama `buildOccurrences(...)`.
- Toda a agregação roda em `src/lib/stats.ts`, módulo puro sem I/O:

```ts
export function computeCategoryStats(
  occurrences: Occurrence[],
  categories: Category[],
  currentUserId: string,
): { categoryId: string; nome: string; cor: string; done: number; total: number }[]

export function computeStreak(
  occurrences: Occurrence[],
  scope: 'own' | 'partner-shared',
): number
```

- `computeCategoryStats`: considera todas as ocorrências visíveis ao usuário (pessoais + compartilhadas), agrupadas por `category_id`; `done` conta `ownCompletion === true`.
- `computeStreak` com `scope: 'own'`: percorre os dias do intervalo do mais recente ao mais antigo; um dia com zero ocorrências é pulado (não conta nem quebra); um dia com ocorrências onde todas têm `ownCompletion === true` estende o streak; um dia com qualquer ocorrência pendente encerra a contagem.
- `computeStreak` com `scope: 'partner-shared'`: mesmo algoritmo, mas filtrando `occurrences` para `item.is_shared === true` antes, e usando `partnerCompletion` no lugar de `ownCompletion` — é o único dado do parceiro visível via RLS (itens pessoais dele nunca aparecem em `occurrences`).
- A tela renderiza duas colunas/blocos: "Você" (categoria stats + streak `own`) e "Parceiro" (streak `partner-shared` apenas — sem % por categoria do parceiro, já que não há como isolar as categorias pessoais dele das compartilhadas de forma significativa com os dados visíveis).

## Testes

**Unitários** (Vitest, sem Supabase):
- `occurrences.test.ts`: item pessoal com/sem conclusão; item compartilhado com conclusão própria só; com conclusão do parceiro só; com ambas; item compartilhado sem nenhuma conclusão.
- `stats.test.ts`: `computeCategoryStats` com múltiplas categorias e itens mistos pessoais/compartilhados; `computeStreak` cobrindo dia neutro (sem ocorrência) mantendo o streak, dia quebrando o streak, streak mantido por vários dias, e o escopo `partner-shared` ignorando itens pessoais.

**Integração** (`tests/integration/rls.test.ts`, mesmo arquivo do Plano 2):
- Usuário A não vê a categoria pessoal de B mesmo pareados, a menos que B tenha um item compartilhado usando essa categoria — nesse caso A consegue ler só essa categoria específica, não as demais de B.

## Erros e casos de borda

- `markComplete` chamado duas vezes seguidas (clique duplo) não deve gerar erro visível — tratado via catch de violação de unicidade dentro da própria API, como descrito acima.
- Item com `recurrence_end` já vencido não gera ocorrências fora do intervalo — comportamento já garantido por `getOccurrencesInRange`, sem mudança necessária aqui.
- Categoria do parceiro exibida em Hoje/Agenda é somente leitura (sem link de edição) — o usuário não pode editar uma categoria que não é sua, mesmo enxergando nome/cor.
- Exclusão de um item de rotina (via `ItemFormPage`, fora deste plano) não precisa limpar `item_completions` manualmente — `routine_item_id` referencia `routine_items(id) on delete cascade` desde o Plano 1.

## Fora deste documento

Otimização de performance (cache de ocorrências, paginação) fica pra quando o histórico de dados justificar — hoje o volume é de duas pessoas, então buscar tudo e computar no client é suficiente, seguindo a mesma convenção do resto do app.

# Categorias, Itens de Rotina e Motor de Recorrência — Design (Plano 2)

## Contexto e objetivo

Plano 2 do app "Rotina do Casal" (ver `docs/superpowers/specs/2026-08-12-app-rotina-casal-design.md` pro spec geral e `docs/superpowers/plans/2026-08-12-app-rotina-casal-foundation.md` pro Plano 1, já implementado). Plano 1 entregou auth, pareamento de casal e o schema completo (categories, routine_items, item_completions, push_subscriptions, couples com RLS). Plano 2 entrega o CRUD de categorias, o CRUD de itens de rotina (com definição de recorrência) e o motor de cálculo de ocorrências — sem as telas de visualização do dia a dia (Hoje/Agenda/Estatísticas), que ficam pro Plano 3.

## Escopo

**Dentro do Plano 2:**
- Seed automático das 4 categorias padrão (Treino/Saúde, Estudos, Trabalho, Lazer) pra toda conta nova — pendência deixada em aberto pelo Plano 1 (ver seção "Known gaps" no plano de fundação).
- CRUD de categorias (nome, cor, ícone).
- CRUD de itens de rotina, incluindo definição de recorrência (diária, dias específicos da semana, intervalo semanal/mensal, evento único) e condição de término (data-fim, nº de repetições, ou nunca).
- Motor de recorrência: funções puras que calculam ocorrências a partir de uma regra — sem UI de calendário ainda.
- Uma listagem crua de itens (sem agrupamento visual por data/categoria) só pra permitir editar/excluir o que foi criado.
- Cobertura de teste de integração para as lacunas de RLS identificadas na revisão final do Plano 1 (parceiro não pode editar item pessoal não-compartilhado de outro; usuário não vê categoria de outro).

**Fora do Plano 2** (fica pro Plano 3, "Hoje/Agenda/Estatísticas"):
- Tela "Hoje" com itens do dia agrupados por categoria, checkbox de conclusão.
- Tela "Agenda/Semana" com visão de calendário.
- Tela "Estatísticas" (% conclusão, streaks).
- Qualquer UI que consuma `item_completions`.

**Fora de escopo geral** (já registrado no spec original): notificações push (essenciais mas tratadas em plano futuro dedicado), edição colaborativa em tempo real, múltiplos casais por conta.

## Modelo de dados

Nenhuma tabela nova. `categories` e `routine_items` já existem (migration `0001_init_schema.sql`, Plano 1) com RLS correta:
- `categories`: visível/editável só pelo dono (`user_id = auth.uid()`).
- `routine_items`: visível/editável pelo dono, ou pelo parceiro se `is_shared = true`.

**Nova migration** (`0002_default_categories_seed.sql`): function `SECURITY DEFINER` + trigger `AFTER INSERT ON auth.users` que insere as 4 categorias padrão para o novo usuário. Roda no banco (não no cliente) pra garantir que aconteça mesmo se o app fechar no meio do cadastro.

```sql
create or replace function seed_default_categories()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.categories (user_id, nome, cor, icone) values
    (new.id, 'Treino/Saúde', '#22c55e', 'dumbbell'),
    (new.id, 'Estudos', '#3b82f6', 'book'),
    (new.id, 'Trabalho', '#f59e0b', 'briefcase'),
    (new.id, 'Lazer', '#a855f7', 'smile');
  return new;
end;
$$;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function seed_default_categories();
```

Cores e nomes de ícone acima são placeholders razoáveis — ajustáveis na implementação sem mudar o design.

## Motor de recorrência

Módulo `src/lib/recurrence.ts`, sem dependência de UI, banco, ou bibliotecas externas — só lógica de datas em TypeScript puro.

```ts
export type RecurrenceRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] }  // 0=domingo .. 6=sábado; interval em semanas (1 = toda semana, 2 = a cada 2 semanas)
  | { type: 'monthly'; dayOfMonth: number }                     // 1..31

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'date'; value: string }    // ISO date (YYYY-MM-DD), inclusive
  | { type: 'count'; value: number }   // número de ocorrências, contando a partir de startDate

export function isOccurrence(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  checkDate: string,
): boolean

export function getOccurrencesInRange(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  rangeStart: string,
  rangeEnd: string,
): string[]  // datas ISO, ordenadas
```

Regras:
- `startDate` (vem de `routine_items.data_inicio`) é sempre a primeira ocorrência possível — nenhuma regra gera datas antes dela.
- `once`: uma única ocorrência, em `startDate`. `end` é ignorado (sempre tratado como `{ type: 'count', value: 1 }` na prática).
- `daily`: uma ocorrência por dia a partir de `startDate`.
- `weekly`: ocorre nos dias de `daysOfWeek`, respeitando o intervalo de semanas (`interval`) contado a partir da semana de `startDate`.
- `monthly`: ocorre no dia `dayOfMonth` de cada mês a partir de `startDate`. Se o mês não tiver esse dia (ex: dia 31 em fevereiro), a ocorrência daquele mês é pulada — não desliza pro último dia disponível.
- Condição de fim aplicada depois de gerar candidatas por data: `date` corta tudo após `value` (inclusive); `count` corta após a n-ésima ocorrência.

Persistência: `routine_items.recurrence_rule` (jsonb) guarda o `RecurrenceRule` serializado direto; `routine_items.recurrence_end` (jsonb) guarda o `RecurrenceEnd`. Nenhuma validação de schema JSON no banco — a validação de forma acontece no cliente (tipos TypeScript) antes do insert/update.

**Testes**: unitários puros cobrindo os 4 tipos de regra × as 3 condições de fim, incluindo casos de borda (dia 31 em mês curto, `count` = 1, `date` igual a `startDate`).

## Categorias — CRUD

`src/features/categories/`
- `categoriesApi.ts`: `listCategories()`, `createCategory(input)`, `updateCategory(id, input)`, `deleteCategory(id)` — todas operando via `supabase.from('categories')`, escopadas implicitamente pela RLS existente.
- `CategoriesPage.tsx`: lista as categorias do usuário logado; formulário inline (nome, cor via `<input type="color">`, ícone via `<select>` com uma lista curta e fixa de nomes) pra criar e editar; botão excluir com confirmação simples.
- Rota: `/categories`, atrás de `ProtectedRoute`.

Sem exclusão em cascata especial além do que o banco já faz (`routine_items.category_id` referencia `categories(id) on delete cascade` — excluir uma categoria excluiria os itens dela. Isso já está na migration do Plano 1; o Plano 2 não muda esse comportamento, mas a UI de exclusão deve avisar o usuário disso antes de confirmar).

## Itens de rotina — CRUD

`src/features/items/`
- `itemsApi.ts`: `listItems()` (retorna itens próprios + compartilhados do parceiro, via RLS), `createItem(input)`, `updateItem(id, input)`, `deleteItem(id)`.
- `ItemFormPage.tsx`: formulário único de criar/editar — título, categoria (select vindo de `listCategories`), notas, prioridade (alta/média/baixa), data de início, horário, seletor de tipo de recorrência com campos condicionais (dias da semana + intervalo pra `weekly`, dia do mês pra `monthly`), condição de fim (nunca / até data / nº de repetições), toggle "compartilhar com [nome do parceiro]" (visível só se o usuário já estiver pareado).
- `ItemsListPage.tsx`: lista crua — título, categoria (nome/cor), data/horário, recorrência resumida em texto (ex: "toda segunda e quarta"), links editar/excluir. Sem agrupamento por dia nem indicação de conclusão (isso é Plano 3, que consome `item_completions`).
- Rotas: `/items` (lista), `/items/new`, `/items/:id/edit`, todas atrás de `ProtectedRoute`.

`is_shared` só pode ser ativado se o usuário já tiver um parceiro pareado (`useAuth()` + checagem de `couples`); a UI esconde o toggle caso contrário, evitando um estado inconsistente (item marcado como compartilhado sem parceiro pra compartilhar).

## Testes de integração (fechando lacuna do Plano 1)

A revisão final do Plano 1 apontou que a suíte de RLS não cobria os casos negativos. O Plano 2 adiciona a `tests/integration/rls.test.ts` (ou um novo arquivo no mesmo padrão):
- Parceiro não consegue editar/excluir um item pessoal (`is_shared = false`) de outro usuário, mesmo estando pareado.
- Usuário não vê nem edita categoria de outro usuário (pareado ou não — categorias nunca são compartilhadas).

## Erros e casos de borda

- Formulário de item: validação client-side básica (título obrigatório, data/horário obrigatórios, `dayOfMonth`/`daysOfWeek` obrigatórios conforme o tipo escolhido) antes de chamar `createItem`/`updateItem`. Erros do Supabase (rede, RLS) exibidos via `role="alert"`, seguindo o padrão já usado em `CoupleSetupPage`.
- Exclusão de categoria com itens vinculados: aviso explícito no confirm ("Isso também vai excluir os N itens dessa categoria") antes de excluir, dado o `on delete cascade`.

## Fora deste documento

Ícones reais (biblioteca de ícones, se houver) e o refinamento visual das listas ficam para quando as telas de Plano 3 (Hoje/Agenda) forem desenhadas — o objetivo aqui é ter CRUD funcional e testável, não a versão final de UI.

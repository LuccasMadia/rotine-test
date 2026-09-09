# Categorias, Itens de Rotina e Motor de Recorrência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver CRUD for categories and routine items, a pure recurrence-calculation engine, and the default-categories seed that Plan 1 deferred — so a logged-in, paired user can manage their categories and create/edit recurring or one-off routine items.

**Architecture:** Same stack as Plan 1 (React + TypeScript + Vite PWA, Supabase Postgres/Auth/RLS). No new tables — `categories` and `routine_items` already exist with correct RLS from Plan 1's migration. One small additive migration adds a `SECURITY DEFINER` trigger that seeds 4 default categories on signup and fixes `routine_items.recurrence_rule`'s default to match this plan's rule shape. The recurrence engine is hand-rolled TypeScript (no new dependency) that turns a `recurrence_rule`/`recurrence_end` pair into concrete occurrence dates — used only by unit tests in this plan; Plan 3's Hoje/Agenda screens will be its first real consumer.

**Tech Stack:** React 18, TypeScript, Vite, Supabase JS v2 (already installed), Vitest, @testing-library/react (unchanged from Plan 1 — no new npm dependencies in this plan).

This is **Plan 2 of 4** for the full spec (`docs/superpowers/specs/2026-08-12-app-rotina-casal-design.md`). Design doc for this plan: `docs/superpowers/specs/2026-09-09-categories-items-recurrence-design.md`. Plan 1 (foundation: auth, couple pairing, schema) is complete. Plan 3 (Hoje/Agenda/Estatísticas screens, consuming `item_completions`) and Plan 4 (push notifications) are not yet written.

## Global Constraints

- Cada conta nova recebe 4 categorias padrão: Treino/Saúde, Estudos, Trabalho, Lazer — seed via trigger no banco (`SECURITY DEFINER` em `auth.users`), não no cliente, pra garantir que aconteça mesmo se o app fechar no meio do cadastro.
- Categorias são customizáveis por usuário: usuário pode criar, editar e remover livremente. Categorias nunca são compartilhadas entre parceiros.
- Recorrência de itens precisa suportar: diária, dias específicos da semana, intervalo semanal (ex: a cada 2 semanas), mensal (dia fixo do mês), evento único — com limite por data-fim ou por número de repetições.
- Motor de recorrência é código próprio (funções TypeScript puras, sem banco, sem UI), sem biblioteca externa nova.
- Itens com `is_shared = true` são editáveis/excluíveis por qualquer um dos dois parceiros; itens pessoais só pelo dono — já garantido pela RLS existente (`0001_init_schema.sql`), este plano não altera essa policy, só adiciona testes de integração pra cobrir os casos negativos.
- `item_completions` não é tocado neste plano — fica pro Plano 3.
- Sem telas de Hoje/Agenda/Estatísticas neste plano — só CRUD e uma listagem crua pra edição.
- Backend continua Supabase (Postgres + Auth + RLS), tudo em camada gratuita.
- Toggle "compartilhar com o parceiro" só aparece no formulário de item se o usuário já estiver pareado (via `couples`).

---

## File Structure

```
Rotinas/
  supabase/migrations/0002_default_categories_seed.sql
  src/
    lib/
      recurrence.ts, recurrence.test.ts
    features/
      couple/
        coupleApi.ts (modified: + getPartnerId)
        coupleApi.test.ts (modified: + getPartnerId test)
      categories/
        categoriesApi.ts, categoriesApi.test.ts
        CategoriesPage.tsx
      items/
        itemsApi.ts, itemsApi.test.ts
        ItemFormPage.tsx
        ItemsListPage.tsx
    App.tsx (modified: routes for /categories, /items, /items/new, /items/:id/edit + Home nav links)
  tests/integration/
    categories-seed.test.ts
    rls.test.ts (modified: + 2 negative-path RLS tests)
```

---

### Task 1: Recurrence engine (pure functions)

**Files:**
- Create: `src/lib/recurrence.ts`
- Test: `src/lib/recurrence.test.ts`

**Interfaces:**
- Produces: `RecurrenceRule` (`'once' | 'daily' | 'weekly' | 'monthly'` discriminated union), `RecurrenceEnd` (`'never' | 'date' | 'count'` discriminated union), `isOccurrence(rule, end, startDate, checkDate): boolean`, `getOccurrencesInRange(rule, end, startDate, rangeStart, rangeEnd): string[]`. All dates are ISO `YYYY-MM-DD` strings. Consumed by Task 5 (`itemsApi.ts`) and Task 6 (`ItemFormPage.tsx`) for typing, and by Plan 3 for actually computing what to show on a given day.

- [ ] **Step 1: Write the failing tests**

`src/lib/recurrence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getOccurrencesInRange, isOccurrence, type RecurrenceEnd, type RecurrenceRule } from './recurrence'

const NEVER: RecurrenceEnd = { type: 'never' }

describe('recurrence: once', () => {
  const rule: RecurrenceRule = { type: 'once' }

  it('occurs only on the start date', () => {
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-01')).toBe(true)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-02')).toBe(false)
  })

  it('getOccurrencesInRange returns only the start date when in range', () => {
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
    ])
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-02', '2026-01-10')).toEqual([])
  })
})

describe('recurrence: daily', () => {
  const rule: RecurrenceRule = { type: 'daily' }

  it('occurs every day from the start date onward, never before', () => {
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2025-12-31')).toBe(false)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-01')).toBe(true)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-06-15')).toBe(true)
  })

  it('getOccurrencesInRange returns every date in range', () => {
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })
})

describe('recurrence: weekly', () => {
  it('occurs on the chosen weekdays every week when interval is 1', () => {
    const rule: RecurrenceRule = { type: 'weekly', interval: 1, daysOfWeek: [1, 3] } // Mon, Wed
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-05', '2026-01-18')).toEqual([
      '2026-01-05',
      '2026-01-07',
      '2026-01-12',
      '2026-01-14',
    ])
  })

  it('skips weeks according to the interval', () => {
    const rule: RecurrenceRule = { type: 'weekly', interval: 2, daysOfWeek: [1] } // Mon, every 2 weeks
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-05', '2026-01-26')).toEqual([
      '2026-01-05',
      '2026-01-19',
    ])
  })
})

describe('recurrence: monthly', () => {
  it('occurs on the chosen day of every month, skipping months without that day', () => {
    const rule: RecurrenceRule = { type: 'monthly', dayOfMonth: 31 }
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-03-31',
    ])
  })

  it('occurs on the same day every month when the day exists in all of them', () => {
    const rule: RecurrenceRule = { type: 'monthly', dayOfMonth: 5 }
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ])
  })
})

describe('recurrence: end conditions', () => {
  const rule: RecurrenceRule = { type: 'daily' }

  it('stops after the end date, inclusive', () => {
    const end: RecurrenceEnd = { type: 'date', value: '2026-01-03' }
    expect(getOccurrencesInRange(rule, end, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('stops after the given number of occurrences', () => {
    const end: RecurrenceEnd = { type: 'count', value: 2 }
    expect(isOccurrence(rule, end, '2026-01-01', '2026-01-02')).toBe(true)
    expect(isOccurrence(rule, end, '2026-01-01', '2026-01-03')).toBe(false)
    expect(getOccurrencesInRange(rule, end, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
      '2026-01-02',
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- recurrence`
Expected: FAIL — `Cannot find module './recurrence'` (file doesn't exist yet).

- [ ] **Step 3: Implement `recurrence.ts`**

`src/lib/recurrence.ts`:

```ts
export type RecurrenceRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] } // 0=domingo..6=sábado; interval em semanas
  | { type: 'monthly'; dayOfMonth: number } // 1..31

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'date'; value: string } // ISO date (YYYY-MM-DD), inclusive
  | { type: 'count'; value: number } // número de ocorrências, contando a partir de startDate

function parseISODate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const date = parseISODate(dateStr)
  date.setUTCDate(date.getUTCDate() + days)
  return formatISODate(date)
}

function dayOfWeek(dateStr: string): number {
  return parseISODate(dateStr).getUTCDay()
}

function dayOfMonth(dateStr: string): number {
  return parseISODate(dateStr).getUTCDate()
}

function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr))
}

function weeksBetween(fromSunday: string, toSunday: string): number {
  const days = Math.round(
    (parseISODate(toSunday).getTime() - parseISODate(fromSunday).getTime()) / 86_400_000,
  )
  return days / 7
}

function isMatchingDate(rule: RecurrenceRule, startDate: string, dateStr: string): boolean {
  if (dateStr < startDate) return false

  switch (rule.type) {
    case 'once':
      return dateStr === startDate
    case 'daily':
      return true
    case 'weekly': {
      if (!rule.daysOfWeek.includes(dayOfWeek(dateStr))) return false
      const weeks = weeksBetween(startOfWeek(startDate), startOfWeek(dateStr))
      return weeks % rule.interval === 0
    }
    case 'monthly':
      return dayOfMonth(dateStr) === rule.dayOfMonth
    default:
      return false
  }
}

export function getOccurrencesInRange(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const result: string[] = []
  let count = 0
  let dateStr = startDate

  while (dateStr <= rangeEnd) {
    if (end.type === 'date' && dateStr > end.value) break

    if (isMatchingDate(rule, startDate, dateStr)) {
      count += 1
      if (end.type === 'count' && count > end.value) break
      if (dateStr >= rangeStart) result.push(dateStr)
    }

    dateStr = addDays(dateStr, 1)
  }

  return result
}

export function isOccurrence(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  checkDate: string,
): boolean {
  if (checkDate < startDate) return false
  return getOccurrencesInRange(rule, end, startDate, checkDate, checkDate).length > 0
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- recurrence`
Expected: all `recurrence` suites PASS (11 tests across the 5 describe blocks above).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat: add pure recurrence calculation engine"
```

---

### Task 2: Default categories seed migration

**Files:**
- Create: `supabase/migrations/0002_default_categories_seed.sql`
- Test: `tests/integration/categories-seed.test.ts`

**Interfaces:**
- Produces: every new `auth.users` row automatically gets 4 rows in `categories` (Treino/Saúde, Estudos, Trabalho, Lazer). No new client-facing function — this is a DB-side effect. Also fixes `routine_items.recurrence_rule`'s column default to `{"type":"once"}` so it matches Task 1's `RecurrenceRule` shape (Plan 1 left it as the placeholder `{"type":"none"}`, which no task ever wrote — harmless in practice since Task 5's `createItem` always sets `recurrence_rule` explicitly, but worth fixing for consistency).

**Prerequisite:** Same hosted Supabase project from Plan 1. Requires manual application via the SQL Editor (no local Docker stack, matching Plan 1 Task 3's approach).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_default_categories_seed.sql`:

```sql
-- Fix recurrence_rule default to match the app's RecurrenceRule shape.
alter table routine_items
  alter column recurrence_rule set default '{"type":"once"}'::jsonb;

-- Seed 4 default categories for every new auth user.
create or replace function seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
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

- [ ] **Step 2: Apply the migration via the Supabase SQL Editor**

In the project dashboard (same project from Plan 1), open SQL Editor → New query, paste the full contents of `supabase/migrations/0002_default_categories_seed.sql`, and run it.
Expected: "Success. No rows returned". Confirm in Table Editor → `routine_items` that the `recurrence_rule` column's default now shows `{"type": "once"}`.

- [ ] **Step 3: Write the integration test**

`tests/integration/categories-seed.test.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

describe('default categories seed', () => {
  it('gives a new user exactly the 4 default categories', async () => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ts = Date.now()
    const { error } = await client.auth.signUp({
      email: `luccasmadia07+seed-${ts}@gmail.com`,
      password: 'password123',
    })
    if (error) throw error

    const { data: categories, error: catError } = await client.from('categories').select('nome')
    if (catError) throw catError

    expect(categories).toHaveLength(4)
    expect(categories?.map((c) => c.nome).sort()).toEqual([
      'Estudos',
      'Lazer',
      'Trabalho',
      'Treino/Saúde',
    ])
  })
})
```

- [ ] **Step 4: Run the integration test against the hosted project**

Run: `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npm run test:integration`
Expected: `default categories seed > gives a new user exactly the 4 default categories` PASS, alongside the existing `rls` suites.

Afterwards, in Table Editor, delete the test row created in `auth.users` (email containing `+seed-`) so it doesn't linger in the real project.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_default_categories_seed.sql tests/integration/categories-seed.test.ts
git commit -m "feat: seed 4 default categories for every new account"
```

---

### Task 3: Categories API

**Files:**
- Create: `src/features/categories/categoriesApi.ts`
- Test: `src/features/categories/categoriesApi.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.ts`.
- Produces: `Category` type (`{ id, user_id, nome, cor, icone, created_at }`), `CategoryInput` type (`{ nome, cor, icone }`), `listCategories(): Promise<Category[]>`, `createCategory(userId, input): Promise<Category>`, `updateCategory(id, input): Promise<Category>`, `deleteCategory(id): Promise<void>`. Consumed by Task 4 (`CategoriesPage.tsx`), Task 6 (`ItemFormPage.tsx`, for the category select), and Task 7 (`ItemsListPage.tsx`, to display category names).

- [ ] **Step 1: Write the failing tests**

`src/features/categories/categoriesApi.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createCategory, deleteCategory, listCategories, updateCategory } from './categoriesApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const order = vi.fn().mockResolvedValue({
    data: [
      { id: 'cat-1', user_id: 'user-a', nome: 'Estudos', cor: '#000', icone: 'book', created_at: '2026-01-01' },
    ],
    error: null,
  })
  const select = vi.fn().mockReturnValue({ order })

  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: 'cat-2', user_id: 'user-a', nome: 'Nova', cor: '#111', icone: 'star', created_at: '2026-01-02' },
    error: null,
  })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateSingle = vi.fn().mockResolvedValue({
    data: { id: 'cat-1', user_id: 'user-a', nome: 'Editada', cor: '#222', icone: 'heart', created_at: '2026-01-01' },
    error: null,
  })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })

  const from = vi.fn().mockReturnValue({ select, insert, update, delete: del })
  return { supabase: { from } }
})

describe('categoriesApi', () => {
  it('listCategories returns categories ordered by name', async () => {
    const result = await listCategories()
    expect(supabase.from).toHaveBeenCalledWith('categories')
    expect(result).toHaveLength(1)
    expect(result[0].nome).toBe('Estudos')
  })

  it('createCategory inserts a category for the given user', async () => {
    const result = await createCategory('user-a', { nome: 'Nova', cor: '#111', icone: 'star' })
    expect(result.nome).toBe('Nova')
  })

  it('updateCategory updates the category matching the id', async () => {
    const result = await updateCategory('cat-1', { nome: 'Editada', cor: '#222', icone: 'heart' })
    expect(result.nome).toBe('Editada')
  })

  it('deleteCategory removes the category matching the id', async () => {
    await expect(deleteCategory('cat-1')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- categoriesApi`
Expected: FAIL — `Cannot find module './categoriesApi'`.

- [ ] **Step 3: Implement `categoriesApi.ts`**

`src/features/categories/categoriesApi.ts`:

```ts
import { supabase } from '../../lib/supabaseClient'

export type Category = {
  id: string
  user_id: string
  nome: string
  cor: string
  icone: string
  created_at: string
}

export type CategoryInput = {
  nome: string
  cor: string
  icone: string
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nome')
  if (error) throw error
  return data
}

export async function createCategory(userId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- categoriesApi`
Expected: all 4 `categoriesApi` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/categories/categoriesApi.ts src/features/categories/categoriesApi.test.ts
git commit -m "feat: add categories CRUD API"
```

---

### Task 4: Categories page + route

**Files:**
- Create: `src/features/categories/CategoriesPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `Category` from `./categoriesApi` (Task 3); `useAuth()` from `../auth/AuthContext`.
- Produces: `/categories` route, reachable from a "Categorias" link on the home page. No exported functions consumed by later tasks (Tasks 6/7 import `categoriesApi` directly, not this component).

No dedicated test for this component, matching this project's existing convention (Plan 1's `CoupleSetupPage.tsx` also has no render test — page components are covered by manual verification, their API modules are covered by unit tests).

- [ ] **Step 1: Implement `CategoriesPage.tsx`**

`src/features/categories/CategoriesPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from './categoriesApi'

const ICON_OPTIONS = ['circle', 'dumbbell', 'book', 'briefcase', 'smile', 'heart', 'star', 'home']

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#6366f1')
  const [icone, setIcone] = useState(ICON_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      setCategories(await listCategories())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setNome(category.nome)
    setCor(category.cor)
    setIcone(category.icone)
  }

  function resetForm() {
    setEditingId(null)
    setNome('')
    setCor('#6366f1')
    setIcone(ICON_OPTIONS[0])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    try {
      if (editingId) {
        await updateCategory(editingId, { nome, cor, icone })
      } else {
        await createCategory(user.id, { nome, cor, icone })
      }
      resetForm()
      await loadCategories()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      'Excluir esta categoria também vai excluir todos os itens de rotina vinculados a ela. Confirmar?',
    )
    if (!confirmed) return
    setError(null)
    try {
      await deleteCategory(id)
      await loadCategories()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>Categorias</h1>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span style={{ color: category.cor }}>{category.icone}</span> {category.nome}
            <button onClick={() => startEdit(category)}>Editar</button>
            <button onClick={() => handleDelete(category.id)}>Excluir</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} />
        <select value={icone} onChange={(e) => setIcone(e.target.value)}>
          {ICON_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button type="submit">{editingId ? 'Salvar' : 'Adicionar'}</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancelar
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route into `App.tsx`**

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'

function Home() {
  return (
    <div>
      <h1>Rotina do Casal</h1>
      <nav>
        <Link to="/categories">Categorias</Link>
      </nav>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/couple-setup"
            element={
              <ProtectedRoute>
                <CoupleSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all suites PASS (unaffected by this UI-only change — `App.test.tsx` only exercises the unauthenticated `/login` redirect, which doesn't touch `Home` or `/categories`).

- [ ] **Step 4: Commit**

```bash
git add src/features/categories/CategoriesPage.tsx src/App.tsx
git commit -m "feat: add categories page and route"
```

---

### Task 5: Routine items API + partner lookup

**Files:**
- Create: `src/features/items/itemsApi.ts`
- Test: `src/features/items/itemsApi.test.ts`
- Modify: `src/features/couple/coupleApi.ts`
- Modify: `src/features/couple/coupleApi.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.ts`; `RecurrenceRule`, `RecurrenceEnd` from `src/lib/recurrence.ts` (Task 1).
- Produces: `Priority` type (`'alta' | 'media' | 'baixa'`), `RoutineItem` type, `RoutineItemInput` type, `listItems(): Promise<RoutineItem[]>`, `getItem(id): Promise<RoutineItem>`, `createItem(userId, input): Promise<RoutineItem>`, `updateItem(id, input): Promise<RoutineItem>`, `deleteItem(id): Promise<void>` from `itemsApi.ts`; `getPartnerId(userId): Promise<string | null>` added to `coupleApi.ts`. Consumed by Task 6 (`ItemFormPage.tsx`) and Task 7 (`ItemsListPage.tsx`).

- [ ] **Step 1: Write the failing test for `getPartnerId`**

Modify `src/features/couple/coupleApi.test.ts` — add `getPartnerId` to the import, add `rpc` to the mocked `supabase` object, and add a new test:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createCouple, getPartnerId, joinCouple } from './coupleApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const single = vi.fn().mockResolvedValue({ data: { code: 'ABC123' }, error: null })
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })
  const updateSelect = vi.fn().mockResolvedValue({ data: [{ code: 'ABC123' }], error: null })
  const eq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ insert, update })
  const rpc = vi.fn().mockResolvedValue({ data: 'partner-user-id', error: null })
  return { supabase: { from, rpc } }
})

describe('coupleApi', () => {
  it('createCouple inserts a couple row and returns its code', async () => {
    const result = await createCouple('user-a-id')
    expect(supabase.from).toHaveBeenCalledWith('couples')
    expect(result.code).toBe('ABC123')
  })

  it('joinCouple updates the couple row matching the code', async () => {
    await joinCouple('user-b-id', 'ABC123')
    expect(supabase.from).toHaveBeenCalledWith('couples')
  })

  it('joinCouple throws when no row matches the code (invalid, already used, or own code)', async () => {
    const from = vi.mocked(supabase.from)
    const updateSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ select: updateSelect })
    const update = vi.fn().mockReturnValue({ eq })
    from.mockReturnValueOnce({ update } as unknown as ReturnType<typeof supabase.from>)

    await expect(joinCouple('user-b-id', 'BADCODE')).rejects.toThrow(
      'Código inválido ou já utilizado.',
    )
  })

  it('getPartnerId calls the partner_id RPC with the given user id', async () => {
    const result = await getPartnerId('user-a-id')
    expect(supabase.rpc).toHaveBeenCalledWith('partner_id', { uid: 'user-a-id' })
    expect(result).toBe('partner-user-id')
  })
})
```

- [ ] **Step 2: Run it to verify the new test fails**

Run: `npm run test -- coupleApi`
Expected: FAIL — `getPartnerId` is not exported from `./coupleApi`.

- [ ] **Step 3: Implement `getPartnerId`**

Add to `src/features/couple/coupleApi.ts` (keep the existing `createCouple`/`joinCouple` unchanged):

```ts
export async function getPartnerId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('partner_id', { uid: userId })
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- coupleApi`
Expected: all 4 `coupleApi` tests PASS.

- [ ] **Step 5: Write the failing tests for `itemsApi`**

`src/features/items/itemsApi.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createItem, deleteItem, getItem, listItems, updateItem } from './itemsApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const sampleRow = {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-05',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: { type: 'once' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
  }

  const order = vi.fn().mockResolvedValue({ data: [sampleRow], error: null })
  const getSingle = vi.fn().mockResolvedValue({ data: sampleRow, error: null })
  const getEq = vi.fn().mockReturnValue({ single: getSingle })
  const select = vi.fn().mockReturnValue({ order, eq: getEq })

  const insertSingle = vi.fn().mockResolvedValue({
    data: { ...sampleRow, id: 'item-2', titulo: 'Novo item' },
    error: null,
  })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateSingle = vi.fn().mockResolvedValue({
    data: { ...sampleRow, titulo: 'Editado' },
    error: null,
  })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })

  const from = vi.fn().mockReturnValue({ select, insert, update, delete: del })
  return { supabase: { from } }
})

describe('itemsApi', () => {
  it('listItems returns items ordered by start date', async () => {
    const result = await listItems()
    expect(supabase.from).toHaveBeenCalledWith('routine_items')
    expect(result).toHaveLength(1)
    expect(result[0].titulo).toBe('Academia')
  })

  it('getItem returns the item matching the id', async () => {
    const result = await getItem('item-1')
    expect(result.titulo).toBe('Academia')
  })

  it('createItem inserts an item for the given user', async () => {
    const result = await createItem('user-a', {
      category_id: 'cat-1',
      titulo: 'Novo item',
      notas: null,
      prioridade: 'media',
      data_inicio: '2026-01-05',
      horario: '18:00',
      is_shared: false,
      recurrence_rule: { type: 'once' },
      recurrence_end: { type: 'never' },
    })
    expect(result.titulo).toBe('Novo item')
  })

  it('updateItem updates the item matching the id', async () => {
    const result = await updateItem('item-1', {
      category_id: 'cat-1',
      titulo: 'Editado',
      notas: null,
      prioridade: 'alta',
      data_inicio: '2026-01-05',
      horario: '19:00',
      is_shared: false,
      recurrence_rule: { type: 'daily' },
      recurrence_end: { type: 'never' },
    })
    expect(result.titulo).toBe('Editado')
  })

  it('deleteItem removes the item matching the id', async () => {
    await expect(deleteItem('item-1')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test -- itemsApi`
Expected: FAIL — `Cannot find module './itemsApi'`.

- [ ] **Step 7: Implement `itemsApi.ts`**

`src/features/items/itemsApi.ts`:

```ts
import { supabase } from '../../lib/supabaseClient'
import type { RecurrenceEnd, RecurrenceRule } from '../../lib/recurrence'

export type Priority = 'alta' | 'media' | 'baixa'

export type RoutineItem = {
  id: string
  user_id: string
  category_id: string
  titulo: string
  notas: string | null
  prioridade: Priority
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
  created_at: string
}

export type RoutineItemInput = {
  category_id: string
  titulo: string
  notas: string | null
  prioridade: Priority
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

export async function listItems(): Promise<RoutineItem[]> {
  const { data, error } = await supabase
    .from('routine_items')
    .select('*')
    .order('data_inicio', { ascending: true })
  if (error) throw error
  return data
}

export async function getItem(id: string): Promise<RoutineItem> {
  const { data, error } = await supabase.from('routine_items').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createItem(userId: string, input: RoutineItemInput): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .insert({ user_id: userId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateItem(id: string, input: RoutineItemInput): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('routine_items').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test -- itemsApi`
Expected: all 5 `itemsApi` tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/couple/coupleApi.ts src/features/couple/coupleApi.test.ts src/features/items/itemsApi.ts src/features/items/itemsApi.test.ts
git commit -m "feat: add routine items CRUD API and partner lookup"
```

---

### Task 6: Item form page (create + edit) + routes

**Files:**
- Create: `src/features/items/ItemFormPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../auth/AuthContext`; `getPartnerId` from `../couple/coupleApi` (Task 5); `listCategories`, `Category` from `../categories/categoriesApi` (Task 3); `createItem`, `getItem`, `updateItem`, `Priority` from `./itemsApi` (Task 5); `RecurrenceRule`, `RecurrenceEnd` from `../../lib/recurrence` (Task 1).
- Produces: `/items/new` and `/items/:id/edit` routes. No exports consumed by other tasks.

No dedicated test for this component (same convention as Task 4 — covered by manual verification).

- [ ] **Step 1: Implement `ItemFormPage.tsx`**

`src/features/items/ItemFormPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getPartnerId } from '../couple/coupleApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { createItem, getItem, updateItem, type Priority } from './itemsApi'
import type { RecurrenceEnd, RecurrenceRule } from '../../lib/recurrence'

type RecurrenceType = RecurrenceRule['type']
type EndType = RecurrenceEnd['type']

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function ItemFormPage() {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [categories, setCategories] = useState<Category[]>([])
  const [hasPartner, setHasPartner] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notas, setNotas] = useState('')
  const [prioridade, setPrioridade] = useState<Priority>('media')
  const [dataInicio, setDataInicio] = useState('')
  const [horario, setHorario] = useState('')
  const [isShared, setIsShared] = useState(false)

  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once')
  const [weeklyInterval, setWeeklyInterval] = useState(1)
  const [weeklyDays, setWeeklyDays] = useState<number[]>([])
  const [monthlyDay, setMonthlyDay] = useState(1)

  const [endType, setEndType] = useState<EndType>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState(1)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listCategories()
      .then((result) => {
        setCategories(result)
        if (!isEditing && result.length > 0) setCategoryId(result[0].id)
      })
      .catch((e) => setError((e as Error).message))
    getPartnerId(user.id)
      .then((partnerId) => setHasPartner(partnerId !== null))
      .catch((e) => setError((e as Error).message))
  }, [user, isEditing])

  useEffect(() => {
    if (!id) return
    getItem(id)
      .then((item) => {
        setTitulo(item.titulo)
        setCategoryId(item.category_id)
        setNotas(item.notas ?? '')
        setPrioridade(item.prioridade)
        setDataInicio(item.data_inicio)
        setHorario(item.horario)
        setIsShared(item.is_shared)

        setRecurrenceType(item.recurrence_rule.type)
        if (item.recurrence_rule.type === 'weekly') {
          setWeeklyInterval(item.recurrence_rule.interval)
          setWeeklyDays(item.recurrence_rule.daysOfWeek)
        }
        if (item.recurrence_rule.type === 'monthly') {
          setMonthlyDay(item.recurrence_rule.dayOfMonth)
        }

        setEndType(item.recurrence_end.type)
        if (item.recurrence_end.type === 'date') setEndDate(item.recurrence_end.value)
        if (item.recurrence_end.type === 'count') setEndCount(item.recurrence_end.value)
      })
      .catch((e) => setError((e as Error).message))
  }, [id])

  function toggleWeeklyDay(day: number) {
    setWeeklyDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()))
  }

  function buildRecurrenceRule(): RecurrenceRule {
    switch (recurrenceType) {
      case 'once':
        return { type: 'once' }
      case 'daily':
        return { type: 'daily' }
      case 'weekly':
        return { type: 'weekly', interval: weeklyInterval, daysOfWeek: weeklyDays }
      case 'monthly':
        return { type: 'monthly', dayOfMonth: monthlyDay }
      default:
        throw new Error(`Tipo de recorrência desconhecido: ${recurrenceType}`)
    }
  }

  function buildRecurrenceEnd(): RecurrenceEnd {
    switch (endType) {
      case 'never':
        return { type: 'never' }
      case 'date':
        return { type: 'date', value: endDate }
      case 'count':
        return { type: 'count', value: endCount }
      default:
        throw new Error(`Tipo de término desconhecido: ${endType}`)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    if (recurrenceType === 'weekly' && weeklyDays.length === 0) {
      setError('Escolha ao menos um dia da semana.')
      return
    }
    if (endType === 'date' && !endDate) {
      setError('Escolha a data final da recorrência.')
      return
    }

    const input = {
      category_id: categoryId,
      titulo,
      notas: notas || null,
      prioridade,
      data_inicio: dataInicio,
      horario,
      is_shared: isShared,
      recurrence_rule: buildRecurrenceRule(),
      recurrence_end: buildRecurrenceEnd(),
    }

    try {
      if (id) {
        await updateItem(id, input)
      } else {
        await createItem(user.id, input)
      }
      navigate('/items')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>{isEditing ? 'Editar item' : 'Novo item'}</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nome}
            </option>
          ))}
        </select>
        <textarea placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Priority)}>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
        <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />

        <fieldset>
          <legend>Recorrência</legend>
          <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}>
            <option value="once">Única</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          {recurrenceType === 'weekly' && (
            <div>
              <label>
                A cada
                <input
                  type="number"
                  min={1}
                  value={weeklyInterval}
                  onChange={(e) => setWeeklyInterval(Number(e.target.value))}
                />
                semana(s)
              </label>
              <div>
                {WEEKDAY_LABELS.map((label, day) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={weeklyDays.includes(day)}
                      onChange={() => toggleWeeklyDay(day)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {recurrenceType === 'monthly' && (
            <label>
              Dia do mês
              <input
                type="number"
                min={1}
                max={31}
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value))}
              />
            </label>
          )}

          <select value={endType} onChange={(e) => setEndType(e.target.value as EndType)}>
            <option value="never">Nunca termina</option>
            <option value="date">Até uma data</option>
            <option value="count">Número de repetições</option>
          </select>

          {endType === 'date' && (
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          )}
          {endType === 'count' && (
            <input type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value))} />
          )}
        </fieldset>

        {hasPartner && (
          <label>
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            Compartilhar com o parceiro
          </label>
        )}

        <button type="submit">{isEditing ? 'Salvar' : 'Criar'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the routes into `App.tsx`**

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'
import ItemFormPage from './features/items/ItemFormPage'

function Home() {
  return (
    <div>
      <h1>Rotina do Casal</h1>
      <nav>
        <Link to="/categories">Categorias</Link>
      </nav>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/couple-setup"
            element={
              <ProtectedRoute>
                <CoupleSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/new"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/items/ItemFormPage.tsx src/App.tsx
git commit -m "feat: add item create/edit form with recurrence controls"
```

---

### Task 7: Items list page + route + home navigation

**Files:**
- Create: `src/features/items/ItemsListPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listItems`, `deleteItem`, `RoutineItem` from `./itemsApi` (Task 5); `listCategories`, `Category` from `../categories/categoriesApi` (Task 3).
- Produces: `/items` route, with a link to `/items/new` and per-row links to `/items/:id/edit`. Final `Home` navigation (links to both `/categories` and `/items`).

No dedicated test for this component (same convention as Tasks 4 and 6).

- [ ] **Step 1: Implement `ItemsListPage.tsx`**

`src/features/items/ItemsListPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteItem, listItems, type RoutineItem } from './itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'

function describeRecurrence(item: RoutineItem): string {
  const rule = item.recurrence_rule
  switch (rule.type) {
    case 'once':
      return 'Única'
    case 'daily':
      return 'Diária'
    case 'weekly': {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .filter((_, index) => rule.daysOfWeek.includes(index))
        .join(', ')
      return rule.interval === 1 ? `Semanal (${days})` : `A cada ${rule.interval} semanas (${days})`
    }
    case 'monthly':
      return `Mensal (dia ${rule.dayOfMonth})`
    default:
      return ''
  }
}

export default function ItemsListPage() {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [itemsResult, categoriesResult] = await Promise.all([listItems(), listCategories()])
      setItems(itemsResult)
      setCategories(categoriesResult)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((category) => category.id === categoryId)?.nome ?? '—'
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Excluir este item de rotina?')
    if (!confirmed) return
    setError(null)
    try {
      await deleteItem(id)
      await loadData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>Meus itens</h1>
      <Link to="/items/new">Novo item</Link>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.titulo} — {categoryName(item.category_id)} — {item.data_inicio} {item.horario} —{' '}
            {describeRecurrence(item)}
            <Link to={`/items/${item.id}/edit`}>Editar</Link>
            <button onClick={() => handleDelete(item.id)}>Excluir</button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route and nav link into `App.tsx`**

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'
import ItemFormPage from './features/items/ItemFormPage'
import ItemsListPage from './features/items/ItemsListPage'

function Home() {
  return (
    <div>
      <h1>Rotina do Casal</h1>
      <nav>
        <Link to="/categories">Categorias</Link>
        <Link to="/items">Meus itens</Link>
      </nav>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/couple-setup"
            element={
              <ProtectedRoute>
                <CoupleSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <ItemsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/new"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/items/ItemsListPage.tsx src/App.tsx
git commit -m "feat: add items list page with navigation"
```

---

### Task 8: RLS negative-path integration tests

**Files:**
- Modify: `tests/integration/rls.test.ts`

**Interfaces:**
- Consumes: the existing `signUp` helper already defined in `rls.test.ts` (creates a client with `persistSession: false, autoRefreshToken: false` — do not change this helper).
- Produces: no new exports — closes the test-coverage gap flagged by Plan 1's final whole-branch review (partner-cannot-edit-personal-item and category-isolation were never asserted).

- [ ] **Step 1: Add the two negative-path tests**

Add to the existing `describe('routine_items RLS', ...)` block in `tests/integration/rls.test.ts` (after the existing two `it` blocks, before the closing `})`):

```ts
  it('partner cannot edit a personal (non-shared) item', async () => {
    const ts = Date.now()
    const code = `code-${ts}`
    const a = await signUp(`luccasmadia07+a-personal-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-personal-${ts}@gmail.com`, 'password123')

    await a.client.from('couples').insert({ code, user_a: a.userId })
    await b.client.from('couples').update({ user_b: b.userId }).eq('code', code)

    const { data: category } = await a.client
      .from('categories')
      .insert({ user_id: a.userId, nome: 'Trabalho', cor: '#000', icone: 'briefcase' })
      .select()
      .single()

    const { data: item } = await a.client
      .from('routine_items')
      .insert({
        user_id: a.userId,
        category_id: category!.id,
        titulo: 'Reunião pessoal',
        data_inicio: '2026-08-12',
        horario: '10:00',
        is_shared: false,
      })
      .select()
      .single()

    const { data: updateResult, error: updateError } = await b.client
      .from('routine_items')
      .update({ titulo: 'Alterado por B' })
      .eq('id', item!.id)
      .select()

    expect(updateError).toBeNull()
    expect(updateResult).toEqual([])
  })

  it('user cannot see another user\'s category', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-cat-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-cat-${ts}@gmail.com`, 'password123')

    await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'Estudos', cor: '#000', icone: 'book' })

    const { data: seenByA } = await a.client.from('categories').select('*').eq('user_id', b.userId)
    expect(seenByA).toEqual([])
  })
```

- [ ] **Step 2: Run the integration suite against the hosted project**

Run: `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npm run test:integration`
Expected: all 4 tests in `rls.test.ts` PASS (the original 2 plus these 2 new ones), plus the `categories-seed` suite from Task 2.

Afterwards, in Table Editor, delete the test rows created in `auth.users` (emails containing `+a-personal-`, `+b-personal-`, `+a-cat-`, `+b-cat-`) so they don't linger in the real project.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/rls.test.ts
git commit -m "test: add RLS negative-path coverage for personal items and categories"
```

---

## Manual Verification (end of Plan 2)

- [ ] With `.env.local` pointed at the hosted project and `npm run dev` running, sign up a new account and confirm it lands with exactly 4 categories (Treino/Saúde, Estudos, Trabalho, Lazer) visible at `/categories`.
- [ ] Create a category, edit it, delete it (confirm the delete warning appears).
- [ ] Create a routine item with each recurrence type (única, diária, semanal, mensal) and each end condition (nunca, até data, nº de repetições); confirm it appears correctly in `/items` with a sensible recurrence summary.
- [ ] Edit an existing item and confirm the form pre-fills all fields correctly, including the recurrence sub-fields.
- [ ] Pair two accounts (via `/couple-setup`, as in Plan 1) and confirm the "Compartilhar com o parceiro" checkbox only appears once paired, and that a shared item created by one account is editable by the other via `/items`.

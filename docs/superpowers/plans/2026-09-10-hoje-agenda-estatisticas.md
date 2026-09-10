# Hoje, Agenda/Semana e Estatísticas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three daily-use screens of "Rotina do Casal" (Hoje, Agenda/Semana, Estatísticas) plus the completion-tracking data layer that none of them have today.

**Architecture:** Two new pure-TS modules (`src/lib/occurrences.ts`, `src/lib/stats.ts`) sit on top of the existing pure recurrence engine (`src/lib/recurrence.ts`) and a new thin Supabase wrapper (`src/features/completions/completionsApi.ts`), following the exact layering already used for items/categories. Three new page components consume these modules and a new shared `OccurrenceRow` component, wired into `src/App.tsx`'s existing router. One new RLS policy closes a category-visibility gap the new screens would otherwise expose.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom, Supabase (Postgres + RLS + supabase-js), Vitest for unit/integration tests. No new dependencies.

## Global Constraints

- Commit directly to `master`, no feature branches (confirmed project convention).
- Conventional Commits for every commit message (`feat:`, `fix:`, `test:`, `docs:`, etc.).
- No new npm dependencies — everything is built with what's already in `package.json`.
- All aggregation/computation is client-side, in pure TypeScript modules with no I/O — matches the existing `recurrence.ts` convention, not because of a hard performance requirement but for testability and consistency.
- New Supabase migrations go in `supabase/migrations/`, numbered sequentially, and must be applied manually to the hosted project via the Supabase dashboard SQL Editor (this project has no `psql`/CLI access) using `window.monaco.editor.getEditors()[0].setValue(...)` + `ctrl+Return` — never simulate keystrokes into the Monaco editor.
- Integration tests run with `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npm run test:integration`. Test accounts they create must be deleted afterward from the Supabase Table Editor (`auth.users`, filter by the email tag used in that test) — no automated cleanup exists.

---

### Task 1: RLS policy — partner's category visible when used by a shared item

**Files:**
- Create: `supabase/migrations/0003_partner_shared_categories.sql`
- Modify: `tests/integration/rls.test.ts`

**Interfaces:**
- Produces: no new TS symbols. Produces a DB-level guarantee that `categories` SELECT returns a partner's category row when `exists (select 1 from routine_items where category_id = categories.id and is_shared = true)`.

- [ ] **Step 1: Write the failing integration test**

Add this test inside the existing `describe('routine_items RLS', ...)` block in `tests/integration/rls.test.ts` (it reuses the `signUp` helper already defined at the top of the file):

```ts
  it('user can see partner category only when used by a shared item', async () => {
    const ts = Date.now()
    const code = `code-${ts}`
    const a = await signUp(`luccasmadia07+a-partnercat-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-partnercat-${ts}@gmail.com`, 'password123')

    await a.client.from('couples').insert({ code, user_a: a.userId })
    await b.client.from('couples').update({ user_b: b.userId }).eq('code', code)

    const { data: sharedCategory } = await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'Compartilhada', cor: '#000', icone: 'star' })
      .select()
      .single()

    const { data: privateCategory } = await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'PrivadaDeB', cor: '#000', icone: 'lock' })
      .select()
      .single()

    await b.client.from('routine_items').insert({
      user_id: b.userId,
      category_id: sharedCategory!.id,
      titulo: 'Item compartilhado de B',
      data_inicio: '2026-08-12',
      horario: '09:00',
      is_shared: true,
    })

    const { data: seenByA } = await a.client.from('categories').select('*').eq('user_id', b.userId)

    expect(seenByA).toHaveLength(1)
    expect(seenByA![0].id).toBe(sharedCategory!.id)
    expect(seenByA!.some((category) => category.id === privateCategory!.id)).toBe(false)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npx vitest run tests/integration/rls.test.ts -t "partner category"`
Expected: FAIL — `seenByA` has length 0 (current `categories` RLS only allows `user_id = auth.uid()`).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_partner_shared_categories.sql`:

```sql
-- Allow a user to see their partner's category, but only when that
-- category is used by an item the partner has marked as shared.
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

- [ ] **Step 4: Apply the migration to the hosted Supabase project via the dashboard SQL Editor**

Open the project's SQL Editor in Chrome, then use the browser tool to run:

```js
const editor = window.monaco.editor.getEditors()[0];
editor.setValue(`create policy "select partner category used by shared item"
on categories for select
using (
  user_id = partner_id(auth.uid())
  and exists (
    select 1 from routine_items ri
    where ri.category_id = categories.id
      and ri.is_shared = true
  )
);`);
```

Take a screenshot to confirm the pasted SQL matches the migration file (check line count, not just visual gaps — folded lines can look wrong when they aren't). Then click into the editor and press `ctrl+Return` to run it. Confirm the dashboard reports success (no error banner).

- [ ] **Step 5: Run the test again to verify it passes**

Run: `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npx vitest run tests/integration/rls.test.ts -t "partner category"`
Expected: PASS.

- [ ] **Step 6: Run the full integration suite to confirm no regressions**

Run: `SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2) npm run test:integration`
Expected: all tests in `rls.test.ts` and `categories-seed.test.ts` PASS.

Afterward, in the Supabase Table Editor, delete the test rows created in `auth.users` (emails containing `+a-partnercat-` and `+b-partnercat-`).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_partner_shared_categories.sql tests/integration/rls.test.ts
git commit -m "feat: let a user see partner's category when used by a shared item"
```

---

### Task 2: Completions API

**Files:**
- Create: `src/features/completions/completionsApi.ts`
- Test: `src/features/completions/completionsApi.test.ts`

**Interfaces:**
- Produces:
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

- [ ] **Step 1: Write the failing tests**

Create `src/features/completions/completionsApi.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { listCompletions, markComplete, unmarkComplete } from './completionsApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const sampleRow = {
    id: 'completion-1',
    routine_item_id: 'item-1',
    user_id: 'user-a',
    data: '2026-01-05',
    completed_at: '2026-01-05T10:00:00Z',
  }

  const lte = vi.fn().mockResolvedValue({ data: [sampleRow], error: null })
  const gte = vi.fn().mockReturnValue({ lte })
  const select = vi.fn().mockReturnValue({ gte })

  const insert = vi.fn().mockResolvedValue({ error: null })

  const deleteEqData = vi.fn().mockResolvedValue({ error: null })
  const deleteEqItem = vi.fn().mockReturnValue({ eq: deleteEqData })
  const del = vi.fn().mockReturnValue({ eq: deleteEqItem })

  const from = vi.fn().mockReturnValue({ select, insert, delete: del })
  return { supabase: { from } }
})

describe('completionsApi', () => {
  it('listCompletions returns completions within the date range', async () => {
    const result = await listCompletions('2026-01-01', '2026-01-31')
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
    expect(result).toHaveLength(1)
    expect(result[0].routine_item_id).toBe('item-1')
  })

  it('markComplete inserts a completion row', async () => {
    await expect(markComplete('user-a', 'item-1', '2026-01-05')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
  })

  it('markComplete swallows a unique-violation error (already marked)', async () => {
    const from = vi.mocked(supabase.from)
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    from.mockReturnValueOnce({ insert } as unknown as ReturnType<typeof supabase.from>)

    await expect(markComplete('user-a', 'item-1', '2026-01-05')).resolves.toBeUndefined()
  })

  it('markComplete rethrows non-unique-violation errors', async () => {
    const from = vi.mocked(supabase.from)
    const insert = vi.fn().mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    from.mockReturnValueOnce({ insert } as unknown as ReturnType<typeof supabase.from>)

    await expect(markComplete('user-a', 'item-1', '2026-01-05')).rejects.toMatchObject({ code: '42501' })
  })

  it('unmarkComplete deletes the matching completion row', async () => {
    await expect(unmarkComplete('item-1', '2026-01-05')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/completions/completionsApi.test.ts`
Expected: FAIL with "Cannot find module './completionsApi'".

- [ ] **Step 3: Write the implementation**

Create `src/features/completions/completionsApi.ts`:

```ts
import { supabase } from '../../lib/supabaseClient'

export type ItemCompletion = {
  id: string
  routine_item_id: string
  user_id: string
  data: string
  completed_at: string
}

const UNIQUE_VIOLATION = '23505'

export async function listCompletions(startDate: string, endDate: string): Promise<ItemCompletion[]> {
  const { data, error } = await supabase
    .from('item_completions')
    .select('*')
    .gte('data', startDate)
    .lte('data', endDate)
  if (error) throw error
  return data
}

export async function markComplete(userId: string, routineItemId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('item_completions')
    .insert({ user_id: userId, routine_item_id: routineItemId, data: date })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}

export async function unmarkComplete(routineItemId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('item_completions')
    .delete()
    .eq('routine_item_id', routineItemId)
    .eq('data', date)
  if (error) throw error
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/completions/completionsApi.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/completions/completionsApi.ts src/features/completions/completionsApi.test.ts
git commit -m "feat: add completions API for marking routine items done"
```

---

### Task 3: Occurrences engine

**Files:**
- Create: `src/lib/occurrences.ts`
- Test: `src/lib/occurrences.test.ts`

**Interfaces:**
- Consumes: `RoutineItem` from `../features/items/itemsApi` (`id, user_id, category_id, titulo, notas, prioridade, data_inicio, horario, is_shared, recurrence_rule, recurrence_end, created_at`), `ItemCompletion` from `../features/completions/completionsApi` (Task 2), `getOccurrencesInRange` from `./recurrence`.
- Produces:
  ```ts
  export type Occurrence = {
    item: RoutineItem
    date: string
    ownCompletion: boolean
    partnerCompletion: boolean
  }
  export function buildOccurrences(
    items: RoutineItem[],
    completions: ItemCompletion[],
    currentUserId: string,
    rangeStart: string,
    rangeEnd: string,
  ): Occurrence[]
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/occurrences.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildOccurrences } from './occurrences'
import type { RoutineItem } from '../features/items/itemsApi'
import type { ItemCompletion } from '../features/completions/completionsApi'

function makeItem(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-05',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCompletion(overrides: Partial<ItemCompletion> = {}): ItemCompletion {
  return {
    id: 'completion-1',
    routine_item_id: 'item-1',
    user_id: 'user-a',
    data: '2026-01-05',
    completed_at: '2026-01-05T20:00:00Z',
    ...overrides,
  }
}

describe('buildOccurrences', () => {
  it('marks a personal item as not completed when there is no completion row', () => {
    const item = makeItem({ is_shared: false })
    const result = buildOccurrences([item], [], 'user-a', '2026-01-05', '2026-01-05')
    expect(result).toEqual([{ item, date: '2026-01-05', ownCompletion: false, partnerCompletion: false }])
  })

  it('marks a personal item as completed when the owner has a completion row', () => {
    const item = makeItem({ is_shared: false })
    const completion = makeCompletion()
    const result = buildOccurrences([item], [completion], 'user-a', '2026-01-05', '2026-01-05')
    expect(result[0].ownCompletion).toBe(true)
    expect(result[0].partnerCompletion).toBe(false)
  })

  it('tracks own and partner completion independently on a shared item', () => {
    const item = makeItem({ is_shared: true })
    const ownCompletion = makeCompletion({ user_id: 'user-a' })
    const partnerCompletion = makeCompletion({ id: 'completion-2', user_id: 'user-b' })
    const result = buildOccurrences(
      [item],
      [ownCompletion, partnerCompletion],
      'user-a',
      '2026-01-05',
      '2026-01-05',
    )
    expect(result[0].ownCompletion).toBe(true)
    expect(result[0].partnerCompletion).toBe(true)
  })

  it('never reports partner completion on a non-shared item, even if another user_id row exists', () => {
    const item = makeItem({ is_shared: false })
    const otherCompletion = makeCompletion({ user_id: 'user-b' })
    const result = buildOccurrences([item], [otherCompletion], 'user-a', '2026-01-05', '2026-01-05')
    expect(result[0].partnerCompletion).toBe(false)
  })

  it('sorts occurrences by date then by time', () => {
    const early = makeItem({ id: 'item-early', horario: '07:00', recurrence_rule: { type: 'once' } })
    const late = makeItem({
      id: 'item-late',
      data_inicio: '2026-01-05',
      horario: '20:00',
      recurrence_rule: { type: 'once' },
    })
    const result = buildOccurrences([late, early], [], 'user-a', '2026-01-05', '2026-01-05')
    expect(result.map((o) => o.item.id)).toEqual(['item-early', 'item-late'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/occurrences.test.ts`
Expected: FAIL with "Cannot find module './occurrences'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/occurrences.ts`:

```ts
import type { RoutineItem } from '../features/items/itemsApi'
import type { ItemCompletion } from '../features/completions/completionsApi'
import { getOccurrencesInRange } from './recurrence'

export type Occurrence = {
  item: RoutineItem
  date: string
  ownCompletion: boolean
  partnerCompletion: boolean
}

export function buildOccurrences(
  items: RoutineItem[],
  completions: ItemCompletion[],
  currentUserId: string,
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  const occurrences: Occurrence[] = []

  for (const item of items) {
    const dates = getOccurrencesInRange(
      item.recurrence_rule,
      item.recurrence_end,
      item.data_inicio,
      rangeStart,
      rangeEnd,
    )

    for (const date of dates) {
      const completionsForOccurrence = completions.filter(
        (completion) => completion.routine_item_id === item.id && completion.data === date,
      )
      occurrences.push({
        item,
        date,
        ownCompletion: completionsForOccurrence.some((completion) => completion.user_id === currentUserId),
        partnerCompletion:
          item.is_shared &&
          completionsForOccurrence.some((completion) => completion.user_id !== currentUserId),
      })
    }
  }

  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.item.horario !== b.item.horario) return a.item.horario < b.item.horario ? -1 : 1
    return 0
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/occurrences.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/occurrences.ts src/lib/occurrences.test.ts
git commit -m "feat: add occurrences engine combining recurrence and completions"
```

---

### Task 4: Shared recurrence-display and date helpers

**Files:**
- Create: `src/lib/recurrenceLabels.ts`
- Test: `src/lib/recurrenceLabels.test.ts`
- Modify: `src/features/items/ItemsListPage.tsx` (remove local `describeRecurrence`, import the shared one)
- Modify: `src/lib/recurrence.ts:20-24,34-36` (export `addDays` and `startOfWeek`)

**Interfaces:**
- Consumes: `RoutineItem` from `../features/items/itemsApi`.
- Produces:
  ```ts
  export function describeRecurrence(item: RoutineItem): string
  ```
  Also produces newly-exported `addDays(dateStr: string, days: number): string` and `startOfWeek(dateStr: string): string` from `./recurrence` (used by Task 8's AgendaPage).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/recurrenceLabels.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { describeRecurrence } from './recurrenceLabels'
import type { RoutineItem } from '../features/items/itemsApi'

function makeItem(rule: RoutineItem['recurrence_rule']): RoutineItem {
  return {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-05',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: rule,
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('describeRecurrence', () => {
  it('describes a one-time item', () => {
    expect(describeRecurrence(makeItem({ type: 'once' }))).toBe('Única')
  })

  it('describes a daily item', () => {
    expect(describeRecurrence(makeItem({ type: 'daily' }))).toBe('Diária')
  })

  it('describes a weekly item with interval 1', () => {
    expect(describeRecurrence(makeItem({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }))).toBe(
      'Semanal (Seg, Qua)',
    )
  })

  it('describes a weekly item with a larger interval', () => {
    expect(describeRecurrence(makeItem({ type: 'weekly', interval: 2, daysOfWeek: [1] }))).toBe(
      'A cada 2 semanas (Seg)',
    )
  })

  it('describes a monthly item', () => {
    expect(describeRecurrence(makeItem({ type: 'monthly', dayOfMonth: 5 }))).toBe('Mensal (dia 5)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/recurrenceLabels.test.ts`
Expected: FAIL with "Cannot find module './recurrenceLabels'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/recurrenceLabels.ts`:

```ts
import type { RoutineItem } from '../features/items/itemsApi'

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function describeRecurrence(item: RoutineItem): string {
  const rule = item.recurrence_rule
  switch (rule.type) {
    case 'once':
      return 'Única'
    case 'daily':
      return 'Diária'
    case 'weekly': {
      const days = WEEKDAY_LABELS.filter((_, index) => rule.daysOfWeek.includes(index)).join(', ')
      return rule.interval === 1 ? `Semanal (${days})` : `A cada ${rule.interval} semanas (${days})`
    }
    case 'monthly':
      return `Mensal (dia ${rule.dayOfMonth})`
    default:
      return ''
  }
}
```

In `src/lib/recurrence.ts`, change the two internal helpers to be exported (keep everything else in the file identical):

```ts
export function addDays(dateStr: string, days: number): string {
```

```ts
export function startOfWeek(dateStr: string): string {
```

In `src/features/items/ItemsListPage.tsx`, delete the local `describeRecurrence` function (lines 6-24) and add this import at the top instead:

```ts
import { describeRecurrence } from '../../lib/recurrenceLabels'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/recurrenceLabels.test.ts src/lib/recurrence.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run the full unit suite to confirm the ItemsListPage refactor didn't break anything**

`ItemsListPage.tsx` has no dedicated render test in this codebase (consistent with the other page components), so this full-suite run — plus the manual smoke test in Task 10 — is what confirms the refactor didn't break its rendering.

Run: `npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recurrenceLabels.ts src/lib/recurrenceLabels.test.ts src/lib/recurrence.ts src/features/items/ItemsListPage.tsx
git commit -m "refactor: extract describeRecurrence into a shared lib module"
```

---

### Task 5: Shared OccurrenceRow component

**Files:**
- Create: `src/features/occurrences/OccurrenceRow.tsx`

**Interfaces:**
- Consumes: `Occurrence` from `../../lib/occurrences` (Task 3), `describeRecurrence` from `../../lib/recurrenceLabels` (Task 4).
- Produces:
  ```ts
  export default function OccurrenceRow(props: {
    occurrence: Occurrence
    onToggle: (occurrence: Occurrence) => void
    categoryName?: string
  }): JSX.Element
  ```
  Renders a single `<li>` — callers must not wrap it in another `<li>`.

This component has no dedicated automated test, matching this codebase's existing convention (no render tests exist for `CategoriesPage`, `ItemFormPage`, or `ItemsListPage` either — only pure-logic modules and API wrappers are unit tested here). It's exercised indirectly through Tasks 7 and 8, and manually verified in Task 10's dev-server check.

- [ ] **Step 1: Write the component**

Create `src/features/occurrences/OccurrenceRow.tsx`:

```tsx
import { describeRecurrence } from '../../lib/recurrenceLabels'
import type { Occurrence } from '../../lib/occurrences'

type OccurrenceRowProps = {
  occurrence: Occurrence
  onToggle: (occurrence: Occurrence) => void
  categoryName?: string
}

export default function OccurrenceRow({ occurrence, onToggle, categoryName }: OccurrenceRowProps) {
  const { item, ownCompletion, partnerCompletion } = occurrence

  return (
    <li>
      <label>
        <input type="checkbox" checked={ownCompletion} onChange={() => onToggle(occurrence)} />
        {categoryName ? `${categoryName} — ` : ''}
        {item.titulo} — {item.horario} — {describeRecurrence(item)}
      </label>
      {item.is_shared && <span> Parceiro: {partnerCompletion ? '✓' : '–'}</span>}
    </li>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/occurrences/OccurrenceRow.tsx
git commit -m "feat: add shared OccurrenceRow component for Hoje and Agenda"
```

---

### Task 6: Stats engine

**Files:**
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

**Interfaces:**
- Consumes: `Occurrence` from `./occurrences` (Task 3), `Category` from `../features/categories/categoriesApi`.
- Produces:
  ```ts
  export type CategoryStat = { categoryId: string; nome: string; cor: string; done: number; total: number }
  export function computeCategoryStats(occurrences: Occurrence[], categories: Category[]): CategoryStat[]
  export function computeStreak(occurrences: Occurrence[], scope: 'own' | 'partner-shared'): number
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeCategoryStats, computeStreak } from './stats'
import type { Occurrence } from './occurrences'
import type { Category } from '../features/categories/categoriesApi'
import type { RoutineItem } from '../features/items/itemsApi'

function makeItem(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-01',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    item: makeItem(),
    date: '2026-01-05',
    ownCompletion: false,
    partnerCompletion: false,
    ...overrides,
  }
}

describe('computeCategoryStats', () => {
  const categories: Category[] = [
    { id: 'cat-1', user_id: 'user-a', nome: 'Treino', cor: '#22c55e', icone: 'dumbbell', created_at: '' },
    { id: 'cat-2', user_id: 'user-a', nome: 'Estudos', cor: '#3b82f6', icone: 'book', created_at: '' },
  ]

  it('computes done/total per category and omits categories with no occurrences', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ category_id: 'cat-1' }), ownCompletion: true }),
      makeOccurrence({ item: makeItem({ category_id: 'cat-1' }), ownCompletion: false }),
    ]
    const result = computeCategoryStats(occurrences, categories)
    expect(result).toEqual([{ categoryId: 'cat-1', nome: 'Treino', cor: '#22c55e', done: 1, total: 2 }])
  })
})

describe('computeStreak', () => {
  it('skips days with no occurrences without breaking the streak', () => {
    const occurrences = [
      makeOccurrence({ date: '2026-01-05', ownCompletion: true }),
      makeOccurrence({ date: '2026-01-03', ownCompletion: true }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(2)
  })

  it('breaks the streak on the most recent incomplete day', () => {
    const occurrences = [
      makeOccurrence({ date: '2026-01-05', ownCompletion: false }),
      makeOccurrence({ date: '2026-01-04', ownCompletion: true }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(0)
  })

  it('requires every occurrence on a day to be completed for it to count', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ id: 'item-a' }), date: '2026-01-05', ownCompletion: true }),
      makeOccurrence({ item: makeItem({ id: 'item-b' }), date: '2026-01-05', ownCompletion: false }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(0)
  })

  it('partner-shared scope only counts shared items using partnerCompletion', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ is_shared: true }), date: '2026-01-05', partnerCompletion: true }),
      makeOccurrence({
        item: makeItem({ is_shared: false }),
        date: '2026-01-05',
        ownCompletion: true,
        partnerCompletion: false,
      }),
    ]
    expect(computeStreak(occurrences, 'partner-shared')).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: FAIL with "Cannot find module './stats'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/stats.ts`:

```ts
import type { Category } from '../features/categories/categoriesApi'
import type { Occurrence } from './occurrences'

export type CategoryStat = {
  categoryId: string
  nome: string
  cor: string
  done: number
  total: number
}

export function computeCategoryStats(occurrences: Occurrence[], categories: Category[]): CategoryStat[] {
  return categories
    .map((category) => {
      const categoryOccurrences = occurrences.filter(
        (occurrence) => occurrence.item.category_id === category.id,
      )
      return {
        categoryId: category.id,
        nome: category.nome,
        cor: category.cor,
        done: categoryOccurrences.filter((occurrence) => occurrence.ownCompletion).length,
        total: categoryOccurrences.length,
      }
    })
    .filter((stat) => stat.total > 0)
}

export function computeStreak(occurrences: Occurrence[], scope: 'own' | 'partner-shared'): number {
  const scoped = scope === 'partner-shared' ? occurrences.filter((o) => o.item.is_shared) : occurrences

  const byDate = new Map<string, Occurrence[]>()
  for (const occurrence of scoped) {
    const existing = byDate.get(occurrence.date) ?? []
    existing.push(occurrence)
    byDate.set(occurrence.date, existing)
  }

  const dates = [...byDate.keys()].sort().reverse()

  let streak = 0
  for (const date of dates) {
    const dayOccurrences = byDate.get(date)!
    const allDone = dayOccurrences.every((occurrence) =>
      scope === 'partner-shared' ? occurrence.partnerCompletion : occurrence.ownCompletion,
    )
    if (!allDone) break
    streak += 1
  }

  return streak
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat: add category completion and streak stats engine"
```

---

### Task 7: Tela Hoje

**Files:**
- Create: `src/features/today/TodayPage.tsx`
- Modify: `src/App.tsx` (only the `/` route and its import — routing for `/agenda` and `/estatisticas` is wired in Task 10, but `/` must switch to `TodayPage` here since `Home` is being replaced)

**Interfaces:**
- Consumes: `useAuth` from `../auth/AuthContext`, `listItems`/`RoutineItem` from `../items/itemsApi`, `listCategories`/`Category` from `../categories/categoriesApi`, `listCompletions`/`markComplete`/`unmarkComplete`/`ItemCompletion` from `../completions/completionsApi` (Task 2), `buildOccurrences`/`Occurrence` from `../../lib/occurrences` (Task 3), `OccurrenceRow` from `../occurrences/OccurrenceRow` (Task 5).
- Produces: default export `TodayPage`, mounted at route `/`.

No dedicated render test — same rationale as Task 5 (this codebase doesn't render-test page components). Verified via the dev-server check in Task 10.

- [ ] **Step 1: Write the component**

Create `src/features/today/TodayPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import {
  listCompletions,
  markComplete,
  unmarkComplete,
  type ItemCompletion,
} from '../completions/completionsApi'
import { buildOccurrences, type Occurrence } from '../../lib/occurrences'
import OccurrenceRow from '../occurrences/OccurrenceRow'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TodayPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
      const today = todayISO()
      const [itemsResult, categoriesResult, completionsResult] = await Promise.all([
        listItems(),
        listCategories(),
        listCompletions(today, today),
      ])
      setItems(itemsResult)
      setCategories(categoriesResult)
      setCompletions(completionsResult)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleToggle(occurrence: Occurrence) {
    if (!user) return
    setError(null)
    try {
      if (occurrence.ownCompletion) {
        await unmarkComplete(occurrence.item.id, occurrence.date)
      } else {
        await markComplete(user.id, occurrence.item.id, occurrence.date)
      }
      await loadData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!user) return null

  const today = todayISO()
  const occurrences = buildOccurrences(items, completions, user.id, today, today)

  const groups = categories
    .map((category) => ({
      category,
      occurrences: occurrences.filter((occurrence) => occurrence.item.category_id === category.id),
    }))
    .filter((group) => group.occurrences.length > 0)

  return (
    <div>
      <h1>Hoje</h1>
      <nav>
        <Link to="/agenda">Agenda</Link>
        <Link to="/estatisticas">Estatísticas</Link>
        <Link to="/categories">Categorias</Link>
        <Link to="/items">Meus itens</Link>
      </nav>
      {groups.map(({ category, occurrences: categoryOccurrences }) => (
        <section key={category.id}>
          <h2 style={{ color: category.cor }}>{category.nome}</h2>
          <ul>
            {categoryOccurrences.map((occurrence) => (
              <OccurrenceRow
                key={`${occurrence.item.id}-${occurrence.date}`}
                occurrence={occurrence}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p>Nada programado para hoje.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `/` and remove the old `Home` component**

In `src/App.tsx`, replace the `import { BrowserRouter, ... }` block's `Home` function and its usage:

Remove the `function Home() { ... }` block entirely (lines 11-21), add this import alongside the other feature imports:

```ts
import TodayPage from './features/today/TodayPage'
```

Replace the `/` route's element from `<Home />` to `<TodayPage />`:

```tsx
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TodayPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Run the full unit suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/TodayPage.tsx src/App.tsx
git commit -m "feat: add Hoje screen grouped by category with completion toggles"
```

---

### Task 8: Tela Agenda/Semana

**Files:**
- Create: `src/features/agenda/AgendaPage.tsx`
- Modify: `src/App.tsx` (add `/agenda` route and import)

**Interfaces:**
- Consumes: same as Task 7, plus `addDays`/`startOfWeek` from `../../lib/recurrence` (exported in Task 4).
- Produces: default export `AgendaPage`, mounted at route `/agenda`.

- [ ] **Step 1: Write the component**

Create `src/features/agenda/AgendaPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import {
  listCompletions,
  markComplete,
  unmarkComplete,
  type ItemCompletion,
} from '../completions/completionsApi'
import { buildOccurrences, type Occurrence } from '../../lib/occurrences'
import { addDays, startOfWeek } from '../../lib/recurrence'
import OccurrenceRow from '../occurrences/OccurrenceRow'

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user, weekStart])

  async function loadData() {
    try {
      const weekEnd = addDays(weekStart, 6)
      const [itemsResult, categoriesResult, completionsResult] = await Promise.all([
        listItems(),
        listCategories(),
        listCompletions(weekStart, weekEnd),
      ])
      setItems(itemsResult)
      setCategories(categoriesResult)
      setCompletions(completionsResult)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleToggle(occurrence: Occurrence) {
    if (!user) return
    setError(null)
    try {
      if (occurrence.ownCompletion) {
        await unmarkComplete(occurrence.item.id, occurrence.date)
      } else {
        await markComplete(user.id, occurrence.item.id, occurrence.date)
      }
      await loadData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((category) => category.id === categoryId)?.nome ?? '—'
  }

  if (!user) return null

  const weekEnd = addDays(weekStart, 6)
  const occurrences = buildOccurrences(items, completions, user.id, weekStart, weekEnd)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <div>
      <h1>Agenda da semana</h1>
      <nav>
        <Link to="/">Hoje</Link>
        <Link to="/estatisticas">Estatísticas</Link>
      </nav>
      <div>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>← Semana anterior</button>
        <button onClick={() => setWeekStart(startOfWeek(todayISO()))}>Semana atual</button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Próxima semana →</button>
      </div>
      {days.map((day, index) => {
        const dayOccurrences = occurrences.filter((occurrence) => occurrence.date === day)
        return (
          <section key={day}>
            <h2>
              {WEEKDAY_LABELS[index]} ({day})
            </h2>
            {dayOccurrences.length === 0 ? (
              <p>Nada programado.</p>
            ) : (
              <ul>
                {dayOccurrences.map((occurrence) => (
                  <OccurrenceRow
                    key={`${occurrence.item.id}-${occurrence.date}`}
                    occurrence={occurrence}
                    onToggle={handleToggle}
                    categoryName={categoryName(occurrence.item.category_id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the `/agenda` route**

In `src/App.tsx`, add the import:

```ts
import AgendaPage from './features/agenda/AgendaPage'
```

Add this route (next to the other `ProtectedRoute`-wrapped routes):

```tsx
          <Route
            path="/agenda"
            element={
              <ProtectedRoute>
                <AgendaPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Run the full unit suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/agenda/AgendaPage.tsx src/App.tsx
git commit -m "feat: add Agenda/Semana screen with week navigation"
```

---

### Task 9: Tela Estatísticas

**Files:**
- Create: `src/features/stats/StatsPage.tsx`
- Modify: `src/App.tsx` (add `/estatisticas` route and import)

**Interfaces:**
- Consumes: `computeCategoryStats`/`computeStreak` from `../../lib/stats` (Task 6), `buildOccurrences` from `../../lib/occurrences` (Task 3), plus the same items/categories/completions APIs as Tasks 7-8.
- Produces: default export `StatsPage`, mounted at route `/estatisticas`.

- [ ] **Step 1: Write the component**

Create `src/features/stats/StatsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { listCompletions, type ItemCompletion } from '../completions/completionsApi'
import { buildOccurrences } from '../../lib/occurrences'
import { computeCategoryStats, computeStreak } from '../../lib/stats'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

export default function StatsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const today = todayISO()
    const monthStart = startOfMonth(today)
    Promise.all([listItems(), listCategories(), listCompletions(monthStart, today)])
      .then(([itemsResult, categoriesResult, completionsResult]) => {
        setItems(itemsResult)
        setCategories(categoriesResult)
        setCompletions(completionsResult)
      })
      .catch((e) => setError((e as Error).message))
  }, [user])

  if (!user) return null

  const today = todayISO()
  const monthStart = startOfMonth(today)
  const occurrences = buildOccurrences(items, completions, user.id, monthStart, today)
  const categoryStats = computeCategoryStats(occurrences, categories)
  const ownStreak = computeStreak(occurrences, 'own')
  const partnerStreak = computeStreak(occurrences, 'partner-shared')

  return (
    <div>
      <h1>Estatísticas do mês</h1>
      <nav>
        <Link to="/">Hoje</Link>
        <Link to="/agenda">Agenda</Link>
      </nav>

      <section>
        <h2>Você</h2>
        <p>Streak: {ownStreak} dia(s)</p>
        <ul>
          {categoryStats.map((stat) => (
            <li key={stat.categoryId} style={{ color: stat.cor }}>
              {stat.nome}: {stat.done}/{stat.total} (
              {stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0}%)
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Parceiro</h2>
        <p>Streak (itens compartilhados): {partnerStreak} dia(s)</p>
      </section>

      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the `/estatisticas` route**

In `src/App.tsx`, add the import:

```ts
import StatsPage from './features/stats/StatsPage'
```

Add this route:

```tsx
          <Route
            path="/estatisticas"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Run the full unit suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/StatsPage.tsx src/App.tsx
git commit -m "feat: add Estatisticas screen with category and streak stats"
```

---

### Task 10: Final wiring check and manual smoke test

**Files:** none (verification only — all routing changes were already made incrementally in Tasks 7-9)

- [ ] **Step 1: Confirm the full route table is correct**

Read `src/App.tsx` and confirm it has exactly these protected routes: `/`, `/agenda`, `/estatisticas`, `/categories`, `/items`, `/items/new`, `/items/:id/edit`, `/couple-setup`, plus public `/login` and `/signup`. Confirm there is no leftover `Home` function or unused import.

- [ ] **Step 2: Run the full unit test suite**

Run: `npx vitest run`
Expected: all tests PASS (recurrence, recurrenceLabels, occurrences, stats, completionsApi, categoriesApi, itemsApi, coupleApi, supabaseClient).

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -b && npx vite build`
Expected: no errors, build succeeds.

- [ ] **Step 4: Manual smoke test in a browser**

Run `npm run dev`, log in as an existing test account (or sign up a new one), and verify:
- `/` (Hoje) shows today's items grouped by category with a working checkbox.
- Checking an item persists after a page refresh (confirms `markComplete`/`listCompletions` round-trip against the real Supabase project).
- `/agenda` shows the current week Sun-Sat, and the week-navigation buttons move the displayed range.
- `/estatisticas` shows a "Você" block with category percentages and a streak, and a "Parceiro" block with a streak (or 0 if not paired/no shared items yet).
- If a test couple is available, confirm a shared item created by one account shows the correct category name (not `—`) and the partner's completion indicator on the other account's Hoje/Agenda.

Note any issues found; fix them in the relevant task's files and re-run the affected step before proceeding.

- [ ] **Step 5: Commit any fixes found during the smoke test**

If Step 4 required changes, stage and commit them with an appropriate Conventional Commit message (e.g. `fix: ...`). If no changes were needed, skip this step.

# Notificações Push (Plano 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o fluxo completo de notificações push do app "Rotina do Casal" — permissão/registro no frontend e disparo periódico no backend — conforme `docs/superpowers/specs/2026-09-10-push-notifications-design.md`.

**Architecture:** PWA (service worker customizado via `injectManifest`) registra subscription em `push_subscriptions`; uma Supabase Edge Function agendada via `pg_cron` a cada 5 minutos calcula ocorrências no horário (reaproveitando o motor de recorrência puro) e envia Web Push assinado com VAPID, deduplicado por uma nova tabela `notification_log`.

**Tech Stack:** React + TS + Vite (`vite-plugin-pwa` com `injectManifest`), Supabase (Postgres + RLS + Edge Functions Deno + `pg_cron`/`pg_net`), biblioteca `web-push` (Deno, via `npm:` specifier no backend), Vitest.

## Global Constraints

- Commitar direto em `master`, sem branches (convenção já estabelecida neste projeto pessoal).
- Migrations e Edge Function são aplicadas manualmente via dashboard/SQL Editor do Supabase — este projeto não tem CLI configurado (mesma convenção dos Planos 1-3).
- Fuso horário fixo em UTC-3 no cálculo do cron (sem configuração por usuário) — decisão explícita do spec.
- Cron roda a `*/5 * * * *` (a cada 5 minutos).
- Deep-link do push sempre abre `/items/:id/edit`.
- Chaves VAPID geradas localmente (`web-push`), sem depender de serviço externo.
- Nunca commitar a chave privada VAPID nem a service role key — só a chave pública VAPID entra em `.env.local`/`.env.example` do frontend.

---

## Task 1: Gerar chaves VAPID e preparar variáveis de ambiente

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (não commitado)

**Interfaces:**
- Produces: `VITE_VAPID_PUBLIC_KEY` (env var consumida pelo frontend na Task 5); chave privada VAPID (guardada fora do repo, usada como secret da Edge Function na Task 7).

- [ ] **Step 1: Gerar o par de chaves VAPID**

Rodar (não precisa instalar como dependência do projeto, `npx` baixa temporariamente):

```bash
npx web-push generate-vapid-keys
```

Saída esperada (exemplo de formato, valores reais serão diferentes):

```
=======================================

Public Key:
BExampleUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU

Private Key:
ExamplePPPPPPPPPPPPPPPPPPPPPPPPPPPP

=======================================
```

- [ ] **Step 2: Guardar a chave privada em local seguro**

Copiar o valor de `Private Key` para um gerenciador de senhas ou anotação segura — ela será necessária na Task 7 como secret `VAPID_PRIVATE_KEY` da Edge Function. Não colar em nenhum arquivo do repositório.

- [ ] **Step 3: Adicionar a chave pública ao `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

- [ ] **Step 4: Adicionar a chave pública real ao `.env.local`**

Editar `.env.local` (arquivo já existe e já é ignorado pelo git) adicionando a linha:

```
VITE_VAPID_PUBLIC_KEY=<a Public Key gerada no Step 1>
```

- [ ] **Step 5: Verificar que `.env.local` continua fora do controle de versão**

```bash
git status
```

Esperado: `.env.local` não aparece na lista (já coberto por `.gitignore` desde o Plano 1); só `.env.example` aparece como modificado.

- [ ] **Step 6: Commit**

```bash
git add .env.example
git commit -m "chore: add VITE_VAPID_PUBLIC_KEY placeholder for push notifications"
```

---

## Task 2: Migration `notification_log` + constraint única em `push_subscriptions`

**Files:**
- Create: `supabase/migrations/0004_notification_log.sql`
- Create: `tests/integration/notifications.test.ts`

**Interfaces:**
- Consumes: tabelas `routine_items`, `push_subscriptions`, `auth.users` (já existentes desde o Plano 1).
- Produces: tabela `notification_log` (colunas `id, routine_item_id, user_id, occurrence_date, sent_at`, unique em `routine_item_id+user_id+occurrence_date`) e constraint única `push_subscriptions_user_id_key` em `push_subscriptions.user_id` — usadas pela Edge Function (Task 7) e pela API de subscription do frontend (Task 5).

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0004_notification_log.sql`:

```sql
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  routine_item_id uuid not null references routine_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_date date not null,
  sent_at timestamptz not null default now(),
  unique (routine_item_id, user_id, occurrence_date)
);

alter table notification_log enable row level security;

create policy "select own notification log"
on notification_log for select
using (user_id = auth.uid());

alter table push_subscriptions
  add constraint push_subscriptions_user_id_key unique (user_id);
```

- [ ] **Step 2: Aplicar a migration manualmente no Supabase**

Abrir o SQL Editor do projeto no dashboard do Supabase, colar o conteúdo do arquivo acima e executar. Confirmar que não houve erro (mesma rotina manual usada nas migrations `0001`-`0003`).

- [ ] **Step 3: Escrever os testes de integração (falham até a migration ser aplicada e o teste rodar contra o projeto certo)**

`tests/integration/notifications.test.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

async function signUp(email: string, password: string) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return { client, userId: data.user!.id }
}

describe('notification_log RLS', () => {
  it('a regular user cannot insert into notification_log', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-notiflog-${ts}@gmail.com`, 'password123')

    const { data: category } = await a.client
      .from('categories')
      .insert({ user_id: a.userId, nome: 'Treino', cor: '#000', icone: 'dumbbell' })
      .select()
      .single()

    const { data: item } = await a.client
      .from('routine_items')
      .insert({
        user_id: a.userId,
        category_id: category!.id,
        titulo: 'Alongar',
        data_inicio: '2026-09-10',
        horario: '09:00',
        is_shared: false,
      })
      .select()
      .single()

    const { error } = await a.client.from('notification_log').insert({
      routine_item_id: item!.id,
      user_id: a.userId,
      occurrence_date: '2026-09-10',
    })

    expect(error).not.toBeNull()
  })
})

describe('push_subscriptions unique constraint', () => {
  it('upserting by user_id overwrites the previous subscription instead of adding a row', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-pushsub-${ts}@gmail.com`, 'password123')

    await a.client
      .from('push_subscriptions')
      .insert({ user_id: a.userId, subscription_json: { endpoint: 'https://push.example/old' } })

    await a.client
      .from('push_subscriptions')
      .upsert(
        { user_id: a.userId, subscription_json: { endpoint: 'https://push.example/new' } },
        { onConflict: 'user_id' },
      )

    const { data: rows } = await a.client
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', a.userId)

    expect(rows).toHaveLength(1)
    expect(rows![0].subscription_json.endpoint).toBe('https://push.example/new')
  })
})
```

- [ ] **Step 4: Rodar os testes de integração contra o projeto Supabase real**

```bash
SUPABASE_URL=https://<seu-ref>.supabase.co SUPABASE_ANON_KEY=<anon-key-do-dashboard> npx vitest run tests/integration/notifications.test.ts
```

Expected: PASS nos dois testes (`a regular user cannot insert into notification_log`, `upserting by user_id overwrites the previous subscription instead of adding a row`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_notification_log.sql tests/integration/notifications.test.ts
git commit -m "feat: add notification_log table and push_subscriptions unique constraint"
```

---

## Task 3: Lógica pura de janela de notificação

**Files:**
- Create: `src/lib/notificationWindow.ts`
- Test: `src/lib/notificationWindow.test.ts`

**Interfaces:**
- Consumes: `isOccurrence`, `type RecurrenceRule`, `type RecurrenceEnd` de `src/lib/recurrence.ts` (já existentes).
- Produces: `shouldNotifyNow(item, today, windowStart, windowEnd): boolean` e `isWithinWindow(horario, windowStart, windowEnd): boolean` — a mesma lógica é replicada (copiada) dentro da Edge Function na Task 7, já que Deno não importa arquivos do `src/` do frontend.

- [ ] **Step 1: Escrever o teste falhando**

`src/lib/notificationWindow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isWithinWindow, shouldNotifyNow, type NotifiableItem } from './notificationWindow'

describe('isWithinWindow', () => {
  it('returns true when horario is inside a normal (non-wrapping) window', () => {
    expect(isWithinWindow('09:03', '09:00', '09:05')).toBe(true)
  })

  it('returns false when horario is before the window', () => {
    expect(isWithinWindow('08:59', '09:00', '09:05')).toBe(false)
  })

  it('is exclusive on windowStart and inclusive on windowEnd', () => {
    expect(isWithinWindow('09:00', '09:00', '09:05')).toBe(false)
    expect(isWithinWindow('09:05', '09:00', '09:05')).toBe(true)
  })

  it('handles a window that wraps past midnight', () => {
    expect(isWithinWindow('23:58', '23:57', '00:02')).toBe(true)
    expect(isWithinWindow('00:01', '23:57', '00:02')).toBe(true)
    expect(isWithinWindow('12:00', '23:57', '00:02')).toBe(false)
  })

  it('accepts horario with seconds and compares only HH:MM', () => {
    expect(isWithinWindow('09:03:00', '09:00', '09:05')).toBe(true)
  })
})

describe('shouldNotifyNow', () => {
  const dailyItem: NotifiableItem = {
    id: 'item-1',
    data_inicio: '2026-09-01',
    horario: '09:00',
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
  }

  it('returns true when today is an occurrence and horario is inside the window', () => {
    expect(shouldNotifyNow(dailyItem, '2026-09-10', '08:56', '09:00')).toBe(true)
  })

  it('returns false when today is an occurrence but horario is outside the window', () => {
    expect(shouldNotifyNow(dailyItem, '2026-09-10', '10:00', '10:05')).toBe(false)
  })

  it('returns false when today is not an occurrence (before data_inicio)', () => {
    expect(shouldNotifyNow(dailyItem, '2026-08-31', '08:56', '09:00')).toBe(false)
  })

  it('returns false when the recurrence has already ended', () => {
    const endedItem: NotifiableItem = {
      ...dailyItem,
      recurrence_end: { type: 'date', value: '2026-09-05' },
    }
    expect(shouldNotifyNow(endedItem, '2026-09-10', '08:56', '09:00')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/lib/notificationWindow.test.ts
```

Expected: FAIL — `Cannot find module './notificationWindow'`.

- [ ] **Step 3: Implementar**

`src/lib/notificationWindow.ts`:

```ts
import { isOccurrence, type RecurrenceEnd, type RecurrenceRule } from './recurrence'

export type NotifiableItem = {
  id: string
  data_inicio: string
  horario: string
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

export function isWithinWindow(horario: string, windowStart: string, windowEnd: string): boolean {
  const time = horario.slice(0, 5)
  if (windowStart <= windowEnd) {
    return time > windowStart && time <= windowEnd
  }
  return time > windowStart || time <= windowEnd
}

export function shouldNotifyNow(
  item: NotifiableItem,
  today: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  if (!isOccurrence(item.recurrence_rule, item.recurrence_end, item.data_inicio, today)) return false
  return isWithinWindow(item.horario, windowStart, windowEnd)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/lib/notificationWindow.test.ts
```

Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationWindow.ts src/lib/notificationWindow.test.ts
git commit -m "feat: add pure notification-window logic"
```

---

## Task 4: Service worker customizado (`injectManifest`)

**Files:**
- Modify: `vite.config.ts`
- Create: `src/sw.ts`
- Modify: `package.json` (nova devDependency `workbox-precaching`)

**Interfaces:**
- Produces: service worker que escuta `push` (mostra notificação) e `notificationclick` (abre `/items/${itemId}/edit`) — consumido pelo navegador quando a Edge Function (Task 7) envia um push registrado via `subscribeToPush` (Task 5).

- [ ] **Step 1: Adicionar `workbox-precaching` como devDependency**

```bash
npm install -D workbox-precaching@^7.4.1
```

- [ ] **Step 2: Trocar a estratégia do `vite-plugin-pwa` para `injectManifest`**

Editar `vite.config.ts`:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rotina do Casal',
        short_name: 'Rotina',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6366f1',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
  },
})
```

- [ ] **Step 3: Criar o service worker customizado**

`src/sw.ts`:

```ts
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

type PushPayload = { title?: string; body?: string; itemId?: string }

self.addEventListener('push', (event: PushEvent) => {
  const data: PushPayload = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Rotina', {
      body: data.body,
      data: { itemId: data.itemId },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const itemId = (event.notification.data as { itemId?: string } | undefined)?.itemId
  const url = itemId ? `/items/${itemId}/edit` : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((client): client is WindowClient => 'focus' in client)
      if (existing) {
        return existing.focus().then(() => existing.navigate(url))
      }
      return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 4: Verificar que o build continua funcionando**

```bash
npm run build
```

Expected: build termina sem erro, e o output (`dist/`) contém um `sw.js` gerado a partir de `src/sw.ts` (verificar com `ls dist` ou equivalente — o nome exato do arquivo gerado depende do hash do Workbox, mas deve haver um arquivo `sw.js` ou `sw-*.js` na raiz de `dist/`).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/sw.ts package.json package-lock.json
git commit -m "feat: switch to a custom service worker for push notifications"
```

---

## Task 5: API de subscription do frontend

**Files:**
- Create: `src/features/notifications/notificationsApi.ts`
- Test: `src/features/notifications/notificationsApi.test.ts`

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabaseClient.ts`; `import.meta.env.VITE_VAPID_PUBLIC_KEY` (Task 1); constraint única `push_subscriptions.user_id` (Task 2); `navigator.serviceWorker`/`Notification`/`PushManager` do browser (registrados pelo service worker da Task 4).
- Produces: `getExistingSubscription()`, `subscribeToPush(userId)`, `unsubscribeFromPush(userId)`, `isPushSupported()` — consumidos pela `SettingsPage` na Task 6.

- [ ] **Step 1: Escrever os testes falhando**

`src/features/notifications/notificationsApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from './notificationsApi'
import { supabase } from '../../lib/supabaseClient'

vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BEXAMPLEKEYBASE64URLSAFEVALUEFORTESTS1234567890')

vi.mock('../../lib/supabaseClient', () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })
  const from = vi.fn().mockReturnValue({ upsert, delete: del })
  return { supabase: { from } }
})

function mockServiceWorker(pushManager: Record<string, unknown>) {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  })
}

describe('notificationsApi', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockClear()
  })

  it('getExistingSubscription returns the current subscription', async () => {
    const fakeSub = { endpoint: 'https://push.example/1' }
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(fakeSub) })

    const result = await getExistingSubscription()
    expect(result).toBe(fakeSub)
  })

  it('subscribeToPush throws when permission is denied', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    mockServiceWorker({ subscribe: vi.fn() })

    await expect(subscribeToPush('user-a')).rejects.toThrow('Permissão de notificação negada')
  })

  it('subscribeToPush saves the subscription when permission is granted', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    const fakeSub = { toJSON: () => ({ endpoint: 'https://push.example/1' }) }
    mockServiceWorker({ subscribe: vi.fn().mockResolvedValue(fakeSub) })

    await expect(subscribeToPush('user-a')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('unsubscribeFromPush unsubscribes and deletes the row', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) })

    await expect(unsubscribeFromPush('user-a')).resolves.toBeUndefined()
    expect(unsubscribe).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('unsubscribeFromPush is a no-op on the browser side when there is no active subscription', async () => {
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(null) })

    await expect(unsubscribeFromPush('user-a')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('isPushSupported reflects browser capability', () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', {})
    mockServiceWorker({})

    expect(isPushSupported()).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npx vitest run src/features/notifications/notificationsApi.test.ts
```

Expected: FAIL — `Cannot find module './notificationsApi'`.

- [ ] **Step 3: Implementar**

`src/features/notifications/notificationsApi.ts`:

```ts
import { supabase } from '../../lib/supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(userId: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, subscription_json: subscription.toJSON() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()

  const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId)
  if (error) throw error
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npx vitest run src/features/notifications/notificationsApi.test.ts
```

Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notificationsApi.ts src/features/notifications/notificationsApi.test.ts
git commit -m "feat: add push subscription API"
```

---

## Task 6: Tela de Configurações

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/today/TodayPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` de `src/features/auth/AuthContext.tsx`; `getExistingSubscription`, `isPushSupported`, `subscribeToPush`, `unsubscribeFromPush` de `src/features/notifications/notificationsApi.ts` (Task 5).
- Produces: rota `/configuracoes`, protegida por `ProtectedRoute`, com link de navegação a partir da tela Hoje.

- [ ] **Step 1: Criar a tela**

`src/features/settings/SettingsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../notifications/notificationsApi'

export default function SettingsPage() {
  const { user } = useAuth()
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false)
      return
    }
    getExistingSubscription().then((subscription) => setEnabled(subscription !== null))
  }, [])

  async function handleToggle() {
    if (!user) return
    setError(null)
    try {
      if (enabled) {
        await unsubscribeFromPush(user.id)
        setEnabled(false)
      } else {
        await subscribeToPush(user.id)
        setEnabled(true)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>Configurações</h1>
      <nav>
        <Link to="/">Hoje</Link>
      </nav>
      {!supported && (
        <p>
          Notificações não são suportadas neste navegador. No iPhone, é preciso iOS 16.4+ e ter
          instalado o app na tela inicial antes de ativar.
        </p>
      )}
      {supported && (
        <label>
          <input type="checkbox" checked={enabled} onChange={handleToggle} />
          Notificações
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Registrar a rota em `App.tsx`**

Adicionar o import junto aos outros de `src/App.tsx`:

```ts
import SettingsPage from './features/settings/SettingsPage'
```

Adicionar a rota logo após a de `/estatisticas`:

```tsx
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Adicionar o link de navegação na tela Hoje**

Em `src/features/today/TodayPage.tsx`, no bloco `<nav>`, adicionar depois de "Meus itens":

```tsx
        <Link to="/configuracoes">Configurações</Link>
```

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
```

Abrir `http://localhost:5173`, logar, clicar em "Configurações" a partir da tela Hoje, confirmar que a tela carrega e mostra o toggle (ou a mensagem de "não suportado", dependendo do navegador de teste).

- [ ] **Step 5: Rodar a suíte de testes completa pra garantir que nada quebrou**

```bash
npm test
```

Expected: PASS em todos os testes existentes (nenhum teste novo nesta task — `SettingsPage` segue o padrão do resto do projeto de não ter teste de componente dedicado para páginas).

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.tsx src/App.tsx src/features/today/TodayPage.tsx
git commit -m "feat: add Configuracoes screen with notification toggle"
```

---

## Task 7: Edge Function `send-push-notifications`

**Files:**
- Create: `supabase/functions/send-push-notifications/index.ts`

**Interfaces:**
- Consumes: tabelas `routine_items`, `item_completions`, `push_subscriptions`, `notification_log` (Task 2), função SQL `partner_id(uid)` (já existente desde o Plano 1); secrets `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (injetados automaticamente pelo runtime de Edge Functions) e `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (configurados manualmente, chave gerada na Task 1).
- Produces: função HTTP invocável, agendada pelo cron da Task 8.

- [ ] **Step 1: Escrever o código da function**

`supabase/functions/send-push-notifications/index.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'

// --- Motor de recorrência (copiado de src/lib/recurrence.ts — Deno não importa arquivos do frontend) ---

type RecurrenceRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] }
  | { type: 'monthly'; dayOfMonth: number }

type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'date'; value: string }
  | { type: 'count'; value: number }

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

function getOccurrencesInRange(
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

function isOccurrence(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  checkDate: string,
): boolean {
  if (checkDate < startDate) return false
  return getOccurrencesInRange(rule, end, startDate, checkDate, checkDate).length > 0
}

function isWithinWindow(horario: string, windowStart: string, windowEnd: string): boolean {
  const time = horario.slice(0, 5)
  if (windowStart <= windowEnd) {
    return time > windowStart && time <= windowEnd
  }
  return time > windowStart || time <= windowEnd
}

// --- Janela de tempo em UTC-3 fixo ---

function localWindow(): { today: string; windowStart: string; windowEnd: string } {
  const OFFSET_MS = 3 * 60 * 60 * 1000
  const now = new Date(Date.now() - OFFSET_MS)
  const windowStartDate = new Date(now.getTime() - 5 * 60 * 1000)

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    today: now.toISOString().slice(0, 10),
    windowStart: `${pad(windowStartDate.getUTCHours())}:${pad(windowStartDate.getUTCMinutes())}`,
    windowEnd: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
  }
}

// --- Handler ---

type RoutineItemRow = {
  id: string
  user_id: string
  titulo: string
  notas: string | null
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

  webpush.setVapidDetails('mailto:luccasmadia07@gmail.com', vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { today, windowStart, windowEnd } = localWindow()

  const { data: items, error: itemsError } = await supabase
    .from('routine_items')
    .select('id, user_id, titulo, notas, data_inicio, horario, is_shared, recurrence_rule, recurrence_end')
    .lte('data_inicio', today)

  if (itemsError) {
    return new Response(JSON.stringify({ error: itemsError.message }), { status: 500 })
  }

  let notified = 0
  let skipped = 0

  for (const item of (items ?? []) as RoutineItemRow[]) {
    const isDue =
      isOccurrence(item.recurrence_rule, item.recurrence_end, item.data_inicio, today) &&
      isWithinWindow(item.horario, windowStart, windowEnd)
    if (!isDue) continue

    const recipients = [item.user_id]
    if (item.is_shared) {
      const { data: partnerId } = await supabase.rpc('partner_id', { uid: item.user_id })
      if (partnerId) recipients.push(partnerId as string)
    }

    for (const recipientId of recipients) {
      const { data: completion } = await supabase
        .from('item_completions')
        .select('id')
        .eq('routine_item_id', item.id)
        .eq('user_id', recipientId)
        .eq('data', today)
        .maybeSingle()
      if (completion) {
        skipped += 1
        continue
      }

      const { error: logError } = await supabase
        .from('notification_log')
        .insert({ routine_item_id: item.id, user_id: recipientId, occurrence_date: today })
      if (logError) {
        skipped += 1
        continue
      }

      const { data: subscriptionRow } = await supabase
        .from('push_subscriptions')
        .select('subscription_json')
        .eq('user_id', recipientId)
        .maybeSingle()
      if (!subscriptionRow) {
        skipped += 1
        continue
      }

      try {
        await webpush.sendNotification(
          subscriptionRow.subscription_json,
          JSON.stringify({
            title: `Hora de: ${item.titulo}`,
            body: item.notas ?? '',
            itemId: item.id,
          }),
        )
        notified += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('user_id', recipientId)
        }
        skipped += 1
      }
    }
  }

  return new Response(JSON.stringify({ notified, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Publicar a function manualmente no dashboard do Supabase**

No dashboard: Edge Functions → Create a new function → nome `send-push-notifications` → colar o conteúdo do arquivo acima → Deploy.

- [ ] **Step 3: Configurar os secrets da function**

No dashboard: Edge Functions → `send-push-notifications` → Secrets, adicionar:
- `VAPID_PUBLIC_KEY`: a mesma chave pública da Task 1.
- `VAPID_PRIVATE_KEY`: a chave privada guardada na Task 1, Step 2.

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente pelo runtime, não precisam ser configurados manualmente.)

- [ ] **Step 4: Testar a function manualmente via curl**

```bash
curl -X POST 'https://<seu-ref>.supabase.co/functions/v1/send-push-notifications' \
  -H "Authorization: Bearer <service-role-key-do-dashboard>"
```

Expected: resposta JSON `{"notified":0,"skipped":0}` (ou números maiores, se já existir algum item com horário na janela dos últimos 5 minutos) — sem erro 500.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-push-notifications/index.ts
git commit -m "feat: add send-push-notifications edge function"
```

---

## Task 8: Agendamento via `pg_cron`

**Files:**
- Create: `supabase/migrations/0005_notification_cron.sql`

**Interfaces:**
- Consumes: a Edge Function publicada e testada na Task 7.
- Produces: job `pg_cron` chamando a function a cada 5 minutos.

- [ ] **Step 1: Escrever a migration com placeholders**

`supabase/migrations/0005_notification_cron.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-push-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
  );
  $$
);
```

Os placeholders `<project-ref>` e `<service-role-key>` ficam no arquivo commitado (não são segredo por si só sem o outro — o `project-ref` é público, e a service role key nunca é preenchida de verdade neste arquivo). O preenchimento real acontece só na cópia colada no SQL Editor do Supabase, nunca commitado.

- [ ] **Step 2: Aplicar manualmente, com os valores reais, no SQL Editor**

Copiar o conteúdo do Step 1, substituir `<project-ref>` pela referência real do projeto (visível na URL do dashboard) e `<service-role-key>` pela service role key (Settings → API), colar no SQL Editor e executar.

- [ ] **Step 3: Confirmar que o job foi agendado**

No SQL Editor, rodar:

```sql
select jobid, schedule, jobname, active from cron.job where jobname = 'send-push-notifications';
```

Expected: uma linha com `schedule = '*/5 * * * *'` e `active = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_notification_cron.sql
git commit -m "feat: schedule send-push-notifications every 5 minutes via pg_cron"
```

---

## Verificação final (fora de qualquer task individual)

Depois de todas as 8 tasks aplicadas (código commitado + migrations/function/cron aplicados manualmente no Supabase):

1. Rodar a suíte completa: `npm test` — todos os testes (incluindo `notificationWindow.test.ts` e `notificationsApi.test.ts`) devem passar.
2. Rodar os testes de integração: `SUPABASE_URL=... SUPABASE_ANON_KEY=... npx vitest run tests/integration/` — todos devem passar, incluindo os novos de `notifications.test.ts`.
3. Teste manual em dispositivo real (Android e iPhone 16.4+): instalar o PWA, ativar notificação em `/configuracoes`, criar um item de rotina com horário poucos minutos no futuro, aguardar o push chegar e confirmar que tocar nele abre o item certo em `/items/:id/edit`.
4. Deletar as contas de teste de integração criadas durante o desenvolvimento (emails contendo `+a-notiflog-`, `+a-pushsub-`) via SQL Editor, seguindo a convenção de limpeza manual já usada nos Planos 1-3.

# Notificações Push — Design (Plano 4)

## Contexto e objetivo

Plano 4 do app "Rotina do Casal" (ver `docs/superpowers/specs/2026-08-12-app-rotina-casal-design.md` pro spec geral; Planos 1-3 já implementados entregaram autenticação, categorias, itens de rotina com recorrência, e as telas Hoje/Agenda/Estatísticas). O spec geral já previa notificações como "essenciais": este plano entrega o fluxo completo de Web Push — pedido de permissão e registro no frontend, e o disparo periódico no backend — fechando o último item pendente do escopo v1.

## Escopo

**Dentro do Plano 4:**
- Troca da estratégia do `vite-plugin-pwa` para `injectManifest`, com service worker customizado tratando `push` e `notificationclick`.
- Nova tela `/configuracoes` com toggle de ativar/desativar notificações.
- API de subscription (`notificationsApi.ts`): subscribe/unsubscribe, upsert/delete em `push_subscriptions`.
- Nova tabela `notification_log` (dedupe de envios).
- Edge Function (`send-push-notifications`) rodando via `pg_cron` a cada 5 minutos, calculando ocorrências no horário e disparando Web Push via VAPID.
- Geração do par de chaves VAPID.
- Testes unitários da lógica "deve notificar agora?" e de integração da RLS/dedupe.

**Fora do Plano 4:**
- Tela de histórico de notificações enviadas (não há necessidade de UI agora; `notification_log` existe só como controle interno).
- Notificações por outros canais (email, SMS) — fora do escopo geral do app.
- Configuração de fuso horário por usuário — fixado em UTC-3 no código, conforme decisão do produto (app é só para duas pessoas, mesmo fuso).
- Otimização de performance da Edge Function (batch de push, retry com backoff) — volume de duas pessoas não justifica agora, mesma convenção de simplicidade do resto do app.

## Modelo de dados

`push_subscriptions` já existe (migration `0001_init_schema.sql`, Plano 1) com RLS `manage own subscriptions` (`user_id = auth.uid()` para todas as operações) — nenhuma mudança necessária nela.

**Nova migration** (`0004_notification_log.sql`):

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
```

- Não há policy de INSERT/UPDATE/DELETE para usuários comuns — só a Edge Function grava, usando a service role key (que ignora RLS). A policy de SELECT existe por coerência com o resto do schema, mesmo sem tela que a consuma hoje.
- A constraint `unique (routine_item_id, user_id, occurrence_date)` é a trava de dedupe: a Edge Function insere antes de enviar o push; se o insert falhar por violação de unicidade (execução sobreposta do cron, ou a mesma ocorrência revisitada dentro da janela de 5min), o envio daquele destinatário é pulado.

**Nova migration** (`0005_notification_cron.sql`): habilita `pg_cron`/`pg_net` (extensões já disponíveis no Supabase) e agenda a chamada HTTP para a Edge Function a cada 5 minutos:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-push-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/send-push-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);
```

Como as demais migrations deste projeto, `0004` e `0005` são aplicadas manualmente via Supabase SQL Editor (sem CLI configurado). `<PROJECT_URL>` e `<SERVICE_ROLE_KEY>` são preenchidos na hora de aplicar, não commitados em texto puro — ficam só na migration aplicada no dashboard, não no arquivo do repositório (o arquivo do repositório guarda placeholders).

## Frontend

### Service worker

`vite.config.ts` muda de `VitePWA({ registerType: 'autoUpdate', manifest: {...} })` para:

```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'autoUpdate',
  manifest: { /* inalterado */ },
})
```

Novo `src/sw.ts`:

```ts
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Rotina', {
      body: data.body,
      data: { itemId: data.itemId },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const itemId = event.notification.data?.itemId
  const url = itemId ? `/items/${itemId}/edit` : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) return existing.focus().then(() => existing.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
```

- `workbox-precaching` precisa entrar como devDependency (`vite-plugin-pwa` já traz Workbox como peer, mas o import direto no SW customizado exige o pacote explícito).
- Mantém o mesmo comportamento de cache offline que o `generateSW` já fornecia, só adicionando os dois listeners.

### API de subscription

`src/features/notifications/notificationsApi.ts`:

```ts
export async function getExistingSubscription(): Promise<PushSubscription | null>
export async function subscribeToPush(userId: string): Promise<void>
export async function unsubscribeFromPush(userId: string): Promise<void>
```

- `getExistingSubscription`: `navigator.serviceWorker.ready` → `registration.pushManager.getSubscription()`. Usado pela tela de Configurações pra saber o estado inicial do toggle sem precisar de round-trip ao banco.
- `subscribeToPush`: `Notification.requestPermission()` → se `'granted'`, `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })` → upsert em `push_subscriptions` (`onConflict: 'user_id'`, exige uma constraint única em `user_id` que ainda não existe — adicionada na mesma migration `0004`) com o JSON da subscription. Se a permissão for negada, lança um erro tipado que a tela usa pra mostrar a mensagem de "ative nas configurações do navegador".
- `unsubscribeFromPush`: chama `subscription.unsubscribe()` no navegador e depois `delete().eq('user_id', userId)` em `push_subscriptions`.
- `VITE_VAPID_PUBLIC_KEY` entra em `.env.local`, mesmo padrão da anon key do Supabase já usada no projeto.

Ajuste em `0004_notification_log.sql`: adicionar `alter table push_subscriptions add constraint push_subscriptions_user_id_key unique (user_id);` — hoje a tabela permite múltiplas subscriptions por usuário; com o upsert por `user_id`, cada pessoa passa a ter no máximo uma subscription ativa (a mais recente sobrescreve a anterior), evitando acumular subscriptions mortas de instalações antigas do PWA.

### Tela de Configurações

`src/features/settings/SettingsPage.tsx`, rota `/configuracoes`, atrás de `ProtectedRoute`, link novo na navegação (mesmo lugar onde já existem os links para Categorias/Agenda/Estatísticas).

- No mount, chama `getExistingSubscription()` pra definir o estado inicial do toggle.
- Toggle "Notificações": ligado → `subscribeToPush(user.id)`; desligado → `unsubscribeFromPush(user.id)`.
- Estados de erro tratados inline (sem modal): permissão negada mostra texto fixo explicando como reativar manualmente no navegador; `Notification`/`PushManager` ausentes no `window` (iOS < 16.4 ou PWA não instalado na tela inicial) mostram a mensagem de limitação já prevista no spec geral, desabilitando o toggle em vez de deixá-lo falhar silenciosamente.

## Backend — Edge Function

`supabase/functions/send-push-notifications/index.ts`, Deno, publicada manualmente via dashboard (sem CLI, mesma convenção das migrations).

### Fluxo por execução

1. Calcula `now` aplicando offset fixo de -3h sobre `new Date()` (UTC-3, decisão já tomada — sem lookup de fuso por usuário). Deriva `today` (data local) e a janela `[now - 5min, now]` em `HH:MM`.
2. Busca todos `routine_items` cujo `data_inicio <= today` via service role client.
3. Para cada item, reaproveita a lógica pura de `isOccurrence` (copiada de `src/lib/recurrence.ts` para dentro da function — é TS puro sem dependência de DOM/Supabase, então o arquivo é replicado, não importado via path relativo cross-package) pra confirmar se `today` é uma ocorrência válida, e verifica se `horario` do item cai dentro da janela de 5 minutos.
4. Para cada ocorrência que bate:
   - Monta a lista de destinatários: sempre o `user_id` dono; também o parceiro (via `partner_id`, já existente como função SQL) se `is_shared = true`.
   - Remove da lista quem já tem `item_completions` para aquela ocorrência (`routine_item_id` + `data = today` + `user_id` do destinatário) — quem já concluiu não é incomodado.
   - Para cada destinatário restante, tenta `insert` em `notification_log` (`routine_item_id`, `user_id`, `occurrence_date: today`). Se o insert falhar por violação de unicidade (código `23505`), pula esse destinatário (já foi notificado por outra execução).
   - Se o insert for bem-sucedido, busca a `push_subscriptions` do destinatário e envia o Web Push (`web-push` via `npm:web-push` no Deno) com payload `{ title: 'Hora de: ' + titulo, body: notas ?? '', itemId: routine_item_id }`.
   - Se o envio retornar 404/410 (subscription expirada), apaga a linha correspondente de `push_subscriptions`.
5. Function não recebe payload de request — é sempre invocada sem argumentos pelo `pg_cron`, e retorna um resumo (`{ notified: number, skipped: number }`) só para fins de log no dashboard.

### VAPID

Par de chaves gerado durante a implementação (`npx web-push generate-vapid-keys` ou lib equivalente). Chave pública vai para `.env.local` do frontend (`VITE_VAPID_PUBLIC_KEY`); chave privada é configurada como secret da Edge Function (`VAPID_PRIVATE_KEY`, via dashboard de Supabase Functions → Secrets) — nunca commitada no repositório.

## Erros e casos de borda

- Usuário sem subscription ativa (nunca ativou, ou desativou): simplesmente não aparece em `push_subscriptions`, a function pula silenciosamente — sem erro.
- Item excluído entre o cálculo da ocorrência e o envio: `routine_item_id` no `notification_log` tem `on delete cascade`, então uma corrida aqui só faria a linha de log desaparecer junto, sem erro visível.
- Cron perde uma execução (Edge Function fora do ar por >5min): a próxima execução só olha a janela dos últimos 5 minutos a partir do `now` corrente, então uma ocorrência que caiu fora dessa janela por causa da falha não gera notificação atrasada — aceito como comportamento razoável para um app de lembrete (notificação atrasada de "hora de: X" já não faz sentido).
- Permissão de notificação negada pelo navegador: tratado na tela de Configurações (ver acima), sem retry automático — precisa ser reativado manualmente nas configurações do navegador/SO, limitação inerente à Web Push API.

## Testes

**Unitários** (Vitest):
- Função pura "deve notificar agora?" (extraída em `src/lib/notificationWindow.ts`, compartilhada entre o teste e a cópia usada na Edge Function): cobre os 4 tipos de recorrência com horário dentro/fora da janela de 5min, item com `recurrence_end` já vencido, item já concluído pelo destinatário (não notifica).

**Integração** (`tests/integration/rls.test.ts`, mesmo arquivo dos planos anteriores):
- Usuário comum não consegue inserir/atualizar/deletar em `notification_log` (só SELECT da própria linha).
- `push_subscriptions` com a nova constraint única por `user_id`: segundo upsert do mesmo usuário sobrescreve a subscription anterior em vez de criar uma segunda linha.

**Manual, dispositivo real** (já previsto no spec geral, não automatizável):
- Instalar o PWA num Android e num iPhone 16.4+, ativar notificação em `/configuracoes`, criar um item com horário poucos minutos no futuro, confirmar que o push chega e que tocar nele abre `/items/:id/edit` do item certo.

## Fora deste documento

Retry/backoff de envio de push com falha transitória (fora 404/410) e batching de envios em massa ficam para quando o volume de itens/usuários justificar — hoje é um cron de 5 em 5 minutos para duas pessoas.

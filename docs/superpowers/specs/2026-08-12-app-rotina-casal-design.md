# App de Rotina para Casal — Design (v1 / teste)

## Contexto e objetivo

App mobile (PWA) para gerenciar rotina pessoal e compartilhada, usado inicialmente só por duas pessoas (um casal) como teste. Sem custo de publicação nesta fase: distribuição via PWA instalável na tela inicial (Android e iOS), sem passar pelas lojas.

## Decisões de escopo

- **Categorias**: customizáveis por usuário. Cada conta nova recebe 4 categorias padrão (Treino/Saúde, Estudos, Trabalho, Lazer), mas o usuário pode criar, editar e remover categorias livremente.
- **Modelo de dados entre os dois**: rotina pessoal por padrão (privada, só o dono vê) + itens marcáveis como compartilhados (`is_shared`), que aparecem para o parceiro.
- **Edição de itens compartilhados**: qualquer um dos dois pode editar/excluir um item com `is_shared = true`. Itens pessoais só são editáveis pelo dono.
- **Conclusão (completion)**: sempre por pessoa, mesmo em itens compartilhados — cada um marca sua própria conclusão independentemente.
- **Recorrência**: precisa suportar diária, dias específicos da semana, intervalo semanal/mensal (ex: a cada 2 semanas, todo dia 5), evento único, e limite por data-fim ou número de repetições.
- **Notificações**: essenciais. Via Web Push a partir do PWA instalado na tela inicial (iOS requer 16.4+ e instalação prévia — limitação conhecida e aceita).
- **Autenticação**: email + senha via Supabase Auth.
- **Fora de escopo nesta v1**: edição colaborativa em tempo real (last-write-wins é suficiente), comentários/chat no app, suporte a múltiplos casais/grupos (só um par vinculado por conta).

## Arquitetura

- **Frontend**: PWA em React + Vite, com service worker para funcionamento offline básico e recebimento de push notifications. Hospedagem gratuita (Vercel ou Netlify).
- **Backend**: Supabase — Postgres (dados), Auth (login email/senha), Realtime (sincronização entre os dois dispositivos), RLS (Row Level Security) para isolar itens pessoais de itens compartilhados.
- **Notificações**: Supabase Edge Function em cron (execução a cada poucos minutos) que verifica ocorrências com horário batendo e dispara Web Push para os `push_subscriptions` registrados. Notificação simples ("Hora de: [título]") com deep-link para o item.

## Modelo de dados (Postgres)

- **users** — gerenciado pelo Supabase Auth.
- **couples** — vincula dois `user_id` (criado via convite/código simples no primeiro acesso: "criar casal" gera um código, o parceiro usa "entrar com código" para vincular).
- **categories** — `id, user_id, nome, cor, ícone`.
- **routine_items** — `id, user_id, category_id, título, notas, prioridade, data_inicio, horário, is_shared (bool), recurrence_rule (jsonb), recurrence_end (data ou nº de ocorrências)`.
- **item_completions** — `id, routine_item_id, user_id, data, completed_at` — histórico de conclusão por ocorrência e por pessoa (permite estatísticas e preserva histórico mesmo se a regra de recorrência for editada depois).
- **push_subscriptions** — `id, user_id, subscription_json`.

**Regras de acesso (RLS)**:
- SELECT: um item é visível se `user_id = auth.uid()` OU (`is_shared = true` E o dono pertence ao mesmo `couple` do usuário logado).
- UPDATE/DELETE: permitido se `user_id = auth.uid()` OU (`is_shared = true` E mesmo `couple`).
- `item_completions`: cada linha pertence a um `user_id`; cada pessoa só cria/edita suas próprias conclusões.

## Telas principais

1. **Login/Cadastro** — email+senha; primeiro acesso oferece "criar casal" (gera código) ou "entrar com código".
2. **Hoje** (tela inicial) — itens do dia (pessoais + compartilhados), agrupados por categoria com cor/ícone, checkbox de conclusão, ordenados por horário.
3. **Agenda/Semana** — visão de calendário semanal/mensal com itens recorrentes e únicos.
4. **Novo/Editar item** — título, categoria, notas, prioridade, data, horário, recorrência (diária / dias da semana / intervalo / única), data-fim ou nº de repetições, toggle "compartilhar com [nome]".
5. **Categorias** — CRUD de categorias (nome, cor, ícone).
6. **Estatísticas** — % de conclusão por categoria/semana e streak de dias cumpridos, por pessoa.

## Notificações — detalhe do fluxo

1. Usuário ativa notificações no app → navegador pede permissão → subscription salva em `push_subscriptions`.
2. Edge Function roda periodicamente, calcula ocorrências ativas para o horário atual a partir de `recurrence_rule`, e dispara Web Push para o `user_id` dono (e para o parceiro, se `is_shared`).
3. Toque na notificação abre o app direto no item (deep-link).

## Testes / validação

- Testar fluxo completo em pelo menos um Android real e um iPhone real (instalação na tela inicial, permissão de notificação, recebimento de push).
- Validar RLS: usuário A não deve conseguir ver/editar item pessoal de B via API direta.
- Validar cálculo de recorrência para os 4 tipos (diária, dias específicos, intervalo, única) incluindo limite por data-fim e por nº de repetições.

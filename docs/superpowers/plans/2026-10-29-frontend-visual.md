# Front-end visual (Plano 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às 10 telas do app a identidade visual e a navegação mobile aprovadas no Figma, sem mudar o que o app faz.

**Architecture:** Um único `src/styles.css` com tokens (variáveis CSS, claro + escuro via `prefers-color-scheme`) e um vocabulário pequeno de classes globais. Três peças de UI compartilhadas em `src/ui/` (ícones SVG, cabeçalho de página, barra inferior/shell). Cada página troca só JSX/classes; lógica de dados (`loadData`, `handleToggle`, APIs) fica intacta.

**Tech Stack:** React 18, TypeScript, Vite, React Router 7, Vitest + Testing Library, CSS puro.

**Spec:** `docs/superpowers/specs/2026-10-28-frontend-visual-design.md`
**Figma (aprovado pelo Lucca em 2026-10-29):** https://www.figma.com/design/a1qRET9vOsig1U0mjWU6Ri — página "Telas". Referência visual de cada tela; leia o frame da tela da sua task com `get_screenshot`/`get_design_context` se o conector Figma estiver disponível.
**Mapa de funcionalidades:** `docs/mapa-funcionalidades.md` (regras fixas de texto de botão, ordem de campos, onde cada ação fica).

## Global Constraints

- Nenhuma dependência nova (npm). CSS puro, sem Tailwind/CSS-in-JS/biblioteca de ícones.
- Nenhuma mudança de banco, API (`*Api.ts`) ou lib (`src/lib/*`). Só JSX, classes e `src/styles.css` / `src/ui/*`.
- "Feito" é binário. Não existe estado "pulei".
- Alvo de toque ≥ 44px em tudo que é clicável (check do item: 48px).
- Cores só por variável CSS (`var(--…)`), nunca hex solto em componente — exceção: a cor da categoria, que vem do banco (`category.cor`) via `style`.
- Fonte: Plus Jakarta Sans (Google Fonts, `display=swap`), fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Ícones: SVG inline, traço 2px, `stroke="currentColor"`, `aria-hidden="true"`; botão só com ícone leva `aria-label`.
- Erros sempre `<p role="alert" className="error">`.
- `prefers-reduced-motion: reduce` desliga transições/animações.
- Datas: nunca `toISOString()` para "hoje" — usar `localDateISO()` (usuários em UTC-3).
- Testes existentes continuam passando (63). `App.test.tsx` procura `heading` "Entrar" → a tela de login mantém `<h1>Entrar</h1>`.
- Textos em português do Brasil.

### Tokens (copiar exatamente para `:root`)

| Token | Claro | Escuro |
|---|---|---|
| `--bg` | `#FAF7F2` | `#171411` |
| `--surface` | `#FFFFFF` | `#221E1A` |
| `--text` | `#1F1B16` | `#F3EDE6` |
| `--text-muted` | `#6B6259` | `#A89E93` |
| `--border` | `#E8E1D7` | `#353029` |
| `--primary` | `#B84F35` | `#E07A5F` |
| `--primary-soft` | `#F6E5DF` | `#3A2620` |
| `--on-primary` | `#FFFFFF` | `#1F1B16` |
| `--done` | `#3F7D5C` | `#6FB28C` |
| `--done-soft` | `#E3EFE7` | `#1F3328` |
| `--danger` | `#B3261E` | `#F2B8B5` |

Tipografia (do Figma): título de tela 28/34 ExtraBold (-0.02em); título de seção 13/18 Bold caixa-alta +0.06em; item 16/22 SemiBold; corpo 16/24 Regular; meta 13/18 Medium; rótulo 14/20 SemiBold; aba 12/16 SemiBold; número grande 40/44 ExtraBold. Raios: cartão/linha 16px, botão 14px, campo 12px. Espaçamento base 4px; gutter lateral 16px.

## Review Focus

1. **Tela de 320px de largura** (iPhone SE/Android pequeno): a faixa de 7 dias da Agenda e o cabeçalho com botões não podem estourar nem gerar rolagem horizontal. Verificado no Chrome na Task 7.
2. **Título de item longo** ("Revisar proposta do cliente X antes da reunião de sexta"): quebra em várias linhas, sem cortar, sem empurrar o chip do par para fora. Teste na Task 3.
3. **Lista longa no Hoje**: o último item e o botão "+" não ficam escondidos atrás da barra inferior nem da barra de gestos do iPhone (`env(safe-area-inset-bottom)`). Verificado no Chrome na Task 7.
4. **Uso só com teclado / leitor de tela**: o check é um `<input type="checkbox">` real com nome acessível = título do item; foco visível (anel 2px `--primary`). Teste na Task 3.
5. **Modo escuro**: contraste AA de texto suave sobre superfície e da cor da categoria (ponto/faixa é decorativo; o nome da categoria vem em texto). Verificado na Task 7.

---

## File Structure

- Create `src/styles.css` — tokens, reset, tipografia, classes globais (vocabulário abaixo).
- Create `src/ui/Icon.tsx` — `<Icon name size? />`, conjunto fixo de SVGs.
- Create `src/ui/PageHeader.tsx` — cabeçalho de tela (eyebrow, título h1, voltar, ação à direita).
- Create `src/ui/AppShell.tsx` — layout das 4 telas principais: `<main>` + `<Outlet/>` + barra inferior.
- Modify `index.html`, `src/main.tsx`, `vite.config.ts` (manifest cores), `src/App.tsx` (rotas aninhadas no shell).
- Modify cada página listada nas tasks.

### Vocabulário de classes (definido na Task 1, usado em todas)

`page` (coluna 16px de gutter, max-width 480px centralizada, padding-top `max(48px, env(safe-area-inset-top))`), `page--with-nav` (padding-bottom que libera barra + safe area + 88px para o "+"), `stack` (flex coluna gap 20px), `card` (surface, raio 16, padding 16), `list` (card sem padding, filhos separados por borda 1px), `group-title` (título de seção caixa-alta com ponto opcional), `btn` + `btn--primary|btn--secondary|btn--text|btn--danger` (altura 52, largura 100%), `icon-btn` (44×44, raio 12, transparente), `field` (`<label>` com `<span>` rótulo acima + input/select/textarea 52px, borda 1.5px `--border`, foco borda `--primary`), `field-row` (dois `field` lado a lado), `segmented` (fieldset de radios estilo pílulas, fundo `--border`, opção marcada `--surface`), `day-chips` (7 checkboxes circulares 44px), `switch` (checkbox `role="switch"` 52×32), `chip` (pílula 13px), `chip--done`, `empty` (texto suave centralizado), `error` (cor `--danger`), `muted`, `sr-only`, `fab` (60×60, raio 20, `--primary`, fixo acima da barra), `progress` (trilho 6px `--border` + preenchimento `--done`).

---

### Task 1: Base visual — tokens, fonte, ícones, manifest

**Files:**
- Create: `src/styles.css`, `src/ui/Icon.tsx`, `src/ui/Icon.test.tsx`
- Modify: `index.html`, `src/main.tsx`, `vite.config.ts`

**Interfaces:**
- Produces: `export type IconName = 'check' | 'today' | 'calendar' | 'chart' | 'list' | 'plus' | 'settings' | 'chevron-left' | 'chevron-right' | 'couple' | 'tag' | 'pencil' | 'trash' | 'bell' | 'flame'`; `export default function Icon({ name, size = 24 }: { name: IconName; size?: number }): JSX.Element`. Todas as classes do vocabulário acima.

- [ ] **Step 1: Teste que falha** — `src/ui/Icon.test.tsx`:
  - `it('renders an aria-hidden svg at the requested size')`: `render(<Icon name="check" size={16} />)`; o `svg` tem `aria-hidden="true"`, `width="16"`, `height="16"`, `stroke="currentColor"`.
- [ ] **Step 2:** `npx vitest run src/ui/Icon.test.tsx` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `Icon`** — `viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`. Paths (mesmos do Figma, estilo Lucide):
  - check `M20 6 9 17l-5-5` · today: `circle 12,12 r4` + `M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41` · calendar: `rect 3,4 18×18 rx2` + `M16 2v4M8 2v4M3 10h18` · chart `M3 3v18h18` + `M18 17V9M13 17V5M8 17v-3` · list `M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01` · plus `M12 5v14M5 12h14` · settings `M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6` · chevron-left `m15 18-6-6 6-6` · chevron-right `m9 18 6-6-6-6` · couple `M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2` + `circle 9,7 r4` + `M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75` · tag `M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41z` + `circle 7,7 r1.5` · pencil `M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z` · trash `M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2` · bell `M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9` + `M10.3 21a1.94 1.94 0 0 0 3.4 0` · flame `M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z`.
- [ ] **Step 4: `src/styles.css`** — tokens da tabela em `:root` (claro) e em `@media (prefers-color-scheme: dark) { :root { … } }`; `color-scheme: light dark`; reset mínimo (box-sizing, margin 0, `button/input/select/textarea { font: inherit }`); `body` fundo `--bg`, texto `--text`, 16px/1.5, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`; `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }`; `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important } }`; todas as classes do vocabulário. Transições 150–200ms só em cor/opacity/transform.
- [ ] **Step 5: `index.html`** — viewport `width=device-width, initial-scale=1, viewport-fit=cover`; `<meta name="theme-color" content="#FAF7F2" media="(prefers-color-scheme: light)">` e `content="#171411"` para dark; `preconnect` para `fonts.googleapis.com` e `fonts.gstatic.com` (crossorigin); stylesheet `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap`. `src/main.tsx`: `import './styles.css'`. `vite.config.ts` manifest: `background_color: '#FAF7F2'`, `theme_color: '#B84F35'`.
- [ ] **Step 6:** `npx vitest run` → todos PASS (63 + 1). `npm run build` → sucesso.
- [ ] **Step 7: Commit** — `feat: add design tokens, global styles and icon set`

### Task 2: Navegação — cabeçalho, barra inferior, shell

**Files:**
- Create: `src/ui/PageHeader.tsx`, `src/ui/AppShell.tsx`, `src/ui/AppShell.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Icon`, classes da Task 1.
- Produces:
  - `PageHeader({ title, eyebrow?, backTo?, action? }: { title: string; eyebrow?: string; backTo?: string; action?: ReactNode })` → `<header className="page-header">`; `backTo` vira `<Link className="icon-btn" aria-label="Voltar">` com `chevron-left` antes do `<h1>`; `eyebrow` é `<p className="muted">` acima do h1; `action` fica à direita.
  - `AppShell()` → `<div className="page page--with-nav"><Outlet/></div>` + `<nav className="bottom-nav" aria-label="Principal">` com 4 `NavLink`: Hoje `/` (`end`, ícone today), Agenda `/agenda` (calendar), Estatísticas `/estatisticas` (chart), Itens `/items` (list). Cada link: ícone dentro de pílula + rótulo visível. Ativo (NavLink já põe `aria-current="page"`): pílula `--primary-soft`, cor `--primary`. Barra: fixa no rodapé, `--surface`, borda superior 1px `--border`, `padding-bottom: env(safe-area-inset-bottom)`, altura útil 56px, max-width 480px centralizada.
  - Telas que NÃO usam o shell envolvem o próprio conteúdo em `<div className="page">`.

- [ ] **Step 1: Teste que falha** — `src/ui/AppShell.test.tsx`, renderizando `AppShell` dentro de `MemoryRouter initialEntries={['/agenda']}` com `<Routes><Route element={<AppShell/>}><Route path="/agenda" element={<p>conteúdo</p>} /></Route></Routes>`:
  - `it('shows the four tabs with visible labels')`: `getByRole('link', { name: 'Hoje' })`, `'Agenda'`, `'Estatísticas'`, `'Itens'` existem.
  - `it('marks the current tab')`: link "Agenda" tem `aria-current="page"`; link "Hoje" não tem.
  - `it('renders the routed page')`: `getByText('conteúdo')`.
- [ ] **Step 2:** `npx vitest run src/ui/AppShell.test.tsx` → FAIL.
- [ ] **Step 3: Implementar `PageHeader` e `AppShell`.**
- [ ] **Step 4: `App.tsx`** — rotas `/`, `/agenda`, `/estatisticas`, `/items` viram filhas de `<Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}>`. As outras rotas ficam como estão. `ProtectedRoute` "Carregando..." ganha `className="page empty"`.
- [ ] **Step 5:** `npx vitest run` → PASS (inclui `App.test.tsx`). 
- [ ] **Step 6: Commit** — `feat: add bottom navigation shell and page header`

### Task 3: Linha do item + tela Hoje

**Files:**
- Modify: `src/features/occurrences/OccurrenceRow.tsx`, `src/features/today/TodayPage.tsx`
- Create: `src/features/occurrences/OccurrenceRow.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `PageHeader`, classes.
- Produces: `OccurrenceRow` com a mesma assinatura de hoje + prop opcional `categoryColor?: string`. Props `occurrence`, `onToggle`, `categoryName?` inalteradas (Agenda usa).

Markup do `OccurrenceRow` (Figma "Linha item"): `<li className="occurrence">` contendo `<label>` que envolve: `<input type="checkbox" className="check">` (visual: círculo 28px dentro de área 48px; marcado = fundo `--done` + check branco, via `appearance: none` + background SVG ou pseudo-elemento), bloco de texto (título em `occurrence__title`; meta = ponto da cor `categoryColor` + `` `${horario.slice(0,5)} · ${categoryName ?? describeRecurrence(item)}` ``). Marcado: título `--text-muted`, sem riscar. Se `item.is_shared`: `<span className="chip">` com `Icon couple` 14px + `<span className="sr-only">Par: </span>` + `feito` (classe `chip--done`) ou `falta`. Título quebra linha (`overflow-wrap: anywhere`); chip não encolhe.

- [ ] **Step 1: Testes que falham** — `OccurrenceRow.test.tsx` (montar um `Occurrence` fake com `item` contendo `titulo`, `horario: '07:00:00'`, `is_shared`, `recurrence_rule: { type: 'daily' }`, `category_id`; `date: '2026-10-29'`):
  - `it('uses the item title as the checkbox accessible name')`: `getByRole('checkbox', { name: /Academia/ })`.
  - `it('calls onToggle with the occurrence when tapped')`: `fireEvent.click(checkbox)` (não há `@testing-library/user-event` no projeto; não instalar) → `onToggle` chamado com o objeto.
  - `it('shows the partner status only for shared items')`: `is_shared: true, partnerCompletion: true` → texto `Par: feito`; `is_shared: false` → `queryByText(/Par:/)` é null.
  - `it('keeps a long title intact')`: título de 80 caracteres aparece inteiro em `getByText`.
  - `it('shows HH:MM without seconds')`: `getByText(/07:00 ·/)` e `queryByText(/07:00:00/)` null.
- [ ] **Step 2:** `npx vitest run src/features/occurrences` → FAIL.
- [ ] **Step 3: Implementar `OccurrenceRow`.**
- [ ] **Step 4: `TodayPage`** — mantém `loadData`/`handleToggle`. Remove o `<nav>` de links. Layout (Figma "Hoje"): `PageHeader` com `eyebrow` = data longa local (`new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })`, primeira letra maiúscula), `title="Hoje"`, `action` = `<Link className="icon-btn" to="/configuracoes" aria-label="Configurações">` com ícone settings. Abaixo, se houver ocorrências: bloco `progress` com "`{feitos} de {total} feitos`" e "`falta {n}`" (ou "tudo feito" quando n = 0) + trilho com `role="progressbar"` `aria-valuenow/aria-valuemax`. Grupos por categoria: `<section>` com `<h2 className="group-title">` (ponto `category.cor` + nome) e `<ul className="occurrences">` de `OccurrenceRow` passando `categoryColor={category.cor}`. Vazio: `<p className="empty">Nada programado para hoje.</p>`. FAB: `<Link className="fab" to="/items/new" aria-label="Novo item">` com ícone plus.
- [ ] **Step 5:** `npx vitest run` → PASS.
- [ ] **Step 6: Commit** — `feat: redesign occurrence row and Today screen`

### Task 4: Agenda e Estatísticas

**Files:**
- Modify: `src/features/agenda/AgendaPage.tsx`, `src/features/stats/StatsPage.tsx`

**Interfaces:**
- Consumes: `OccurrenceRow` (com `categoryName` e `categoryColor`), `PageHeader`, `Icon`.

- [ ] **Step 1: Agenda** (Figma "Agenda") — lógica intacta. `PageHeader` `title="Semana"`, `eyebrow` = intervalo "26 out – 1 nov" (`toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })` sem ponto, a partir de `weekStart`/`weekEnd` parseados como data local `new Date(y, m-1, d)`). Remove o `<nav>`. Faixa de semana: `icon-btn` "Semana anterior" (chevron-left, `aria-label`), 7 dias como `<a href={`#dia-${day}`}>` com letra do dia (D S T Q Q S S) + número; dia == `localDateISO()` destacado (`--primary`, `aria-current="date"`); `icon-btn` "Próxima semana". Os 7 dias dividem o espaço restante (`flex: 1; min-width: 0`) para caber em 320px. Se a semana mostrada não for a atual, botão `btn--text` "Voltar para esta semana" abaixo da faixa (substitui "Semana atual"). Cada dia: `<section id={`dia-${day}`}>` com `group-title` "Quarta, 28" (+ " · hoje" se for hoje) e lista de `OccurrenceRow` ou `<p className="empty">Nada programado.</p>`. Passar `categoryColor` da categoria do item (mesmo lookup do `categoryName`, cor `undefined` se não achar).
- [ ] **Step 2: Estatísticas** (Figma "Estatísticas") — lógica intacta. `PageHeader` `eyebrow` = mês por extenso capitalizado (`toLocaleDateString('pt-BR', { month: 'long' })`), `title="Estatísticas"`. Remove `<nav>`. Dois `card` lado a lado (grid 2 colunas, mesma altura): "Você" (ícone flame) número grande `ownStreak` + "dia seguido"/"dias seguidos"; "Seu par" (ícone couple) `partnerStreak` + "dia seguido nos compartilhados"/"dias seguidos nos compartilhados". `card` "Por categoria": por `categoryStats`, linha com ponto + nome e "`{pct}% · {done}/{total}`", barra 8px com preenchimento na cor da categoria e `role="progressbar"`. Sem categorias com ocorrência: `<p className="empty">Ainda não há itens neste mês.</p>`.
- [ ] **Step 3:** `npx vitest run` e `npm run build` → PASS.
- [ ] **Step 4: Commit** — `feat: redesign Agenda and Stats screens`

### Task 5: Itens — lista e formulário (excluir vai para a edição)

**Files:**
- Modify: `src/features/items/ItemsListPage.tsx`, `src/features/items/ItemFormPage.tsx`
- Create: `src/features/items/ItemsListPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Icon`, classes `field`, `field-row`, `segmented`, `day-chips`, `switch`, `btn--*`.

- [ ] **Step 1: Teste que falha** — `ItemsListPage.test.tsx` (mock de `./itemsApi` `listItems` e `../categories/categoriesApi` `listCategories` com 1 item/1 categoria; `MemoryRouter`):
  - `it('links each item to its edit screen')`: `findByRole('link', { name: 'Editar Academia' })` tem `href="/items/<id>/edit"`.
  - `it('does not offer delete in the list')`: `queryByRole('button', { name: /Excluir/ })` é null.
  - `it('links to categories')`: `getByRole('link', { name: 'Categorias' })` → `/categories`.
- [ ] **Step 2:** `npx vitest run src/features/items` → FAIL.
- [ ] **Step 3: `ItemsListPage`** (Figma "Itens") — `PageHeader` `title="Meus itens"`, `action` = `<Link className="btn-chip" to="/categories">` (ícone tag + "Categorias", altura 44). `<ul className="list">`, cada `<li>`: faixa 4px na cor da categoria, título, meta "`{describeRecurrence} · {HH:MM} · {categoria}`" + ícone couple (com `<span className="sr-only">compartilhado</span>`) se `is_shared`, e `<Link className="icon-btn" aria-label={`Editar ${titulo}`}>` com pencil. Remove "Novo item" e "Excluir" e `handleDelete` (vai para o formulário). Rodapé `muted`: "Para editar ou excluir, toque no lápis. Itens novos você cria na tela Hoje." Vazio: `empty` "Nenhum item ainda. Crie o primeiro pelo + na tela Hoje."
- [ ] **Step 4: `ItemFormPage`** (Figma "Novo item") — lógica de estado/submit intacta. `<div className="page">`, `PageHeader` `title` "Novo item"/"Editar item" e `backTo="/items"`. Campos na ordem do mapa, cada um como `<label className="field"><span>Rótulo</span>…</label>`: Título; Categoria (select); `field-row` Começa em (date) + Horário (time); "Repete" = `fieldset.segmented` com `legend` e 4 radios (Única/Diária/Semanal/Mensal) ligados a `recurrenceType`; se semanal: `fieldset.day-chips` (legend sr-only "Dias da semana", 7 checkboxes com rótulo D S T Q Q S S e `aria-label` Domingo…Sábado) + "A cada [n] semana(s)"; se mensal: field "Dia do mês"; Termina (select) + campo condicional de data/quantidade; Prioridade = `segmented` Alta/Média/Baixa; Notas (opcional) textarea; se `hasPartner`: `card` com ícone couple, "Compartilhar com seu par", "Aparece para os dois e cada um marca o seu." e `<input type="checkbox" role="switch" className="switch">`. Botão submit `btn--primary` "Criar item" (novo) / "Salvar" (edição). Em edição, abaixo: `btn--danger` (estilo texto) "Excluir item" → `window.confirm('Excluir este item de rotina?')` → `deleteItem(id)` → `navigate('/items')`; erro vai para `setError`.
- [ ] **Step 5:** `npx vitest run` → PASS.
- [ ] **Step 6: Commit** — `feat: redesign items list and form, move delete into edit screen`

### Task 6: Categorias, Configurações, Entrar, Criar conta, Parear casal

**Files:**
- Modify: `src/features/categories/CategoriesPage.tsx`, `src/features/settings/SettingsPage.tsx`, `src/features/auth/LoginPage.tsx`, `src/features/auth/SignupPage.tsx`, `src/features/couple/CoupleSetupPage.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Icon`, classes.

- [ ] **Step 1: Categorias** (Figma "Categorias") — `page`, `PageHeader` `title="Categorias"` `backTo="/items"`. `list` com bolinha 14px da cor + nome + `icon-btn` "Editar {nome}" (pencil) + `icon-btn` "Excluir {nome}" (trash). Card de formulário com `group-title` "Nova categoria"/"Editar categoria"; field Nome; "Cor" = `fieldset` de radios-amostra 40px (mín. 44px de área) com `aria-label` = hex, presets `['#22c55e','#3b82f6','#f59e0b','#a855f7','#ef4444','#14b8a6','#ec4899']` + a cor atual se não estiver na lista; marcada com anel `--text` 3px. Remove o `<select>` de ícone da tela, mas mantém o estado `icone` e o envio (criação continua mandando `ICON_OPTIONS[0]`). Cor inicial do formulário: `'#22c55e'` (era `#6366f1`). Botão "Adicionar categoria" / "Salvar" + "Cancelar" (`btn--text`) em edição.
- [ ] **Step 2: Configurações** (Figma "Configurações") — `page`, `PageHeader` `title="Configurações"` `backTo="/"`. Suportado: `card` com ícone bell, "Lembretes no horário", "Uma notificação quando chegar a hora de cada item." e `<input type="checkbox" role="switch" className="switch" aria-label="Lembretes no horário">`. Sempre abaixo, `muted`: "No iPhone, os lembretes só funcionam com o app adicionado à Tela de Início (iOS 16.4 ou mais novo)." Não suportado: `card` com "Este navegador não permite notificações." + o mesmo aviso.
- [ ] **Step 3: Entrar / Criar conta** (Figma "Entrar"/"Criar conta") — `<form className="page auth">`: marca (dois círculos sobrepostos 44px, `--primary` e `--done`, `aria-hidden`) + `<p className="brand">Rotina do Casal</p>` + `<p className="muted">O dia de vocês dois, marcado num toque.</p>`; depois `<h1>` "Entrar"/"Criar conta" em tamanho de título de seção grande (22px Bold) — **mantém o texto do h1** por causa do `App.test.tsx`. Fields "E-mail" (`type=email`, `autoComplete="email"`) e "Senha" (`type=password`, `autoComplete` `current-password`/`new-password`); cadastro mostra `muted` "Mínimo de 6 caracteres." Botão primário com o mesmo texto de antes; link `btn--text` "Criar conta"/"Já tenho conta".
- [ ] **Step 4: Parear casal** (Figma "Parear casal") — `page`, ícone couple 32px, h1 "Conectar com seu par", `muted` "Um de vocês cria o código e o outro digita. Só precisa fazer uma vez." `card` "Vou criar o código": se `generatedCode`, caixa `--primary-soft` com o código em 28px ExtraBold espaçado (`aria-live="polite"`) + "Mande este código para seu par."; botão `btn--secondary` "Criar código". Divisor "ou". `card` "Recebi um código": field "Código do seu par" (`autoCapitalize="characters"`, `autoComplete="off"`) + `btn--primary` "Conectar". No fim, `<Link className="btn btn--text" to="/">Fazer depois</Link>` (hoje a tela não tem saída depois de gerar o código).
- [ ] **Step 5:** `npx vitest run` e `npm run build` → PASS.
- [ ] **Step 6: Commit** — `feat: redesign categories, settings, auth and couple setup screens`

### Task 7: Revisão visual no navegador

**Files:** ajustes pontuais em `src/styles.css` e páginas, se necessário.

- [ ] **Step 1:** `npm run dev`; abrir no Chrome com viewport 390×844 e 320×640, logado com uma conta de teste. Percorrer as 10 telas e cada ação do `docs/mapa-funcionalidades.md`.
- [ ] **Step 2:** Conferir os 5 itens da Review Focus (320px sem rolagem horizontal; título longo; último item visível acima da barra; foco por teclado visível; modo escuro via DevTools "Emulate prefers-color-scheme: dark").
- [ ] **Step 3:** `C:/Users/lucca/.claude/skills/impeccable/scripts/impeccable detect --json src` e corrigir o que for real.
- [ ] **Step 4:** `npx vitest run` e `npm run build` → PASS.
- [ ] **Step 5: Commit** — `fix: visual polish after browser review` (só se houve ajuste).

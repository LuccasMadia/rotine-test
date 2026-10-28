# Front-end visual — Rotina do Casal (Plano 5)

Data: 2026-10-28 · Status: aprovado pelo Lucca em chat ("pode seguir até a implementação")

## Intenção

As 10 telas do app funcionam (Planos 1–4), mas não existe nenhum CSS: é HTML cru em fundo branco. Este plano dá ao app uma identidade visual e uma navegação de app de celular, **sem mudar o que ele faz**.

Uso real (palavras do Lucca): o casal abre o app **o dia todo** para acompanhar a rotina planejada; tem que ser simples — **marcar o que foi feito, o que não foi, e seguir**. Front **mobile-first**. Visual **novo**, sem referência a outro app.

## Objetivos

- Tela **Hoje** como centro: bater o olho, ver o que falta, marcar com um toque, sair.
- Navegação de app instalado (PWA) no celular: barra inferior ao alcance do polegar.
- Identidade visual própria, consistente em todas as telas (tokens de cor, tipo, espaçamento).
- Modo claro e escuro.

## Não-objetivos

- Nenhuma funcionalidade nova, nenhuma mudança de banco/API. "Feito" continua binário (marcado ou não); **não** existe estado "pulei".
- Não reescrever a lógica das páginas (`loadData`, `handleToggle`, APIs): só JSX/markup e estilo.
- Layout de desktop elaborado — no computador a coluna mobile só centraliza.

## Anti-objetivos (falha mesmo se "funcionar")

- Marcar um item exigir mais de um toque, ou alvo de toque menor que 44px.
- Tela Hoje poluída: enfeite, gráfico ou informação que compita com a lista do dia.
- A mesma ação (marcar feito, criar item) com aparência ou comportamento diferente em telas diferentes.

## Restrições

- Stack existente: React 18 + Vite + TS + React Router 7, PWA. Sem dependência nova de UI/CSS — **CSS puro com variáveis** num arquivo global (decisão do Claude: zero dependência, cabe no tamanho do app).
- Testes unitários atuais (63) precisam continuar passando; textos usados nos testes (`App.test.tsx`, `AuthContext.test.tsx`) só mudam junto com o teste.
- Usuários em UTC-3 — nada de data em UTC (regra já existente).

## Decisões de como (tomadas pelo Claude, aceitas pelo Lucca na playback)

- **Tipo no workflow: "Sistema"** → impeccable no modo Operar + `docs/mapa-funcionalidades.md`.
- **Barra de navegação inferior fixa**: Hoje · Agenda · Estatísticas · Itens. Categorias e Configurações acessíveis a partir de Itens / ícone no topo.
- **Criar item** sempre à mão na Hoje (botão flutuante ou equivalente).
- **Modo escuro automático** via `prefers-color-scheme`.
- Telas de entrada (Login, Cadastro, Parear casal) sem barra inferior.

## Ordem (workflow padrão)

1. Identidade visual com `ui-ux-pro-max` (paleta, par de fontes, estilo).
2. Telas no Figma (`figma-generate-design`) — fluxo completo; se o conector Figma não estiver autenticado, o Lucca autentica.
3. `impeccable init` (PRODUCT.md) + `docs/mapa-funcionalidades.md` a partir das telas.
4. Plano (`writing-plans`) → código (Figma → código, `impeccable polish`).
5. Revisão: `/code-review`, Chrome em viewport de celular, `impeccable audit`, verificação antes de concluir.

## Deixado para o executor

- Ícones: SVG inline simples (sem biblioteca), escolha livre.
- Microanimação do check: opcional, curta, respeitando `prefers-reduced-motion`.
- Estados vazios/erro/carregando de cada tela, seguindo o tom do app.

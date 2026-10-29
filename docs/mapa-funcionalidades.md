# Mapa de funcionalidades — Rotina do Casal

Fonte visual: Figma "Rotina do Casal — Telas" (https://www.figma.com/design/a1qRET9vOsig1U0mjWU6Ri), página "Telas".
Antes de mexer numa ação, altere o componente único dela. Atualize este mapa quando uma ação entrar ou mudar de lugar.

## Navegação

| Destino | Como chega |
|---|---|
| Hoje `/` | Aba "Hoje" na barra inferior |
| Agenda `/agenda` | Aba "Agenda" |
| Estatísticas `/estatisticas` | Aba "Estatísticas" |
| Itens `/items` | Aba "Itens" |
| Categorias `/categories` | Botão "Categorias" no topo de Itens |
| Configurações `/configuracoes` | Ícone de ajustes no topo de Hoje |
| Novo item `/items/new` | Botão flutuante "+" em Hoje |
| Editar item `/items/:id/edit` | Lápis em cada linha de Itens |
| Parear casal `/couple-setup` | Depois do cadastro; e pelo cartão "Conectar com seu par" em Configurações (só aparece sem par) |

- Barra inferior (componente `BottomNav`): só nas 4 telas principais. Rótulo + ícone sempre; aba ativa com pílula terracota.
- Telas internas (Novo/Editar item, Categorias, Configurações) têm botão voltar (seta) no cabeçalho, sem barra inferior.
- Entrar, Criar conta e Parear casal: sem barra e sem voltar.

## Ações

### Marcar item como feito / desfazer
- **Telas:** Hoje, Agenda.
- **Componente único:** `OccurrenceRow` (Figma: "Linha item" + "Check").
- **Regras:** um toque no círculo alterna feito/não feito. Área de toque ≥ 48px. Feito = círculo verde-sálvia com check + título em cor suave (sem riscar). Sem estado "pulei". Meta: `HH:MM · <recorrência ou categoria>` com ponto da cor da categoria.
- **Item compartilhado:** chip à direita com ícone de casal + "feito" (verde) ou "falta" (neutro) para o status do parceiro. Só aparece se `is_shared`.

### Criar item
- **Telas:** Hoje (botão flutuante "+", canto inferior direito, acima da barra).
- **Componente único:** `ItemFormPage` (modo novo).
- **Regras:** título da tela "Novo item"; botão "Criar item". Ordem dos campos: Título, Categoria, Começa em + Horário (lado a lado), Repete (Única/Diária/Semanal/Mensal; Semanal mostra dias + "A cada N semana(s)"; Mensal mostra o dia), Termina, Prioridade (Alta/Média/Baixa), Notas (opcional), Compartilhar com seu par (só se pareado).

### Editar / excluir item
- **Telas:** Itens (lápis em cada linha) → formulário.
- **Componente único:** `ItemFormPage` (modo edição).
- **Regras:** título "Editar item"; botão "Salvar". Excluir fica no formulário de edição (botão de texto destrutivo no fim), com confirmação.

### Categorias (criar, editar, excluir)
- **Telas:** Categorias.
- **Componente único:** `CategoriesPage`.
- **Regras:** lista com bolinha de cor + nome + lápis + lixeira. Formulário "Nova categoria" (Nome, Cor) com botão "Adicionar categoria"; em edição vira "Salvar" + "Cancelar".

### Lembretes (push)
- **Telas:** Configurações.
- **Componente único:** `SettingsPage`.
- **Regras:** linha "Lembretes no horário" com interruptor. Aviso fixo sobre iPhone (Tela de Início, iOS 16.4+). Sem par conectado, aparece também o cartão "Conectar com seu par" → Parear casal.

### Entrar / Criar conta
- **Telas:** Entrar, Criar conta.
- **Regras:** marca no topo, campos E-mail e Senha, botão principal ("Entrar" / "Criar conta"), link de texto para a outra tela ("Criar conta" / "Já tenho conta").

### Esqueci minha senha
- **Telas:** Entrar (link "Esqueci minha senha") → Esqueci minha senha `/esqueci-senha` → e-mail → Criar senha nova `/nova-senha`.
- **Componentes:** `ForgotPasswordPage`, `ResetPasswordPage`; mensagens em `authErrorMessage`.
- **Regras:** campo E-mail + botão "Enviar link"; depois mostra sempre a mesma confirmação ("Se existir uma conta com esse e-mail…"), exista a conta ou não. Na tela nova: campo "Nova senha" (mín. 6) + "Salvar nova senha" → Hoje. Link vencido: "Esse link expirou ou já foi usado." + "Pedir um novo link". Erro de login nunca diz qual campo errou ("E-mail ou senha incorretos").

### Parear casal
- **Telas:** Parear casal.
- **Componente único:** `CoupleSetupPage`.
- **Regras:** dois cartões — "Vou criar o código" (botão secundário "Criar código", mostra o código grande) e "Recebi um código" (campo + botão "Conectar"). Link de texto "Fazer depois" leva para Hoje.

## Padrões fixos
- Erros: texto abaixo do bloco, `role="alert"`, cor de erro com texto (nunca só cor).
- Vazio: frase curta no lugar da lista (ex.: Hoje "Nada programado para hoje.").
- Botões: Primário (terracota), Secundário (terracota suave), Texto. Altura 52px.
- Campos: rótulo visível acima, caixa 52px.

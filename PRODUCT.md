# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Duas pessoas: o Lucca e a parceira dele. Usam no celular, várias vezes ao longo do dia, às vezes como PWA instalado na tela inicial e às vezes pelo navegador (Chrome/Safari). O trabalho de cada abertura é curto: ver o que falta hoje, marcar o que foi feito e fechar o app.

## Product Purpose

"Rotina do Casal" é um acompanhamento de rotina diária para o casal. Cada um cadastra os seus itens (com horário, categoria e recorrência) e alguns itens são compartilhados entre os dois. O app mostra o que cai em cada dia, deixa marcar como feito e lembra por notificação push no horário. O sucesso é abrir, marcar e sair em poucos segundos, sem fricção.

## Positioning

É uma rotina **a dois**: itens compartilhados aparecem para os dois, e cada um vê se o parceiro já marcou o item compartilhado. Não é um app de produtividade genérico nem de hábitos individuais.

## Operating Context

- Uso rápido, de pé, com uma mão, ao longo do dia.
- Usuários em UTC-3; "hoje" sempre é a data local.
- Notificações push no horário do item (Android e iPhone com iOS 16.4+, quando instalado).
- Pareamento do casal por código (um cria, o outro entra).

## Capabilities and Constraints

- Telas: Hoje, Agenda (semana), Estatísticas, Itens (lista + formulário), Categorias, Configurações, Login, Cadastro, Parear casal.
- "Feito" é binário: marcado ou não. Não existe estado "pulei".
- Categorias têm cor própria definida pelo usuário.
- Stack: React 18 + TypeScript + Vite + React Router 7, PWA (vite-plugin-pwa, injectManifest), Supabase. Sem biblioteca de UI.
- Projeto pessoal, não é de cliente.

## Product Principles

1. Marcar um item é um toque, sempre, em qualquer tela.
2. A tela Hoje é o centro; nada compete com a lista do dia.
3. A mesma ação tem a mesma aparência e o mesmo comportamento em todas as telas.
4. O que é do casal (compartilhado, status do parceiro) fica visível sem precisar procurar.

## Accessibility & Inclusion

Alvos de toque de no mínimo 44px; contraste AA; modo claro e escuro; respeitar `prefers-reduced-motion`.

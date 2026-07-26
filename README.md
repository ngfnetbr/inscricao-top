# Sistema de Inscrição em Oficinas — Estudo e Planejamento da SME

Sistema web para gerenciamento de inscrições em oficinas do **Estudo e Planejamento da Secretaria Municipal de Educação**.

Desenvolvido para ser extremamente simples e intuitivo, permite que participantes escolham oficinas para dois dias distintos, consultem suas inscrições e acompanhem a lista pública de participantes. A área administrativa oferece controle completo de vagas, inscrições, presenças, certificados, gestores e relatórios.

## Funcionalidades

### Público
- **Inscrição em 5 etapas**: identificação por CPF, escolha da oficina de quinta-feira, escolha da oficina de sexta-feira, revisão e confirmação.
- **Correção de nome**: se o CPF já existir na base, o participante pode confirmar ou corrigir seus dados.
- **Bloqueio automático**: oficinas com o mesmo nome não podem ser escolhidas nos dois dias; CPFs já inscritos são bloqueados.
- **Placar de vagas em tempo real**: exibe ocupação real (`24/25`, `25/25 ESGOTADO`) com cores dinâmicas.
- **Consulta de inscrição**: o participante consulta seus dados e oficinas escolhidas.
- **Lista pública de participantes**: visualização agrupada por oficina e dia, com carga horária.

### Administrativo
- Painel de controle com ocupação, inscrições, status e filtros por CPF/nome.
- Cadastro, edição e transferência de inscritos entre oficinas.
- Controle de presença (manhã/tarde) com indicadores de pendência.
- Geração de certificados individuais e em massa, com nome em caixa alta, CPF e total de horas.
- Relatórios em PDF: oficinas com participantes e presenças.
- Gestão de gestores por oficina, com agrupamento e alertas de oficinas sem gestor.
- Modo de manutenção: bloqueia o site público e exibe mensagem personalizada.
- Rota oculta de inscrição interna, acessível mesmo durante a manutenção.

## Tecnologias

- [TanStack Start](https://tanstack.com/start) — framework full-stack React
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) — banco de dados, autenticação e funções
- [shadcn/ui](https://ui.shadcn.com/) — componentes de interface
- [jsPDF](https://github.com/parallax/jsPDF) / [html2canvas](https://html2canvas.hertzen.com/) — geração de PDFs e certificados

## Estrutura do Banco de Dados

> **O schema completo do banco de dados está incluso neste repositório em:**
>
> ```
> supabase/export/schema.sql
> ```
>
> O arquivo contém toda a estrutura: extensões, enums, tabelas, constraints, índices, GRANTs, RLS, políticas, views, funções (RPCs) e triggers. Não há edge functions nem buckets de storage neste projeto — toda a lógica de servidor está nas funções do banco (`SECURITY DEFINER`) e nas server functions do app (`src/lib/*.functions.ts`).

### Principais tabelas

| Tabela | Descrição |
| --- | --- |
| `pessoas` | Base de pessoas com CPF e nome |
| `oficinas` | Oficinas disponíveis, datas, turnos, vagas, ministrantes e horas |
| `inscricoes` | Inscrições dos participantes com oficinas de quinta e sexta |
| `presencas` | Registro de presença/falta por oficina, manhã e tarde |
| `gestor_oficinas` | Vínculo de gestores às oficinas |
| `user_roles` | Papéis de usuário (admin, gestor) |
| `configuracoes` | Configurações do sistema, incluindo modo de manutenção |

## Executando Localmente

```bash
# Instalar dependências
bun install

# Iniciar servidor de desenvolvimento
bun dev
```

O projeto utiliza variáveis de ambiente para conexão com o Supabase. As chaves públicas são configuradas automaticamente pelo Lovable Cloud.

## Autoria

Desenvolvido por **NGF — Soluções em Tecnologia**.

# Export do banco de dados

Arquivo: `schema.sql` — estrutura completa do banco (gerada a partir do estado atual).

Conteúdo incluído:

- Extensões
- Tipos/Enums (`app_role`)
- Todas as tabelas do schema `public` (configuracoes, gestor_oficinas, inscricoes, oficinas, pessoas, presencas, user_roles) com colunas, defaults, constraints, índices, GRANTs, RLS e políticas
- View `oficinas_com_vagas`
- Todas as funções (RPCs) e triggers
- Storage: **nenhum bucket configurado** neste projeto
- Realtime: **nenhuma tabela publicada**

## Funções de borda (edge functions)

Este projeto **não usa edge functions**. Toda a lógica de servidor está em:

- Funções do banco (`SECURITY DEFINER`) listadas no `schema.sql`
- Server functions do app em `src/lib/*.functions.ts`

## Observação

O arquivo contém apenas a **estrutura**, sem dados (nenhuma linha de pessoas/inscrições foi exportada).
Para restaurar em um projeto novo, execute o `schema.sql` na ordem em que está.

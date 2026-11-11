# Contas em Dia

MVP em JavaScript para planejamento financeiro colaborativo de uma família, baseado na proposta em [`docs/PropostaSistema.pdf`](./docs/PropostaSistema.pdf).

## O que já funciona

- Entradas individuais com perfis de **administrador** e **participante**.
- Lançamentos compartilhados de receitas e despesas com descrição, valor, data, categoria e observações.
- Orçamento mensal por categoria; administradores podem alterar limites.
- Painel com receitas, gastos, saldo, histórico, progresso por categoria e alertas a partir de 80% do limite.
- Acompanhamento visual de metas familiares.
- Atualização automática do painel a cada 20 segundos para manter diferentes clientes sincronizados.

## Estrutura

```text
apps/
  api/
    src/
      domain.js       # regras de orçamento, lançamentos e validações
      server.js       # API HTTP, autenticação e arquivos estáticos
      store.js        # persistência local e dados de demonstração
    test/
      domain.test.js
  web/
    app.js            # interface e comunicação com a API
    index.html
    styles.css
docs/
  PropostaSistema.pdf
```

O navegador comunica-se com a API HTTP; o serviço mantém os dados da família em um arquivo local. Essa separação permite que vários clientes compartilhem o mesmo orçamento quando acessam a mesma instância do serviço. Para executar mais de uma instância em produção, substitua o armazenamento local por um banco de dados compartilhado e adote notificações distribuídas.

## Executar localmente

Requer Node.js 20 ou superior. Não há dependências externas.

```bash
npm start
```

Abra <http://localhost:3000>. Contas de demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Administradora | `maria@contas.local` | `familia123` |
| Participante | `jonas@contas.local` | `familia123` |
| Participante | `rafael@contas.local` | `familia123` |

O estado inicial é criado em `apps/api/data/state.json` na primeira execução. Para alterar a senha das contas de demonstração antes dessa inicialização, defina `DEMO_PASSWORD`. A porta padrão é `3000` e pode ser alterada com `PORT`.

## Testes

```bash
npm test
```

## Limites e próximos passos

Este é um protótipo educacional: as sessões existem apenas na memória do processo, as credenciais são contas fictícias e o arquivo JSON não suporta múltiplas instâncias nem garante a durabilidade de um banco de produção. Antes de usar dados financeiros reais, implemente autenticação e recuperação de conta adequadas, autorização por família, banco de dados transacional, auditoria, backups, proteção contra abuso e revisão de segurança/privacidade.

Open Finance, importação bancária, notificações push, criação/convite de membros, contribuições nas metas e sincronização em tempo real não estão implementados. A importação financeira deve ser feita por integração autorizada com provedor compatível, nunca pela coleta de senhas bancárias.

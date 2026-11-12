# Contas em Dia

Protótipo interativo para demonstrar gestão financeira familiar, baseado na proposta em [`docs/PropostaSistema.pdf`](./docs/PropostaSistema.pdf).

## Demonstração no GitHub Pages

A versão do GitHub Pages é um site estático: a interface e todas as interações de demonstração são executadas no navegador. Não é necessário iniciar um servidor Node.js ou configurar uma API.

1. Envie o projeto para a branch `main` do GitHub.
2. No repositório, abra **Settings → Pages** e, em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Aguarde a conclusão do fluxo **Publicar demonstração no GitHub Pages** na aba **Actions**.
4. Acesse o endereço informado na publicação. Para um repositório de projeto, o endereço normalmente termina em `/<nome-do-repositório>/`.

O fluxo [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) publica somente `apps/web`, sem enviar a API ou os dados de execução ao Pages.

### Contas fictícias

| Perfil | E-mail | Senha |
|---|---|---|
| Administradora | `maria@contas.local` | `familia123` |
| Participante | `jonas@contas.local` | `familia123` |
| Participante | `rafael@contas.local` | `familia123` |

O perfil administrador pode alterar limites de categorias. Todos os perfis podem registrar receitas e despesas e acompanhar o orçamento, os alertas, as movimentações e a meta familiar. **Restaurar demonstração** repõe os dados fictícios originais naquele navegador.

## Dados e limites da versão demonstrativa

Os lançamentos e limites alterados são salvos no `localStorage` do navegador. Isso permite repetir os percursos, inclusive após atualizar a página, e sincroniza alterações entre abas abertas no mesmo navegador. Os dados **não** são compartilhados entre dispositivos, navegadores ou pessoas; cada sessão de teste começa com sua própria cópia. Para repetir um cenário, restaure a demonstração.

As credenciais e regras de acesso são públicas no código-fonte e servem somente para simular a experiência. Qualquer pessoa pode inspecionar ou modificar os dados locais. Não use informações financeiras, credenciais pessoais ou dados reais de participantes nos testes. A demonstração não possui autenticação segura, servidor compartilhado, sincronização entre dispositivos ou integração com bancos/Open Finance.

## Desenvolvimento e testes locais

Requer Node.js 20 ou superior; não há dependências externas.

```bash
npm test
npm start
```

`npm start` inicia o servidor local do protótipo em <http://localhost:3000>. A interface utiliza o mesmo modo de demonstração com dados no navegador. O código de API em `apps/api` permanece como protótipo de arquitetura, mas não é usado pela publicação no GitHub Pages.

## Estrutura

```text
apps/
  api/
    src/              # API HTTP e regras do protótipo de servidor
    test/             # testes das regras de negócio da API
  web/
    app.js            # interface e percursos interativos
    demo-store.js     # autenticação fictícia e persistência local da demonstração
    index.html
    styles.css
    test/             # testes da demonstração estática
docs/
  PropostaSistema.pdf
.github/
  workflows/
    deploy-pages.yml  # publicação automática no GitHub Pages
```

Para oferecer contas reais e dados familiares compartilhados entre dispositivos, seria necessário hospedar a API e um banco de dados persistente em um serviço próprio; o GitHub Pages sozinho não executa código de servidor.

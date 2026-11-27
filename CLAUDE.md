# CLAUDE.md — ERP DiCasa

> Leia este arquivo inteiro antes de qualquer tarefa. Ele resume como o projeto funciona,
> as regras que já custaram caro para aprender e o jeito de trabalhar combinado com o Jean.
> Responda sempre em português do Brasil.

---

## 1. Quem é quem

| Pessoa | Papel |
|---|---|
| **Jean Bezerra** | Desenvolvedor principal (E-Sig). É quem usa o Claude Code, revisa, faz commit, push e deploy |
| **Allan** | Sócio/dono da E-Sig, dono do projeto |
| **Juliano** | T.I./infraestrutura da DiCasa (servidor, e-mail Locaweb, acessos) |
| **Rafael Pamplona** | Diretor comercial da DiCasa (decide regras comerciais, premiação, inadimplência) |
| **Ana Clara** | Área comercial; autora do "Relatório de sugestões de melhorias ERP – área comercial" |
| **Patrícia Bittencourt** | RH (premiação, comissão) |
| **Jennifer** | Diretora financeira |
| **Wenderson** | Controller financeiro (DRE) |

DiCasa = rede de lojas de material de construção (home center) no Pará. O ERP DiCasa é um sistema
interno que lê o ERP legado **CISS (DB2)** e guarda configurações próprias no **Postgres (schema `farol`)**.

---

## 2. Stack e estrutura

- **Back:** NestJS (porta 3000), TypeScript. DB2/CISS via `ibm_db` (`DB2Service`), Postgres via `PostgresService`.
- **Front:** Angular 20, **standalone e zoneless**, Angular Material.
- **Servidor:** Windows Server, API publicada por Cloudflare tunnel em `https://api-erp.dicasaweb.com.br`,
  front em `https://erp.dicasaweb.com.br`.
- **Repositórios:** back e front separados no GitHub, branch **`main`**.
- **Validação de SQL:** WinSQL, feita pelo Jean, direto no CISS.

### Back (pastas conhecidas)
```
src/
  shared/database/db2.service.ts        → import { DB2Service } from '@shared/database/db2.service'
  shared/database/postgres.service.ts   → PostgresService
  routes/jwt-auth.guard.ts              → import { JwtAuthGuard } from 'routes/jwt-auth.guard'
  permissoes/permissoes.guard.ts        → PermissionGuard('CODIGO')
  modules/comercial/
    metas/                (metas.controller/service/repository)
    repositories/         (dashboard-comercial.repository.ts, comercial-setores.repository.ts)
    controllers/  services/
  modules/financeiro/
    inadimplencia/        (módulo completo, com agendamento)
    contaspagar.module, fluxocaixa.module, dre.module, financeiro.module
  app.module.ts           (ScheduleModule.forRoot() + InadimplenciaModule registrados)
```

### Front (pastas conhecidas)
```
src/app/
  services/               (dashboard-comercial.service, comercial-setores.service, dias-venda.util,
                           empresa.service, inadimplencia.service ...)
  pages/comercial/        dashboard, metas, meu-painel, colaborador, colaborador-cadastro,
                          faturamento, premiacao (+ premiacao-confirmacao-bar, premiacao-gestor ...)
  pages/financeiro/inadimplencia
  settings/               (ex.: inadimplencia-config)
src/environments/         environment.apiUrl
```

Confirme sempre o caminho real lendo os arquivos antes de criar algo novo.

---

## 3. Regras de ouro (não negociáveis)

1. **Não existe homologação.** Tudo que sobe vai direto para produção. Por isso:
   - mudança pequena, uma coisa de cada vez;
   - compilar antes de dizer que está pronto (`npx tsc --noEmit` no back, `ng build` no front);
   - SQL novo é validado pelo Jean no WinSQL **antes** de virar código.
2. **Validar contra o CISS, centavo a centavo.** Nenhum número novo vai para produção sem bater com
   uma tela ou relatório oficial do CISS. Sempre entregue junto um SQL de conferência para o WinSQL.
3. **Premiação não muda** sem pedido explícito. `MetasService.diasUteis/diasUteisMes/metaProporcional`
   (regra antiga: só exclui domingo) alimentam a premiação. Não alterar.
4. **Nunca** mexer no `.env`, nunca commitar `.env`, nunca imprimir segredos.
5. **Nunca** rodar `npm audit fix --force` nem atualizar o npm para a v12.
6. **Você não faz** `git push`, deploy, nem acessa o servidor de produção. Prepare, compile e mostre o diff;
   o Jean revisa e sobe.
7. Migração de banco (Postgres): escreva o `.sql` idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
   e entregue para o Jean rodar. Avise antes de qualquer coisa destrutiva.
8. O Jean prefere **arquivos completos** prontos, não trechos soltos. Ao terminar, liste os arquivos
   alterados/criados e o que precisa ser feito à mão (migração, provider, permissão, `.env`).

---

## 4. DB2 / ibm_db: pegadinhas que quebram em produção

- `COUNT(*)` volta BIGINT e derruba o driver → **sempre** `CAST(COUNT(*) AS INTEGER)`.
- **Proibido window function** (`ROW_NUMBER() OVER`, etc.): volta BIGINT e derruba o driver nativo.
  Use subconsulta correlacionada com `ORDER BY ... FETCH FIRST 1 ROWS ONLY` (funciona dentro de `COALESCE`).
- `CAST(x AS DECIMAL(15,2))` **trunca**. Para valor em dinheiro: `CAST(ROUND(x, 2) AS DECIMAL(15,2))`.
- `DECIMAL / DECIMAL` dá SQL0419N → `DOUBLE(a) / DOUBLE(b)`.
- DECIMAL estreito dá SQL0413N → percentuais com pelo menos `DECIMAL(8,1)`.
- `CHAR(N)` até 254: `CAST(LEFT(COALESCE(campo,''), N) AS CHAR(N))`.
- O WinSQL rejeitou `CURRENT DATE - 720 DAYS` → use `DAYS_BETWEEN(CURRENT DATE, data) <= 720`.
- Consultas DB2 em sequência (`await` uma por vez), nunca em paralelo no mesmo serviço.
- Datas vindas do front: validar com regex `^\d{4}-\d{2}-\d{2}$` antes de interpolar no SQL.
- **Acentos do CISS chegam quebrados** ("LOG�STICA"). Para textos com acento, selecione também
  `HEX(coluna)` e decodifique no Node (UTF-8 se válido, senão `windows-1252`).
  Exemplo pronto: `textoDoHex()` em `comercial-setores.repository.ts`.
- Use `FOR READ ONLY` nas consultas de leitura.
- **Não usar views do CISS/Metabase** sem ter certeza de que são mantidas. Prefira replicar a lógica do
  relatório oficial do CISS.

---

## 5. Lógica de negócio já validada

### 5.1 Faturamento (base de tudo no comercial)
Fonte: `dashboard-comercial.repository.ts` → `indicadoresPorEmpresa`. Validada contra o CISS.
- `ESTOQUE_ANALITICO.VALTOTLIQUIDO`, `V` positivo e `E` (devolução) negativo.
- Filtros: `CONFIG.IDOPERACAO = 3000`, `FLAGMOVPRODUTOS = 'T'`, sem itens de kit (`NUMSEQUENCIAKIT <= 0`),
  `IDOPERACAO <> 1301`, `TIPOITEMCATEGORIA NOT IN ('D8')`, regra da série `CAN`, empresas 1 a 10.
- **Bloco 1:** vendas e devoluções sem reentrega + exclusão de venda antecipada (`NOT EXISTS` em
  `ORCAMENTO_PRE_NOTA`/`ORCAMENTO_PROD_NOTA_ANTECIPADA`).
- **Bloco 2:** devoluções **com** reentrega (`FLAGGERARREENTREGA = 'T'`, origem 3001).
- Lucro: `VALLUCRO * QTDPRODUTO`, kits (`TIPOBAIXAMESTRE = 'K'`) somam os componentes.
- **Ticket médio** = venda bruta (só `V`) ÷ quantidade de vendas (`COUNT(DISTINCT IDPLANILHA)` das `V`).
  Igual ao CISS. Meta de ticket é cheia (não proporcional).
- Ao criar um relatório novo de faturamento, **reaproveite esta base** em vez de escrever outra.

### 5.2 Setor = departamento do vendedor
- Tabelas: `VENDEDOR_DEPARTAMENTO_HIST (IDVENDEDOR, IDDEPARTAMENTO, DTCADASTRO)` e
  `DEPARTAMENTOS (IDDEPARTAMENTO, DESCRDEPARTAMENTO, FLAGINATIVO)`.
- Regra igual ao relatório CISS "Análise Gerencial de Venda > Vendas por Departamento": o setor é o do
  **último HIST com `DTCADASTRO <= data da nota`**. Sem departamento = `-1`.
- Para performance: somar por loja + vendedor + dia e só então buscar o departamento.
- Validado em out/2026: bateu no total e setor a setor com o relatório do CISS.
- O cadastro atual do vendedor (`VENDEDOR.IDDEPARTAMENTO`) pode divergir do HIST. Use o HIST.
- Filtro por setor (3.3): `GET comercial/colaborador/produtividade` devolve `idDepartamento`/`departamento` de
  cada vendedor no **último dia do período** (`ColaboradorService` + `departamentoDosVendedores`). Usado no
  Painel da Equipe (Meu Painel do gestor) e na Produtividade por Colaborador. Se a consulta do setor falhar,
  volta `idDepartamento = null` e a tela esconde o filtro.

### 5.3 Dias de venda (calendário)
- Padrão: **segunda a sábado** é dia de venda; domingo não.
- Exceções em `farol.comercial_dias_venda_excecao (data, id_empresa NULL = todas, tipo FECHADO|ABERTO)`.
  Exceção da loja vale mais que a de "todas".
- Util no front: `services/dias-venda.util.ts` (`contarDiasVenda`). Use-o em toda conta de dias nova.
- Feriados do CISS (`FERIADO`) são só lembrete: as lojas abrem na maioria dos feriados.
- **Premiação continua com a regra antiga** (só domingo). Não trocar.

### 5.4 Metas
- `farol.comercial_metas_empresa` (loja/mês: faturamento, margem como fração, ticket médio).
  Travada quando a premiação de gestores do mês está confirmada (`garantirCompetenciaAberta`).
- `farol.comercial_metas_setor` (loja + departamento + mês). Sem trava.
- Sugestão por setor = participação nos 3 meses fechados anteriores (cache 6 h).
- `farol.comercial_metas_vendedor` (loja + vendedor IDCLIFOR + mês). Sem trava. **Meta por loja**: o realizado
  conta só as vendas do vendedor naquela loja (a soma dos vendedores fecha com a loja). Base:
  `ComercialSetoresRepository.faturamentoPorVendedor`, validada em out/2026 (por loja = Dashboard; vendedor
  somando as lojas = CISS "Vendas por Vendedor"). Rotas `comercial/metas/vendedores*` exigem COM_METAS;
  quem tem COM_EMPRESA_X só vê/altera essas lojas. Sugestão = participação do vendedor na loja nos 3 meses.
- Ritmo individual (3.2/3.4): `GET comercial/colaborador/ritmo-mes` (`ColaboradorRitmoService`) devolve meta +
  realizado do dia 1 até ontem por loja + vendedor do mês corrente (cache por período, 1 consulta por vez).
  Gestor vê as lojas pedidas; vendedor só ele (login → `comercial_vendedores.username`). Tendência e meta
  diária são calculadas no Meu Painel com `dias-venda.util`, iguais ao Ritmo do mês do Dashboard.
- A tela "Produtividade por Colaborador"/Meu Painel usa outra consulta (`colaborador.repository.ts`, soma as
  lojas e exclui D5+D8). D5 veio zerado em out/2026.
- Meta proporcional = meta do mês × dias de venda do período ÷ dias de venda do mês (por loja).
- Ritmo do mês: corte = ontem; tendência = média diária × dias do mês; meta diária necessária =
  (meta − realizado) ÷ dias restantes contando hoje. Total geral = soma das lojas.

### 5.5 Produto
- Hierarquia: DIVISAO > SECAO > GRUPO > SUBGRUPO (`PRODUTO.IDDIVISAO`, `IDSECAO`).
- **Bota-Fora = divisão 23** (20 seções, ex.: Banheiro, Pisos, Pintura). Produto FOCO = comissão 1,5%.
  A base do Farol tem FOCO/COMPLEMENTO.
- Bota-Fora no Meu Painel: `GET comercial/colaborador/bota-fora?idempresa&dataInicio&dataFim`
  (`ColaboradorBotaForaService`, `ComercialSetoresRepository.botaForaPorVendedor`): base do Dashboard +
  `PRODUTO.IDDIVISAO = 23`, por loja + vendedor + seção (cache 10 min). Vendedor vê só ele; gestor vê a loja
  (inclui vendas sem vendedor). **Sem meta** até o Rafael definir a regra.

### 5.6 Inadimplência por vendedor (Financeiro > Clientes em atraso)
- Módulo `modules/financeiro/inadimplencia`. Títulos vencidos em até 720 dias, juros pelo CISS.
- Vendedor do título = quem vendeu (ESTOQUE_ANALITICO pela planilha; pré-venda via ORCAMENTO_PRE_NOTA →
  ORCAMENTO_PROD). Não usar o vendedor da carteira do cliente.
- E-mail semanal só liga com `INADIMPLENCIA_CRON_ATIVO=true` (hoje **desligado**, aguardando: e-mails dos
  vendedores no CISS e respostas do Rafael sobre período, quem cobra, jurídico, frequência, faixas e
  destinatários do consolidado).
- `@nestjs/schedule` **6.1.3** (a 12 é ESM e quebra). `DB2Service` e `PostgresService` não são globais:
  precisam estar nos providers do módulo.
- "Enviar agora" roda em segundo plano (limite do Cloudflare).

### 5.7 E-mail
- Locaweb (domínio dicasanet.com.br). `MAIL_MODO=producao` por causa da premiação.

---

## 6. Padrões de código

### Back (NestJS)
- Controller com `@UseGuards(JwtAuthGuard)` na classe e `@UseGuards(PermissionGuard('CODIGO'))` nas
  rotas que alteram dados. Permissões em uso: `COM_DASHBOARD`, `COM_METAS`, `FIN_INADIMPLENCIA`,
  `FIN_INADIMPLENCIA_GESTOR`, `CFG_INADIMPLENCIA` (ver `permissoes.catalog.ts`).
- Repository novo de DB2 → registrar nos `providers` do módulo junto com `DB2Service`.
- Validar entrada no service (`BadRequestException` com mensagem em português).
- Colunas do DB2 podem vir em maiúsculas ou minúsculas: `r.CAMPO ?? r.campo`.
- **Limite de ~100 s do Cloudflare:** consulta longa → cache, carregamento sob demanda ou job em segundo
  plano com acompanhamento pelo front.

### Front (Angular 20 zoneless)
- Componentes standalone. **Sem zone.js:** depois de cada subscribe/await, chamar
  `this.cdr.detectChanges()`. Carregamento inicial com `afterNextRender()` (ou `ngOnInit` onde o
  componente já usa).
- `inject()` ou construtor, seguindo o padrão do arquivo.
- Templates compilam com `strictTemplates`.
- Visual: cartões brancos, hero escuro (`#0f172a → #172554`), roxo `#534AB7` como cor de ação,
  verde/amarelo/vermelho para ok/atenção/ruim (`.ok .warn .bad`).
- **Modo compartilhamento** do Dashboard: esconder valores em R$, mostrar só percentuais.
- Lojas permitidas ao usuário vêm das roles `COM_EMPRESA_X` no token (ADMIN vê tudo).

---

## 7. Deploy (feito pelo Jean)

Servidor Windows, pastas `C:\DICASA\erp-dicasa-back` e `C:\DICASA\erp-dicasa-front`, branch `main`.
```
git pull
npm install
npm run build
(reiniciar o back)
```
- Conferir no log do Nest as linhas `Mapped {/rota, GET}` das rotas novas.
- Teste rápido: `https://api-erp.dicasaweb.com.br/<rota>` sem login deve dar **401** (rota existe);
  **404** = rota não subiu.
- Front: se o build der `EPERM ... lstat ... dist`, algum processo segura a pasta `dist`. Parar o
  servidor web, apagar `dist`, gerar de novo. Depois, Ctrl+F5.

---

## 8. Como trabalhar com o Jean

1. Entenda o pedido e leia o código existente antes de propor. Reaproveite o que já existe.
2. Se a regra de negócio não estiver clara, pergunte. Se houver uma opção boa, proponha e siga com ela.
3. SQL novo no CISS: escreva primeiro uma consulta de investigação/conferência para o WinSQL e espere o
   resultado do Jean antes de codar em cima.
4. Implemente em branch, compile back e front, e entregue: arquivos alterados, passos manuais
   (migração, providers, permissões), SQL de conferência e o que conferir na tela.
5. Textos para Asana: curtos, **sem valores financeiros**, só o que foi feito e a regra de cálculo.
6. Mensagens de grupo: sem emoji, sem travessão, com acentuação correta.

---

## 9. Onde estamos (atualize ao fim de cada entrega)

### Concluído
- Dashboard Comercial: indicadores por loja, ticket médio (card 41646), **Ritmo do mês** (meta diária
  necessária e tendência), **Faturamento por setor**.
- Metas: abas **Por loja**, **Por setor** (com sugestão pela participação) e **Dias de venda** (calendário).
- Premiação de vendedores e gestores, com confirmação de valores e e-mail (em produção).
- Inadimplência por vendedor (tela do vendedor e da equipe, exportação Excel, configuração de destinatários).
  Envio automático ainda desligado.

### Testado em 26/11/2026, aguardando deploy (branch `feat/metas-vendedor`, back e front)
- Itens 3.1 a 3.4, 4.1 a 4.4 do relatório da Ana Clara, Bota-Fora real e correções do Meu Painel.
  Testado com admin, vendedor (jose.alfaia) e o mesmo login como gestor da HCAB.
- Antes de subir: conferir no CISS o total do Bota-Fora de uma loja (out/2026) e os cartões Cheque Moradia/Boleto.
- Ordem: back primeiro (conferir `Mapped` e 401), depois front.
- **Queda conhecida do driver DB2** ("Invalid Handle: SQLGetData", assert em `odbc.cpp`): acontece com várias
  requisições ao mesmo tempo. Causa provável: `DB2Service` abre conexão assíncrona (`ibmdb.open`) enquanto outra
  consulta lê de forma síncrona. Correção planejada em commit separado: fila no `DB2Service` (uma consulta por vez).
  O Meu Painel já carrega produtividade → ritmo → Bota-Fora em sequência para reduzir o risco.

### Próximos itens (relatório da Ana Clara, subtarefas no Asana)
1. **Metas individuais por vendedor** (3.1), **tendência individual** (3.2) e **meta diária individual**
   (3.4). Aproveitar o Painel da Equipe existente.
   - Junto: corrigir o **Meu Painel**, que conta sábado como dia sem venda (usar `dias-venda.util`),
     tem textos fixos ("Meta a definir com Dr. Ricardo", "meta: ≥20%") e o bloco Bota-Fora com dados
     fictícios (ligar na divisão 23).
   - Decisões em aberto: quem cadastra (sugestão: COM_METAS, gerente só na loja dele); soma das metas
     individuais x meta do setor/loja (sugestão: avisar quanto falta distribuir, sem bloquear).
2. ~~Filtro de colaboradores por setor (3.3)~~ feito (aguardando teste), junto com o Bota-Fora real no Meu Painel.
3. ~~Formas de pagamento (4.3) e PJ em boleto (4.4)~~ feito (aguardando teste e o resultado de
   `sql/conferencia/03-formas-pagamento-pj.sql`). Faturamento > Por Forma de Pagamento: cartões Cheque Moradia
   e Boleto (pelo nome da forma: "MORADIA"/"BOLETO", ignorando formas que começam com COMPRA/PAG/REC/REM PAG/
   BAIXA/BOLETO TESTE; clique isola na tabela) e cartão "PJ em boleto".
   PJ = `CNPJCPF` com 14 dígitos; o back aplica o filtro (`tipoPessoa: 'PJ'`) nos marcadores `AND 0=0`/`AND 3=3`
   do relatório replicado do CISS (`aplicarFiltroPessoa`); sem `tipoPessoa` o SQL é o mesmo de antes.
4. ~~Comparativos (4.1) e indicadores (4.2)~~ primeira versão feita (aguardando teste): Comercial > Comparativos
   (permissão COM_DASHBOARD). `GET comercial/comparativo/periodo` (`ComparativoService`, até 62 dias, cache) devolve
   loja + vendedor de `faturamentoPorVendedor` (ganhou a coluna `devolucoes`). O front chama 3 períodos em sequência
   (atual, mesmo intervalo no mês anterior e no ano anterior; último dia do mês vira último dia do mês de destino)
   e monta Geral/Setor/Vendedor. Indicadores: faturamento, lucro, margem (p.p.), ticket, qtd. vendas, devoluções,
   produtividade (fat ÷ vendedores com venda) e descontos (só Geral). Na visão **Geral** os números por loja vêm
   de `GET comercial/dashboard` (indicadoresPorEmpresa): somar qtd. de vendas por vendedor conta 2x a nota com 2
   vendedores (ticket da HCAB caiu ~7% assim, corrigido). Testado em 26/11: faturamento por loja de out/2026 bateu.
   Falta: forma de pagamento nos comparativos.
   Fora do escopo: visitantes e taxa de conversão (o ERP não tem a fonte). "Parceiros" aguarda definição.

### Outras pendências conhecidas
- Inadimplência: respostas do Rafael, campanha da T.I. para e-mails dos vendedores, ligar o cron.
- Premiação: Rafael definir quem confirma e quem reabre; Juliano trocar a senha do SMTP.
- DRE: desconto financeiro (Jennifer); folha pela `FOLHA_PAGTO_MOVIMENTO` do CISS.

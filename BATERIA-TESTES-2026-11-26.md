# Bateria de testes, por login — branch `feat/metas-vendedor` (back e front)

> Tudo compila (`npx tsc --noEmit` e `ng build`), mas nada foi testado na tela.
> Rode com o back local apontando para o CISS e o front com `ng serve` (Node 20.19).
> Marque `[x]` conforme passar. Se algo não bater, anote o valor da tela e o do CISS.
> SQLs de conferência: `erp-dicasa/sql/conferencia/`.
>
> **Ordem pensada para trocar permissão uma vez só:**
> 1. Parte A: seu login **admin** (a maior parte dos testes).
> 2. Parte B: o login de teste como **vendedor** (como ele está hoje).
> 3. Parte C: o **mesmo login** virando **gestor de uma loja** (uma única alteração de permissão).
> 4. Parte D: devolver o login de teste ao normal.

---

## Preparação (uma vez)

- [ ] Migração `sql/migracoes/2026-11-25-comercial-metas-vendedor.sql` já rodada (rodada em 25/11).
- [ ] Back sobe sem erro e o log mostra:
  - [ ] `Mapped {/comercial/metas/vendedores, GET}` (e `/cadastro`, `/sugestao`, `POST`, `DELETE /:id`)
  - [ ] `Mapped {/comercial/colaborador/ritmo-mes, GET}`
  - [ ] `Mapped {/comercial/colaborador/bota-fora, GET}`
  - [ ] `Mapped {/comercial/comparativo/periodo, GET}`
- [ ] Anote do login de teste: **IDCLIFOR** do vendedor e a **loja principal** dele.
- [ ] Em Comercial > Cadastro de Colaboradores, confira que o login de teste está ligado ao IDCLIFOR
      (campo `username`) e ativo como VENDEDOR.

---

# Parte A — login ADMIN

## A1. Metas por vendedor (3.1) — Comercial > Metas > Por vendedor
- [ ] Escolha a **loja principal do vendedor de teste**. **Sugerir**: só vêm vendedores ativos no cadastro.
- [ ] Aviso "vendeu na loja mas não está no cadastro" mostra nome, código e valor (ex.: Logística, Vendedor Exemplo).
- [ ] Lista ordenada da maior meta para a menor.
- [ ] Faixa de distribuição mostra quanto falta distribuir quando a soma não fecha com a meta da loja.
- [ ] Edite a meta de 2 vendedores (uma em R$, outra em %), **Salvar vendedores**, recarregue (F5): valores ficaram.
- [ ] Exclua um vendedor da lista, salve, recarregue: sumiu.
- [ ] Tabela "Vendedores x meta do setor": com meta por setor no mês, mostra a diferença por setor.
- [ ] **IMPORTANTE para as partes B e C:** deixe salvas metas de **novembro** nessa loja,
      **incluindo o vendedor de teste** e mais uns 3 ou 4 vendedores.

## A2. Ritmo da equipe — Comercial > Meu Painel (admin vê como gestor)
Conferência: consulta 1 de `01-metas-vendedor-base.sql`, datas **2026-11-01 a ontem**.
- [ ] Na loja de A1, resumo "Metas individuais de novembro": vendedores com meta, soma das metas, realizado, tendência, fora do ritmo.
- [ ] Selo "tend. X%" aparece só em quem tem meta.
- [ ] Clique num vendedor com meta: cartão de ritmo com meta, realizado, tendência, média diária e meta diária necessária.
- [ ] **Realizado** desse vendedor = consulta 1 (mesma loja + vendedor), centavo a centavo.
- [ ] **Tendência** = realizado ÷ dias de venda decorridos × dias de venda do mês (segunda a sábado + exceções).
- [ ] **Meta diária necessária** = (meta − realizado) ÷ dias de venda restantes contando hoje.
- [ ] Trocar a loja no seletor recarrega lista e ritmo.

## A3. Filtro por setor (3.3)
Conferência: CISS **Análise Gerencial de Venda > Vendas por Departamento**, mesmo período e loja.
A tela usa o setor do vendedor no **último dia do período**; o CISS usa o da data da venda (só difere se alguém trocou de setor no meio).

**Meu Painel (Painel da Equipe):**
- [ ] Caixa "Todos os setores" acima da busca, com a quantidade por setor.
- [ ] Escolher um setor: lista, ranking, "Total do setor", "% da equipe", vendedores, média e resumo de metas mudam juntos.
- [ ] Total do setor bate (ou fica muito próximo) com o CISS.
- [ ] Sem filtro, cada vendedor mostra o setor ao lado do nome.

**Comercial > Colaborador (Produtividade):**
- [ ] Coluna **Setor** e filtro **Setor** ao lado de Empresas.
- [ ] Exportar **Excel** e **PDF** com um setor escolhido: só as linhas do setor, coluna Setor incluída, PDF com o setor no cabeçalho.
- [ ] (se testar depois das 21h) filtro de hoje traz o dia certo.

## A4. Bota-Fora (divisão 23) — Meu Painel
Conferência: consulta 2 (e o modelo da 3, soma por loja) de `02-bota-fora-divisao-23.sql`.
- [ ] Selo "dados de exemplo" sumiu.
- [ ] Loja X, período personalizado **01/10/2026 a 31/10/2026**: "Vendido pela loja" = total da loja na consulta (inclui vendas sem vendedor).
- [ ] Seções = consulta (6 maiores + "Outras seções"); "Quem mais vendeu Bota-Fora" (top 5) bate.
- [ ] Trocar o período (Hoje / Esta semana / Este mês) atualiza o bloco.

## A5. Formas de pagamento (4.3) e PJ em boleto (4.4) — Análise de Faturamento > Por Forma de Pagamento
Conferência: relatório do CISS de faturamento por forma de pagamento, mesma loja, 01/10 a 31/10.
- [ ] Tabela com os mesmos valores de antes, mais "% do total" e linha de **Total**.
- [ ] Cartão **Cheque Moradia** = CHEQUE MORADIA A VISTA + CHEQUE MORADIA - A PRAZO (venda menos CANC/DEV).
- [ ] Cartão **Boleto** = todas as linhas de boleto de venda. Passe o mouse e confira que nenhuma forma estranha entrou.
- [ ] Clicar no cartão isola as formas na tabela; clicar de novo volta tudo.
- [ ] Cartão **PJ em boleto** aparece depois de alguns segundos (% = boleto PJ ÷ total PJ).
- [ ] Se o CISS tiver filtro de cliente **Jurídica**: total PJ e boleto PJ batem.
- [ ] (opcional) Consulta 5 de `03-formas-pagamento-pj.sql`.

## A6. Comparativos (4.1 e 4.2) — Comercial > Comparativos (novo no menu)
- [ ] Abre e carrega sozinho (dia 1 até ontem), mostrando "Carregando período atual / mês anterior / ano anterior".
- [ ] Cabeçalho com os 3 períodos certos.

**Geral, período 01/10/2026 a 31/10/2026:**
- [ ] HCAB 3.697.116,43 · SHRM 1.695.439,87 · COM1 191.826,79 · HCAM 1.189.631,84 · HCVR 2.017.644,35 ·
      ATACADO 874.511,28 · **Total 9.666.170,55**.
- [ ] **Mês anterior** = Dashboard de 01/09 a 30/09. **Ano anterior** = Dashboard de outubro/2025.
- [ ] Lucratividade, margem e ticket por loja = Dashboard de outubro.
- [ ] Qtd. de vendas igual ou um pouco acima do Dashboard (nota com 2 vendedores conta 2 vezes no total da loja).
- [ ] Devoluções por loja = Dashboard / Análise de Faturamento.
- [ ] Cores: verde melhora, vermelho piora; em Devoluções subir é vermelho; Margem em p.p.

**Por setor e por vendedor:**
- [ ] Por setor ≈ Faturamento por setor do Dashboard.
- [ ] Por vendedor: filtro de setor e busca funcionam; vendedor somando as lojas = CISS "Vendas por Vendedor".

**Limites:**
- [ ] Período maior que 62 dias mostra a mensagem de limite, sem travar.
- [ ] Desmarcar lojas recalcula na hora, sem nova consulta.

## A7. Regressão (o que já está em produção)
- [ ] Dashboard Comercial: números de outubro continuam os mesmos.
- [ ] Premiação abre normalmente.
- [ ] Análise de Faturamento > Por Empresa continua igual.
- [ ] Metas > Por loja, Por setor e Dias de venda funcionando.

---

# Parte B — login de teste como VENDEDOR (sem alterar nada)

Pré-requisito: meta de novembro do vendedor de teste salva na Parte A1.

## B1. Meu Painel do vendedor
- [ ] Abre já na loja principal do vendedor.
- [ ] Cartão "Minha meta de novembro": meta, realizado, % atingido, barra, tendência e meta diária necessária.
- [ ] Realizado = o mesmo valor que você viu para ele na A2 (e na consulta 1).
- [ ] Sábado conta como dia de venda.
- [ ] Não aparecem os textos fixos "Meta a definir com Dr. Ricardo" e "meta: ≥20%"; margem mostra "meta da loja: X%".
- [ ] Se ele vende em 2 lojas e tem meta nas 2: um cartão por loja.
- [ ] Não aparece nenhum dado de outro vendedor (nem ranking com valores de colegas além do que já aparecia antes).

## B2. Bota-Fora do vendedor
- [ ] Bloco mostra só o valor dele (somando as lojas), "% do seu faturamento" e margem.
- [ ] Período 01/10 a 31/10: confere com a consulta 2 somando as linhas desse vendedor em todas as lojas.

## B3. Telas que ele não deve ver
- [ ] Menu não mostra Metas, Comparativos nem Análise de Faturamento (se ele não tem essas permissões).

## B4. (rápido) Vendedor sem meta
- [ ] Na Parte A, apague a meta dele **ou** use outro mês: o Meu Painel mostra o aviso "sem meta no mês", sem erro.
      Pode pular se for trabalhoso; volte a meta depois.

---

# Parte C — MESMO login, agora como GESTOR de uma loja

**Uma única alteração:** dê ao login de teste **COM_COLABORADOR** e **COM_EMPRESA_X** só da loja principal dele
(e COM_DASHBOARD e COM_METAS, para testar essas telas com restrição de loja). Saia e entre de novo para o token atualizar.

## C1. Meu Painel como gestor
- [ ] Agora aparece o Painel da Equipe (lista de vendedores), só da loja dele.
- [ ] Resumo de metas individuais e selos "tend. X%" iguais aos que você viu como admin na A2.
- [ ] Filtro por setor funciona igual à A3.
- [ ] Bota-Fora mostra a loja inteira ("Vendido pela loja"), igual à A4 para essa loja.

## C2. Metas com restrição de loja
- [ ] Comercial > Metas > Por vendedor: o seletor só tem a loja dele.
- [ ] Consegue alterar e salvar uma meta da loja dele.

## C3. Comparativos com restrição de loja
- [ ] Comercial > Comparativos: seletor e números só da loja dele (total = só essa loja).

## C4. Colaborador (Produtividade)
- [ ] Só consegue consultar a loja dele; coluna e filtro de setor funcionam.

---

# Parte D — voltar ao normal

- [ ] Remova do login de teste as permissões que você deu na Parte C (COM_COLABORADOR, COM_EMPRESA_X,
      COM_DASHBOARD, COM_METAS), deixando como vendedor de novo.
- [ ] Se criou metas só para teste, decida se mantém ou apaga (Metas > Por vendedor).

---

## Depois dos testes

- Me mande o que não bateu (valor da tela x valor do CISS) para eu corrigir antes do commit.
- Commit e push ficam com você (back e front na branch `feat/metas-vendedor`).
- Arquivos não versionados para decidir: `CLAUDE.md`, `sql/` e este arquivo.

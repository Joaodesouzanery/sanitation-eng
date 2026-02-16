# Lovable Prompt — Novo Modulo BDI (Beneficios e Despesas Indiretas)

> Cole este prompt na Lovable para implementar o modulo completo de BDI.

---

## Context

This is a sanitation engineering platform (ConstruData | HydroNetwork) built with React + TypeScript + Tailwind CSS + Shadcn/ui + Chart.js for the frontend. The project already has:

- **Orcamento module** (`src/engine/budget.ts`) — calculates budget from trechos, applies a flat BDI percentage (default 25%), and exports CSV/Excel.
- **6 existing tabs:** Topografia, Orcamento, Execucao, Planejamento, RDO, Resultados.
- **SINAPI 2025 cost base** — 60+ line items with official codes, categories, and unit costs.
- **Budget calculation** — `calculateBudget()` sums all direct costs (escavacao, reaterro, tubulacao, assentamento, escoramento, pavimentacao, PVs, testes, mobilizacao) and applies BDI as a flat percentage on top.
- **Leaflet.js map**, **Chart.js graphs** (Gantt, Curva S, histograms), **Supabase** backend.

Dependencies already in the project: `react`, `typescript`, `tailwindcss`, `chart.js`, `react-chartjs-2`, `xlsx`, `file-saver`, `leaflet`, `react-leaflet`, `lucide-react`, `@radix-ui` (shadcn).

---

## OBJETIVO

Criar uma **nova aba "BDI"** (a 7a aba, entre "Orcamento" e "Execucao") que permite ao usuario:

1. **Cadastrar contratos** com concessionarias (agua, esgoto, drenagem, obras civis)
2. **Definir o orcamento mensal** (custo direto estimado por mes)
3. **Definir o periodo do contrato** (quantidade de meses)
4. **Calcular o valor total do contrato** (custo direto total)
5. **Aplicar o percentual de BDI** (lucro desejado — padrao 12%)
6. **Compor o BDI detalhado** com sub-itens (administracao central, lucro, impostos, seguros, riscos, garantias)
7. **Simular cenarios** variando o BDI para encontrar o ponto ideal entre competitividade e rentabilidade
8. **Comparar valor orcado vs. valor do contrato** para verificar viabilidade
9. **Gerar relatorios e graficos** de composicao do BDI
10. **Exportar** planilha detalhada do BDI (CSV, Excel, PDF)

---

## PART 1 — NOVA ABA "BDI" NO MENU PRINCIPAL

### 1.1 — Adicionar a aba

Adicionar uma 7a aba chamada **"BDI"** no menu de navegacao principal da plataforma. A ordem das abas deve ser:

```
[Topografia] [Orcamento] [BDI] [Execucao] [Planejamento] [RDO] [Resultados]
```

- Icone da aba: icone de cifrao ou calculadora (`DollarSign` ou `Calculator` do lucide-react)
- Cor do icone ativo: #22c55e (verde)
- Tooltip: "BDI - Beneficios e Despesas Indiretas"

---

## PART 2 — SECAO 1: CADASTRO DO CONTRATO

### 2.1 — Card "Dados do Contrato"

```
Card com borda-esquerda verde (#22c55e) e titulo:
"Dados do Contrato"
Subtitulo: "Preencha as informacoes basicas do contrato com a concessionaria"
```

**Campos do formulario:**

```
Nome do Contrato: [Input texto] (ex: "Itapetininga - Assentamento Rede Agua/Esgoto + ETA")
Contratante/Concessionaria: [Input texto] (ex: "SABESP", "SAAE", "DAE", "BRK")
Tipo de Contrato: [Select]
  - Assentamento de Rede de Agua
  - Assentamento de Rede de Esgoto
  - Assentamento de Rede de Agua + Esgoto
  - Montagem de ETA (Estacao de Tratamento de Agua)
  - Montagem de ETE (Estacao de Tratamento de Esgoto)
  - Estacoes Elevatorias
  - Drenagem Pluvial
  - Obra Civil de Saneamento
  - Manutencao de Redes
  - Contrato Misto (multiplos servicos)

Numero do Edital/Contrato: [Input texto]
Data de Inicio: [Date picker]
Data de Termino Previsto: [Date picker]
Duracao (meses): [Input number — auto-calculado a partir das datas, editavel]
Municipio: [Input texto]
Estado: [Select com UFs]
```

---

## PART 3 — SECAO 2: COMPOSICAO DE EQUIPES E RECURSOS DO EDITAL

### 3.1 — Card "Equipes Exigidas pelo Edital"

```
Card com borda-esquerda azul (#3b82f6) e titulo:
"Equipes e Recursos Exigidos pelo Edital"
Subtitulo: "Cadastre a composicao de equipes, equipamentos e cargos conforme o edital"
```

**Sub-secao: Mao de Obra**

```
[+ Adicionar Cargo]

Tabela:
| Cargo/Funcao         | Quantidade | Salario Mensal (R$) | Encargos (%) | Custo Total/Mes (R$) |
| Encarregado          | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Oficial/Encanador    | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Ajudante             | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Operador Maquinas    | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Motorista            | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Engenheiro Residente | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| Tecnico Seguranca    | [Input]    | [Input]             | [73.33]      | [Calculado]           |
| [Personalizado]      | [Input]    | [Input]             | [Input]      | [Calculado]           |

Subtotal Mao de Obra/Mes: R$ XXXXX
```

**Dica (card amarelo #fef3c7):**
```
Os encargos sociais incluem: INSS, FGTS, 13o salario, ferias,
aviso previo, multa FGTS, etc. O valor padrao de 73.33% e
referencia para obras de construcao civil (desonerado).
```

**Sub-secao: Equipamentos**

```
[+ Adicionar Equipamento]

Tabela:
| Equipamento           | Qtde | Proprio/Alugado | Custo Mensal (R$) | Horas/Mes |
| Retroescavadeira      | [Input] | [Select]     | [Input]           | [Input]   |
| Compactador Mecanico  | [Input] | [Select]     | [Input]           | [Input]   |
| Caminhao Basculante   | [Input] | [Select]     | [Input]           | [Input]   |
| Caminhao Munk         | [Input] | [Select]     | [Input]           | [Input]   |
| Bomba de Esgotamento  | [Input] | [Select]     | [Input]           | [Input]   |
| Gerador               | [Input] | [Select]     | [Input]           | [Input]   |
| [Personalizado]       | [Input] | [Select]     | [Input]           | [Input]   |

Subtotal Equipamentos/Mes: R$ XXXXX
```

**Sub-secao: Materiais Estimados**

```
Usar Orcamento da Plataforma: [Toggle ON/OFF]
  - Se ON: puxar automaticamente o valor total de materiais do modulo Orcamento
    (mostrar: "R$ XXX.XXX,XX importados do modulo Orcamento — Y itens")
  - Se OFF: campo manual

Custo Estimado de Materiais/Mes: [Input R$]
```

---

## PART 4 — SECAO 3: ORCAMENTO MENSAL E TOTAL

### 4.1 — Card "Resumo do Orcamento"

```
Card com borda-esquerda laranja (#f59e0b) e titulo:
"Resumo do Orcamento do Contrato"
```

**6 Cards de Resumo (em grid 3x2):**

```
| Custo Mao de Obra/Mes   | Custo Equipamentos/Mes   | Custo Materiais/Mes      |
| (azul #3b82f6)           | (roxo #8b5cf6)           | (laranja #f59e0b)        |
| R$ XXX.XXX,XX            | R$ XXX.XXX,XX            | R$ XXX.XXX,XX            |
|------------------------------------------------------------------------|
| Custo Direto Total/Mes   | Duracao do Contrato      | Custo Direto Total       |
| (verde #22c55e)          | (teal #14b8a6)           | (vermelho #ef4444)       |
| R$ XXX.XXX,XX            | XX meses                 | R$ X.XXX.XXX,XX          |
```

**Calculo:**
```
Custo Direto Total/Mes = Mao de Obra/Mes + Equipamentos/Mes + Materiais/Mes
Custo Direto Total     = Custo Direto Total/Mes × Duracao (meses)
```

---

## PART 5 — SECAO 4: COMPOSICAO DETALHADA DO BDI

### 5.1 — Card "Composicao do BDI"

```
Card com borda-esquerda verde (#22c55e) e titulo:
"Composicao do BDI"
Subtitulo: "O BDI (Beneficios e Despesas Indiretas) e o percentual aplicado sobre
o custo direto para formar o preco de venda. Inclui lucro, impostos, administracao
central, seguros e outros custos indiretos."
```

**Tabela de Composicao do BDI:**

```
| Componente                          | Percentual (%) | Valor (R$)    | Editavel |
|-------------------------------------|----------------|---------------|----------|
| Administracao Central (AC)          | [3.00]         | [Calculado]   | Sim      |
| Seguro e Garantia (SG)             | [0.80]         | [Calculado]   | Sim      |
| Risco (R)                          | [1.27]         | [Calculado]   | Sim      |
| Despesas Financeiras (DF)          | [1.23]         | [Calculado]   | Sim      |
| Lucro (L)                          | [6.16]         | [Calculado]   | Sim      |
| PIS                                | [0.65]         | [Calculado]   | Sim      |
| COFINS                             | [3.00]         | [Calculado]   | Sim      |
| ISS                                | [2.00]         | [Calculado]   | Sim      |
| CPRB (Contrib. Previdenciaria)     | [0.00]         | [Calculado]   | Sim      |
| IRPJ (estimativa)                  | [0.00]         | [Calculado]   | Sim      |
| CSLL (estimativa)                  | [0.00]         | [Calculado]   | Sim      |
|-------------------------------------|----------------|---------------|----------|
| **BDI TOTAL**                       | **[XX.XX]**    | **[Calculado]** |        |
```

**Formula do BDI (Acordao TCU 2622/2013):**

```
BDI = [(1+AC+SG+R+DF) × (1+L) × (1+I)] - 1

Onde:
  AC = Administracao Central
  SG = Seguros e Garantias
  R  = Riscos
  DF = Despesas Financeiras
  L  = Lucro
  I  = Impostos (PIS + COFINS + ISS + CPRB)

Mostrar a formula expandida no card como referencia.
```

**Card informativo (azul claro #dbeafe):**
```
Referencia: Acordao TCU 2622/2013

Faixas de referencia para obras de saneamento:
  - BDI para Obras:          20,34% a 25,00%
  - BDI para Fornecimento:   11,10% a 14,02%
  - BDI para Servicos:       16,80% a 20,97%
  - BDI para Equipamentos:   14,02% a 18,45%

O BDI medio para obras de saneamento e tipicamente entre 20% e 25%.
Para licitacoes, verificar o BDI de referencia do edital.
```

**Modo Simplificado (Toggle):**
```
[Toggle: Modo Simplificado]

Se ativado, esconder a tabela detalhada e mostrar apenas:

Percentual de BDI Desejado: [Input %] (padrao: 12%)
  - Slider de 5% a 40%
  - Campo numerico editavel ao lado

Nota: "No modo simplificado, o BDI e aplicado como um percentual
unico sobre o custo direto total. Ative o modo detalhado para
compor o BDI por item (AC, lucro, impostos, etc.)"
```

---

## PART 6 — SECAO 5: CALCULO FINAL E PRECO DE VENDA

### 6.1 — Card "Preco de Venda do Contrato"

```
Card com borda-esquerda verde (#22c55e) e titulo:
"Preco de Venda do Contrato"
Background do card: gradiente sutil de branco para verde claro (#f0fdf4)
```

**Resumo Final (cards grandes, destaque visual):**

```
| Custo Direto Total              | BDI (%)          | Valor do BDI (R$)        |
| (cinza escuro, fonte grande)    | (verde, destaque) | (verde, destaque)         |
| R$ X.XXX.XXX,XX                 | XX,XX%            | R$ X.XXX.XXX,XX          |
|-------------------------------------------------------------------------|
| PRECO DE VENDA (TOTAL)          |  Preco de Venda/Mes               |
| (verde #22c55e, bg escuro,      |  (teal, medio)                    |
|  fonte 2xl, negrito)            |                                   |
| R$ XX.XXX.XXX,XX                |  R$ X.XXX.XXX,XX                  |
```

**Calculo:**
```
Valor do BDI       = Custo Direto Total × (BDI% / 100)
   -- ou, no modo detalhado:
Valor do BDI       = Custo Direto Total × [(1+AC+SG+R+DF)×(1+L)×(1+I) - 1]

Preco de Venda     = Custo Direto Total + Valor do BDI
Preco de Venda/Mes = Preco de Venda / Duracao (meses)
```

---

## PART 7 — SECAO 6: ANALISE DE VIABILIDADE (ORCADO vs. CONTRATO)

### 7.1 — Card "Analise de Viabilidade"

```
Card com borda-esquerda roxo (#8b5cf6) e titulo:
"Analise de Viabilidade — Orcado vs. Contrato"
Subtitulo: "Compare o preco de venda calculado com o valor do edital/contrato"
```

**Campos:**

```
Valor do Contrato/Edital (R$): [Input — valor que a concessionaria vai pagar]
```

**Resultado (exibido automaticamente ao preencher):**

```
| Preco de Venda Calculado | Valor do Edital     | Diferenca (R$)     | Status           |
| R$ XX.XXX.XXX,XX         | R$ XX.XXX.XXX,XX    | R$ ±X.XXX.XXX,XX  | [Badge Colorido] |
```

**Badges de Status:**
```
Se Preco de Venda < Valor do Edital:
  Badge VERDE: "VIAVEL — Margem de R$ XXX.XXX (X,XX%)"

Se Preco de Venda = Valor do Edital (±2%):
  Badge AMARELO: "ATENCAO — Margem muito justa (X,XX%)"

Se Preco de Venda > Valor do Edital:
  Badge VERMELHO: "INVIAVEL — Deficit de R$ XXX.XXX (X,XX%)"
```

**Sub-card de Detalhamento:**

```
Margem Real do Contrato:
  Lucro Real (R$)  = Valor do Edital - Custo Direto Total
  Lucro Real (%)   = (Lucro Real / Custo Direto Total) × 100
  BDI Real (%)     = (Valor do Edital / Custo Direto Total - 1) × 100

Destaque visual:
  - Se Lucro Real > 10%: card com borda verde, icone check
  - Se Lucro Real entre 5% e 10%: card com borda amarela, icone alerta
  - Se Lucro Real < 5%: card com borda vermelha, icone X
```

---

## PART 8 — SECAO 7: SIMULADOR DE CENARIOS

### 8.1 — Card "Simulador de Cenarios BDI"

```
Card com borda-esquerda teal (#14b8a6) e titulo:
"Simulador de Cenarios"
Subtitulo: "Varie o BDI e veja o impacto no preco de venda e na margem"
```

**Tabela de Cenarios (gerada automaticamente):**

```
| Cenario   | BDI (%) | Preco de Venda (R$) | Margem vs Edital (R$) | Margem (%) | Status    |
| Minimo    | 8%      | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
| Conservador| 12%    | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
| Referencia| 20%     | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
| TCU Medio | 22%     | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
| Maximo    | 30%     | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
| Custom    | [Input] | R$ XXX.XXX          | R$ XXX.XXX            | XX%        | [Badge]   |
```

**Botao:**
```
[+ Adicionar Cenario] — abre linha nova editavel
```

**Grafico de Cenarios (Chart.js — Barras + Linha):**

```
Eixo X: Cenarios (8%, 10%, 12%, 15%, 18%, 20%, 22%, 25%, 30%)
Eixo Y Esquerdo: Preco de Venda (R$) — Barras azuis (#3b82f6)
Eixo Y Direito: Margem (%) — Linha verde (#22c55e)

Linha horizontal tracejada vermelha: Valor do Edital
Regiao verde claro: zona de viabilidade (preco < edital)
Regiao vermelha clara: zona de inviabilidade (preco > edital)

Titulo: "Impacto do BDI no Preco de Venda"
```

**Grafico de Pizza — Composicao do Preco (Chart.js Donut):**

```
Fatias:
  - Mao de Obra: XX% (azul #3b82f6)
  - Equipamentos: XX% (roxo #8b5cf6)
  - Materiais: XX% (laranja #f59e0b)
  - BDI (Lucro + Indiretos): XX% (verde #22c55e)

Centro: "R$ XX.XXX.XXX"
Titulo: "Composicao do Preco de Venda"
```

---

## PART 9 — SECAO 8: HISTORICO DE CONTRATOS

### 9.1 — Card "Historico de Contratos"

```
Card com titulo:
"Historico de Contratos"
Subtitulo: "Contratos cadastrados e seus BDIs"
```

**Tabela:**

```
Filtros:
[Input busca] [Select tipo: Todos/Agua/Esgoto/Drenagem/ETA/ETE/Misto]

| Contrato              | Contratante | Tipo   | Valor (R$)        | BDI (%) | Status    | Acoes        |
| Itapetininga - Rede   | SABESP      | Misto  | R$ 100.000.000    | 12%     | [Badge]   | [Ver][Editar][Duplicar][Excluir] |
| Sorocaba - ETA        | DAE         | ETA    | R$ 45.000.000     | 18%     | [Badge]   | [Ver][Editar][Duplicar][Excluir] |
```

**Badges de Status:**
```
Em Andamento: Badge azul (#3b82f6)
Concluido: Badge verde (#22c55e)
Proposta: Badge amarelo (#f59e0b)
Cancelado: Badge vermelho (#ef4444)
```

**Persistencia:**
```
- Salvar contratos no localStorage inicialmente
- Quando Supabase estiver configurado, persistir na tabela `contratos_bdi`
```

---

## PART 10 — SECAO 9: EXPORTACAO

### 10.1 — Card "Exportacao"

```
Card com titulo:
"Exportacao do BDI"
```

**Botoes de Exportacao:**

```
[Exportar Excel (.xlsx)] — Verde
  - Gera planilha com abas:
    - Aba "Dados do Contrato": todas as informacoes basicas
    - Aba "Composicao Equipes": mao de obra + equipamentos
    - Aba "Orcamento Mensal": resumo de custos/mes
    - Aba "Composicao BDI": tabela detalhada dos componentes
    - Aba "Preco de Venda": resumo final
    - Aba "Viabilidade": comparativo orcado vs edital
    - Aba "Cenarios": tabela de simulacao

[Exportar CSV (.csv)] — Laranja
  - Exporta tabela resumida com colunas:
    Item;Descricao;Valor

[Exportar PDF (.pdf)] — Vermelho
  - Gera relatorio formatado com:
    - Logo/cabecalho da empresa
    - Dados do contrato
    - Composicao do BDI
    - Preco de venda
    - Analise de viabilidade
    - Graficos (pizza e barras)

[Imprimir] — Cinza
  - Abre print dialog do navegador com layout otimizado
```

---

## PART 11 — INTEGRACAO COM MODULO DE ORCAMENTO EXISTENTE

### 11.1 — Sincronizar com Orcamento

O modulo BDI deve se integrar com o modulo de Orcamento existente:

**De Orcamento para BDI:**
```
- Botao no modulo de Orcamento: "Enviar para BDI"
- Preenche automaticamente o campo "Custo Estimado de Materiais/Mes" no BDI
- Importa a lista de itens orcamentarios como referencia
- Mostra badge: "Dados importados do Orcamento (X itens, R$ XXX.XXX)"
```

**De BDI para Orcamento:**
```
- No modulo de Orcamento, atualizar o campo `bdi` com o valor calculado no modulo BDI
- Substituir o BDI fixo de 25% pelo BDI detalhado calculado
- Mostrar no modulo de Orcamento: "BDI: XX,XX% (via Modulo BDI)"
```

---

## PART 12 — INTERFACES TYPESCRIPT

### 12.1 — Tipos e Interfaces

Criar o arquivo `src/engine/bdi.ts` com as seguintes interfaces:

```typescript
export interface ContratoBDI {
  id: string;
  nome: string;
  contratante: string;
  tipoContrato: TipoContrato;
  numeroEdital: string;
  dataInicio: string;      // ISO date
  dataTermino: string;     // ISO date
  duracaoMeses: number;
  municipio: string;
  estado: string;
  status: StatusContrato;
  createdAt: string;
  updatedAt: string;
}

export enum TipoContrato {
  REDE_AGUA = 'Assentamento de Rede de Agua',
  REDE_ESGOTO = 'Assentamento de Rede de Esgoto',
  REDE_AGUA_ESGOTO = 'Assentamento de Rede de Agua + Esgoto',
  ETA = 'Montagem de ETA',
  ETE = 'Montagem de ETE',
  ESTACAO_ELEVATORIA = 'Estacoes Elevatorias',
  DRENAGEM = 'Drenagem Pluvial',
  OBRA_CIVIL = 'Obra Civil de Saneamento',
  MANUTENCAO = 'Manutencao de Redes',
  MISTO = 'Contrato Misto'
}

export enum StatusContrato {
  PROPOSTA = 'Proposta',
  EM_ANDAMENTO = 'Em Andamento',
  CONCLUIDO = 'Concluido',
  CANCELADO = 'Cancelado'
}

export interface CargoEquipe {
  id: string;
  cargo: string;
  quantidade: number;
  salarioMensal: number;
  encargosPercent: number;  // default 73.33
  custoTotalMes: number;    // calculado: quantidade * salarioMensal * (1 + encargos/100)
}

export interface EquipamentoContrato {
  id: string;
  equipamento: string;
  quantidade: number;
  proprioOuAlugado: 'Proprio' | 'Alugado';
  custoMensal: number;
  horasMes: number;
}

export interface ComposicaoBDI {
  administracaoCentral: number;   // % — default 3.00
  seguroGarantia: number;         // % — default 0.80
  risco: number;                  // % — default 1.27
  despesasFinanceiras: number;    // % — default 1.23
  lucro: number;                  // % — default 6.16
  pis: number;                    // % — default 0.65
  cofins: number;                 // % — default 3.00
  iss: number;                    // % — default 2.00
  cprb: number;                   // % — default 0.00
  irpj: number;                   // % — default 0.00
  csll: number;                   // % — default 0.00
}

export interface OrcamentoContrato {
  custoMaoObraMes: number;
  custoEquipamentosMes: number;
  custoMateriaisMes: number;
  custoDiretoMes: number;         // soma dos tres acima
  duracaoMeses: number;
  custoDiretoTotal: number;       // custoDiretoMes * duracaoMeses
}

export interface ResultadoBDI {
  modoSimplificado: boolean;
  bdiPercentual: number;          // BDI total calculado (%)
  bdiValor: number;               // Custo Direto Total * (BDI / 100)
  precoVenda: number;             // Custo Direto Total + BDI Valor
  precoVendaMes: number;          // Preco Venda / Duracao Meses
  composicao: ComposicaoBDI;      // detalhamento dos componentes
}

export interface AnaliseViabilidade {
  valorEdital: number;
  precoVendaCalculado: number;
  diferenca: number;              // valorEdital - precoVendaCalculado
  diferencaPercent: number;
  lucroReal: number;              // valorEdital - custoDiretoTotal
  lucroRealPercent: number;       // (lucroReal / custoDiretoTotal) * 100
  bdiReal: number;                // (valorEdital / custoDiretoTotal - 1) * 100
  status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
}

export interface CenarioBDI {
  nome: string;
  bdiPercent: number;
  precoVenda: number;
  margemVsEdital: number;
  margemPercent: number;
  status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
}
```

### 12.2 — Funcoes de Calculo

```typescript
/**
 * Calcula BDI pelo metodo TCU (Acordao 2622/2013)
 * Formula: BDI = [(1+AC+SG+R+DF) × (1+L) × (1+I)] - 1
 */
export function calcularBDI_TCU(composicao: ComposicaoBDI): number {
  const AC = composicao.administracaoCentral / 100;
  const SG = composicao.seguroGarantia / 100;
  const R  = composicao.risco / 100;
  const DF = composicao.despesasFinanceiras / 100;
  const L  = composicao.lucro / 100;
  const I  = (composicao.pis + composicao.cofins + composicao.iss +
              composicao.cprb + composicao.irpj + composicao.csll) / 100;

  const bdi = ((1 + AC + SG + R + DF) * (1 + L) * (1 + I)) - 1;
  return Math.round(bdi * 10000) / 100;  // retorna em %
}

/**
 * Calcula o preco de venda
 */
export function calcularPrecoVenda(
  custoDiretoTotal: number,
  bdiPercent: number
): number {
  return Math.round(custoDiretoTotal * (1 + bdiPercent / 100) * 100) / 100;
}

/**
 * Analisa viabilidade comparando preco calculado vs valor do edital
 */
export function analisarViabilidade(
  custoDiretoTotal: number,
  precoVendaCalculado: number,
  valorEdital: number
): AnaliseViabilidade {
  const diferenca = valorEdital - precoVendaCalculado;
  const diferencaPercent = (diferenca / valorEdital) * 100;
  const lucroReal = valorEdital - custoDiretoTotal;
  const lucroRealPercent = (lucroReal / custoDiretoTotal) * 100;
  const bdiReal = ((valorEdital / custoDiretoTotal) - 1) * 100;

  let status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
  if (diferencaPercent > 2) status = 'VIAVEL';
  else if (diferencaPercent >= -2) status = 'ATENCAO';
  else status = 'INVIAVEL';

  return {
    valorEdital,
    precoVendaCalculado,
    diferenca: Math.round(diferenca * 100) / 100,
    diferencaPercent: Math.round(diferencaPercent * 100) / 100,
    lucroReal: Math.round(lucroReal * 100) / 100,
    lucroRealPercent: Math.round(lucroRealPercent * 100) / 100,
    bdiReal: Math.round(bdiReal * 100) / 100,
    status
  };
}

/**
 * Gera cenarios padrao de BDI
 */
export function gerarCenarios(
  custoDiretoTotal: number,
  valorEdital: number,
  cenariosBDI: number[] = [8, 10, 12, 15, 18, 20, 22, 25, 30]
): CenarioBDI[] {
  return cenariosBDI.map(bdi => {
    const precoVenda = calcularPrecoVenda(custoDiretoTotal, bdi);
    const margem = valorEdital - precoVenda;
    const margemPercent = (margem / valorEdital) * 100;

    let status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
    if (margemPercent > 2) status = 'VIAVEL';
    else if (margemPercent >= -2) status = 'ATENCAO';
    else status = 'INVIAVEL';

    return {
      nome: `BDI ${bdi}%`,
      bdiPercent: bdi,
      precoVenda: Math.round(precoVenda * 100) / 100,
      margemVsEdital: Math.round(margem * 100) / 100,
      margemPercent: Math.round(margemPercent * 100) / 100,
      status
    };
  });
}
```

---

## PART 13 — ESTILO VISUAL

### 13.1 — Design System (mesmo da plataforma)

**Cores:**
```
Azul: #3b82f6
Verde: #22c55e
Laranja: #f59e0b
Roxo: #8b5cf6
Vermelho: #ef4444
Teal: #14b8a6
```

**Cards:**
```
Background: white
Border-radius: 12px
Border: 1px solid #e2e8f0
Shadow: 0 1px 3px rgba(0,0,0,0.1)
Borda-esquerda colorida: 4px solid [cor da secao]
```

**Botoes:**
```
Border-radius: 8px
Padding: 10px 20px
Font-weight: 500
```

**Tabelas:**
```
Header: bg-slate-50, texto bold
Linhas alternadas: bg-white / bg-slate-50
Hover: bg-blue-50
Border: 1px solid #e2e8f0
```

**Inputs monetarios:**
```
Prefixo "R$" fixo a esquerda
Formato: 1.234.567,89 (padrao brasileiro)
Alinhamento: direita
```

**Responsividade:**
```
Desktop: grid 3 colunas nos cards de resumo
Tablet: grid 2 colunas
Mobile: 1 coluna, cards empilhados
```

---

## PART 14 — DADOS DEMO

### 14.1 — Botao "Carregar Demo"

```
[Carregar Demo] — Botao roxo (#8b5cf6) no topo da aba BDI
```

**Dados do demo:**

```javascript
const DEMO_CONTRATO = {
  nome: "Itapetininga - Assentamento Rede Agua/Esgoto + ETA + Estacoes Elevatorias",
  contratante: "SABESP",
  tipoContrato: "Contrato Misto",
  numeroEdital: "PE-2025/0142",
  dataInicio: "2025-03-01",
  dataTermino: "2025-12-31",
  duracaoMeses: 10,
  municipio: "Itapetininga",
  estado: "SP",
  status: "Em Andamento",

  maoDeObra: [
    { cargo: "Engenheiro Residente", quantidade: 1, salarioMensal: 18500.00, encargos: 73.33 },
    { cargo: "Encarregado de Obra", quantidade: 3, salarioMensal: 6800.00, encargos: 73.33 },
    { cargo: "Tecnico em Seguranca", quantidade: 1, salarioMensal: 5200.00, encargos: 73.33 },
    { cargo: "Oficial/Encanador", quantidade: 12, salarioMensal: 3800.00, encargos: 73.33 },
    { cargo: "Ajudante Geral", quantidade: 24, salarioMensal: 2100.00, encargos: 73.33 },
    { cargo: "Operador de Maquinas", quantidade: 4, salarioMensal: 4500.00, encargos: 73.33 },
    { cargo: "Motorista", quantidade: 6, salarioMensal: 3200.00, encargos: 73.33 },
    { cargo: "Almoxarife", quantidade: 1, salarioMensal: 3500.00, encargos: 73.33 },
    { cargo: "Topografo", quantidade: 2, salarioMensal: 5800.00, encargos: 73.33 }
  ],

  equipamentos: [
    { equipamento: "Retroescavadeira", quantidade: 3, tipo: "Alugado", custoMensal: 18500.00, horasMes: 176 },
    { equipamento: "Compactador Mecanico", quantidade: 4, tipo: "Alugado", custoMensal: 3200.00, horasMes: 176 },
    { equipamento: "Caminhao Basculante", quantidade: 4, tipo: "Alugado", custoMensal: 12800.00, horasMes: 176 },
    { equipamento: "Caminhao Munk 12t", quantidade: 2, tipo: "Alugado", custoMensal: 15500.00, horasMes: 176 },
    { equipamento: "Bomba Submersa", quantidade: 2, tipo: "Proprio", custoMensal: 1800.00, horasMes: 80 },
    { equipamento: "Gerador 150kVA", quantidade: 1, tipo: "Alugado", custoMensal: 8500.00, horasMes: 120 },
    { equipamento: "Veiculo Apoio", quantidade: 3, tipo: "Proprio", custoMensal: 4200.00, horasMes: 176 }
  ],

  custoMateriaisMes: 3500000.00,

  composicaoBDI: {
    administracaoCentral: 3.00,
    seguroGarantia: 0.80,
    risco: 1.27,
    despesasFinanceiras: 1.23,
    lucro: 6.16,
    pis: 0.65,
    cofins: 3.00,
    iss: 2.00,
    cprb: 0.00,
    irpj: 0.00,
    csll: 0.00
  },

  valorEdital: 112000000.00  // R$ 112 milhoes (contrato)
};
```

---

## PART 15 — SUPABASE SCHEMA (para quando estiver pronto)

### 15.1 — Tabela `contratos_bdi`

```sql
CREATE TABLE contratos_bdi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  contratante TEXT,
  tipo_contrato TEXT,
  numero_edital TEXT,
  data_inicio DATE,
  data_termino DATE,
  duracao_meses INTEGER,
  municipio TEXT,
  estado TEXT,
  status TEXT DEFAULT 'Proposta',

  -- Custos
  custo_mao_obra_mes DECIMAL(15,2),
  custo_equipamentos_mes DECIMAL(15,2),
  custo_materiais_mes DECIMAL(15,2),
  custo_direto_total DECIMAL(15,2),

  -- BDI
  modo_simplificado BOOLEAN DEFAULT true,
  bdi_percentual DECIMAL(5,2) DEFAULT 12.00,
  composicao_bdi JSONB,

  -- Resultado
  preco_venda DECIMAL(15,2),
  valor_edital DECIMAL(15,2),

  -- Equipes (JSONB)
  mao_de_obra JSONB,
  equipamentos JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE contratos_bdi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contracts"
  ON contratos_bdi FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## PART 16 — PRIORIDADE DE IMPLEMENTACAO

```
1. CRITICA: Estrutura da aba BDI com navegacao (PART 1)
2. CRITICA: Formulario de dados do contrato (PART 2)
3. CRITICA: Composicao de equipes com calculo automatico (PART 3)
4. CRITICA: Cards de resumo de orcamento (PART 4)
5. ALTA:    Composicao detalhada do BDI com formula TCU (PART 5)
6. ALTA:    Calculo do preco de venda (PART 6)
7. ALTA:    Analise de viabilidade (PART 7)
8. MEDIA:   Simulador de cenarios com graficos (PART 8)
9. MEDIA:   Historico de contratos (PART 9)
10. MEDIA:  Exportacao (PART 10)
11. BAIXA:  Integracao bidirecional com Orcamento (PART 11)
12. BAIXA:  Persistencia Supabase (PART 15)
```

---

## DEPENDENCIAS ADICIONAIS

```json
{
  "dependencies": {
    "uuid": "^9.0.0"
  }
}
```

Nenhuma dependencia nova obrigatoria — o projeto ja tem `xlsx`, `file-saver`, `chart.js`, `react-chartjs-2`, `lucide-react`.

---

## RESUMO FINAL

O modulo BDI transforma a plataforma de um simples calculador de orcamento em uma **ferramenta completa de analise de viabilidade de contratos**, permitindo:

1. Cadastrar qualquer contrato de saneamento/obras
2. Montar a composicao de custos (equipes + equipamentos + materiais)
3. Calcular o BDI pela formula oficial do TCU
4. Simular cenarios de lucro
5. Comparar com o valor do edital para decidir se o contrato e viavel
6. Manter historico de todos os contratos para referencia futura

Este modulo e essencial para a tomada de decisao comercial: **aceitar ou recusar um contrato com base em dados reais de custo e margem de lucro.**

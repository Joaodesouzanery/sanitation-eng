# Especificação Completa para Integração Lovable

## Visão Geral

Este documento especifica as funcionalidades completas dos módulos **Topografia**, **Planejamento** e **RDO** para implementação na Lovable. Os arquivos de engine TypeScript já estão disponíveis em `src/engine/` e devem ser copiados para o projeto Lovable.

---

## MÓDULO 1: TOPOGRAFIA

### 1.1 Descrição
Módulo para importação de dados topográficos, processamento de pontos e visualização em mapa interativo georreferenciado.

### 1.2 Funcionalidades Obrigatórias

#### 1.2.1 Importação de Arquivos
- **Formatos suportados**: CSV, TXT (delimitador `;` ou `,`)
- **Colunas esperadas**: `id` (ou `ponto`/`nome`), `x` (ou `este`), `y` (ou `norte`), `cota` (ou `z`/`elevacao`)
- **Drag-and-drop**: Área de arrastar arquivos
- **Validação**: Tamanho máximo 50MB, validar formato e colunas

#### 1.2.2 Processamento de Dados
Usar as funções do arquivo `src/engine/reader.ts`:
```typescript
import { parseCSV, PontoTopografico } from './engine/reader';

// Exemplo de uso:
const pontos = parseCSV(conteudoCSV, ';');
// Retorna: Array<{ id: string, x: number, y: number, cota: number }>
```

#### 1.2.3 Criação de Trechos
Usar as funções do arquivo `src/engine/domain.ts`:
```typescript
import { createTrechosFromTopography, summarizeNetwork } from './engine/domain';

// Criar trechos a partir dos pontos:
const trechos = createTrechosFromTopography(pontos, diametroMm, material);

// Cada trecho contém:
// - idInicio, idFim: IDs dos pontos
// - comprimento: distância em metros
// - declividade: diferença de cota / comprimento
// - tipoRede: 'Esgoto por Gravidade' ou 'Elevatoria / Booster'
// - diametroMm, material
// - coordenadas: xInicio, yInicio, cotaInicio, xFim, yFim, cotaFim
```

#### 1.2.4 Classificação Automática
Usar `src/engine/geometry.ts`:
```typescript
// Declividade mínima para gravidade: 0.5% (0.005)
export const DECLIVIDADE_MIN = 0.005;

// Se declividade >= 0.005 → "Esgoto por Gravidade"
// Se declividade < 0.005 → "Elevatoria / Booster"
```

### 1.3 Interface de Usuário

#### 1.3.1 Configuração (antes da importação)
- **Diâmetro**: Select com opções DN100, DN150, DN200, DN250, DN300, DN400, DN500
- **Material**: Select com PVC, PEAD, Ferro Fundido, Concreto

#### 1.3.2 Área de Upload
```
┌─────────────────────────────────────────────┐
│                    📁                        │
│  Arraste o arquivo aqui ou clique para      │
│              selecionar                      │
│        Formatos: .txt, .csv                 │
└─────────────────────────────────────────────┘
```

#### 1.3.3 Cards de Resumo (após importação)
Exibir 6 cards:
1. **Total de Pontos**: `pontos.length`
2. **Total de Trechos**: `summary.totalTrechos`
3. **Comprimento Total**: `summary.comprimentoTotal` em metros
4. **Por Gravidade**: `summary.trechosGravidade`
5. **Elevatória**: `summary.trechosElevatoria`
6. **Declividade Média**: `summary.declividadeMedia * 100` em %

#### 1.3.4 Mapa Interativo (Leaflet)
- **Biblioteca**: Leaflet.js
- **Tile**: OpenStreetMap
- **Marcadores de Pontos**:
  - Primeiro ponto: verde (#22c55e)
  - Último ponto: vermelho (#ef4444)
  - Intermediários: azul (#3b82f6)
- **Linhas de Trechos**:
  - Gravidade: verde (#22c55e)
  - Elevatória: laranja (#f59e0b)
- **Popup ao clicar**:
  - No ponto: ID, X, Y, Cota
  - No trecho: Início→Fim, Comprimento, Declividade%, Tipo, DN, Material

#### 1.3.5 Tabela de Dados
Colunas: Início | Fim | Comp.(m) | Decliv.(%) | Tipo | DN | Material

#### 1.3.6 Exportação
- **CSV**: Exportar trechos com todas as colunas
- **JSON**: Exportar { pontos, trechos, summary }

---

## MÓDULO 2: PLANEJAMENTO

### 2.1 Descrição
Módulo de cronograma com a **Regra de Conclusão no Mesmo Dia** (Same-Day Completion) - fundamental em obras de saneamento onde não se pode deixar vala aberta.

### 2.2 Regra Fundamental (CRÍTICO)
```
⚠️ REGRA DE CONCLUSÃO NO MESMO DIA
Em obras de saneamento, NÃO se pode deixar vala aberta de um dia para outro.
Cada segmento escavado DEVE ser completado no mesmo dia:
  Escavação → Nivelamento → Assentamento → Escoramento → Reaterro → Base
```

### 2.3 Funcionalidades Obrigatórias

#### 2.3.1 Configuração da Equipe
Usar `src/engine/planning.ts`:
```typescript
interface TeamConfig {
  encarregado: number;      // padrão: 1
  oficiais: number;         // padrão: 2
  ajudantes: number;        // padrão: 4
  operador: number;         // padrão: 1
  metrosDiaBase: number;    // padrão: 12 metros/dia
  hoursPerDay: number;      // padrão: 8 horas
  hasRetro: boolean;        // retroescavadeira
  hasCompactor: boolean;    // compactador
  hasTruck: boolean;        // caminhão
  hasPump: boolean;         // bomba
}
```

#### 2.3.2 Cálculo de Produtividade
A produtividade em metros/dia varia conforme:

**Por Profundidade:**
- > 3.0m: × 0.5 (muito profundo)
- > 2.5m: × 0.6
- > 2.0m: × 0.7
- > 1.5m: × 0.85

**Por Diâmetro:**
- > 400mm: × 0.6
- > 300mm: × 0.75
- > 200mm: × 0.9

**Por Equipamentos:**
- Sem retroescavadeira: × 0.4
- Sem compactador: × 0.8
- Com bomba: × 1.1

**Mínimo**: 3 metros/dia

#### 2.3.3 Geração do Cronograma
```typescript
import { generateFullSchedule } from './engine/planning';

const schedule = generateFullSchedule(trechos, numEquipes, teamConfig, dataInicio);

// Retorna:
// - totalDays: número de dias de obra
// - schedule: array de ScheduleItem
// - dailyPlan: array de DailyPlanItem
// - curveS: dados para Curva S
// - histogram: dados para histograma
```

#### 2.3.4 Alocação de Equipes
- Múltiplas equipes trabalham em paralelo
- Cada equipe pega o próximo trecho disponível
- Balanceamento automático de carga

### 2.4 Interface de Usuário

#### 2.4.1 Alerta da Regra (sempre visível)
```
⚠️ Regra de Conclusão no Mesmo Dia
Em obras de saneamento, não se pode deixar vala aberta. Cada segmento
escavado é completado no mesmo dia: Escavação → Assentamento → Reaterro.
```

#### 2.4.2 Painel de Configuração
Inputs para:
- Número de Equipes (1-10)
- Encarregados/Equipe
- Oficiais/Equipe
- Ajudantes/Equipe
- Metros/Dia Base
- Data de Início
- Checkboxes: Retroescavadeira, Compactador, Caminhão, Bomba

#### 2.4.3 Cards de Resumo
1. **Dias de Obra**: `schedule.totalDays`
2. **Data de Início**: formatada
3. **Data de Término**: `schedule.endDate`
4. **Custo Total Estimado**: soma dos custos diários

#### 2.4.4 Gráfico de Gantt
```
Legenda: [█ Escav.] [█ Assent.] [█ Reat.] [█ Teste]

Trecho  | Metros |  1   2   3   4   5   6   7   8   9  10
--------|--------|----------------------------------------
T01     |  50m   | [███████]
T02     |  50m   |      [███████]
T03     |  75m   | [██████████████]
T04     |  60m   |           [█████████]  [T]
```

Cada célula mostra:
- Gradiente colorido representando ciclo completo (laranja→azul→verde)
- Número de metros executados no dia
- "T" para teste hidrostático

#### 2.4.5 Curva S (Chart.js)
Gráfico de linhas com:
- **Eixo X**: Dias (D1, D2, D3...)
- **Eixo Y**: Progresso 0-100%
- **Linha Azul**: Físico Planejado (%)
- **Linha Verde**: Financeiro Planejado (%)
- **Área preenchida** sob as curvas

```typescript
// Dados da Curva S
const curveSData = generateCurveSData(schedule.schedule, schedule.dailyPlan, totalDays);
// Retorna: Array<{ day, physicalPlanned, financialPlanned }>
```

#### 2.4.6 Histograma de Recursos (Chart.js)
Gráfico de barras com:
- **Visualização**: Diário / Semanal / Mensal (select)
- **Recurso**: Todos / Mão de Obra / Equipamentos / Custo (select)
- **Barras azuis**: Mão de obra
- **Barras roxas**: Equipamentos
- **Linha tracejada laranja**: Média

```typescript
const histogramData = generateHistogramData(schedule.dailyPlan, totalDays);
// Retorna: Array<{ day, labor, equipment, cost }>
```

#### 2.4.7 Tabela do Plano Diário
Colunas: Dia | Trecho | Atividade | Equipe | Metros | Mão de Obra | Custo/Dia

### 2.5 Exportações
- **Excel**: Cronograma + Plano Diário + Verificação de Regras
- **PDF**: Gráfico de Gantt
- **Imagem**: Gráfico de Gantt como PNG

---

## MÓDULO 3: RDO (Relatório Diário de Obra)

### 3.1 Descrição
Sistema completo de gestão de Relatórios Diários de Obra com dashboard, formulário de entrada, lista, visualização detalhada e mapa georreferenciado.

### 3.2 Funcionalidades Obrigatórias

#### 3.2.1 Estrutura de Dados
Usar `src/engine/rdo.ts`:
```typescript
interface RDO {
  id: string;
  projectId: string;
  date: string;              // YYYY-MM-DD
  projectName: string;
  obraName?: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';
  services: ExecutedService[];
  segments: SegmentProgress[];
  workers?: Worker[];
  workFronts?: WorkFront[];
  locations?: Location[];
  notes?: string;
  occurrences?: string;
  visits?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

interface ExecutedService {
  id: string;
  serviceName: string;
  quantity: number;
  unit: 'm' | 'm2' | 'm3' | 'un' | 'vb' | 'kg' | 'h';
  equipment?: string;
  employeeName?: string;
}

interface SegmentProgress {
  id: string;
  segmentName: string;
  system: 'agua' | 'esgoto' | 'drenagem';
  plannedTotal: number;      // metros planejados
  executedBefore: number;    // metros já executados antes
  executedToday: number;     // metros executados hoje
  startNode?: string;
  endNode?: string;
  coordinates?: { start: [number, number]; end: [number, number] };
}
```

#### 3.2.2 Persistência
- Salvar RDOs no localStorage
- Chave: `rdoData`
- Formato: JSON array de RDOs

### 3.3 Views do Módulo

#### 3.3.1 VIEW: Dashboard
**Cards de Resumo (4 cards principais):**
1. **Total Planejado**: soma de todos plannedTotal (em metros)
2. **Total Executado**: soma de (executedBefore + executedToday) de todos segmentos
3. **Restante**: Planejado - Executado
4. **Progresso**: (Executado / Planejado) × 100%
   - Incluir barra de progresso visual

**Cards por Sistema (3 cards):**
```
💧 Água                    🚰 Esgoto                 🌧️ Drenagem
[████████──] 65.3%         [██████────] 48.2%        [████──────] 32.1%
195m / 300m                241m / 500m               64m / 200m
```

**Gráficos (Chart.js):**

1. **Evolução Semanal** (Line Chart):
   - Últimos 7 dias
   - Linha tracejada: Planejado
   - Linha sólida com área: Executado

2. **Status dos Trechos** (Doughnut Chart):
   - Verde: Concluído
   - Laranja: Em Execução
   - Vermelho: Não Iniciado

#### 3.3.2 VIEW: Lista de RDOs
**Filtros:**
- Campo de busca (por projeto ou data)
- Select de status (Todos / Rascunho / Enviado / Aprovado / Rejeitado)

**Tabela:**
| Data | Projeto | Serviços | Trechos | Executado | Status | Ações |
|------|---------|----------|---------|-----------|--------|-------|
| 11/02/2026 | Projeto X | 5 | 3 | 45.50m | [Enviado] | 👁️ 🗑️ |

**Status badges com cores:**
- Rascunho: laranja (#f59e0b)
- Enviado: azul (#3b82f6)
- Aprovado: verde (#22c55e)
- Rejeitado: vermelho (#ef4444)

#### 3.3.3 VIEW: Formulário de Novo RDO

**Seção 1: Informações Básicas**
- Data (date picker)

**Seção 2: Serviços Executados**
```
🔧 Serviços Executados                    [+ Adicionar]
┌─────────────────────────────────────────────────────┐
│ [Nome do serviço________] [Qtd__] [m ▼] [✕]        │
│ [Nome do serviço________] [Qtd__] [m ▼] [✕]        │
└─────────────────────────────────────────────────────┘
```
- Input: Nome do serviço (texto)
- Input: Quantidade (número)
- Select: Unidade (m, m², m³, un, vb)
- Botão: Remover linha

**Seção 3: Avanço por Trecho**
```
📏 Avanço por Trecho                      [+ Adicionar]
┌─────────────────────────────────────────────────────┐
│ [Nome trecho__] [Plan.__] [Exec.Ant.__] [Exec.Hoje] │
└─────────────────────────────────────────────────────┘
```
- Input: Nome do trecho
- Input: Planejado (metros)
- Input: Executado Anterior (metros)
- Input: Executado Hoje (metros)

**Seção 4: Observações**
- Textarea: Observações gerais
- Textarea: Ocorrências (com destaque visual - borda vermelha)

**Ações:**
- Botão "Cancelar" (cinza)
- Botão "Salvar Rascunho" (laranja) - status = 'rascunho'
- Botão "Enviar RDO" (verde) - status = 'enviado'

#### 3.3.4 VIEW: Detalhe do RDO

**Header com Cards:**
| Projeto | Obra | Data | Status |

**Seção: Serviços Executados**
Tabela com: Serviço | Quantidade | Equipamentos | Responsável

**Seção: Avanço por Trecho**
Tabela com colunas:
| Trecho | Sistema | Planejado | Exec.Anterior | Exec.Hoje | Total | Progresso |

A coluna Progresso deve mostrar:
- Barra de progresso visual
- Percentual (ex: "78.5%")
- Cor da barra conforme progresso:
  - < 50%: vermelho
  - 50-99%: laranja
  - 100%: verde

**Seções Opcionais (se preenchidas):**
- Observações (card normal)
- Ocorrências (card com borda vermelha à esquerda)

#### 3.3.5 VIEW: Mapa Georreferenciado (Leaflet)

**Controles:**
- Select: Filtro por Sistema (Todos / Água / Esgoto / Drenagem)
- Botão: Atualizar

**Legenda:**
```
[───] Concluído (verde)  [───] Em Execução (laranja)  [───] Não Iniciado (vermelho)
```

**Visualização:**
- Polylines representando cada segmento
- Cor conforme status de progresso:
  - 100%: verde (#22c55e), linha grossa
  - > 0%: laranja (#f59e0b)
  - 0%: vermelho (#ef4444)
- CircleMarkers nos nós (início/fim)
- Popup ao clicar:
  ```
  Trecho: seg1
  Sistema: 💧 agua
  Planejado: 100m
  Executado: 75m
  Progresso: 75.0%
  [████████──────]
  ```

### 3.4 Navegação entre Views
Botões de navegação no topo:
```
[📊 Dashboard] [📋 Lista de RDOs] [➕ Novo RDO] [🗺️ Mapa]
```
O botão ativo deve ter cor diferente (azul).

---

## ARQUIVOS DE ENGINE (COPIAR PARA O PROJETO)

Copie os seguintes arquivos de `src/engine/` para o projeto Lovable:

1. **geometry.ts** - Cálculos geométricos
2. **reader.ts** - Parser de arquivos topográficos
3. **domain.ts** - Modelo de Trecho e fábrica
4. **planning.ts** - Cronograma e Same-Day Completion
5. **construction.ts** - Parâmetros de execução
6. **budget.ts** - Orçamento e custos
7. **rdo.ts** - Engine de RDO
8. **dashboard.ts** - Métricas e dados para gráficos
9. **materials.ts** - Materiais e compras
10. **peer-review.ts** - Revisão por pares
11. **index.ts** - Exports

---

## DEPENDÊNCIAS NECESSÁRIAS

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "chart.js": "^4.4.0",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.8"
  }
}
```

---

## ESTILO VISUAL

### Cores do Tema (Dark Mode)
```css
--bg-primary: #0f172a;
--bg-secondary: #1e293b;
--bg-card: #1e293b;
--border-color: #334155;
--text-primary: #e2e8f0;
--text-secondary: #94a3b8;
--accent-blue: #3b82f6;
--accent-green: #22c55e;
--accent-orange: #f59e0b;
--accent-red: #ef4444;
--accent-purple: #8b5cf6;
```

### Componentes
- **Cards**: `background: #1e293b; border-radius: 12px; padding: 20px;`
- **Inputs**: `background: #0f172a; border: 1px solid #334155; border-radius: 8px;`
- **Buttons**: `border-radius: 8px; padding: 10px 20px; font-weight: bold;`
- **Tables**: Cabeçalho em `#0f172a`, linhas alternadas

---

## FLUXO DE USO TÍPICO

1. **Topografia**: Usuário importa CSV com pontos → Sistema cria trechos → Exibe no mapa
2. **Planejamento**: Configura equipe → Gera cronograma → Visualiza Gantt e Curva S
3. **RDO**: Cria RDO diário → Registra serviços e avanço → Acompanha no dashboard e mapa

---

## VALIDAÇÕES IMPORTANTES

1. **Topografia**: Mínimo 2 pontos para criar trechos
2. **Planejamento**: Mínimo 1 trecho para gerar cronograma
3. **RDO**: Data obrigatória, pelo menos 1 serviço ou segmento
4. **Progresso**: Não pode ultrapassar 100% (executado <= planejado)

---

## RESPONSIVIDADE

Todos os módulos devem funcionar em:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

Usar CSS Grid com `repeat(auto-fit, minmax(Xpx, 1fr))` para cards.

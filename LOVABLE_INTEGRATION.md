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
```typescript
// Declividade mínima para gravidade: 0.5% (0.005)
const DECLIVIDADE_MIN = 0.005;

// Se declividade >= 0.005 → "Esgoto por Gravidade"
// Se declividade < 0.005 → "Elevatoria / Booster"
```

#### 1.2.5 Exemplo de Implementação React com Leaflet
```typescript
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';

// Estado
const [pontos, setPontos] = useState<PontoTopografico[]>([]);
const [trechos, setTrechos] = useState<Trecho[]>([]);

// Ao importar arquivo
const handleFileUpload = async (file: File) => {
  const content = await file.text();
  const delimiter = content.includes(';') ? ';' : ',';
  const newPontos = parseCSV(content, delimiter);
  const newTrechos = createTrechosFromTopography(newPontos, diametro, material);
  setPontos(newPontos);
  setTrechos(newTrechos);
};

// Componente do Mapa
<MapContainer center={mapCenter} zoom={15} style={{ height: '500px' }}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

  {/* Pontos como círculos */}
  {pontos.map((ponto, idx) => {
    const [lat, lng] = getMapCoordinates(ponto.x, ponto.y);
    const color = idx === 0 ? '#22c55e' : idx === pontos.length - 1 ? '#ef4444' : '#3b82f6';
    return (
      <CircleMarker key={ponto.id} center={[lat, lng]} radius={8} color={color}>
        <Popup>
          <strong>{ponto.id}</strong><br/>
          X: {ponto.x.toFixed(3)}<br/>
          Y: {ponto.y.toFixed(3)}<br/>
          Cota: {ponto.cota.toFixed(3)}m
        </Popup>
      </CircleMarker>
    );
  })}

  {/* Trechos como linhas */}
  {trechos.map(trecho => {
    const start = getMapCoordinates(trecho.xInicio, trecho.yInicio);
    const end = getMapCoordinates(trecho.xFim, trecho.yFim);
    const color = trecho.tipoRede === 'Esgoto por Gravidade' ? '#22c55e' : '#f59e0b';
    return (
      <Polyline key={`${trecho.idInicio}-${trecho.idFim}`} positions={[start, end]} color={color} weight={4}>
        <Popup>
          <strong>{trecho.idInicio} → {trecho.idFim}</strong><br/>
          Comprimento: {trecho.comprimento.toFixed(2)}m<br/>
          Declividade: {(trecho.declividade * 100).toFixed(2)}%<br/>
          Tipo: {trecho.tipoRede}<br/>
          DN{trecho.diametroMm} - {trecho.material}
        </Popup>
      </Polyline>
    );
  })}
</MapContainer>
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

**Exemplo de Implementação do Gantt:**
```typescript
interface GanttRow {
  trechoId: string;
  metrosTotal: number;
  startDay: number;
  endDay: number;
  segments: { day: number; meters: number; isTest?: boolean }[];
}

function GanttChart({ schedule, totalDays }: { schedule: DailySegment[]; totalDays: number }) {
  // Agrupa por trecho
  const rows: GanttRow[] = [];
  const byTrecho = schedule.reduce((acc, seg) => {
    if (!acc[seg.trechoId]) acc[seg.trechoId] = [];
    acc[seg.trechoId].push(seg);
    return acc;
  }, {} as Record<string, DailySegment[]>);

  Object.entries(byTrecho).forEach(([trechoId, segments]) => {
    const nonTestSegs = segments.filter(s => s.meters > 0);
    rows.push({
      trechoId,
      metrosTotal: nonTestSegs.reduce((sum, s) => sum + s.meters, 0),
      startDay: Math.min(...nonTestSegs.map(s => s.day)),
      endDay: Math.max(...segments.map(s => s.day)),
      segments: segments.map(s => ({
        day: s.day,
        meters: s.meters,
        isTest: s.activities.includes('Teste Hidrostatico')
      }))
    });
  });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ width: '100px', textAlign: 'left' }}>Trecho</th>
          <th style={{ width: '80px' }}>Metros</th>
          {Array.from({ length: totalDays }, (_, i) => (
            <th key={i} style={{ width: '40px', textAlign: 'center' }}>{i + 1}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.trechoId}>
            <td>{row.trechoId}</td>
            <td style={{ textAlign: 'center' }}>{row.metrosTotal.toFixed(0)}m</td>
            {Array.from({ length: totalDays }, (_, day) => {
              const seg = row.segments.find(s => s.day === day + 1);
              if (!seg) return <td key={day} />;

              if (seg.isTest) {
                return (
                  <td key={day} style={{
                    background: '#8b5cf6',
                    color: 'white',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>T</td>
                );
              }

              // Gradiente: laranja (escavação) → azul (assentamento) → verde (reaterro)
              return (
                <td key={day} style={{
                  background: 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 50%, #22c55e 100%)',
                  color: 'white',
                  textAlign: 'center',
                  fontSize: '11px'
                }}>
                  {seg.meters.toFixed(0)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### 2.4.5 Curva S (Chart.js)
Gráfico de linhas com:
- **Eixo X**: Dias (D1, D2, D3...)
- **Eixo Y**: Progresso 0-100%
- **Linha Azul**: Físico Planejado (%)
- **Linha Verde**: Financeiro Planejado (%)
- **Área preenchida** sob as curvas

**Exemplo de Implementação com Chart.js:**
```typescript
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

function CurvaSChart({ curveSData }: { curveSData: CurveSPoint[] }) {
  const data = {
    labels: curveSData.map(d => `D${d.day}`),
    datasets: [
      {
        label: 'Físico Planejado (%)',
        data: curveSData.map(d => d.physicalPercent),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Financeiro Planejado (%)',
        data: curveSData.map(d => d.financialPercent),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Curva S - Progresso Acumulado' }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: { display: true, text: 'Progresso (%)' }
      }
    }
  };

  return <Line data={data} options={options} />;
}
```

#### 2.4.6 Histograma de Recursos (Chart.js)
Gráfico de barras com:
- **Visualização**: Diário / Semanal / Mensal (select)
- **Recurso**: Todos / Mão de Obra / Equipamentos / Custo (select)
- **Barras azuis**: Mão de obra
- **Barras roxas**: Equipamentos
- **Linha tracejada laranja**: Média

**Exemplo de Implementação com Chart.js:**
```typescript
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

function HistogramChart({ histogramData }: { histogramData: HistogramDay[] }) {
  // Calcula média de mão de obra
  const avgLabor = histogramData.reduce((sum, d) => sum + d.labor, 0) / histogramData.length;

  const data = {
    labels: histogramData.map(d => `D${d.day}`),
    datasets: [
      {
        label: 'Mão de Obra',
        data: histogramData.map(d => d.labor),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        label: 'Equipamentos',
        data: histogramData.map(d => d.equipment),
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Histograma de Recursos' },
      annotation: {
        annotations: {
          avgLine: {
            type: 'line' as const,
            yMin: avgLabor,
            yMax: avgLabor,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: `Média: ${avgLabor.toFixed(1)}`,
              enabled: true,
              position: 'end'
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Quantidade' }
      }
    }
  };

  return <Bar data={data} options={options} />;
}

// Agregação semanal
function aggregateWeekly(daily: HistogramDay[]): HistogramDay[] {
  const weeks: HistogramDay[] = [];
  for (let i = 0; i < daily.length; i += 5) {  // 5 dias úteis por semana
    const weekDays = daily.slice(i, i + 5);
    weeks.push({
      day: Math.floor(i / 5) + 1,  // semana 1, 2, 3...
      labor: Math.round(weekDays.reduce((sum, d) => sum + d.labor, 0) / weekDays.length),
      equipment: Math.round(weekDays.reduce((sum, d) => sum + d.equipment, 0) / weekDays.length),
      cost: weekDays.reduce((sum, d) => sum + d.cost, 0)
    });
  }
  return weeks;
}
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

**Exemplo de Implementação do Mapa RDO:**
```typescript
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';

interface SegmentProgress {
  id: string;
  segmentName: string;
  system: 'agua' | 'esgoto' | 'drenagem';
  plannedTotal: number;
  executedBefore: number;
  executedToday: number;
  coordinates?: { start: [number, number]; end: [number, number] };
}

// Função para determinar cor do segmento
function getSegmentColor(segment: SegmentProgress): string {
  const totalExecuted = segment.executedBefore + segment.executedToday;
  const percent = segment.plannedTotal > 0
    ? (totalExecuted / segment.plannedTotal) * 100
    : 0;

  if (percent >= 100) return '#22c55e';  // Verde - Concluído
  if (percent > 0) return '#f59e0b';     // Laranja - Em Execução
  return '#ef4444';                       // Vermelho - Não Iniciado
}

// Ícone de sistema
const systemIcons = {
  agua: '💧',
  esgoto: '🚰',
  drenagem: '🌧️'
};

// Componente do Mapa
function RDOMap({ segments, filter }: { segments: SegmentProgress[]; filter: string }) {
  const filteredSegments = filter === 'todos'
    ? segments
    : segments.filter(s => s.system === filter);

  // Calcula centro do mapa baseado nos segmentos
  const allCoords = filteredSegments
    .filter(s => s.coordinates)
    .flatMap(s => [s.coordinates!.start, s.coordinates!.end]);

  const center: [number, number] = allCoords.length > 0
    ? [
        allCoords.reduce((sum, c) => sum + c[0], 0) / allCoords.length,
        allCoords.reduce((sum, c) => sum + c[1], 0) / allCoords.length
      ]
    : [-23.5505, -46.6333];  // Default: São Paulo

  return (
    <MapContainer center={center} zoom={15} style={{ height: '500px' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {filteredSegments.map(segment => {
        if (!segment.coordinates) return null;

        const color = getSegmentColor(segment);
        const totalExecuted = segment.executedBefore + segment.executedToday;
        const percent = segment.plannedTotal > 0
          ? (totalExecuted / segment.plannedTotal) * 100
          : 0;

        return (
          <Polyline
            key={segment.id}
            positions={[segment.coordinates.start, segment.coordinates.end]}
            color={color}
            weight={percent >= 100 ? 6 : 4}
          >
            <Popup>
              <strong>Trecho: {segment.segmentName}</strong><br/>
              Sistema: {systemIcons[segment.system]} {segment.system}<br/>
              Planejado: {segment.plannedTotal}m<br/>
              Executado: {totalExecuted.toFixed(1)}m<br/>
              Progresso: {percent.toFixed(1)}%<br/>
              <div style={{
                background: '#334155',
                borderRadius: '4px',
                height: '8px',
                marginTop: '4px'
              }}>
                <div style={{
                  background: color,
                  width: `${Math.min(percent, 100)}%`,
                  height: '100%',
                  borderRadius: '4px'
                }} />
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Nós (início e fim de cada segmento) */}
      {filteredSegments
        .filter(s => s.coordinates)
        .flatMap(s => [
          { id: `${s.id}-start`, coord: s.coordinates!.start },
          { id: `${s.id}-end`, coord: s.coordinates!.end }
        ])
        .map(node => (
          <CircleMarker
            key={node.id}
            center={node.coord}
            radius={5}
            color="#1e293b"
            fillColor="#e2e8f0"
            fillOpacity={1}
          />
        ))}
    </MapContainer>
  );
}
```

### 3.4 Navegação entre Views
Botões de navegação no topo:
```
[📊 Dashboard] [📋 Lista de RDOs] [➕ Novo RDO] [🗺️ Mapa]
```
O botão ativo deve ter cor diferente (azul).

---

## CÁLCULOS COMPLETOS (IMPLEMENTAÇÃO DIRETA)

Esta seção contém os cálculos completos que a Lovable deve implementar diretamente. **Não é necessário ler arquivos externos** - todos os algoritmos estão aqui.

### CÁLCULO 1: Transformação de Coordenadas UTM para Lat/Lng (CRÍTICO PARA MAPAS)

O Leaflet usa coordenadas geográficas (Lat/Lng), mas dados topográficos brasileiros geralmente vêm em UTM (x, y).

```typescript
// Constantes para projeção UTM
const EQUATORIAL_RADIUS = 6378137.0; // WGS84
const POLAR_RADIUS = 6356752.314245;
const E_SQUARED = 0.00669437999014;
const K0 = 0.9996;

// Detecta se coordenadas são UTM (valores grandes) ou já são Lat/Lng (valores pequenos)
function isUTM(x: number, y: number): boolean {
  // UTM tem X entre 100000-900000 e Y pode ser até 10000000
  return x > 1000 && x < 1000000 && y > 100000;
}

// Converte UTM para Lat/Lng (aproximação para Brasil - Zona 23S default)
function utmToLatLng(
  easting: number,
  northing: number,
  zone: number = 23,
  hemisphere: 'N' | 'S' = 'S'
): { lat: number; lng: number } {
  const x = easting - 500000;
  const y = hemisphere === 'S' ? northing - 10000000 : northing;

  const m = y / K0;
  const mu = m / (EQUATORIAL_RADIUS * (1 - E_SQUARED / 4 - 3 * E_SQUARED ** 2 / 64));

  const e1 = (1 - Math.sqrt(1 - E_SQUARED)) / (1 + Math.sqrt(1 - E_SQUARED));
  const phi1 = mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const n1 = EQUATORIAL_RADIUS / Math.sqrt(1 - E_SQUARED * sinPhi1 ** 2);
  const r1 = EQUATORIAL_RADIUS * (1 - E_SQUARED) / (1 - E_SQUARED * sinPhi1 ** 2) ** 1.5;
  const d = x / (n1 * K0);

  const lat = phi1 - (n1 * tanPhi1 / r1) * (
    d ** 2 / 2 -
    (5 + 3 * tanPhi1 ** 2) * d ** 4 / 24 +
    (61 + 90 * tanPhi1 ** 2) * d ** 6 / 720
  );

  const lng = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180 +
    (d - (1 + 2 * tanPhi1 ** 2) * d ** 3 / 6 +
    (5 - 2 * tanPhi1 ** 2 + 28 * tanPhi1 ** 2) * d ** 5 / 120) / cosPhi1;

  return {
    lat: lat * 180 / Math.PI,
    lng: lng * 180 / Math.PI
  };
}

// Uso no mapa
function getMapCoordinates(x: number, y: number): [number, number] {
  if (isUTM(x, y)) {
    const { lat, lng } = utmToLatLng(x, y);
    return [lat, lng];
  }
  // Se já for Lat/Lng, retornar diretamente (y = lat, x = lng)
  return [y, x];
}
```

### CÁLCULO 2: Parser de CSV/TXT Topográfico

```typescript
interface PontoTopografico {
  id: string;
  x: number;
  y: number;
  cota: number;
}

function parseCSV(content: string, delimiter = ','): PontoTopografico[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV deve ter pelo menos cabeçalho e uma linha de dados');
  }

  // Encontra colunas pelo nome (flexível)
  const header = lines[0].toLowerCase().split(delimiter).map(h => h.trim());
  const idIndex = header.findIndex(h => ['id', 'ponto', 'nome'].includes(h));
  const xIndex = header.findIndex(h => ['x', 'este', 'easting'].includes(h));
  const yIndex = header.findIndex(h => ['y', 'norte', 'northing'].includes(h));
  const cotaIndex = header.findIndex(h => ['cota', 'z', 'elevacao', 'elevation'].includes(h));

  if (idIndex === -1 || xIndex === -1 || yIndex === -1 || cotaIndex === -1) {
    throw new Error('CSV deve conter colunas: id, x, y, cota');
  }

  const pontos: PontoTopografico[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map(v => v.trim());
    const id = values[idIndex];
    const x = parseFloat(values[xIndex].replace(',', '.')); // Aceita vírgula decimal
    const y = parseFloat(values[yIndex].replace(',', '.'));
    const cota = parseFloat(values[cotaIndex].replace(',', '.'));

    if (id && !isNaN(x) && !isNaN(y) && !isNaN(cota)) {
      pontos.push({ id, x, y, cota });
    }
  }

  return pontos;
}
```

### CÁLCULO 3: Criação de Trechos a partir de Pontos

```typescript
interface Trecho {
  idInicio: string;
  idFim: string;
  comprimento: number;       // metros
  declividade: number;       // valor decimal (0.005 = 0.5%)
  tipoRede: 'Esgoto por Gravidade' | 'Elevatoria / Booster';
  diametroMm: number;
  material: string;
  xInicio: number;
  yInicio: number;
  cotaInicio: number;
  xFim: number;
  yFim: number;
  cotaFim: number;
}

const DECLIVIDADE_MIN = 0.005; // 0.5% mínimo para gravidade

function createTrechosFromTopography(
  pontos: PontoTopografico[],
  diametroMm = 200,
  material = 'PVC'
): Trecho[] {
  if (pontos.length < 2) {
    throw new Error('Mínimo 2 pontos necessários');
  }

  const trechos: Trecho[] = [];

  for (let i = 0; i < pontos.length - 1; i++) {
    const p1 = pontos[i];
    const p2 = pontos[i + 1];

    // Distância euclidiana 2D
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const comprimento = Math.sqrt(dx * dx + dy * dy);

    // Declividade = diferença de cota / comprimento horizontal
    const declividade = (p1.cota - p2.cota) / comprimento;

    // Classificação: >= 0.5% = Gravidade, < 0.5% = Elevatória
    const tipoRede = declividade >= DECLIVIDADE_MIN
      ? 'Esgoto por Gravidade'
      : 'Elevatoria / Booster';

    trechos.push({
      idInicio: p1.id,
      idFim: p2.id,
      comprimento,
      declividade,
      tipoRede,
      diametroMm,
      material,
      xInicio: p1.x,
      yInicio: p1.y,
      cotaInicio: p1.cota,
      xFim: p2.x,
      yFim: p2.y,
      cotaFim: p2.cota
    });
  }

  return trechos;
}
```

### CÁLCULO 4: Resumo da Rede

```typescript
interface NetworkSummary {
  totalTrechos: number;
  comprimentoTotal: number;
  trechosGravidade: number;
  trechosElevatoria: number;
  declividadeMedia: number;
}

function summarizeNetwork(trechos: Trecho[]): NetworkSummary {
  if (!trechos.length) {
    return {
      totalTrechos: 0,
      comprimentoTotal: 0,
      trechosGravidade: 0,
      trechosElevatoria: 0,
      declividadeMedia: 0
    };
  }

  const gravidade = trechos.filter(t => t.tipoRede === 'Esgoto por Gravidade').length;
  const comprimentoTotal = trechos.reduce((sum, t) => sum + t.comprimento, 0);
  const declividadeMedia = trechos.reduce((sum, t) => sum + t.declividade, 0) / trechos.length;

  return {
    totalTrechos: trechos.length,
    comprimentoTotal,
    trechosGravidade: gravidade,
    trechosElevatoria: trechos.length - gravidade,
    declividadeMedia
  };
}
```

### CÁLCULO 5: Produtividade em Metros/Dia (PLANEJAMENTO)

```typescript
interface TeamConfig {
  encarregado: number;
  oficiais: number;
  ajudantes: number;
  operador: number;
  hasRetroescavadeira: boolean;
  hasCompactador: boolean;
  hasCaminhao: boolean;
  hasBomba: boolean;
}

// FÓRMULA PRINCIPAL DE PRODUTIVIDADE
function calculateDailyMeters(
  profundidade: number,
  diametro: number,
  team: TeamConfig
): number {
  // Base: 12 metros/dia em condições normais (prof < 1.5m, DN150)
  let baseMetros = 12.0;

  // === AJUSTE POR PROFUNDIDADE (quanto mais fundo, mais lento) ===
  if (profundidade > 3.0) {
    baseMetros *= 0.5;  // Muito profundo - escoramento pesado
  } else if (profundidade > 2.5) {
    baseMetros *= 0.6;
  } else if (profundidade > 2.0) {
    baseMetros *= 0.7;
  } else if (profundidade > 1.5) {
    baseMetros *= 0.85;
  }
  // prof <= 1.5m: mantém 100%

  // === AJUSTE POR DIÂMETRO (tubos maiores = mais lento) ===
  if (diametro > 400) {
    baseMetros *= 0.6;
  } else if (diametro > 300) {
    baseMetros *= 0.75;
  } else if (diametro > 200) {
    baseMetros *= 0.9;
  }
  // DN <= 200: mantém 100%

  // === AJUSTE POR EQUIPAMENTOS ===
  if (!team.hasRetroescavadeira) {
    baseMetros *= 0.4;  // Escavação manual é muito lenta
  }
  if (!team.hasCompactador) {
    baseMetros *= 0.8;
  }
  if (team.hasBomba) {
    baseMetros *= 1.1;  // Rebaixamento do lençol ajuda
  }

  // === AJUSTE POR TAMANHO DA EQUIPE ===
  if (team.oficiais >= 3 && team.ajudantes >= 6) {
    baseMetros *= 1.2;  // Equipe grande
  } else if (team.oficiais < 2 || team.ajudantes < 3) {
    baseMetros *= 0.7;  // Equipe pequena
  }

  // Mínimo: 3 metros/dia (sempre produz algo)
  return Math.max(3.0, Math.round(baseMetros * 10) / 10);
}

// Exemplo:
// calculateDailyMeters(2.0, 200, { oficiais: 2, ajudantes: 4, hasRetroescavadeira: true, hasCompactador: true })
// Resultado: 12 * 0.7 = 8.4 metros/dia
```

### CÁLCULO 6: Custos Diários

```typescript
// Mão de obra
function getDailyLaborCost(team: TeamConfig, avgCostPerWorker = 180): number {
  const totalWorkers = team.encarregado + team.oficiais + team.ajudantes + team.operador;
  return totalWorkers * avgCostPerWorker;
}
// Exemplo: 1 + 2 + 4 + 1 = 8 pessoas × R$180 = R$1.440/dia

// Equipamentos
function getDailyEquipmentCost(team: TeamConfig): number {
  let cost = 0;
  if (team.hasRetroescavadeira) cost += 450;  // R$/dia
  if (team.hasCompactador) cost += 120;
  if (team.hasCaminhao) cost += 350;
  if (team.hasBomba) cost += 200;
  return cost;
}
// Exemplo: Retro + Compact = R$570/dia

// Custo total diário
function getTotalDailyCost(team: TeamConfig): number {
  return getDailyLaborCost(team) + getDailyEquipmentCost(team);
}
// Exemplo: R$1.440 + R$570 = R$2.010/dia por equipe
```

### CÁLCULO 7: Geração do Cronograma (Same-Day Completion)

```typescript
interface DailySegment {
  segmentId: string;
  trechoId: string;
  day: number;
  meters: number;
  team: number;
  activities: string[];
  volEscavacao: number;
  volReaterro: number;
  custoTotal: number;
}

function generateTrechoSchedule(
  trechoId: string,
  comprimento: number,
  profundidade: number,
  diametro: number,
  startDay: number,
  teamNum: number,
  teamConfig: TeamConfig
): DailySegment[] {
  // 1. Calcula produtividade
  const metrosDia = calculateDailyMeters(profundidade, diametro, teamConfig);

  // 2. Calcula número de dias necessários
  const numDias = Math.max(1, Math.ceil(comprimento / metrosDia));

  // 3. Largura da vala (diâmetro + folga de 40cm de cada lado)
  const larguraVala = Math.max(0.6, diametro / 1000 + 0.4);

  const segments: DailySegment[] = [];
  let metrosRestantes = comprimento;

  for (let dia = 0; dia < numDias; dia++) {
    const dayNumber = startDay + dia;
    const metrosHoje = Math.min(metrosDia, metrosRestantes);
    metrosRestantes -= metrosHoje;

    // Volumes
    const volEscavacao = metrosHoje * larguraVala * profundidade;  // m³
    const volReaterro = volEscavacao * 0.7;  // 30% vai para bota-fora

    // Atividades do dia (TODAS no mesmo dia - regra Same-Day)
    const activities = [
      'Escavacao',
      'Nivelamento',
      'Assentamento',
      ...(profundidade > 1.25 ? ['Escoramento'] : []),
      ...(teamConfig.hasBomba ? ['Bombeamento'] : []),
      'Reaterro',
      'Base/Berco'
    ];

    segments.push({
      segmentId: `${trechoId}.D${dia + 1}`,
      trechoId,
      day: dayNumber,
      meters: metrosHoje,
      team: teamNum,
      activities,
      volEscavacao,
      volReaterro,
      custoTotal: getTotalDailyCost(teamConfig)
    });
  }

  return segments;
}
```

### CÁLCULO 8: Curva S (Progresso Físico e Financeiro)

```typescript
interface CurveSPoint {
  day: number;
  physicalPercent: number;   // 0-100%
  financialPercent: number;  // 0-100%
}

function generateCurveSData(
  allSegments: DailySegment[],
  totalDays: number
): CurveSPoint[] {
  const totalMetros = allSegments.reduce((sum, seg) => sum + seg.meters, 0);
  const totalCusto = allSegments.reduce((sum, seg) => sum + seg.custoTotal, 0);

  const points: CurveSPoint[] = [];
  let cumMetros = 0;
  let cumCusto = 0;

  for (let day = 1; day <= totalDays; day++) {
    // Soma todos os segmentos do dia
    const daySegments = allSegments.filter(s => s.day === day);
    cumMetros += daySegments.reduce((sum, s) => sum + s.meters, 0);
    cumCusto += daySegments.reduce((sum, s) => sum + s.custoTotal, 0);

    points.push({
      day,
      physicalPercent: totalMetros > 0 ? (cumMetros / totalMetros) * 100 : 0,
      financialPercent: totalCusto > 0 ? (cumCusto / totalCusto) * 100 : 0
    });
  }

  return points;
}

// Uso com Chart.js:
// labels: points.map(p => `D${p.day}`)
// datasets: [
//   { label: 'Físico (%)', data: points.map(p => p.physicalPercent), borderColor: '#3b82f6' },
//   { label: 'Financeiro (%)', data: points.map(p => p.financialPercent), borderColor: '#22c55e' }
// ]
```

### CÁLCULO 9: Histograma de Recursos

```typescript
interface HistogramDay {
  day: number;
  labor: number;      // número de trabalhadores
  equipment: number;  // número de equipamentos
  cost: number;       // custo do dia
}

function generateHistogramData(
  allSegments: DailySegment[],
  totalDays: number,
  workersPerTeam: number  // total de trabalhadores por equipe
): HistogramDay[] {
  const data: HistogramDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const daySegments = allSegments.filter(s => s.day === day && s.team > 0);
    const teamsWorking = new Set(daySegments.map(s => s.team)).size;

    data.push({
      day,
      labor: teamsWorking * workersPerTeam,
      equipment: teamsWorking,  // 1 conjunto por equipe
      cost: daySegments.reduce((sum, s) => sum + s.custoTotal, 0)
    });
  }

  return data;
}

// Uso com Chart.js (barras):
// labels: data.map(d => `D${d.day}`)
// datasets: [
//   { label: 'Mão de Obra', data: data.map(d => d.labor), backgroundColor: '#3b82f6' },
//   { label: 'Equipamentos', data: data.map(d => d.equipment), backgroundColor: '#8b5cf6' }
// ]
```

### CÁLCULO 10: Métricas do Dashboard RDO

```typescript
interface DashboardMetrics {
  totalPlanned: number;
  totalExecuted: number;
  remaining: number;
  progressPercent: number;
  aguaProgress: { planned: number; executed: number; percent: number };
  esgotoProgress: { planned: number; executed: number; percent: number };
  drenagemProgress: { planned: number; executed: number; percent: number };
}

function calculateDashboardMetrics(rdos: RDO[]): DashboardMetrics {
  // Agrupa todos os segmentos de todos os RDOs
  const allSegments = rdos.flatMap(rdo => rdo.segments);

  const totalPlanned = allSegments.reduce((sum, s) => sum + s.plannedTotal, 0);
  const totalExecuted = allSegments.reduce((sum, s) =>
    sum + s.executedBefore + s.executedToday, 0);

  // Por sistema
  const calcBySystem = (system: string) => {
    const segs = allSegments.filter(s => s.system === system);
    const planned = segs.reduce((sum, s) => sum + s.plannedTotal, 0);
    const executed = segs.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
    return {
      planned,
      executed,
      percent: planned > 0 ? (executed / planned) * 100 : 0
    };
  };

  return {
    totalPlanned,
    totalExecuted,
    remaining: totalPlanned - totalExecuted,
    progressPercent: totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0,
    aguaProgress: calcBySystem('agua'),
    esgotoProgress: calcBySystem('esgoto'),
    drenagemProgress: calcBySystem('drenagem')
  };
}
```

### CÁLCULO 11: Alocação de Múltiplas Equipes

```typescript
function allocateTeams(
  trechos: { id: string; comprimento: number; profundidade: number; diametro: number }[],
  numTeams: number,
  teamConfig: TeamConfig,
  startDate: Date
) {
  // Rastreia quando cada equipe estará livre (dia)
  const teamAvailability = new Array(numTeams).fill(0);
  const allSegments: DailySegment[] = [];

  for (const trecho of trechos) {
    // Encontra equipe mais disponível (menor dia)
    const teamIdx = teamAvailability.indexOf(Math.min(...teamAvailability));
    const trechoStartDay = teamAvailability[teamIdx] + 1;

    // Gera cronograma deste trecho
    const segments = generateTrechoSchedule(
      trecho.id,
      trecho.comprimento,
      trecho.profundidade,
      trecho.diametro,
      trechoStartDay,
      teamIdx + 1,  // equipe 1, 2, 3...
      teamConfig
    );

    // Atualiza disponibilidade da equipe
    const lastDay = Math.max(...segments.map(s => s.day));
    teamAvailability[teamIdx] = lastDay;

    allSegments.push(...segments);
  }

  const totalDays = Math.max(...allSegments.map(s => s.day));

  return {
    allSegments,
    totalDays,
    endDate: new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000)
  };
}
```

### CÁLCULO 12: EVM - Earned Value Management (Controle Financeiro)

```typescript
// Indicadores de desempenho de projeto
interface EVMMetrics {
  PV: number;   // Planned Value - valor planejado até a data
  EV: number;   // Earned Value - valor agregado (trabalho realizado)
  AC: number;   // Actual Cost - custo real
  CPI: number;  // Cost Performance Index = EV / AC
  SPI: number;  // Schedule Performance Index = EV / PV
  CV: number;   // Cost Variance = EV - AC (positivo = economia)
  SV: number;   // Schedule Variance = EV - PV (positivo = adiantado)
  EAC: number;  // Estimate At Completion = orçamento total / CPI
  VAC: number;  // Variance At Completion = orçamento total - EAC
}

function calculateEVM(
  budgetTotal: number,        // Orçamento total do projeto
  physicalPercent: number,    // % físico executado (0-100)
  actualCost: number          // Custo real gasto até agora
): EVMMetrics {
  const PV = budgetTotal * (physicalPercent / 100);
  const EV = budgetTotal * (physicalPercent / 100);
  const AC = actualCost;

  const CPI = AC > 0 ? EV / AC : 0;  // > 1 = gastando menos que planejado
  const SPI = PV > 0 ? EV / PV : 0;  // > 1 = adiantado no cronograma

  const CV = EV - AC;  // positivo = economia
  const SV = EV - PV;  // positivo = adiantado

  const EAC = CPI > 0 ? budgetTotal / CPI : budgetTotal;
  const VAC = budgetTotal - EAC;

  return { PV, EV, AC, CPI, SPI, CV, SV, EAC, VAC };
}

// Interpretação:
// CPI > 1.0: Gastando MENOS que planejado (bom)
// CPI < 1.0: Gastando MAIS que planejado (ruim)
// SPI > 1.0: Projeto ADIANTADO
// SPI < 1.0: Projeto ATRASADO
```

### CÁLCULO 13: Estrutura Completa do RDO

```typescript
type ServiceUnit = 'm' | 'm2' | 'm3' | 'un' | 'h' | 'dia' | 'kg' | 't' | 'L';
type RDOStatus = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';
type SystemType = 'agua' | 'esgoto' | 'drenagem';
type Severity = 'baixa' | 'media' | 'alta' | 'critica';

interface ExecutedService {
  id: string;
  serviceName: string;
  quantity: number;
  unit: ServiceUnit;
  equipmentUsed?: string[];
  responsibleWorkerName?: string;
  notes?: string;
}

interface SegmentProgress {
  segmentId: string;
  segmentName?: string;
  projectId: string;
  systemType: SystemType;
  executionDate: string;
  plannedLength?: number;
  executedLength: number;
  progressPercentage: number;
  startCoordinates?: { latitude: number; longitude: number };
  endCoordinates?: { latitude: number; longitude: number };
  status: string;
}

interface Occurrence {
  id: string;
  type: string;
  description: string;
  severity: Severity;
  affectedServices?: string[];
  correctiveActions?: string;
  timestamp: string;
}

interface FinancialEntry {
  id: string;
  description: string;
  category: 'mao_obra' | 'material' | 'equipamento' | 'outros';
  value: number;
  quantity?: number;
  unit?: string;
  trechoId?: string;
  notes?: string;
}

interface RDO {
  id: string;
  projectId: string;
  projectName?: string;
  date: string;
  location?: { latitude: number; longitude: number };
  executedServices: ExecutedService[];
  segmentProgress: SegmentProgress[];
  occurrences: Occurrence[];
  financialEntries: FinancialEntry[];
  dailyLaborCost: number;
  dailyMaterialCost: number;
  dailyEquipmentCost: number;
  dailyTotalCost: number;
  generalNotes?: string;
  status: RDOStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

### CÁLCULO 14: Catálogo de Serviços Padrão

```typescript
const DEFAULT_SERVICES = [
  { code: 'ESC001', name: 'Escavação de vala', unit: 'm3', category: 'Escavacao' },
  { code: 'ESC002', name: 'Escavação em rocha', unit: 'm3', category: 'Escavacao' },
  { code: 'REA001', name: 'Reaterro compactado', unit: 'm3', category: 'Reaterro' },
  { code: 'TUB001', name: 'Assentamento de tubulação PVC', unit: 'm', category: 'Tubulacao' },
  { code: 'TUB002', name: 'Assentamento de tubulação PEAD', unit: 'm', category: 'Tubulacao' },
  { code: 'PV001', name: 'Execução de poço de visita', unit: 'un', category: 'Pocos' },
  { code: 'LIG001', name: 'Ligação domiciliar de água', unit: 'un', category: 'Ligacoes' },
  { code: 'LIG002', name: 'Ligação domiciliar de esgoto', unit: 'un', category: 'Ligacoes' },
  { code: 'PAV001', name: 'Recomposição de pavimento', unit: 'm2', category: 'Pavimentacao' },
  { code: 'TEST001', name: 'Teste de estanqueidade', unit: 'm', category: 'Testes' },
  { code: 'TEST002', name: 'Teste hidrostático', unit: 'm', category: 'Testes' }
];
```

### CÁLCULO 15: Persistência LocalStorage

```typescript
const STORAGE_KEYS = {
  RDO_LIST: 'rdoData',
  PROJECTS: 'rdoProjects',
  PLANNED_SEGMENTS: 'rdoPlannedSegments'
};

function saveRDOs(rdos: RDO[]): void {
  localStorage.setItem(STORAGE_KEYS.RDO_LIST, JSON.stringify(rdos));
}

function loadRDOs(): RDO[] {
  const data = localStorage.getItem(STORAGE_KEYS.RDO_LIST);
  return data ? JSON.parse(data) : [];
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### CÁLCULO 16: GeoJSON para Mapa

```typescript
interface MapData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: number[][];  // [[lng, lat], [lng, lat]]
    };
    properties: {
      segmentId: string;
      progressPercentage: number;
      status: string;
      color: string;
    };
  }>;
}

function generateMapData(segments: SegmentProgress[]): MapData {
  const features = segments
    .filter(s => s.startCoordinates && s.endCoordinates)
    .map(segment => {
      const progress = segment.progressPercentage;
      let color = '#ef4444';  // Vermelho - não iniciado
      if (progress >= 100) color = '#22c55e';  // Verde - concluído
      else if (progress > 0) color = '#f59e0b';  // Laranja - em execução

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [segment.startCoordinates!.longitude, segment.startCoordinates!.latitude],
            [segment.endCoordinates!.longitude, segment.endCoordinates!.latitude]
          ]
        },
        properties: {
          segmentId: segment.segmentId,
          progressPercentage: progress,
          status: progress >= 100 ? 'concluido' : progress > 0 ? 'em_execucao' : 'nao_iniciado',
          color
        }
      };
    });

  return { type: 'FeatureCollection', features };
}
```

### CÁLCULO 17: Validações de Formulário

```typescript
function validateRDO(rdo: Partial<RDO>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rdo.date) errors.push('Data é obrigatória');

  const hasServices = rdo.executedServices && rdo.executedServices.length > 0;
  const hasSegments = rdo.segmentProgress && rdo.segmentProgress.length > 0;
  if (!hasServices && !hasSegments) {
    errors.push('RDO deve ter pelo menos um serviço ou avanço de trecho');
  }

  if (rdo.executedServices) {
    for (const service of rdo.executedServices) {
      if (!service.serviceName?.trim()) errors.push('Nome do serviço é obrigatório');
      if (service.quantity <= 0) errors.push('Quantidade deve ser maior que zero');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### CÁLCULO 18: Exportação de Dados

```typescript
function exportRDOsToCSV(rdos: RDO[]): string {
  const headers = ['ID', 'Data', 'Projeto', 'Status', 'Serviços', 'Custo Total'];
  const rows = rdos.map(rdo => [
    rdo.id, rdo.date, rdo.projectName || '', rdo.status,
    rdo.executedServices.length, rdo.dailyTotalCost.toFixed(2)
  ]);
  return [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```

---

## ARQUIVOS DE ENGINE (OPCIONAIS)

Os cálculos acima são suficientes para implementar as funcionalidades. Opcionalmente, copie os arquivos de `src/engine/` para reutilizar código já testado

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

---

## MÓDULO 4: CONSTRUÇÃO E PARÂMETROS DE EXECUÇÃO

### 4.1 Descrição
Módulo para cálculo de parâmetros construtivos baseados em normas brasileiras, incluindo tipo de solo, escoramento, embasamento, composição de equipe e recomposição de pavimento.

### 4.2 Tipos e Enumerações

```typescript
// Tipo de Solo
type TipoSolo = 'normal' | 'saturado' | 'rochoso';

// Tipo de Escavação
type TipoEscavacao = 'manual' | 'mecanizada' | 'mista';

// Tipo de Pavimento
type TipoPavimento = 'terra' | 'paralelepipedo' | 'asfalto' | 'concreto' | 'bloquete';

// Tipo de Material
type TipoMaterial = 'PVC' | 'PEAD' | 'Concreto' | 'Ferro Fundido';
```

### 4.3 Constantes de Engenharia

```typescript
// CRÍTICO: Profundidade que exige escoramento
const PROFUNDIDADE_ESCORAMENTO = 1.25; // metros (NR-18)

// Declividade mínima para gravidade
const DECLIVIDADE_MIN = 0.005; // 0.5%

// Velocidade máxima em tubulações
const VELOCIDADE_MAX_AGUA = 3.0; // m/s (NBR 15920)
const VELOCIDADE_MAX_ESGOTO = 5.0; // m/s (NBR 9649)
```

### CÁLCULO 19: Requisitos de Escoramento

```typescript
interface RequisitoEscoramento {
  necessario: boolean;
  profundidade: number;
  tipo: 'Pontaleteamento' | 'Estacas-prancha' | 'Nenhum';
  descricao: string;
}

function calcularEscoramento(profundidade: number): RequisitoEscoramento {
  const necessario = profundidade > PROFUNDIDADE_ESCORAMENTO;

  let tipo: RequisitoEscoramento['tipo'] = 'Nenhum';
  if (necessario) {
    tipo = profundidade <= 3.0 ? 'Pontaleteamento' : 'Estacas-prancha';
  }

  return {
    necessario,
    profundidade,
    tipo,
    descricao: necessario
      ? `${tipo} (prof. ${profundidade.toFixed(2)}m)`
      : 'Não necessário (prof. <= 1,25m)'
  };
}
```

### CÁLCULO 20: Requisitos de Embasamento

```typescript
interface RequisitoEmbasamento {
  necessario: boolean;
  lastroAreia: boolean;    // Colchão de areia ao redor do tubo
  lastroBrita: boolean;    // Brita para drenagem
  dreno: boolean;          // Dreno sub-superficial
  descricao: string;
}

function calcularEmbasamento(tipoSolo: TipoSolo): RequisitoEmbasamento {
  if (tipoSolo === 'saturado') {
    return {
      necessario: true,
      lastroAreia: true,
      lastroBrita: true,
      dreno: true,
      descricao: 'Lastro de areia, Lastro de brita, Dreno sub-superficial'
    };
  }

  if (tipoSolo === 'rochoso') {
    return {
      necessario: true,
      lastroAreia: true,  // Amortecimento para o tubo
      lastroBrita: false,
      dreno: false,
      descricao: 'Lastro de areia (proteção do tubo)'
    };
  }

  return {
    necessario: false,
    lastroAreia: false,
    lastroBrita: false,
    dreno: false,
    descricao: 'Padrão (solo normal)'
  };
}
```

### CÁLCULO 21: Requisitos de Assentamento por Material

```typescript
interface RequisitoAssentamento {
  material: TipoMaterial;
  termofusao: boolean;          // PEAD requer termofusão
  equipamentoPesado: boolean;   // Concreto/Ferro requer guincho
  juntaEspecial: boolean;       // Juntas especiais
  descricao: string;
}

function calcularAssentamento(tipoMaterial: TipoMaterial): RequisitoAssentamento {
  const requisitos: Record<TipoMaterial, Omit<RequisitoAssentamento, 'material'>> = {
    'PVC': {
      termofusao: false,
      equipamentoPesado: false,
      juntaEspecial: false,
      descricao: 'Assentamento padrão'
    },
    'PEAD': {
      termofusao: true,
      equipamentoPesado: false,
      juntaEspecial: true,
      descricao: 'Termofusão, Junta especial'
    },
    'Concreto': {
      termofusao: false,
      equipamentoPesado: true,
      juntaEspecial: true,
      descricao: 'Equipamento de içamento, Junta especial'
    },
    'Ferro Fundido': {
      termofusao: false,
      equipamentoPesado: true,
      juntaEspecial: true,
      descricao: 'Equipamento de içamento, Junta especial'
    }
  };

  return {
    material: tipoMaterial,
    ...requisitos[tipoMaterial]
  };
}
```

### CÁLCULO 22: Requisitos de Recomposição de Pavimento

```typescript
interface RequisitoRecomposicao {
  tipoPavimento: TipoPavimento;
  subbase: boolean;
  base: boolean;
  bgs: boolean;     // Brita Graduada Simples
  cbuq: boolean;    // Concreto Betuminoso (asfalto)
  camadas: string[];
  descricao: string;
}

function calcularRecomposicao(tipoPavimento: TipoPavimento): RequisitoRecomposicao {
  const configs: Record<TipoPavimento, Omit<RequisitoRecomposicao, 'tipoPavimento' | 'camadas' | 'descricao'>> = {
    'asfalto': { subbase: true, base: true, bgs: true, cbuq: true },
    'concreto': { subbase: true, base: true, bgs: false, cbuq: false },
    'paralelepipedo': { subbase: false, base: true, bgs: false, cbuq: false },
    'bloquete': { subbase: false, base: true, bgs: false, cbuq: false },
    'terra': { subbase: false, base: false, bgs: false, cbuq: false }
  };

  const config = configs[tipoPavimento];
  const camadas: string[] = [];

  if (config.subbase) camadas.push('Sub-base');
  if (config.base) camadas.push('Base');
  if (config.bgs) camadas.push('BGS (Brita Graduada Simples)');
  if (config.cbuq) camadas.push('CBUQ (Asfalto)');

  return {
    tipoPavimento,
    ...config,
    camadas,
    descricao: camadas.length > 0
      ? `Recomposição: ${camadas.join(' → ')}`
      : `Recomposição simples (${tipoPavimento})`
  };
}
```

### CÁLCULO 23: Composição de Equipe Detalhada

```typescript
interface ComposicaoEquipe {
  encarregado: number;
  pedreiro: number;
  servente: number;
  operadorMaquina: number;
  soldadorPead: number;
  adicionalEscoramento: number;
  adicionalEmbasamento: number;
  adicionalMaterial: number;
  totalProfissionais: number;
  totalAjudantes: number;
  totalEquipe: number;
}

function calcularComposicaoEquipe(
  tipoEscavacao: TipoEscavacao,
  escoramento: RequisitoEscoramento,
  embasamento: RequisitoEmbasamento,
  tipoMaterial: TipoMaterial
): ComposicaoEquipe {
  const equipe: ComposicaoEquipe = {
    encarregado: 1,
    pedreiro: 0,
    servente: 2,
    operadorMaquina: 0,
    soldadorPead: 0,
    adicionalEscoramento: 0,
    adicionalEmbasamento: 0,
    adicionalMaterial: 0,
    totalProfissionais: 0,
    totalAjudantes: 0,
    totalEquipe: 0
  };

  // Escavação mecanizada requer operador
  if (tipoEscavacao === 'mecanizada' || tipoEscavacao === 'mista') {
    equipe.operadorMaquina = 1;
  }

  // Escoramento requer equipe adicional
  if (escoramento.necessario) {
    equipe.adicionalEscoramento = 1;
    equipe.pedreiro += 1;
  }

  // Solo saturado requer equipe adicional
  if (embasamento.necessario && embasamento.dreno) {
    equipe.adicionalEmbasamento = 1;
  }

  // Materiais especiais
  if (tipoMaterial === 'PEAD') {
    equipe.soldadorPead = 1;
    equipe.adicionalMaterial = 1;
  } else if (tipoMaterial === 'Concreto' || tipoMaterial === 'Ferro Fundido') {
    equipe.adicionalMaterial = 1;
  }

  // Calcular totais
  equipe.totalProfissionais =
    equipe.encarregado +
    equipe.pedreiro +
    equipe.operadorMaquina +
    equipe.soldadorPead +
    equipe.adicionalEscoramento +
    equipe.adicionalEmbasamento +
    equipe.adicionalMaterial;

  equipe.totalAjudantes = equipe.servente +
    (equipe.adicionalEscoramento > 0 ? 1 : 0) +
    (equipe.adicionalEmbasamento > 0 ? 1 : 0) +
    (equipe.adicionalMaterial > 0 ? 1 : 0);

  equipe.totalEquipe = equipe.totalProfissionais + equipe.totalAjudantes;

  return equipe;
}
```

### CÁLCULO 24: Parâmetros de Execução Completos

```typescript
interface ParametrosExecucao {
  tipoSolo: TipoSolo;
  tipoEscavacao: TipoEscavacao;
  tipoPavimento: TipoPavimento;
  tipoMaterial: TipoMaterial;
  profundidade: number;
  escoramento: RequisitoEscoramento;
  embasamento: RequisitoEmbasamento;
  assentamento: RequisitoAssentamento;
  recomposicao: RequisitoRecomposicao;
  equipe: ComposicaoEquipe;
}

function criarParametrosExecucao(
  tipoSolo: TipoSolo,
  tipoEscavacao: TipoEscavacao,
  tipoPavimento: TipoPavimento,
  tipoMaterial: TipoMaterial,
  profundidade: number
): ParametrosExecucao {
  const escoramento = calcularEscoramento(profundidade);
  const embasamento = calcularEmbasamento(tipoSolo);
  const assentamento = calcularAssentamento(tipoMaterial);
  const recomposicao = calcularRecomposicao(tipoPavimento);
  const equipe = calcularComposicaoEquipe(tipoEscavacao, escoramento, embasamento, tipoMaterial);

  return {
    tipoSolo,
    tipoEscavacao,
    tipoPavimento,
    tipoMaterial,
    profundidade,
    escoramento,
    embasamento,
    assentamento,
    recomposicao,
    equipe
  };
}

// Exemplo de uso:
// const params = criarParametrosExecucao('saturado', 'mecanizada', 'asfalto', 'PVC', 2.0);
// console.log(params.escoramento.descricao);  // "Pontaleteamento (prof. 2.00m)"
// console.log(params.equipe.totalEquipe);     // 8 pessoas
```

---

## MÓDULO 5: CÁLCULOS HIDRÁULICOS

### 5.1 Descrição
Cálculos hidráulicos baseados em Manning (escoamento livre) e Hazen-Williams (pressão) para dimensionamento de redes.

### CÁLCULO 25: Seção Circular - Funções Geométricas

```typescript
const PI = Math.PI;
const GRAVITY = 9.81; // m/s²

// Área de seção circular
function areaCircular(D: number, y: number | null = null): number {
  // D = diâmetro (m), y = lâmina d'água (m)
  if (y === null || y >= D) {
    return PI * D * D / 4;  // Seção cheia
  }
  if (y <= 0) return 0;

  // Área parcialmente cheia
  const r = D / 2;
  const theta = 2 * Math.acos((r - y) / r);
  return r * r * (theta - Math.sin(theta)) / 2;
}

// Perímetro molhado
function perimetroMolhado(D: number, y: number | null = null): number {
  if (y === null || y >= D) return PI * D;
  if (y <= 0) return 0;

  const r = D / 2;
  const theta = 2 * Math.acos((r - y) / r);
  return r * theta;
}

// Raio hidráulico
function raioHidraulico(D: number, y: number | null = null): number {
  const A = areaCircular(D, y);
  const P = perimetroMolhado(D, y);
  return P > 0 ? A / P : 0;
}
```

### CÁLCULO 26: Manning - Escoamento Livre

```typescript
// Velocidade por Manning
// V = (1/n) * R^(2/3) * S^(1/2)
function manningVelocity(R: number, S: number, n: number): number {
  if (R <= 0 || S <= 0 || n <= 0) return 0;
  return (1 / n) * Math.pow(R, 2/3) * Math.pow(S, 0.5);
}

// Vazão por Manning
// Q = (1/n) * A * R^(2/3) * S^(1/2)
function manningFlow(A: number, R: number, S: number, n: number): number {
  const V = manningVelocity(R, S, n);
  return A * V;
}

// Vazão em seção circular
function manningFlowCircular(
  D: number,    // Diâmetro (m)
  S: number,    // Declividade (m/m)
  n: number,    // Coeficiente de Manning
  yD: number = 1.0  // Relação y/D (1.0 = cheia)
): number {
  const y = yD * D;
  const A = areaCircular(D, y);
  const R = raioHidraulico(D, y);
  return manningFlow(A, R, S, n);
}

// Capacidade máxima (seção cheia)
function manningFullCapacity(D: number, S: number, n: number): number {
  return manningFlowCircular(D, S, n, 1.0);
}

// Coeficientes de Manning típicos
const COEF_MANNING = {
  'PVC': 0.010,
  'PEAD': 0.010,
  'Concreto': 0.013,
  'Ferro Fundido': 0.012,
  'Concreto Rugoso': 0.015
};
```

### CÁLCULO 27: Hazen-Williams - Escoamento sob Pressão

```typescript
// Perda de carga por Hazen-Williams
// hf = 10.643 * (Q^1.85) / (C^1.85 * D^4.87) * L
function hazenWilliamsHeadloss(
  Q: number,  // Vazão (m³/s)
  D: number,  // Diâmetro (m)
  L: number,  // Comprimento (m)
  C: number   // Coeficiente de Hazen-Williams
): number {
  if (Q <= 0 || D <= 0 || L <= 0 || C <= 0) return 0;
  return 10.643 * Math.pow(Q, 1.85) / (Math.pow(C, 1.85) * Math.pow(D, 4.87)) * L;
}

// Velocidade em conduto sob pressão
// V = Q / A = 4Q / (π * D²)
function hazenWilliamsVelocity(Q: number, D: number): number {
  if (D <= 0) return 0;
  const A = PI * D * D / 4;
  return Q / A;
}

// Diâmetro necessário para limitar perda de carga
function hazenWilliamsDiameterRequired(
  Q: number,      // Vazão (m³/s)
  L: number,      // Comprimento (m)
  hfMax: number,  // Perda de carga máxima (m)
  C: number       // Coeficiente HW
): number {
  if (Q <= 0 || hfMax <= 0) return 0;
  const DExp = 10.643 * Math.pow(Q, 1.85) * L / (Math.pow(C, 1.85) * hfMax);
  return Math.pow(DExp, 1 / 4.87);
}

// Coeficientes de Hazen-Williams típicos
const COEF_HAZEN_WILLIAMS = {
  'PVC': 150,
  'PEAD': 150,
  'Ferro Fundido Novo': 130,
  'Ferro Fundido Usado': 100,
  'Concreto': 120,
  'Aço': 120
};
```

### CÁLCULO 28: Potência de Bomba

```typescript
// Potência de bomba em kW
// P = ρ * g * Q * ΔH / η
function pumpPowerKW(
  Q: number,          // Vazão (m³/s)
  dH: number,         // Altura manométrica (m)
  efficiency: number = 0.75  // Rendimento (0-1)
): number {
  if (Q <= 0 || dH <= 0 || efficiency <= 0) return 0;
  const P_watts = 1000 * GRAVITY * Q * dH / efficiency;
  return P_watts / 1000;
}

// Potência em CV (cavalos-vapor)
function pumpPowerCV(Q: number, dH: number, efficiency: number = 0.75): number {
  const P_kw = pumpPowerKW(Q, dH, efficiency);
  return P_kw / 0.7355;  // 1 CV = 0.7355 kW
}

// Seleção de bomba comercial
const BOMBAS_COMERCIAIS_CV = [0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

function selecionarBombaComercial(potenciaCalculada: number): number {
  for (const cv of BOMBAS_COMERCIAIS_CV) {
    if (cv >= potenciaCalculada * 1.1) return cv;  // 10% de margem
  }
  return BOMBAS_COMERCIAIS_CV[BOMBAS_COMERCIAIS_CV.length - 1];
}
```

### CÁLCULO 29: Intensidade de Chuva (IDF) e Método Racional

```typescript
// Intensidade de chuva pela equação IDF
// i = K * T^a / (t + b)^c
function idfIntensity(
  T: number,  // Período de retorno (anos)
  t: number,  // Duração (minutos)
  K: number, a: number, b: number, c: number  // Coeficientes IDF
): number {
  if (T <= 0 || t <= 0) return 0;
  return K * Math.pow(T, a) / Math.pow(t + b, c);
}

// Vazão pelo método racional
// Q = 0.00278 * C * i * A
function rationalMethodFlow(
  C: number,  // Coeficiente de runoff (0-1)
  i: number,  // Intensidade (mm/h)
  A: number   // Área de contribuição (ha)
): number {
  return 0.00278 * C * i * A;
}

// Tempo de concentração (Kirpich)
// tc = 0.0195 * L^0.77 * S^(-0.385)
function timeOfConcentration(L: number, H: number): number {
  if (L <= 0 || H <= 0) return 5.0;  // Mínimo 5 minutos
  const S = H / L;
  const tc = 0.0195 * Math.pow(L, 0.77) * Math.pow(S, -0.385);
  return Math.max(tc, 5.0);
}

// Coeficientes de runoff típicos
const COEF_RUNOFF = {
  'Telhado': 0.95,
  'Asfalto': 0.90,
  'Concreto': 0.85,
  'Paralelepipedo': 0.60,
  'Gramado (arenoso)': 0.10,
  'Gramado (argiloso)': 0.25,
  'Area Verde': 0.15
};
```

---

## MÓDULO 6: PEER REVIEW (REVISÃO POR PARES)

### 6.1 Descrição
Sistema de verificação de conformidade com normas brasileiras (ABNT) com workflow de revisão A + B e adjudicação.

### 6.2 Estrutura de Dados

```typescript
type Severity = 'OK' | 'INFO' | 'ALERT' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface NormRef {
  normId: string;       // Ex: "ABNT_NBR_15920"
  clauseId?: string;    // Ex: "5.3.2"
  topic: string;        // Ex: "min_diameter_50mm"
}

interface Finding {
  id: string;
  elementId: string;
  elementType: string;
  ruleId: string;
  severity: Severity;
  normRefs: NormRef[];
  message: string;
  recommendation: string;
  evidence: Record<string, any>;
  reviewerId: string;
  timestamp: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'wont_fix';
  x?: number;
  y?: number;
}

interface Rule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  appliesTo: string[];     // Tipos de elementos
  systemFilter?: string;   // water, sewer, drainage
  normRefs: NormRef[];
  evalFunc: (element: any) => { passed: boolean; evidence: Record<string, any> };
  recommendation: string;
  active: boolean;
}
```

### CÁLCULO 30: Regras de Verificação Normativa

```typescript
// REGRAS PARA ÁGUA (NBR 15920)
const WATER_RULES: Rule[] = [
  {
    id: 'WAT-001',
    title: 'Diâmetro mínimo',
    description: 'Verifica se o diâmetro atende ao mínimo normativo',
    severity: 'ERROR',
    appliesTo: ['pipe'],
    systemFilter: 'water',
    normRefs: [{ normId: 'ABNT_NBR_15920', topic: 'min_diameter_50mm' }],
    evalFunc: (elem) => ({
      passed: elem.diameter >= 50,
      evidence: { diameter: elem.diameter }
    }),
    recommendation: 'Ajustar diâmetro para mínimo de 50mm',
    active: true
  },
  {
    id: 'WAT-002',
    title: 'Velocidade máxima',
    description: 'Verifica se velocidade está abaixo do máximo',
    severity: 'ALERT',
    appliesTo: ['pipe'],
    systemFilter: 'water',
    normRefs: [{ normId: 'ABNT_NBR_15920', topic: 'max_velocity_3m/s' }],
    evalFunc: (elem) => ({
      passed: (elem.velocity ?? 0) <= 3.0,
      evidence: { velocity: elem.velocity }
    }),
    recommendation: 'Reduzir velocidade aumentando diâmetro ou reduzindo vazão',
    active: true
  },
  {
    id: 'WAT-003',
    title: 'Cobertura mínima',
    description: 'Verifica cobertura mínima sobre a tubulação',
    severity: 'WARNING',
    appliesTo: ['pipe'],
    systemFilter: 'water',
    normRefs: [{ normId: 'ABNT_NBR_15920', topic: 'min_cover_0.6m' }],
    evalFunc: (elem) => ({
      passed: (elem.cover ?? 1) >= 0.6,
      evidence: { cover: elem.cover }
    }),
    recommendation: 'Ajustar profundidade para mínimo 0.6m de cobertura',
    active: true
  }
];

// REGRAS PARA ESGOTO (NBR 9649)
const SEWER_RULES: Rule[] = [
  {
    id: 'SEW-001',
    title: 'Diâmetro mínimo',
    description: 'Verifica diâmetro mínimo para esgoto',
    severity: 'ERROR',
    appliesTo: ['pipe', 'conduit'],
    systemFilter: 'sewer',
    normRefs: [{ normId: 'ABNT_NBR_9649', topic: 'min_diameter_100mm' }],
    evalFunc: (elem) => ({
      passed: elem.diameter >= 100,
      evidence: { diameter: elem.diameter }
    }),
    recommendation: 'Ajustar diâmetro para mínimo de 100mm',
    active: true
  },
  {
    id: 'SEW-002',
    title: 'Declividade mínima',
    description: 'Verifica declividade mínima para DN150',
    severity: 'ERROR',
    appliesTo: ['pipe', 'conduit'],
    systemFilter: 'sewer',
    normRefs: [{ normId: 'ABNT_NBR_9649', topic: 'min_slope_0.5pct_d150' }],
    evalFunc: (elem) => ({
      passed: elem.slope >= 0.005 || elem.diameter > 150,
      evidence: { slope: elem.slope, diameter: elem.diameter }
    }),
    recommendation: 'Ajustar declividade para mínimo 0.5% (DN150)',
    active: true
  },
  {
    id: 'SEW-003',
    title: 'Distância máxima entre PVs',
    description: 'Verifica distância máxima de 100m entre PVs',
    severity: 'ALERT',
    appliesTo: ['pipe', 'conduit'],
    systemFilter: 'sewer',
    normRefs: [{ normId: 'ABNT_NBR_9649', topic: 'max_distance_100m_PV' }],
    evalFunc: (elem) => ({
      passed: elem.length <= 100,
      evidence: { length: elem.length }
    }),
    recommendation: 'Inserir PV intermediário se comprimento > 100m',
    active: true
  }
];

// REGRAS PARA DRENAGEM (NBR 15527)
const DRAINAGE_RULES: Rule[] = [
  {
    id: 'DRN-001',
    title: 'Velocidade máxima',
    description: 'Verifica velocidade máxima em condutos de drenagem',
    severity: 'ALERT',
    appliesTo: ['conduit'],
    systemFilter: 'drainage',
    normRefs: [{ normId: 'ABNT_NBR_15527', topic: 'max_velocity_5m/s' }],
    evalFunc: (elem) => ({
      passed: (elem.velocity ?? 0) <= 5.0,
      evidence: { velocity: elem.velocity }
    }),
    recommendation: 'Reduzir velocidade ou prever dissipador',
    active: true
  }
];
```

### CÁLCULO 31: Motor de Revisão

```typescript
interface ReviewSession {
  id: string;
  reviewerId: string;
  projectId: string;
  startedAt: string;
  completedAt?: string;
  findings: Finding[];
  elementsReviewed: Set<string>;
  status: 'pending' | 'in_progress' | 'completed';
}

function runPeerReview(
  elements: any[],
  rules: Rule[],
  reviewerId: string
): ReviewSession {
  const session: ReviewSession = {
    id: generateId(),
    reviewerId,
    projectId: 'current',
    startedAt: new Date().toISOString(),
    findings: [],
    elementsReviewed: new Set(),
    status: 'in_progress'
  };

  for (const element of elements) {
    session.elementsReviewed.add(element.id);

    // Filtrar regras aplicáveis
    const applicableRules = rules.filter(rule =>
      rule.active &&
      rule.appliesTo.includes(element.type) &&
      (!rule.systemFilter || rule.systemFilter === element.system)
    );

    for (const rule of applicableRules) {
      try {
        const { passed, evidence } = rule.evalFunc(element);

        if (!passed) {
          session.findings.push({
            id: generateId(),
            elementId: element.id,
            elementType: element.type,
            ruleId: rule.id,
            severity: rule.severity,
            normRefs: rule.normRefs,
            message: `${rule.title}: ${rule.description}`,
            recommendation: rule.recommendation,
            evidence,
            reviewerId,
            timestamp: new Date().toISOString(),
            status: 'open',
            x: element.x,
            y: element.y
          });
        }
      } catch (error) {
        console.error(`Erro ao avaliar regra ${rule.id}:`, error);
      }
    }
  }

  session.status = 'completed';
  session.completedAt = new Date().toISOString();

  return session;
}

function getReviewSummary(session: ReviewSession): Record<string, any> {
  const severityCounts: Record<string, number> = {};

  for (const finding of session.findings) {
    severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
  }

  return {
    sessionId: session.id,
    reviewerId: session.reviewerId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    totalFindings: session.findings.length,
    elementsReviewed: session.elementsReviewed.size,
    severityCounts,
    status: session.status
  };
}
```

### 6.3 Interface de Usuário para Peer Review

#### 6.3.1 Dashboard de Findings

```
┌────────────────────────────────────────────────────────────────┐
│ 🔍 PEER REVIEW - Verificação de Conformidade                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [🔴 CRITICAL: 0] [🟠 ERROR: 3] [🟡 WARNING: 5] [🔵 INFO: 12]  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Findings por Norma                                       │  │
│  │ ████████████████████ NBR 9649 (Esgoto) - 12             │  │
│  │ ████████████         NBR 15920 (Água) - 6               │  │
│  │ ████                 NBR 15527 (Drenagem) - 2           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 6.3.2 Lista de Findings

| Severidade | Elemento | Regra | Mensagem | Norma | Ações |
|------------|----------|-------|----------|-------|-------|
| 🟠 ERROR | T01-T02 | SEW-002 | Declividade mínima: 0.3% < 0.5% | NBR 9649 | 👁️ ✓ |
| 🟡 WARNING | N05 | WAT-003 | Cobertura: 0.5m < 0.6m | NBR 15920 | 👁️ ✓ |

---

## MÓDULO 7: EXPORTAÇÃO GIS

### 7.1 Descrição
Exportação para formatos GIS compatíveis com QGIS: GeoJSON, Shapefile conceitual e GeoPackage.

### CÁLCULO 32: Geração de GeoJSON Completo

```typescript
interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  crs?: {
    type: 'name';
    properties: { name: string };
  };
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString' | 'Point';
      coordinates: number[][] | number[];
    };
    properties: Record<string, any>;
  }>;
}

function exportNetworkToGeoJSON(
  trechos: Trecho[],
  parametrosExecucao?: Map<string, ParametrosExecucao>
): GeoJSONFeatureCollection {
  const features = trechos.map(trecho => {
    const params = parametrosExecucao?.get(`${trecho.idInicio}_${trecho.idFim}`);

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [trecho.xInicio, trecho.yInicio],
          [trecho.xFim, trecho.yFim]
        ]
      },
      properties: {
        id_inicio: trecho.idInicio,
        id_fim: trecho.idFim,
        comprim_m: Math.round(trecho.comprimento * 100) / 100,
        decliv_pct: Math.round(trecho.declividade * 10000) / 100,
        tipo_rede: trecho.tipoRede,
        diam_mm: trecho.diametroMm,
        material: trecho.material,
        cota_ini: trecho.cotaInicio,
        cota_fim: trecho.cotaFim,
        desnivel: Math.round((trecho.cotaInicio - trecho.cotaFim) * 1000) / 1000,
        // Parâmetros de execução (se disponíveis)
        ...(params && {
          solo: params.tipoSolo,
          escavacao: params.tipoEscavacao,
          pavimento: params.tipoPavimento,
          prof_m: params.profundidade,
          escoram: params.escoramento.necessario,
          equipe: params.equipe.totalEquipe
        })
      }
    };
  });

  return {
    type: 'FeatureCollection',
    crs: {
      type: 'name',
      properties: { name: 'EPSG:31983' }  // SIRGAS 2000 / UTM zone 23S
    },
    features
  };
}

function downloadGeoJSON(data: GeoJSONFeatureCollection, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.geojson') ? filename : `${filename}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### CÁLCULO 33: Exportação de Pontos para GeoJSON

```typescript
function exportPointsToGeoJSON(pontos: PontoTopografico[]): GeoJSONFeatureCollection {
  const features = pontos.map((ponto, index) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [ponto.x, ponto.y]
    },
    properties: {
      id: ponto.id,
      cota: ponto.cota,
      ordem: index + 1,
      tipo: index === 0 ? 'inicio' : index === pontos.length - 1 ? 'fim' : 'intermediario'
    }
  }));

  return {
    type: 'FeatureCollection',
    crs: {
      type: 'name',
      properties: { name: 'EPSG:31983' }
    },
    features
  };
}
```

### CÁLCULO 34: Exportação de Findings para GeoJSON

```typescript
function exportFindingsToGeoJSON(findings: Finding[]): GeoJSONFeatureCollection {
  const features = findings
    .filter(f => f.x !== undefined && f.y !== undefined)
    .map(finding => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [finding.x!, finding.y!]
      },
      properties: {
        id: finding.id,
        element_id: finding.elementId,
        rule_id: finding.ruleId,
        severity: finding.severity,
        message: finding.message,
        recommendation: finding.recommendation,
        norm_ref: finding.normRefs.map(n => n.normId).join(', '),
        status: finding.status,
        timestamp: finding.timestamp
      }
    }));

  return {
    type: 'FeatureCollection',
    features
  };
}
```

---

## SEÇÃO DE SEGURANÇA (CRÍTICO)

Esta seção define práticas de segurança **obrigatórias** para a implementação na Lovable. Implementar desde o início evita vulnerabilidades futuras.

### SEC-1: Validação de Entrada (Input Sanitization)

```typescript
// ⚠️ SEMPRE sanitizar entrada de usuário antes de:
// - Exibir em HTML (previne XSS)
// - Armazenar em localStorage
// - Usar em cálculos

// Escape HTML
function escapeHtml(text: string): string {
  if (!text) return '';
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '`': '&#96;'
  };
  return String(text).replace(/[&<>"'`]/g, char => escapeMap[char]);
}

// Padrões de injeção a detectar
const INJECTION_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,    // Script tags
  /javascript:/gi,                     // JS protocol
  /on\w+\s*=/gi,                       // Event handlers (onclick=, onerror=)
  /expression\s*\(/gi,                 // CSS expression
  /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\s/gi,  // SQL keywords
  /UNION\s+SELECT/gi,                  // SQL UNION
];

function detectInjection(text: string): string[] {
  const attacks: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      attacks.push(`Padrão suspeito detectado: ${pattern.source}`);
    }
  }
  return attacks;
}

function validateAndSanitize(text: string, maxLength: number = 10000): {
  isValid: boolean;
  errors: string[];
  sanitized: string;
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text) {
    return { isValid: true, errors: [], sanitized: '', warnings: [] };
  }

  let sanitized = String(text);

  // Verificar tamanho
  if (sanitized.length > maxLength) {
    errors.push(`Texto excede tamanho máximo de ${maxLength} caracteres`);
    sanitized = sanitized.slice(0, maxLength);
  }

  // Detectar ataques
  const attacks = detectInjection(sanitized);
  if (attacks.length > 0) {
    warnings.push(...attacks.map(a => `Potencial ataque detectado: ${a}`));
  }

  // Sanitizar
  sanitized = escapeHtml(sanitized);

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
    warnings
  };
}
```

### SEC-2: Validação de Arquivos (File Upload)

```typescript
// ⚠️ SEMPRE validar arquivos antes de processar

interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  safeFilename: string;
  warnings: string[];
}

// Extensões permitidas
const ALLOWED_EXTENSIONS = new Set(['.csv', '.txt', '.json', '.geojson', '.xlsx']);

// Tamanho máximo (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Magic bytes para validar tipo real do arquivo
const MAGIC_BYTES: Record<string, string[]> = {
  'PK': ['.xlsx', '.zip'],      // ZIP-based
  '%PDF': ['.pdf'],
  '{"': ['.json', '.geojson'],
  '[{': ['.json', '.geojson'],
};

function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';

  // Remover caminho
  let safe = filename.split(/[/\\]/).pop() || 'unnamed';

  // Remover null bytes
  safe = safe.replace(/\x00/g, '');

  // Manter apenas caracteres seguros
  const safeChars = /[a-zA-Z0-9._-]/;
  safe = Array.from(safe).map(c => safeChars.test(c) ? c : '_').join('');

  // Não permitir arquivos ocultos
  safe = safe.replace(/^\.+/, '');

  // Limitar tamanho
  if (safe.length > 255) {
    const ext = safe.slice(safe.lastIndexOf('.'));
    const name = safe.slice(0, 200);
    safe = name + ext;
  }

  return safe || 'unnamed';
}

function validateFile(
  file: File,
  allowedExtensions: Set<string> = ALLOWED_EXTENSIONS
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const safeFilename = sanitizeFilename(file.name);
  const ext = '.' + safeFilename.split('.').pop()?.toLowerCase();

  // Verificar tamanho
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`Arquivo excede tamanho máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Verificar extensão
  if (!allowedExtensions.has(ext)) {
    errors.push(`Extensão '${ext}' não permitida. Permitidas: ${Array.from(allowedExtensions).join(', ')}`);
  }

  // Arquivos muito pequenos podem ser suspeitos
  if (file.size < 10) {
    warnings.push('Arquivo muito pequeno');
  }

  return {
    isValid: errors.length === 0,
    errors,
    safeFilename,
    warnings
  };
}

// Verificar conteúdo do arquivo para scripts maliciosos
async function validateFileContent(file: File): Promise<string[]> {
  const errors: string[] = [];

  try {
    const text = await file.text();

    // Verificar padrões perigosos em arquivos de texto
    const dangerousPatterns = [
      '<script',
      'javascript:',
      'vbscript:',
      'onload=',
      'onerror=',
      'onclick=',
      'eval('
    ];

    const lowerText = text.toLowerCase();
    for (const pattern of dangerousPatterns) {
      if (lowerText.includes(pattern)) {
        errors.push(`Arquivo contém conteúdo potencialmente malicioso: ${pattern}`);
      }
    }
  } catch {
    // Arquivo binário, ignorar validação de texto
  }

  return errors;
}
```

### SEC-3: Validação de GeoJSON

```typescript
// ⚠️ Validar estrutura e conteúdo de dados GeoJSON

const VALID_GEOMETRY_TYPES = new Set([
  'Point', 'MultiPoint', 'LineString', 'MultiLineString',
  'Polygon', 'MultiPolygon', 'GeometryCollection'
]);

interface GeoJSONValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: GeoJSONFeatureCollection;
}

function validateGeoJSON(data: any): GeoJSONValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['GeoJSON deve ser um objeto'], warnings: [] };
  }

  // Verificar tipo
  const type = data.type;
  if (!type) {
    errors.push("Propriedade 'type' ausente");
  } else if (!['Feature', 'FeatureCollection', ...VALID_GEOMETRY_TYPES].includes(type)) {
    errors.push(`Tipo inválido: ${type}`);
  }

  // Validar FeatureCollection
  if (type === 'FeatureCollection') {
    const features = data.features;
    if (!Array.isArray(features)) {
      errors.push("'features' deve ser um array");
    } else {
      features.forEach((feature: any, i: number) => {
        if (feature.type !== 'Feature') {
          errors.push(`Feature[${i}]: type deve ser 'Feature'`);
        }

        // Validar geometria
        const geometry = feature.geometry;
        if (geometry && !VALID_GEOMETRY_TYPES.has(geometry.type)) {
          errors.push(`Feature[${i}]: tipo de geometria inválido: ${geometry.type}`);
        }

        // Validar coordenadas
        if (geometry?.coordinates) {
          const coordErrors = validateCoordinates(geometry.coordinates, geometry.type);
          errors.push(...coordErrors.map(e => `Feature[${i}]: ${e}`));
        }
      });
    }
  }

  // Sanitizar propriedades de string
  const sanitized = errors.length === 0 ? sanitizeGeoJSONStrings(data) : undefined;

  return { isValid: errors.length === 0, errors, warnings, sanitized };
}

function validateCoordinates(coords: any, type: string): string[] {
  const errors: string[] = [];

  function checkPoint(point: any, path: string) {
    if (!Array.isArray(point) || point.length < 2) {
      errors.push(`${path}: ponto deve ter pelo menos 2 coordenadas`);
      return;
    }

    const [lon, lat] = point;
    if (lon < -180 || lon > 180) {
      errors.push(`${path}: longitude ${lon} fora do intervalo [-180, 180]`);
    }
    if (lat < -90 || lat > 90) {
      errors.push(`${path}: latitude ${lat} fora do intervalo [-90, 90]`);
    }
  }

  if (type === 'Point') {
    checkPoint(coords, 'coordinates');
  } else if (type === 'LineString') {
    coords.forEach((c: any, i: number) => checkPoint(c, `coordinates[${i}]`));
  }
  // ... similar para outros tipos

  return errors;
}

function sanitizeGeoJSONStrings(data: any): any {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeGeoJSONStrings(item));
  }
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const safeKey = escapeHtml(key);
      sanitized[safeKey] = sanitizeGeoJSONStrings(value);
    }
    return sanitized;
  }
  return data;
}
```

### SEC-4: Validação de CSV/Topografia

```typescript
// ⚠️ Validar dados numéricos antes de usar em cálculos

interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rowsValidated: number;
  rowsWithErrors: number;
}

function validateCSVData(pontos: PontoTopografico[]): CSVValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rowsWithErrors = 0;

  // Verificar mínimo de pontos
  if (pontos.length < 2) {
    errors.push('Mínimo de 2 pontos necessários para criar trechos');
  }

  // Verificar máximo (prevenir DoS)
  const MAX_POINTS = 10000;
  if (pontos.length > MAX_POINTS) {
    errors.push(`Máximo de ${MAX_POINTS} pontos permitido`);
  }

  // Validar cada ponto
  pontos.forEach((ponto, i) => {
    const rowErrors: string[] = [];

    // Verificar ID
    if (!ponto.id || ponto.id.trim() === '') {
      rowErrors.push('ID vazio');
    }

    // Verificar coordenadas
    if (isNaN(ponto.x) || !isFinite(ponto.x)) {
      rowErrors.push('Coordenada X inválida');
    }
    if (isNaN(ponto.y) || !isFinite(ponto.y)) {
      rowErrors.push('Coordenada Y inválida');
    }
    if (isNaN(ponto.cota) || !isFinite(ponto.cota)) {
      rowErrors.push('Cota inválida');
    }

    // Verificar limites razoáveis para coordenadas UTM
    if (ponto.x < 100000 || ponto.x > 900000) {
      warnings.push(`Linha ${i + 2}: X=${ponto.x} fora do intervalo típico UTM`);
    }
    if (ponto.y < 1000000 || ponto.y > 10000000) {
      warnings.push(`Linha ${i + 2}: Y=${ponto.y} fora do intervalo típico UTM`);
    }

    if (rowErrors.length > 0) {
      rowsWithErrors++;
      errors.push(`Linha ${i + 2}: ${rowErrors.join(', ')}`);
    }
  });

  // Verificar IDs duplicados
  const ids = pontos.map(p => p.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    warnings.push(`IDs duplicados encontrados: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    rowsValidated: pontos.length,
    rowsWithErrors
  };
}
```

### SEC-5: Proteção de localStorage

```typescript
// ⚠️ Proteger dados sensíveis no localStorage

const STORAGE_KEYS = {
  RDO_LIST: 'rdoData',
  PROJECTS: 'rdoProjects',
  USER_PREFERENCES: 'userPrefs'
} as const;

// Limite de tamanho por chave (5MB)
const MAX_STORAGE_SIZE = 5 * 1024 * 1024;

function safeSetItem(key: string, value: any): { success: boolean; error?: string } {
  try {
    const json = JSON.stringify(value);

    // Verificar tamanho
    if (json.length > MAX_STORAGE_SIZE) {
      return { success: false, error: `Dados excedem ${MAX_STORAGE_SIZE / 1024 / 1024}MB` };
    }

    localStorage.setItem(key, json);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      // QuotaExceededError
      if (error.name === 'QuotaExceededError') {
        return { success: false, error: 'localStorage cheio' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Erro desconhecido' };
  }
}

function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    const parsed = JSON.parse(item);

    // Validar estrutura básica (evita dados corrompidos)
    if (parsed === null || parsed === undefined) {
      return defaultValue;
    }

    return parsed as T;
  } catch {
    console.warn(`Erro ao ler ${key} do localStorage, usando valor padrão`);
    return defaultValue;
  }
}

// Limpar dados antigos para liberar espaço
function cleanupOldData(): void {
  const keysToClean = Object.values(STORAGE_KEYS);

  for (const key of keysToClean) {
    try {
      const item = localStorage.getItem(key);
      if (item && item.length > MAX_STORAGE_SIZE) {
        console.warn(`Removendo ${key} por exceder tamanho máximo`);
        localStorage.removeItem(key);
      }
    } catch {
      // Ignorar erros de limpeza
    }
  }
}
```

### SEC-6: Proteção contra Path Traversal

```typescript
// ⚠️ NUNCA usar caminhos de arquivo fornecidos pelo usuário diretamente

function sanitizePath(path: string, baseDir: string): string | null {
  if (!path || !baseDir) return null;

  // Remover tentativas de path traversal
  const dangerous = ['..', '~', '%2e%2e', '%252e%252e'];
  for (const pattern of dangerous) {
    if (path.toLowerCase().includes(pattern)) {
      console.warn(`Path traversal detectado: ${path}`);
      return null;
    }
  }

  // No browser, validar que é um nome de arquivo simples
  const safeName = sanitizeFilename(path);

  return safeName;
}
```

### SEC-7: Rate Limiting (Proteção contra Abuso)

```typescript
// ⚠️ Limitar operações pesadas para prevenir DoS

interface RateLimiter {
  checkLimit(operation: string): boolean;
  reset(operation: string): void;
}

function createRateLimiter(maxOperations: number, windowMs: number): RateLimiter {
  const operations: Map<string, number[]> = new Map();

  return {
    checkLimit(operation: string): boolean {
      const now = Date.now();
      const windowStart = now - windowMs;

      let timestamps = operations.get(operation) || [];

      // Remover operações fora da janela
      timestamps = timestamps.filter(t => t > windowStart);

      if (timestamps.length >= maxOperations) {
        return false; // Limite atingido
      }

      timestamps.push(now);
      operations.set(operation, timestamps);
      return true;
    },

    reset(operation: string): void {
      operations.delete(operation);
    }
  };
}

// Uso:
// const limiter = createRateLimiter(10, 60000); // 10 operações por minuto
// if (!limiter.checkLimit('file_upload')) {
//   alert('Muitas operações. Aguarde um momento.');
//   return;
// }
```

### SEC-8: Checklist de Segurança para Implementação

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ CHECKLIST DE SEGURANÇA - OBRIGATÓRIO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ □ Entrada de Texto                                              │
│   ├─ escapeHtml() antes de exibir em HTML                       │
│   ├─ detectInjection() para campos de texto livre               │
│   └─ validateAndSanitize() para dados do usuário                │
│                                                                 │
│ □ Upload de Arquivos                                            │
│   ├─ validateFile() para extensão e tamanho                     │
│   ├─ sanitizeFilename() para nome do arquivo                    │
│   └─ validateFileContent() para conteúdo                        │
│                                                                 │
│ □ Dados GeoJSON                                                 │
│   ├─ validateGeoJSON() para estrutura                           │
│   ├─ validateCoordinates() para valores                         │
│   └─ sanitizeGeoJSONStrings() para propriedades                 │
│                                                                 │
│ □ Dados CSV/Topografia                                          │
│   ├─ validateCSVData() após parse                               │
│   ├─ Verificar limites numéricos                                │
│   └─ Limitar número de pontos (MAX_POINTS)                      │
│                                                                 │
│ □ localStorage                                                  │
│   ├─ safeSetItem() com verificação de tamanho                   │
│   ├─ safeGetItem() com tratamento de erros                      │
│   └─ cleanupOldData() periodicamente                            │
│                                                                 │
│ □ Operações Pesadas                                             │
│   ├─ Rate limiting para uploads                                 │
│   ├─ Rate limiting para cálculos complexos                      │
│   └─ Timeout para operações longas                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## DEPENDÊNCIAS ATUALIZADAS

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "chart.js": "^4.4.0",
    "react-leaflet": "^4.2.1",
    "chartjs-plugin-annotation": "^3.0.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.8"
  }
}
```

---

## RESUMO DE PARIDADE COM ENGINE PYTHON

| Funcionalidade | Engine Python | Documento Lovable | Status |
|----------------|---------------|-------------------|--------|
| Parse CSV/TXT | reader.py | CÁLCULO 2 | ✅ |
| Criação de Trechos | domain.py | CÁLCULO 3 | ✅ |
| Classificação Gravidade/Elevatória | geometry.py | CÁLCULO 4 | ✅ |
| Parâmetros de Construção | construction.py | CÁLCULOS 19-24 | ✅ |
| Escoramento | construction.py | CÁLCULO 19 | ✅ |
| Embasamento | construction.py | CÁLCULO 20 | ✅ |
| Composição de Equipe | construction.py | CÁLCULO 23 | ✅ |
| Recomposição de Pavimento | construction.py | CÁLCULO 22 | ✅ |
| Orçamento | budget.py | CÁLCULO 6 | ✅ |
| Cronograma | planning.ts | CÁLCULOS 5, 7, 11 | ✅ |
| Curva S | planning.ts | CÁLCULO 8 | ✅ |
| Histograma | planning.ts | CÁLCULO 9 | ✅ |
| EVM | dashboard.ts | CÁLCULO 12 | ✅ |
| RDO Completo | rdo.ts | CÁLCULOS 10, 13 | ✅ |
| Manning | hydraulics.py | CÁLCULO 26 | ✅ |
| Hazen-Williams | hydraulics.py | CÁLCULO 27 | ✅ |
| Bombeamento | hydraulics.py | CÁLCULO 28 | ✅ |
| IDF/Método Racional | hydraulics.py | CÁLCULO 29 | ✅ |
| Peer Review | peer_review/ | CÁLCULOS 30-31 | ✅ |
| Regras NBR | peer_review/rules/ | CÁLCULO 30 | ✅ |
| Export GeoJSON | gis_export.py | CÁLCULOS 32-34 | ✅ |
| UTM → Lat/Lng | geometry.ts | CÁLCULO 1 | ✅ |
| **Segurança** | security/ | SEC-1 a SEC-8 | ✅ |

---

## FLUXO COMPLETO DE IMPLEMENTAÇÃO

```
1. TOPOGRAFIA
   └─→ Upload CSV → validateFile() → parseCSV() → validateCSVData()
   └─→ createTrechosFromTopography() → summarizeNetwork()
   └─→ Mapa Leaflet com getMapCoordinates()

2. PARÂMETROS DE CONSTRUÇÃO
   └─→ Configurar: Solo, Escavação, Pavimento, Material
   └─→ criarParametrosExecucao() para cada trecho
   └─→ Exibir requisitos de escoramento, embasamento, equipe

3. PLANEJAMENTO
   └─→ Configurar equipes e produtividade
   └─→ generateFullSchedule() com Same-Day Completion
   └─→ Gantt Chart, Curva S, Histograma

4. PEER REVIEW
   └─→ runPeerReview() com SEWER_RULES, WATER_RULES
   └─→ Dashboard de Findings por severidade
   └─→ exportFindingsToGeoJSON() para QGIS

5. RDO
   └─→ Formulário com validateRDO()
   └─→ safeSetItem() para persistência
   └─→ Dashboard com calculateDashboardMetrics()

6. EXPORTAÇÃO
   └─→ exportNetworkToGeoJSON() com parâmetros
   └─→ downloadGeoJSON() ou downloadFile()
```

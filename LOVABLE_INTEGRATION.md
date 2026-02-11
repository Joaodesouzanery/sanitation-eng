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

# Prompt para Lovable - Completar Plataforma HydroNetwork

## CONTEXTO IMPORTANTE

A plataforma HydroNetwork foi implementada de forma **incompleta**. A versão atual na Lovable tem apenas formularios basicos, mas faltam:
- Graficos e visualizacoes (Gantt, Curva S, Histograma, Mapas)
- Resultados apos gerar calculos
- Muitas funcionalidades de cada modulo

Este prompt lista EXATAMENTE o que falta em cada modulo.

---

## MODULO 1: TOPOGRAFIA - O QUE FALTA

### Situacao Atual:
- Apenas area de upload de arquivo

### O QUE DEVE SER ADICIONADO:

#### 1.1 Apos upload do arquivo, mostrar:

**Cards de Resumo (6 cards em grid):**
```
| Total de Pontos | Total de Trechos | Comprimento Total |
| Por Gravidade   | Elevatoria       | Declividade Media |
```

**Mapa Interativo com Leaflet:**
- Mostrar pontos como CircleMarkers coloridos:
  - Verde (#22c55e) = Ponto inicial
  - Vermelho (#ef4444) = Ponto final
  - Azul (#3b82f6) = Pontos intermediarios
- Mostrar trechos como Polylines:
  - Verde = Gravidade (declividade >= 0.5%)
  - Amarelo/Laranja = Elevatoria (declividade < 0.5%)
- Popup ao clicar com informacoes do ponto/trecho

**Tabela de Dados:**
- Colunas: Inicio | Fim | Comprimento | Declividade | Tipo | DN | Material
- Com scroll se muitos registros
- Badge colorido para tipo (Gravidade = verde, Elevatoria = laranja)

**Botoes de Exportacao:**
- Exportar CSV
- Exportar JSON

#### 1.2 Codigo para integrar:
Usar os arquivos de `src/engine/`:
```typescript
import { parseCSV, createSampleTopography } from '../engine/reader';
import { createTrechosFromTopography, summarizeNetwork } from '../engine/domain';
```

---

## MODULO 2: PLANEJAMENTO - O QUE FALTA

### Situacao Atual:
- Apenas campos de configuracao (numero de equipes, data, etc.)
- Botao "Gerar Cronograma" que nao mostra resultados visuais

### O QUE DEVE SER ADICIONADO APOS CLICAR "GERAR CRONOGRAMA":

#### 2.1 Cards de Resumo (4 cards):
```
| Dias de Obra (azul)  | Data de Inicio (verde) |
| Data de Termino (laranja) | Custo Total Estimado (roxo) |
```

#### 2.2 Grafico de Gantt COMPLETO:
```
Estrutura:
- Header com numeros dos dias (1, 2, 3, 4, 5...)
- Uma linha por trecho
- Cada celula mostra:
  - Se tem trabalho: Gradiente colorido (amarelo->azul->verde) representando o ciclo
    Escavacao (amarelo #f59e0b) | Assentamento (azul #3b82f6) | Reaterro (verde #22c55e)
  - Se teste hidrostatico: Vermelho (#ef4444) com letra "T"
  - Numero de metros no centro da celula
- Celulas vazias = cinza claro com borda tracejada
```

**Legenda do Gantt:**
- Gradiente colorido = Ciclo Completo (Escavacao -> Assentamento -> Reaterro)
- Vermelho = Teste Hidrostatico
- Tag: "Vala fechada no mesmo dia"

#### 2.3 Curva S (Grafico de Linha com Chart.js):
```
- Eixo X: Dias (D1, D2, D3...)
- Eixo Y: Progresso (0% a 100%)
- Linha Azul: Fisico Planejado (%)
- Linha Verde: Financeiro Planejado (%)
- Area preenchida sob as linhas
- Titulo: "Curva S - Avanco Fisico-Financeiro"
```

#### 2.4 Histograma de Recursos (Grafico de Barras com Chart.js):
```
- Eixo X: Dias/Semanas/Meses (selecionavel)
- Eixo Y: Quantidade
- Barras Azuis: Mao de Obra (pessoas)
- Barras Roxas: Equipamentos (unidades)
- Controles: Select para "Diario/Semanal/Mensal" e "Todos/Mao de Obra/Equipamentos/Custo"
```

**Estatisticas do Histograma (4 mini-cards):**
```
| Pico Mao de Obra | Media Diaria | Total HH | Equip. x Dias |
```

#### 2.5 Tabela de Plano Diario:
```
Colunas: Dia | Trecho | Atividade | Equipe | Metros | Mao de Obra | Custo/Dia
- Mostrar primeiras 20 linhas
- Mensagem "... e mais X registros" se houver mais
```

#### 2.6 Codigo para integrar:
```typescript
import {
  generateFullSchedule,
  generateCurveSData,
  generateHistogramData
} from '../engine/planning';
```

---

## MODULO 3: RDO - O QUE FALTA

### Situacao Atual:
- Estrutura basica com abas

### O QUE DEVE SER ADICIONADO:

#### 3.1 Dashboard RDO (4 cards + 3 barras de progresso + 2 graficos):

**Cards de Resumo:**
```
| Total Planejado (m) | Total Executado (m) | Restante (m) | Progresso (%) |
```

**Barras de Progresso por Sistema:**
```
- Agua (azul #60a5fa): X% - Xm / Xm
- Esgoto (verde #22c55e): X% - Xm / Xm
- Drenagem (laranja #f59e0b): X% - Xm / Xm
```

**Grafico 1 - Evolucao Semanal (Linha):**
- Linha tracejada azul: Planejado
- Linha solida verde com area: Executado

**Grafico 2 - Status dos Trechos (Donut):**
- Verde: Concluido
- Laranja: Em Execucao
- Vermelho: Nao Iniciado

#### 3.2 Mapa do RDO (com Leaflet):
```
- Mostrar trechos coloridos por status:
  - Verde (#22c55e) = Concluido (linha mais grossa)
  - Laranja (#f59e0b) = Em Execucao
  - Vermelho (#ef4444) = Nao Iniciado
- Filtros: Sistema (Agua/Esgoto/Drenagem) e Status
- Popup com informacoes do trecho e progresso
- Barra de progresso no popup
```

#### 3.3 Codigo para integrar:
```typescript
import { RDOEngine, type RDO } from '../engine/rdo';
import { RDODashboard } from '../engine/dashboard';
```

---

## MODULO 4: ORCAMENTO - O QUE FALTA

### Situacao Atual:
- Estrutura basica

### O QUE DEVE SER ADICIONADO:

**Cards de Resumo:**
```
| Total Geral (R$) | Comprimento (m) | Custo/Metro (R$/m) |
```

**Tabela de Itens:**
```
Colunas: Item | Descricao | Un | Qtd | Preco Unit. | Total
```

**Codigo:**
```typescript
import { generateBudgetFromTrechos, type BudgetSummary } from '../engine/budget';
```

---

## MODULO 5: EXECUCAO - O QUE FALTA

### Situacao Atual:
- Estrutura basica

### O QUE DEVE SER ADICIONADO:

**Cards:**
```
| Planejado (m) | Executado (m) | Progresso (%) |
```

**Barra de Progresso Geral:**
- Mostrar percentual de execucao
- Cor baseada no progresso (vermelho < 30%, amarelo 30-70%, verde > 70%)

---

## MODULO 6: RESULTADOS - O QUE FALTA

### O QUE DEVE SER ADICIONADO:

**Cards de Resumo Final:**
```
| Trechos | Comprimento | Dias de Obra | Custo Estimado |
```

**Botoes de Exportacao:**
- Exportar Trechos (CSV)
- Exportar Projeto Completo (JSON)

---

## DEPENDENCIAS NECESSARIAS

Adicionar ao `package.json`:
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

**IMPORTANTE:** Importar CSS do Leaflet:
```typescript
import 'leaflet/dist/leaflet.css';
```

---

## RESUMO DO QUE IMPLEMENTAR

| Modulo | Falta |
|--------|-------|
| Topografia | Mapa interativo, Cards de resumo, Tabela de trechos |
| Planejamento | Gantt com gradiente, Curva S, Histograma, Cards, Tabela diaria |
| RDO | Dashboard com graficos, Mapa de progresso, Barras por sistema |
| Orcamento | Cards, Tabela de itens |
| Execucao | Cards, Barra de progresso |
| Resultados | Cards finais, Botoes de exportacao |

---

## FLUXO DE DADOS

```
1. TOPOGRAFIA
   Usuario faz upload CSV/TXT
   -> parseCSV() processa
   -> createTrechosFromTopography() cria trechos
   -> summarizeNetwork() gera resumo
   -> Exibir: Cards + Mapa + Tabela

2. PLANEJAMENTO
   Usuario configura equipes e clica "Gerar Cronograma"
   -> generateFullSchedule() gera cronograma
   -> generateCurveSData() gera dados da curva S
   -> generateHistogramData() gera dados do histograma
   -> Exibir: Cards + Gantt + Curva S + Histograma + Tabela

3. RDO
   Usuario cria RDOs
   -> Salvar em localStorage
   -> calculateDashboardMetrics() calcula metricas
   -> Exibir: Dashboard + Graficos + Mapa
```

---

## ESTILO VISUAL

Manter o estilo atual com:
- Background claro (#f8fafc)
- Cards brancos com sombra suave
- Cores de destaque: Azul (#3b82f6), Verde (#22c55e), Laranja (#f59e0b), Roxo (#8b5cf6)
- Border radius de 12px nos cards
- Fontes: Inter ou sistema

---

## PRIORIDADE DE IMPLEMENTACAO

1. **ALTA**: Mapa na Topografia (Leaflet)
2. **ALTA**: Gantt + Curva S + Histograma no Planejamento (Chart.js)
3. **MEDIA**: Dashboard do RDO com graficos
4. **MEDIA**: Mapa do RDO
5. **BAIXA**: Cards e tabelas nos outros modulos

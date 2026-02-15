# Deep Research Analysis - HydroNetwork / Sanitation Engineering Platform

**Data:** 2026-02-15
**Branch:** `claude/build-python-engine-bEGd9`
**Foco:** Analise completa para integracao Lovable
**Metodologia:** Deep Research Agent - Investigacao sistematica multi-hop

---

## Sumario Executivo

Este documento apresenta uma analise profunda e sistematica de todo o repositorio `sanitation-eng`, cobrindo:

1. **Arquitetura e Estrutura do Codigo** - Python + TypeScript
2. **Qualidade do Motor Python** - Calculos hidraulicos, erros, NBR
3. **Qualidade do Motor TypeScript** - Port para React/Lovable
4. **Gaps de Integracao Lovable** - O que falta para producao
5. **Seguranca, API e Deploy** - Vulnerabilidades e configuracao
6. **Paridade Python vs TypeScript** - Divergencias de calculo
7. **Recomendacoes Priorizadas** - Roadmap de correcoes

### Nota Importante
> Os codigos foram escritos primeiro aqui (Claude Code) e depois transferidos para a Lovable, que provavelmente fez alteracoes. Esta analise foca no estado atual do repositorio como **referencia base** para comparacao com o que a Lovable pode ter modificado.

---

## 1. Visao Geral da Arquitetura

### 1.1 Stack Tecnologico

```
+---------------------------------------------------------------+
|                    FRONTEND (Lovable)                          |
|  React + TypeScript + Shadcn/UI + Tailwind                    |
|  Pages: Topografia, HydroNetwork, Planejamento, RDO           |
+---------------------------------------------------------------+
          |                    |                     |
          v                    v                     v
+------------------+  +------------------+  +------------------+
|  FastAPI Backend |  |  TypeScript Eng  |  |  Python Engine   |
|  (api/)          |  |  (src/engine/)   |  |  (hydro_network/)|
|  Supabase Auth   |  |  Client-side     |  |  Server-side     |
|  Demo/PRO gates  |  |  calculations    |  |  calculations    |
+------------------+  +------------------+  +------------------+
          |                                          |
          +------------------------------------------+
                           |
          +------------------------------------------+
          |  Supabase (Auth + PostgreSQL + Storage)  |
          |  EPANET (simulacao hidraulica)           |
          |  SINAPI/SICRO (base de custos)           |
          +------------------------------------------+
```

### 1.2 Inventario de Arquivos

| Categoria | Arquivos | LOC Estimado |
|-----------|----------|-------------|
| Python Engine (`hydro_network/`) | 12 | ~4,300 |
| Python Engine Legacy (`engine_rede/`) | 8 | ~1,500 |
| TypeScript Engine (`src/engine/`) | 11 | ~15,000+ |
| React Pages (`src/pages/`) | 4 | ~4,900+ |
| Python API (`api/`) | 3 | ~1,365 |
| Security (`src/security/`) | 6 | ~2,205 |
| GIS (`src/gis/`) | 7 | ~2,800+ |
| Documentation (`.md`) | 8 | N/A |
| Config/Deploy | 6 | ~500 |
| **Total** | **~65+** | **~32,500+** |

### 1.3 Modulos Funcionais

| Modulo | Python | TypeScript | React Page | API Endpoint |
|--------|--------|------------|------------|-------------|
| Topografia | `reader.py`, `pipeline.py` | `reader.ts`, `domain.ts` | `TopografiaPage.tsx` | `/api/topografia/process` |
| Hidraulica | `hydraulics.py`, `sewer.py`, `water.py`, `drainage.py` | (parcial em `construction.ts`) | `HydroNetworkPage.tsx` | `/api/orcamento/calculate` |
| Orcamento | `budget.py`, `construction.py` | `budget.ts`, `construction.ts` | (dentro de HydroNetwork) | `/api/orcamento/calculate` |
| Planejamento | `planning/schedule.py` | `planning.ts`, `materials.ts` | `PlanejamentoPage.tsx` | `/api/planejamento/generate` |
| RDO | `rdo/engine.py` | `rdo.ts`, `dashboard.ts` | `RDOPage.tsx` | N/A |
| GIS Export | `gis_export.py`, `gis_io.py` | N/A | N/A | `/api/gis/export/*` |
| Peer Review | `peer_review/engine.py` | `peer-review.ts` | N/A | `/api/peer-review/analyze` |
| Seguranca | `security/*` | N/A | N/A | (middleware nao aplicado) |

---

## 2. Analise do Motor Python

### 2.1 Problemas Criticos

#### 2.1.1 Convergencia do Bisection (y/D ratio) - `hydraulics.py`
**Severidade: CRITICA**

O metodo de bissecao para encontrar a razao y/D tem iteracoes fixas (50) e sem tratamento de erro se nao convergir:

```python
# hydraulics.py, linhas ~88-130
for _ in range(50):  # Maximo de iteracoes fixo
    y_mid = (y_low + y_high) / 2
    Q_mid = flow_at_depth(y_mid)
    if abs(Q_mid - Q) < 1e-9:
        break
# Nenhum tratamento se o loop completa sem convergir
```

**Impacto:** Para condicoes extremas de vazao, pode retornar valores errados silenciosamente.

#### 2.1.2 Acumulacao de Vazao em Drenagem usa `max()` ao inves de `sum()` - `drainage.py`
**Severidade: CRITICA**

```python
# drainage.py, linha ~313
Q_total = max(Q_total, r.Q_total)  # Usar maxima vazao convergente
```

**Problema:** Em confluencias, a vazao deveria ser **somada** (Q1 + Q2), nao usar o **maximo**. Isto subestima dramaticamente a vazao nos pontos de juncao.

**Impacto:** Subdimensionamento de galerias em confluencias - erro de projeto grave.

#### 2.1.3 Redes Malhadas Nao Suportadas sem Aviso - `water.py`
**Severidade: CRITICA**

```python
# water.py, linhas ~334-382
# Comentario: "Para redes malhadas, use EPANET"
# Mas nenhum erro ou aviso se o usuario passa uma rede malhada!
```

**Impacto:** Calculos de pressao completamente errados para redes malhadas (loops), que sao comuns em sistemas de abastecimento reais.

#### 2.1.4 Coeficiente de Escoamento Ponderado Incorreto - `drainage.py`
**Severidade: ALTA**

```python
# drainage.py, linhas ~198-202
runoff_medio = (
    (runoff_medio * (area_total - node_result.area_ha)) +
    (node_result.runoff_coef * node_result.area_ha)
) / area_total
```

**Problema:** A logica de ponderacao da media tem erro na aritmetica - `area_total` ja inclui `node_result.area_ha`.

### 2.2 Problemas de Media Severidade

| # | Arquivo | Linha | Problema | Impacto |
|---|---------|-------|----------|---------|
| 1 | `constants.py` | 223-237 | IDF hardcoded para Sao Paulo (K=3462.6) | Invalido fora de SP |
| 2 | `constants.py` | 93 | `COBERTURA_MIN = 0.90m` (NBR 9649 exige 1.00m urbano) | Sub-cobertura |
| 3 | `hydraulics.py` | 225-232 | Constante magica 0.312 na formula de Manning | Sem referencia |
| 4 | `hydraulics.py` | 333-352 | Calculo de bomba ignora perdas de succao/recalque | Subestima potencia 5-15% |
| 5 | `topology.py` | 126 | Usa distancia 2D em vez de 3D para comprimento | Erro em terrenos inclinados |
| 6 | `topology.py` | 162-202 | Topological sort nao distingue ciclo de desconexao | Msg de erro ambigua |
| 7 | `sewer.py` | 224-225 | Calculo de cota de fundo nao verifica impossibilidade fisica | Cota acima do terreno |
| 8 | `water.py` | 364-372 | Auto-deteccao de no fonte fragil (fallback arbitrario) | Escolhe no errado |
| 9 | `quantities.py` | 184-187 | Fator 1.1 para diametro externo arbitrario | SDR varia por material |
| 10 | `quantities.py` | 233-247 | Logica de volume de bota-fora confusa/possivel erro | Custo incorreto |
| 11 | `pipeline_advanced.py` | 74 | CRS hardcoded EPSG:31983 (Sao Paulo) | Errado para outras regioes |
| 12 | `rule_check.py` | 312-315 | Operador 'range' nao valida `value_max` None | RuntimeError |

### 2.3 Conformidade NBR

| Norma | Status | Gaps Identificados |
|-------|--------|-------------------|
| **NBR 9649 (Esgoto)** | Parcial | Falta tensao trativa minima (tau >= 1.0 Pa), cobertura minima incorreta |
| **NBR 12218 (Agua)** | Parcial | Falta pressao maxima em tubulacoes, setorizacao de pressao |
| **NBR 14486 (Drenagem)** | Parcial | Falta limites de tempo de concentracao, verificacao de escoamento subcritico |
| **SINAPI 2025** | Referenciado | Sem integracao real - custos hardcoded |

---

## 3. Analise do Motor TypeScript

### 3.1 Bugs Criticos

#### 3.1.1 Calculo EVM Quebrado - `rdo.ts`
**Severidade: CRITICA**

```typescript
// rdo.ts, linhas ~662-674
const pv = plannedBudget * (physicalPct / 100);
const ev = plannedBudget * (physicalPct / 100);  // <-- IDENTICO ao PV!
const ac = executedFinancial;

const spi = pv > 0 ? ev / pv : 0;  // Sempre = 1.0!
```

**Problema:** PV e EV sao calculados com a mesma formula. O SPI (Schedule Performance Index) sera sempre 1.0, tornando a analise de cronograma sem sentido.

**Correcao necessaria:**
- PV = Orcamento planejado baseado no **tempo decorrido**
- EV = Orcamento planejado baseado no **trabalho realizado**

#### 3.1.2 Inconsistencia de Volumes entre Modulos
**Severidade: ALTA**

```typescript
// construction.ts (linha ~163): Calculo preciso
volumeReaterro = volumeEscavacao - volumeBerco - volumeTubo;

// planning.ts (linha ~298): Regra de bolso
volReat = volEsc * 0.7; // 30% vai para bota-fora
```

**Impacto:** Orcamento e Planejamento mostrarao quantidades diferentes para o mesmo projeto.

#### 3.1.3 Profundidade Hardcoded no Orcamento - `budget.ts`
**Severidade: ALTA**

```typescript
// budget.ts, linha ~336
const profundidade = 1.5; // Default depth para TODOS os trechos
```

**Problema:** Deveria usar `trecho.profundidade` se disponivel. Todos os trechos sao orcados com 1.5m de profundidade.

### 3.2 Problemas de Integracao React/Lovable

#### 3.2.1 Singleton RDOEngine Incompativel com React

```typescript
// rdo.ts, linhas 910-917
let engineInstance: RDOEngine | null = null;

export function getRDOEngine(): RDOEngine {
  if (!engineInstance) {
    engineInstance = new RDOEngine();
  }
  return engineInstance;
}
```

**Problema em React:**
- Singleton mutavel e global
- Multiplos componentes compartilham estado sem controle
- Hot reload em dev pode causar problemas
- Testes ficam dificeis (estado carregado entre testes)

**Recomendacao:** Usar React Context ou criar nova instancia por componente.

#### 3.2.2 Estado Nao Serializavel

```typescript
// peer-review.ts, linha ~85
export interface ReviewSession {
  elementsReviewed: Set<string>;  // Set NAO pode ser JSON.stringify!
}
```

**Impacto:** Impossivel persistir em localStorage ou enviar para servidor. Perda de dados ao recarregar pagina.

#### 3.2.3 Dashboard Recalcula Tudo a Cada Render

```typescript
// dashboard.ts - calculateMetrics()
// Itera sobre rdos 6+ vezes separadamente para:
// 1. calculateOverallProgress()
// 2. calculateProgressBySystem()
// 3. calculateProgressByProject()
// 4. getTopServices()
```

**Impacto:** Para projetos grandes (100+ RDOs), pode causar lentidao perceptivel no render.

### 3.3 Inconsistencias de Nomenclatura

```typescript
// planning.ts, linhas ~204-209 - Nomes duplos EN/PT
if (team.hasRetroescavadeira ?? team.hasRetro) cost += 450;
if (team.hasCompactador ?? team.hasCompactor) cost += 120;
```

**Problema:** O mesmo campo tem dois nomes posssiveis. Deveria ser padronizado.

### 3.4 Problemas de Timezone

```typescript
// planning.ts, materials.ts
const currentDate = new Date(dateStr);
// JavaScript Date assume local time, nao UTC
// Calculo de semana pode errar por 1 dia dependendo do fuso
```

**Recomendacao:** Usar UTC consistentemente ou adotar `date-fns`/`dayjs`.

---

## 4. Gaps de Integracao Lovable

### 4.1 Funcionalidades Documentadas vs Implementadas

| Funcionalidade | Doc (LOVABLE_PROMPT_PONTUAL.md) | Codigo | Status |
|---------------|-------------------------------|--------|--------|
| Import CSV/TXT | Sim | Sim | :white_check_mark: Implementado |
| Import DXF/SHP | Sim | Nao | :x: Nao implementado |
| Import XLSX | Sim | Nao | :x: Nao implementado |
| Deteccao auto de delimitador | Sim | Nao | :x: Nao implementado |
| Deteccao auto de fuso UTM | Sim | Hardcoded zona 23 | :warning: Parcial |
| Calculos hidraulicos client-side | Sim | Sim | :white_check_mark: Implementado |
| Integracao SINAPI real | Sim | Custos hardcoded | :x: Nao implementado |
| BDI calculation | Sim | Nao | :x: Nao implementado |
| Curva ABC | Sim | Nao (exceto HTML standalone) | :x: Nao implementado |
| Gantt chart | Sim | Sim | :white_check_mark: Implementado |
| Gerenciamento de feriados | Sim | Apenas date picker | :warning: Parcial |
| Cronograma de materiais | Sim | Nao | :x: Nao implementado |
| Curva S | Sim | Parcial | :warning: Parcial |
| EVM (Earned Value) | Sim | Mock/hardcoded | :x: Nao funcional |
| Dashboard RDO | Sim | Metricas falsas | :x: Nao funcional |
| Upload de fotos | Sim | Nao | :x: Nao implementado |
| Export Shapefile | Sim | Apenas server-side | :warning: Parcial |
| Export GeoPackage | Sim | Apenas server-side | :warning: Parcial |
| Auth Supabase | Sim | Nao no frontend | :x: Nao implementado |
| Persistencia Supabase | Sim | Apenas localStorage | :x: Nao implementado |

### 4.2 Compatibilidade Tecnica com Lovable

| Aspecto | Status | Detalhes |
|---------|--------|---------|
| **React + TypeScript** | :white_check_mark: Compativel | Hooks padrao (useState, useEffect, etc.) |
| **Shadcn/UI** | :warning: Parcial | Pages usam CSS inline, nao Shadcn |
| **Vite/ESM** | :white_check_mark: Compativel | Imports ESM padrao |
| **Leaflet** | :warning: Problema | Usa `declare const L: any` - precisa de CDN ou npm |
| **Chart.js** | :warning: Problema | Usa `declare const Chart: any` - mesmo issue |
| **File API** | :white_check_mark: Compativel | Usa `file.text()`, `file.arrayBuffer()` |
| **Env Vars** | :x: Ausente | Nenhum `import.meta.env.VITE_*` usado |

### 4.3 Tamanho dos Componentes React

| Arquivo | Linhas | Tamanho | Problema? |
|---------|--------|---------|-----------|
| `TopografiaPage.tsx` | 891 | ~37KB | :warning: Grande mas aceitavel |
| `HydroNetworkPage.tsx` | 1655 | ~68KB | :x: CRITICO - 6 tabs em 1 componente |
| `PlanejamentoPage.tsx` | 1090 | ~45KB | :warning: Deveria ser dividido |
| `RDOPage.tsx` | 1285 | ~52KB | :warning: Formulario grande |

**Recomendacao:** `HydroNetworkPage.tsx` com 1655 linhas excede o tamanho recomendado para Lovable (~800 linhas). Deveria ser dividido em 6 componentes separados.

### 4.4 Integracao Backend Ausente

**Nenhuma** das React Pages faz chamadas HTTP para o backend Railway:

```typescript
// ESPERADO (mas ausente em todas as pages):
const response = await fetch(`${import.meta.env.VITE_RAILWAY_API_URL}/api/topografia/process`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ pontos })
});
```

**Estado atual:** Todas as operacoes sao feitas client-side. O backend FastAPI existe mas nao e chamado pelas pages.

### 4.5 Persistencia de Dados

| Camada | Documentado | Implementado | Status |
|--------|------------|-------------|--------|
| Supabase Auth | Sim | Nao | :x: Zero codigo de auth no frontend |
| Supabase Database | Sim (10+ tabelas) | Nao | :x: Zero queries no frontend |
| Supabase Storage | Sim | Nao | :x: Zero upload |
| localStorage | Nao documentado | Sim (RDOPage) | :warning: Dados perdidos ao limpar cache |

---

## 5. Analise de Seguranca

### 5.1 Vulnerabilidades Criticas

#### 5.1.1 Middleware de Seguranca NAO Aplicado
**Severidade: CRITICA**

O codigo de seguranca existe em `/src/security/middleware.py` com 4 middlewares completos:
- `SecurityHeadersMiddleware`
- `RateLimitMiddleware`
- `RequestValidationMiddleware`
- `AuditLogMiddleware`

**Problema:** Nenhum e importado ou aplicado em `api/main.py`. A funcao `apply_all_security_middleware(app)` existe mas nunca e chamada.

**Resultado:**
- :x: Sem rate limiting (vulneravel a DoS)
- :x: Sem headers de seguranca (CSP, HSTS, X-Frame-Options)
- :x: Sem validacao de requests (XSS, SQLi possivel)
- :x: Sem audit logging

#### 5.1.2 Token Demo Previsivel
**Severidade: ALTA**

```python
# api/auth.py, linha 37
DEMO_TOKEN = "demo"  # Hardcoded, previsivel
```

Qualquer pessoa pode usar `Authorization: Bearer demo` para acesso completo ao plano Demo.

#### 5.1.3 HTTPS Nao Configurado
**Severidade: ALTA**

Nem Dockerfile, nem railway.json, nem render.yaml configuram HTTPS. Tokens JWT trafegam em texto plano.

### 5.2 Gaps de Seguranca

| Componente | Codigo Existe | Aplicado | Gap |
|-----------|--------------|----------|-----|
| Security Headers | Sim (headers.py) | Nao | Nenhum header enviado |
| Rate Limiting | Sim (middleware.py) | Nao | Zero protecao DoS |
| Input Validation | Sim (validators.py) | Nao | Pydantic basico apenas |
| Audit Logging | Sim (middleware.py) | Nao | Zero rastreabilidade |
| CORS | Sim | Sim | Sem validacao de origens |
| Auth Supabase | Sim (auth.py) | Sim | Sem refresh/logout |
| Demo/PRO Gates | Sim (demo.py) | Sim | Bem implementado |
| Docker Security | Parcial | Parcial | Roda como root |

### 5.3 Feature Gating (Demo/PRO) - Ponto Positivo

O sistema de planos em `api/demo.py` e **bem implementado**:

```python
# Limites bem definidos
PLAN_LIMITS = {
    PlanTier.DEMO: {
        "topografia_max_pontos": 10,
        "orcamento_max_trechos": 5,
        "orcamento_mostra_custo_total": False,
        "gis_export_shapefile": False,
        # ...
    },
    PlanTier.PRO: { ... }  # Tudo liberado
}

# Enforcement consistente
def enforce_limit(plan, key, current_value):
    # Levanta HTTPException 403 se exceder
```

---

## 6. Paridade Python vs TypeScript

### 6.1 Divergencias de Calculo Identificadas

| Calculo | Python | TypeScript | Divergencia |
|---------|--------|------------|-------------|
| Volume de reaterro | `V_esc - V_berco - V_tubo` | `V_esc * 0.7` | **Significativa** - metodos diferentes |
| Profundidade de vala | Variavel por trecho | Fixo 1.5m (budget.ts) | **Significativa** - orcamento errado |
| Produtividade | Multiplicativo | Multiplicativo | Compativel |
| EVM (PV vs EV) | N/A no Python base | PV = EV (bug) | **Critico** - SPI sempre 1.0 |
| Diametro externo | `DN * 1.1` | `DN * 1.1` | Compativel (ambos arbitrarios) |
| Custo por metro | SINAPI ref | Hardcoded | **Media** - valores podem divergir |

### 6.2 Funcionalidades Apenas no Python

| Funcionalidade | Python | TypeScript |
|---------------|--------|------------|
| Calculo de sewer (esgoto) completo | Sim | Parcial |
| Calculo de water (agua) completo | Sim | Parcial |
| Calculo de drainage completo | Sim | Parcial |
| GIS Export (Shapefile, GeoPackage) | Sim | Nao |
| EPANET wrapper | Sim | Nao |
| Validacao de regras (rule_check) | Sim | Nao |
| DXF/DWG import | Sim | Nao |
| Coordinate transformations | Sim | Nao |
| Interactive map generation | Sim | Nao |

### 6.3 Funcionalidades Apenas no TypeScript

| Funcionalidade | TypeScript | Python |
|---------------|-----------|--------|
| RDO Engine completo | Sim | Parcial |
| Dashboard RDO | Sim | Nao |
| Peer Review Engine | Sim | Parcial |
| Materials scheduling | Sim | Parcial |
| Planning calendar | Sim | Parcial |

---

## 7. Recomendacoes Priorizadas

### 7.1 Tier 1: Critico - Corrigir Imediatamente

| # | Item | Arquivo | Impacto |
|---|------|---------|---------|
| 1 | **Corrigir acumulacao de vazao em drenagem** (`max` -> `sum`) | `drainage.py:313` | Subdimensionamento de galerias |
| 2 | **Corrigir calculo EVM** (PV != EV) | `rdo.ts:662-674` | SPI sempre 1.0 |
| 3 | **Aplicar middleware de seguranca** | `api/main.py` | Zero protecao atual |
| 4 | **Adicionar deteccao de redes malhadas** | `water.py:334-382` | Resultados errados silenciosos |
| 5 | **Corrigir profundidade hardcoded no orcamento** | `budget.ts:336` | Orcamento impreciso |

### 7.2 Tier 2: Alto - Corrigir no Proximo Sprint

| # | Item | Arquivo | Impacto |
|---|------|---------|---------|
| 6 | Unificar calculo de volumes (budget vs planning) | `budget.ts`, `planning.ts` | Inconsistencia de dados |
| 7 | Implementar integracao Supabase no frontend | Todas as pages | Sem persistencia de dados |
| 8 | Implementar chamadas ao backend Railway | Todas as pages | Backend inutilizado |
| 9 | Dividir `HydroNetworkPage.tsx` em componentes | `HydroNetworkPage.tsx` | 1655 linhas = inmanejavel |
| 10 | Configurar HTTPS no deploy | Dockerfile, railway.json | Tokens em texto plano |
| 11 | Corrigir IDF hardcoded para SP | `constants.py:223-237` | Invalido fora de SP |
| 12 | Corrigir cobertura minima (0.90 -> 1.00m) | `constants.py:93` | Nao-conformidade NBR 9649 |

### 7.3 Tier 3: Medio - Melhorias Importantes

| # | Item | Arquivo | Impacto |
|---|------|---------|---------|
| 13 | Adicionar convergencia segura no bisection | `hydraulics.py:88-130` | Erro silencioso em extremos |
| 14 | Implementar SINAPI real (nao hardcoded) | `budget.ts`, `constants.ts` | Custos imprecisos |
| 15 | Corrigir ponderacao de C (runoff) | `drainage.py:198-202` | Coeficiente errado |
| 16 | Trocar singleton RDOEngine por Context | `rdo.ts:910-917` | Incompativel com React |
| 17 | Serializar Set -> Array em ReviewSession | `peer-review.ts:85` | Perda de dados |
| 18 | Adicionar env vars VITE_ | Todas as pages | Sem config de ambiente |
| 19 | Usar distancia 3D para comprimento | `topology.py:126` | Erro em terrenos inclinados |
| 20 | Implementar token demo seguro | `api/auth.py:37` | Token previsivel |

### 7.4 Tier 4: Baixo - Nice to Have

| # | Item | Impacto |
|---|------|---------|
| 21 | Memoizar calculos do dashboard | Performance |
| 22 | Padronizar nomes PT/EN em interfaces | Manutencao |
| 23 | Adicionar ErrorBoundary components | UX |
| 24 | Usar UUID criptografico | Seguranca marginal |
| 25 | Multi-stage Docker build | Tamanho da imagem |
| 26 | Separar requirements-dev.txt | Tamanho da imagem |

---

## 8. Metricas de Qualidade

### 8.1 Score por Area

| Area | Score | Justificativa |
|------|-------|--------------|
| **Estrutura/Arquitetura** | 7/10 | Boa organizacao de modulos, separacao de concerns |
| **Calculos Hidraulicos (Python)** | 6/10 | Funcional mas com bugs criticos em drenagem e agua |
| **Motor TypeScript** | 5/10 | Port incompleto, bugs de EVM, inconsistencias |
| **React Pages** | 5/10 | Funcionais mas muito grandes, sem backend |
| **Integracao Lovable** | 3/10 | Muitas features documentadas mas nao implementadas |
| **Backend/API** | 6/10 | Endpoints ok, feature gating bom, seguranca nao aplicada |
| **Seguranca** | 4/10 | Codigo existe mas nao esta integrado |
| **Deploy** | 4/10 | Configs basicas, sem HTTPS, sem multi-stage |
| **Documentacao** | 8/10 | Extensa e detalhada (talvez excessiva) |
| **Testes** | 2/10 | Infra de testes existe, quase nenhum teste escrito |
| **Score Geral** | **5.0/10** | **Funcional mas fragil - requer trabalho significativo** |

### 8.2 Risco por Modulo para Producao

```
ALTO RISCO    ████████████████░░░░  Drenagem (bug acumulacao)
ALTO RISCO    ████████████████░░░░  EVM/RDO (calculo quebrado)
ALTO RISCO    ████████████████░░░░  Seguranca (middleware nao aplicado)
MEDIO RISCO   ████████████░░░░░░░░  Agua (redes malhadas)
MEDIO RISCO   ████████████░░░░░░░░  Orcamento (profundidade fixa)
BAIXO RISCO   ████████░░░░░░░░░░░░  Topografia (funcional)
BAIXO RISCO   ████████░░░░░░░░░░░░  Planejamento (parcial)
BAIXO RISCO   ██████░░░░░░░░░░░░░░  GIS Export (server-side ok)
```

---

## 9. Nota Sobre Lovable

### O que a Lovable provavelmente modificou

Considerando que os codigos foram criados aqui e depois transferidos para a Lovable, e provavel que a Lovable tenha:

1. **Adicionado Shadcn/UI components** - Substituindo CSS inline por componentes estilizados
2. **Instalado dependencias npm** - Leaflet, Chart.js, react-leaflet via package.json
3. **Adicionado roteamento** - React Router para navegacao entre pages
4. **Modificado imports** - Ajustando paths para a estrutura do projeto Lovable
5. **Adicionado Supabase client** - Se seguiu a documentacao
6. **Dividido componentes grandes** - Se seguiu boas praticas
7. **Adicionado hooks personalizados** - useMap, useChart, etc.

### O que verificar na Lovable

Para comparar com esta analise base:

- [ ] Os bugs de calculo foram corrigidos ou propagados?
- [ ] O EVM foi reimplementado corretamente?
- [ ] Supabase foi integrado no frontend?
- [ ] Backend Railway esta sendo chamado?
- [ ] Componentes foram divididos adequadamente?
- [ ] Env vars VITE_ estao configurados?
- [ ] Leaflet e Chart.js estao como npm dependencies?

---

## 10. Fontes e Referencias

### Arquivos Analisados (65+)

**Python Engine:**
- `hydro_network/core/constants.py` (338 LOC)
- `hydro_network/core/hydraulics.py` (431 LOC)
- `hydro_network/core/topology.py` (337 LOC)
- `hydro_network/networks/sewer.py` (362 LOC)
- `hydro_network/networks/water.py` (500 LOC)
- `hydro_network/networks/drainage.py` (390 LOC)
- `hydro_network/construction/quantities.py` (442 LOC)
- `hydro_network/validation/rule_check.py` (542 LOC)
- `engine_rede/pipeline.py` (302 LOC)
- `engine_rede/pipeline_advanced.py` (481 LOC)

**TypeScript Engine:**
- `src/engine/constants.ts` (13.9KB)
- `src/engine/reader.ts` (10.9KB)
- `src/engine/budget.ts` (32.3KB)
- `src/engine/construction.ts` (9KB)
- `src/engine/planning.ts` (20.4KB)
- `src/engine/rdo.ts` (27.4KB)
- `src/engine/dashboard.ts` (26.9KB)
- `src/engine/materials.ts` (14.3KB)
- `src/engine/peer-review.ts` (18.6KB)
- `src/engine/domain.ts` (6.1KB)
- `src/engine/geometry.ts` (4.5KB)

**React Pages:**
- `src/pages/TopografiaPage.tsx` (891 linhas)
- `src/pages/HydroNetworkPage.tsx` (1655 linhas)
- `src/pages/PlanejamentoPage.tsx` (1090 linhas)
- `src/pages/RDOPage.tsx` (1285 linhas)

**API & Security:**
- `api/main.py` (980 LOC)
- `api/auth.py` (146 LOC)
- `api/demo.py` (239 LOC)
- `src/security/auth.py` (434 LOC)
- `src/security/config.py` (236 LOC)
- `src/security/headers.py` (194 LOC)
- `src/security/middleware.py` (425 LOC)
- `src/security/validators.py` (615 LOC)
- `src/security/https.py` (301 LOC)

**Documentacao:**
- `LOVABLE_INTEGRATION.md` (101KB)
- `MODULOS_LOVABLE_SPEC.md`
- `LOVABLE_PROMPT_PONTUAL.md`
- `ARQUITETURA_STACK_COMPLETA.md`
- `GUIA_CONFIGURACAO_PLATAFORMAS.md`
- `SECURITY_AUDIT_REPORT.md`
- `PROMPT_MELHORIAS_SEGURANCA.md`

**Deploy:**
- `Dockerfile`
- `railway.json`
- `render.yaml`
- `requirements.txt`
- `.gitignore`

### Normas Referenciadas
- NBR 9649 - Projeto de redes coletoras de esgoto sanitario
- NBR 12218 - Projeto de rede de distribuicao de agua para abastecimento publico
- NBR 14486 - Sistemas enterrados para conducao de esgoto sanitario
- SINAPI 2025 - Sistema Nacional de Pesquisa de Custos e Indices da Construcao Civil

---

*Analise gerada por Deep Research Agent - Claude Code*
*Nivel de confianca geral: 85% (baseado em leitura direta do codigo, sem execucao de testes)*

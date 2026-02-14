# ESPECIFICAÇÃO COMPLETA DOS MÓDULOS PARA LOVABLE

Este documento detalha a estrutura de entrada/saída de cada módulo do sistema ConstruData | HydroNetwork para implementação na Lovable.

---

## MÓDULO 1: IMPORTAR TOPOGRAFIA

### Descrição
Importa dados externos de topografia e elementos de rede para iniciar o cálculo hidráulico.

### Interface de Entrada

#### 1.1 Tipo de Arquivo
| Categoria | Formatos Aceitos |
|-----------|------------------|
| Topografia | TXT, CSV, XLSX, XLS |
| CAD | DWG, DXF |
| GIS/Shapefile | SHP, GeoJSON, KML, GeoPackage |
| BIM | IFC |
| LandXML | XML |

#### 1.2 Tipos de Elementos a Importar
- [ ] Elementos de Distribuição (Nós/PVs)
- [ ] Tubulações (Trechos)
- [ ] Terminais de Fluxo (Descarte/Reservatório)
- [ ] Todos os elementos

#### 1.3 Área de Upload
```
[Arraste o arquivo aqui ou clique para selecionar]
Formatos aceitos: CSV, TXT, XLSX, DXF, DWG, SHP, GeoJSON, KML, IFC
```

#### 1.4 Opções de Importação

**Tipo de Rede a Calcular:**
- [ ] Esgoto Sanitário (Gravidade)
- [ ] Água (Pressurizado)
- [ ] Drenagem Pluvial
- [ ] Recalque/Elevatória

**Geração de Trechos:**
- [ ] Automática (conectar pontos sequencialmente)
- [ ] Manual (definir conexões)
- [ ] Por camada DXF/SHP

**População por Nó (para Esgoto):**
- Campo para informar habitantes por nó
- Ou importar de coluna do arquivo

#### 1.5 Parâmetros de Execução

**1. Tipo de Solo:**
- [ ] 1ª Categoria (solo comum)
- [ ] 2ª Categoria (solo compacto/pedregulho)
- [ ] 3ª Categoria (rocha)

**2. Opções de Solo:**
- [ ] Solo saturado (presença de água)

**3. Escoramento:**
- [ ] Utilizar escoramento (obrigatório para profundidades > 1,25m conforme NR-18)

**4. Tipo de Escoramento:** (se marcado escoramento)
- [ ] Escoramento contínuo (madeira)
- [ ] Pontaleteamento
- [ ] Escoramento metálico
- [ ] Estacas-prancha

**5. Profundidade mínima para escoramento:**
```
[Campo numérico] m (padrão: 1.25)
```

**6. Interpolação de Cotas:**
- [ ] Pontos topográficos estão nos cantos da rua
  - *Marque se os pontos foram levantados nas bordas/cantos da rua*

#### 1.6 Importação Avançada de DXF
```
Importe arquivos DXF com classificação detalhada de entidades.
Selecione exatamente quais elementos representam cada componente da rede.

[Dropdown: Camada de Nós/PVs]
[Dropdown: Camada de Tubulações]
[Dropdown: Camada de Cotas]
[Dropdown: Camada de Textos/Labels]
```

#### 1.7 Botões de Ação
```
[CALCULAR REDE] [CALCULAR TUDO (REDE + QUANTITATIVOS)] [DEMO]
```

### Saída de Dados (Output)

```json
{
  "pontos": [
    {
      "id": "P1",
      "x": 123456.789,
      "y": 7654321.123,
      "cota": 850.50
    }
  ],
  "trechos": [
    {
      "id_inicio": "P1",
      "id_fim": "P2",
      "comprimento": 85.5,
      "declividade": 0.0085,
      "tipo_rede": "Esgoto por Gravidade",
      "diametro_mm": 150
    }
  ],
  "metadata": {
    "total_pontos": 25,
    "total_trechos": 24,
    "comprimento_total": 2150.75,
    "arquivo_origem": "topografia.csv",
    "crs": "EPSG:31983"
  }
}
```

---

## MÓDULO 2: PARÂMETROS HIDRÁULICOS

### Descrição
Configura os parâmetros de cálculo hidráulico conforme normas brasileiras.

### Interface de Entrada

#### 2.1 Parâmetros de Esgoto Sanitário

**Contribuições:**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Consumo per capita (QPC) | Consumo de água | 200 | L/hab.dia |
| Habitantes por UH | Moradores por unidade | 3.5 | hab |
| Coeficiente de retorno | Esgoto/Água | 0.80 | - |
| Taxa de infiltração | Infiltração na rede | 0.0005 | L/s.m |

**Hidráulica (Manning):**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Coeficiente Manning (n) | Rugosidade | 0.013 | - |
| Declividade mínima | Declividade min. | 0.005 | m/m (0.5%) |
| Declividade máxima | Declividade max. | 0.15 | m/m (15%) |
| Velocidade mínima | Autolimpeza | 0.60 | m/s |
| Velocidade máxima | Limite erosão | 5.0 | m/s |
| Lâmina mínima (y/D) | Preenchimento min. | 0.20 | - |
| Lâmina máxima (y/D) | Preenchimento max. | 0.75 | - |

**Cobertura:**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Cobertura mínima | Cobertura min. sobre tubo | 0.90 | m |
| Cobertura máxima | Cobertura max. | 6.0 | m |

**Diâmetros Comerciais:**
```
Diâmetros disponíveis (mm): [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200]
Diâmetro mínimo: 150 mm (NBR 9649)
```

#### 2.2 Parâmetros de Água (Pressurizado)

**Demandas:**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Consumo per capita (QPC) | Consumo | 200 | L/hab.dia |
| Habitantes por UH | Moradores | 3.5 | hab |
| K1 | Coef. dia maior consumo | 1.2 | - |
| K2 | Coef. hora maior consumo | 1.5 | - |

**Pressões:**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Pressão mínima dinâmica | Mínima rede | 10.0 | mca |
| Pressão máxima estática | Máxima rede | 50.0 | mca |

**Hidráulica (Hazen-Williams):**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Coeficiente C | Rugosidade PVC | 140 | - |
| Velocidade mínima | | 0.5 | m/s |
| Velocidade máxima | | 3.5 | m/s |
| Rendimento bomba | Para elevatórias | 0.75 | - |

**Diâmetros Comerciais:**
```
Diâmetros disponíveis (mm): [50, 75, 100, 150, 200, 250, 300, 400, 500, 600]
Diâmetro mínimo: 50 mm
```

#### 2.3 Parâmetros de Drenagem Pluvial

**Chuva:**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Período de retorno | Recorrência | 10 | anos |
| Duração mínima | Duração mín. chuva | 5 | minutos |

**Curva IDF (Intensidade-Duração-Frequência):**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| K | Coeficiente regional | 3462.6 | - |
| a | Expoente a | 0.172 | - |
| b | Parâmetro b | 20 | - |
| c | Expoente c | 1.025 | - |
```
Fórmula: i = K × T^a / (t + b)^c  [mm/h]
```

**Coeficientes de Runoff:**
| Tipo de Superfície | Coeficiente C |
|--------------------|---------------|
| Telhado | 0.95 |
| Asfalto | 0.90 |
| Concreto | 0.85 |
| Paralelepípedo | 0.75 |
| Solo compactado | 0.60 |
| Grama | 0.25 |
| Área verde | 0.15 |
| Misto urbano | 0.70 |

**Hidráulica (Manning):**
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Manning concreto | Rugosidade | 0.015 | - |
| Manning PEAD | Rugosidade | 0.012 | - |
| Declividade mínima | | 0.005 | m/m |
| Velocidade mínima | | 0.75 | m/s |
| Velocidade máxima | | 5.0 | m/s |
| Lâmina máxima (y/D) | | 0.85 | - |

**Diâmetros Comerciais:**
```
Diâmetros disponíveis (mm): [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000]
Diâmetro mínimo: 300 mm
```

### Saída de Dados (Output)

```json
{
  "parametros_esgoto": {
    "qpc": 200,
    "hab_por_uh": 3.5,
    "coef_retorno": 0.8,
    "taxa_infiltracao": 0.0005,
    "manning_n": 0.013,
    "S_min": 0.005,
    "S_max": 0.15,
    "V_min": 0.6,
    "V_max": 5.0,
    "yD_min": 0.2,
    "yD_max": 0.75,
    "cobertura_min": 0.90,
    "DN_comerciais": [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200],
    "DN_min": 150
  },
  "parametros_agua": {
    "qpc": 200,
    "K1": 1.2,
    "K2": 1.5,
    "P_min": 10.0,
    "P_max": 50.0,
    "hazen_williams_C": 140,
    "V_min": 0.5,
    "V_max": 3.5,
    "DN_comerciais": [50, 75, 100, 150, 200, 250, 300, 400, 500, 600],
    "DN_min": 50
  }
}
```

---

## MÓDULO 3: CÁLCULO DE REDE (RESULTADOS HIDRÁULICOS)

### Descrição
Processa os dados de entrada e calcula os parâmetros hidráulicos de cada trecho.

### Saída de Dados - Rede de Esgoto

#### 3.1 Resultados por Nó
```json
{
  "node_id": "PV-01",
  "population": 150,
  "Qm": 0.347,           // Vazão média (L/s)
  "Kp": 2.15,            // Fator de pico Harmon
  "Qp": 0.746,           // Vazão de pico (L/s)
  "ground_elev": 850.50, // Cota terreno (m)
  "invert_elev": 848.10, // Cota de fundo (m)
  "depth": 2.40          // Profundidade PV (m)
}
```

#### 3.2 Resultados por Trecho
```json
{
  "link_id": "T-01",
  "from_node": "PV-01",
  "to_node": "PV-02",

  // Vazões (L/s)
  "Q_local": 0.746,      // Vazão local
  "Q_upstream": 2.350,   // Vazão acumulada montante
  "Q_inf": 0.043,        // Vazão infiltração
  "Q_total": 3.139,      // Vazão total

  // Geometria
  "length": 85.5,        // Comprimento (m)
  "DN": 200,             // Diâmetro nominal (mm)
  "slope": 0.0085,       // Declividade (m/m)
  "invert_up": 848.10,   // Cota fundo montante (m)
  "invert_down": 847.37, // Cota fundo jusante (m)
  "cover_up": 2.40,      // Cobertura montante (m)
  "cover_down": 2.63,    // Cobertura jusante (m)

  // Hidráulica
  "velocity": 0.85,      // Velocidade (m/s)
  "y_D": 0.35,           // Lâmina relativa
  "tractive_force": 1.2, // Força trativa (Pa)

  // Validação
  "status": "OK",        // OK, WARN, ERROR
  "alerts": []           // Lista de alertas
}
```

### Saída de Dados - Rede de Água

#### 3.3 Resultados por Nó
```json
{
  "node_id": "N-01",
  "population": 500,
  "Qm": 1.157,           // Vazão média (L/s)
  "Qmd": 1.389,          // Vazão máx. diária (L/s)
  "Qmh": 2.083,          // Vazão máx. horária (L/s)
  "ground_elev": 850.50, // Cota terreno (m)
  "head": 870.25,        // Carga hidráulica (m)
  "pressure": 19.75,     // Pressão (mca)
  "status": "OK",
  "alerts": []
}
```

#### 3.4 Resultados por Trecho (Água)
```json
{
  "link_id": "T-01",
  "Q": 12.5,             // Vazão no trecho (L/s)
  "length": 120.0,       // Comprimento (m)
  "DN": 150,             // Diâmetro (mm)
  "velocity": 0.71,      // Velocidade (m/s)
  "headloss": 0.85,      // Perda de carga (m)
  "headloss_unit": 0.0071, // Perda unitária (m/m)
  "status": "OK",
  "alerts": []
}
```

### Saída de Dados - Drenagem Pluvial

#### 3.5 Resultados por Nó (Drenagem)
```json
{
  "node_id": "BL-01",
  "area_ha": 2.5,        // Área contribuinte (ha)
  "runoff_coef": 0.70,   // Coeficiente de runoff
  "tc": 12.5,            // Tempo concentração (min)
  "intensity": 125.3,    // Intensidade chuva (mm/h)
  "Q_local": 0.608,      // Vazão local (m³/s)
  "ground_elev": 850.50
}
```

#### 3.6 Resultados por Trecho (Drenagem)
```json
{
  "link_id": "G-01",

  // Vazões (m³/s)
  "Q_local": 0.608,
  "Q_upstream": 1.250,
  "Q_total": 1.858,

  // Tempo de concentração
  "tc_upstream": 12.5,   // tc montante (min)
  "tc_trecho": 2.1,      // Tempo no trecho (min)
  "tc_total": 14.6,      // tc total (min)

  // Intensidade recalculada
  "intensity": 118.7,    // Intensidade (mm/h)

  // Área acumulada
  "area_total_ha": 5.8,
  "runoff_coef_mean": 0.72,

  // Geometria
  "length": 95.0,
  "DN": 600,
  "slope": 0.008,

  // Hidráulica
  "velocity": 2.45,
  "y_D": 0.65,

  "status": "OK",
  "alerts": []
}
```

### Resumo da Rede (Network Summary)
```json
{
  "total_trechos": 45,
  "comprimento_total": 3250.75,
  "trechos_gravidade": 42,
  "trechos_elevatoria": 3,
  "declividade_media": 0.0078,
  "declividade_min": 0.005,
  "declividade_max": 0.085,
  "diametro_predominante": 200,
  "vazao_final": 45.8,
  "velocidade_media": 0.95
}
```

---

## MÓDULO 4: QUANTITATIVOS DE CONSTRUÇÃO

### Descrição
Calcula volumes de escavação, escoramento, materiais e recomposição de pavimento.

### Interface de Entrada

#### 4.1 Geometria da Vala
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Largura mínima | Largura mín. da vala | 0.60 | m |
| Folga lateral | Folga cada lado do tubo | 0.15 | m |
| Tipo de vala | Vertical ou Taludada | Vertical | - |
| Talude | Inclinação (0=vertical) | 0.0 | m/m |

#### 4.2 Escoramento
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Profundidade mín. escoramento | Conforme NR-18 | 1.25 | m |
| Tipo de escoramento | Contínuo, Pontual, Metálico | - | - |

#### 4.3 Camadas
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Espessura do berço | Camada sob o tubo | 0.10 | m |
| Espessura envoltória | Acima do tubo | 0.30 | m |

#### 4.4 Recomposição de Pavimento
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Faixa técnica | Cada lado da vala | 0.30 | m |
| Espessura sub-base | Camada sub-base | 0.20 | m |
| Espessura base | Camada base | 0.15 | m |
| Espessura asfalto | CBUQ | 0.05 | m |

#### 4.5 Fatores
| Campo | Descrição | Padrão | Unidade |
|-------|-----------|--------|---------|
| Fator de empolamento | Expansão do solo | 1.25 | - |

### Saída de Dados (Output por Trecho)

```json
{
  "link_id": "T-01",

  // Geometria básica
  "length": 85.5,              // Comprimento (m)
  "DN_mm": 200,                // Diâmetro (mm)
  "prof_media": 2.52,          // Profundidade média (m)
  "largura_vala": 0.90,        // Largura da vala (m)

  // Escavação
  "area_secao": 2.27,          // Área seção transversal (m²)
  "vol_escavacao": 194.09,     // Volume escavação (m³)

  // Escoramento
  "escoramento_necessario": true,
  "area_escoramento": 431.10,  // Área de escoramento (m²)

  // Volumes de camadas (m³)
  "vol_tubo": 2.69,            // Volume do tubo
  "vol_berco": 7.70,           // Volume do berço
  "vol_envoltoria": 19.24,     // Volume da envoltória
  "vol_reaterro": 155.38,      // Volume reaterro comum
  "vol_botafora": 48.52,       // Volume bota-fora (empolado)

  // Pavimento
  "tipo_pavimento": "asfalto",
  "area_pavimento": 128.25,    // Área recomposição (m²)
  "vol_subbase": 25.65,        // Volume sub-base (m³)
  "vol_base": 19.24,           // Volume base (m³)
  "vol_asfalto": 6.41          // Volume asfalto (m³)
}
```

### Totais do Projeto

```json
{
  "totais_quantitativos": {
    "comprimento_total": 3250.75,
    "vol_escavacao_total": 7350.25,
    "area_escoramento_total": 16320.50,
    "vol_berco_total": 292.57,
    "vol_envoltoria_total": 731.42,
    "vol_reaterro_total": 5876.23,
    "vol_botafora_total": 1838.82,
    "area_pavimento_total": 4876.13,
    "vol_subbase_total": 975.23,
    "vol_base_total": 731.42,
    "vol_asfalto_total": 243.81
  }
}
```

---

## MÓDULO 5: ORÇAMENTO E CUSTOS

### Descrição
Aplica custos unitários (SINAPI/SICRO/Próprio) aos quantitativos calculados.

### Interface de Entrada

#### 5.1 Base de Custos
- [ ] SINAPI (Caixa/IBGE) - Desonerado
- [ ] SINAPI (Caixa/IBGE) - Onerado
- [ ] SICRO (DNIT)
- [ ] Base Própria (Upload)

**Estado/UF:** [Dropdown com UFs]
**Mês/Ano de Referência:** [Dropdown MM/AAAA]

#### 5.2 Composições por Serviço

**Escavação:**
| Serviço | Código SINAPI | Custo (R$/m³) |
|---------|---------------|---------------|
| Escav. 1ª cat. (0-1,5m) | 96995 | 28.50 |
| Escav. 1ª cat. (1,5-3m) | 96996 | 35.20 |
| Escav. 1ª cat. (3-4,5m) | 96997 | 42.80 |
| Escav. 2ª cat. | 96998 | 65.30 |
| Escav. 3ª cat. | 96999 | 125.50 |

**Escoramento:**
| Serviço | Código SINAPI | Custo (R$/m²) |
|---------|---------------|---------------|
| Escoramento madeira | 95241 | 45.80 |
| Escoramento metálico | 95242 | 38.50 |
| Estaca-prancha | 95243 | 85.20 |

**Tubulação (implantada):**
| Diâmetro | Material | Código SINAPI | Custo (R$/m) |
|----------|----------|---------------|--------------|
| 150mm | PVC | 89356 | 125.50 |
| 200mm | PVC | 89357 | 185.30 |
| 250mm | PVC | 89358 | 265.80 |
| 300mm | PVC | 89359 | 355.20 |
| 400mm | PVC | 89361 | 485.60 |
| 500mm | PEAD | 89363 | 650.80 |
| 600mm | Concreto | 89365 | 820.50 |

**Reaterro:**
| Serviço | Código SINAPI | Custo (R$/m³) |
|---------|---------------|---------------|
| Reaterro compactado | 97914 | 18.50 |
| Berço de areia | 97905 | 95.30 |
| Envoltória c/ areia | 97906 | 85.50 |

**Pavimentação:**
| Serviço | Código SINAPI | Custo |
|---------|---------------|-------|
| Sub-base BGS | 95995 | R$ 125.30/m³ |
| Base brita grad. | 95996 | R$ 145.80/m³ |
| CBUQ 5cm | 95998 | R$ 28.50/m² |

**Poços de Visita:**
| Tipo | Código SINAPI | Custo (R$/un) |
|------|---------------|---------------|
| PV concreto até 1,5m | 89709 | 2,850.00 |
| PV concreto 1,5-2,5m | 89710 | 4,250.00 |
| PV concreto 2,5-4,0m | 89711 | 6,850.00 |

#### 5.3 BDI (Bonificação)
| Campo | Descrição | Padrão |
|-------|-----------|--------|
| BDI | Bonificação e Despesas Indiretas | 25% |
| Encargos Sociais | Leis Sociais | Inclusos na base |

### Saída de Dados (Output)

#### 5.4 Orçamento por Trecho
```json
{
  "link_id": "T-01",
  "custos": {
    "escavacao": 5531.57,
    "escoramento": 19746.38,
    "tubo": 15839.65,
    "berco": 733.81,
    "envoltoria": 1645.11,
    "reaterro": 2876.15,
    "botafora": 462.13,
    "subbase": 3213.66,
    "base": 2808.83,
    "asfalto": 3655.13,
    "subtotal": 56512.42,
    "bdi": 14128.11,
    "total": 70640.53
  }
}
```

#### 5.5 Orçamento Consolidado
```json
{
  "resumo_orcamento": {
    "servicos": {
      "escavacao": {
        "quantidade": 7350.25,
        "unidade": "m³",
        "custo_unitario_medio": 35.80,
        "custo_total": 263148.95
      },
      "escoramento": {
        "quantidade": 16320.50,
        "unidade": "m²",
        "custo_unitario_medio": 45.80,
        "custo_total": 747478.90
      },
      "tubulacao": {
        "quantidade": 3250.75,
        "unidade": "m",
        "custo_unitario_medio": 225.50,
        "custo_total": 733044.13
      },
      "reaterro_berco_envoltoria": {
        "quantidade": 1023.99,
        "unidade": "m³",
        "custo_unitario_medio": 90.40,
        "custo_total": 92568.70
      },
      "reaterro_comum": {
        "quantidade": 5876.23,
        "unidade": "m³",
        "custo_unitario_medio": 18.50,
        "custo_total": 108710.26
      },
      "pavimentacao": {
        "quantidade": 4876.13,
        "unidade": "m²",
        "custo_unitario_medio": 85.30,
        "custo_total": 415935.89
      },
      "pocos_visita": {
        "quantidade": 46,
        "unidade": "un",
        "custo_unitario_medio": 4250.00,
        "custo_total": 195500.00
      }
    },
    "subtotal": 2556386.83,
    "bdi_percentual": 25,
    "bdi_valor": 639096.71,
    "total_geral": 3195483.54,
    "custo_por_metro": 982.63
  }
}
```

#### 5.6 Curva ABC (Pareto)
```json
{
  "curva_abc": [
    {"item": "Escoramento", "percentual": 29.23, "acumulado": 29.23, "classe": "A"},
    {"item": "Tubulação", "percentual": 28.67, "acumulado": 57.90, "classe": "A"},
    {"item": "Pavimentação", "percentual": 16.27, "acumulado": 74.17, "classe": "A"},
    {"item": "Escavação", "percentual": 10.29, "acumulado": 84.46, "classe": "B"},
    {"item": "Poços Visita", "percentual": 7.64, "acumulado": 92.10, "classe": "B"},
    {"item": "Reaterro", "percentual": 4.25, "acumulado": 96.35, "classe": "C"},
    {"item": "Berço/Envoltória", "percentual": 3.65, "acumulado": 100.00, "classe": "C"}
  ]
}
```

---

## MÓDULO 6: EXPORTAÇÃO GIS

### Descrição
Exporta resultados para formatos GIS e CAD.

### Interface de Entrada

#### 6.1 Formatos de Exportação
- [ ] Shapefile (.SHP)
- [ ] GeoJSON (.geojson)
- [ ] GeoPackage (.gpkg)
- [ ] KML/KMZ (Google Earth)
- [ ] DXF (AutoCAD)
- [ ] CSV (com coordenadas)

#### 6.2 Sistema de Coordenadas
| Campo | Opções |
|-------|--------|
| CRS de Saída | EPSG:31983 (SIRGAS 2000 / UTM 23S) |
| | EPSG:31984 (SIRGAS 2000 / UTM 24S) |
| | EPSG:4326 (WGS84 - Lat/Long) |
| | EPSG:4674 (SIRGAS 2000 Geográfico) |

#### 6.3 Camadas a Exportar
- [ ] Nós/Poços de Visita (POINT)
- [ ] Trechos/Tubulações (LINESTRING)
- [ ] Áreas de Contribuição (POLYGON)
- [ ] Perfil Longitudinal

#### 6.4 Atributos a Incluir

**Nós:**
```
ID, X, Y, COTA_TERR, COTA_FUNDO, PROF, POPULACAO, VAZAO, PRESSAO, STATUS
```

**Trechos:**
```
ID, DE_NO, PARA_NO, COMPR, DECL, DN, MATERIAL, VAZAO, VELOC, Y_D,
STATUS, ESC_M3, SHOR_M2, BERCO, ENV, REAT, PAV_M2, CUSTO
```

### Saída de Dados

#### 6.5 Shapefile de Trechos
```
Arquivo: rede_trechos.shp (+ .shx, .dbf, .prj)
Geometria: LINESTRING
CRS: EPSG:31983

Atributos:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| ID | String | Identificador do trecho |
| DE_NO | String | Nó de início |
| PARA_NO | String | Nó de fim |
| COMPR_M | Float | Comprimento (m) |
| DECL_MM | Float | Declividade (m/m) |
| DN_MM | Integer | Diâmetro nominal (mm) |
| MATERIAL | String | Material do tubo |
| VAZAO_LS | Float | Vazão (L/s) |
| VELOC_MS | Float | Velocidade (m/s) |
| Y_D | Float | Lâmina relativa |
| STATUS | String | OK/WARN/ERROR |
| EXC_M3 | Float | Escavação (m³) |
| SHOR_M2 | Float | Escoramento (m²) |
| BED_M3 | Float | Berço (m³) |
| ENV_M3 | Float | Envoltória (m³) |
| BFILL_M3 | Float | Reaterro (m³) |
| PAV_M2 | Float | Pavimento (m²) |
| CUSTO_R | Float | Custo (R$) |
```

#### 6.6 GeoJSON
```json
{
  "type": "FeatureCollection",
  "crs": {
    "type": "name",
    "properties": {"name": "urn:ogc:def:crs:EPSG::31983"}
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[123456.78, 7654321.12], [123541.23, 7654298.45]]
      },
      "properties": {
        "id": "T-01",
        "de_no": "PV-01",
        "para_no": "PV-02",
        "comprimento_m": 85.5,
        "diametro_mm": 200,
        "vazao_ls": 3.14,
        "custo_r": 70640.53
      }
    }
  ]
}
```

---

## MÓDULO 7: RDO/RDA (RELATÓRIO DIÁRIO DE OBRA/AMBIENTAL)

### Descrição
Gera relatórios diários de acompanhamento de obra com medições e fotos.

### Interface de Entrada

#### 7.1 Cabeçalho do Relatório
| Campo | Descrição |
|-------|-----------|
| Número do RDO | Sequencial automático |
| Data | Data do relatório |
| Contrato | Número do contrato |
| Empresa | Razão social |
| Fiscal | Nome do fiscal |
| Local/Trecho | Localização |
| Condições Climáticas | Sol, Nublado, Chuva, etc. |
| Temperatura | Máx/Mín (°C) |

#### 7.2 Efetivo de Obra
| Campo | Descrição |
|-------|-----------|
| Engenheiro | Quantidade |
| Encarregado | Quantidade |
| Pedreiro | Quantidade |
| Servente | Quantidade |
| Operador Máquinas | Quantidade |
| Outros | Quantidade e descrição |

#### 7.3 Equipamentos
| Campo | Descrição |
|-------|-----------|
| Retroescavadeira | Quantidade, horas |
| Escavadeira | Quantidade, horas |
| Caminhão Basculante | Quantidade, horas |
| Compactador | Quantidade, horas |
| Outros | Descrição, quantidade, horas |

#### 7.4 Serviços Executados
| Campo | Descrição |
|-------|-----------|
| Descrição do Serviço | Texto |
| Trecho | De/Até |
| Quantidade | Numérico |
| Unidade | m, m², m³, un |
| % Acumulado | Percentual |

#### 7.5 Registros Fotográficos
```
[Upload de fotos com legenda e geolocalização]
```

#### 7.6 Ocorrências/Observações
```
[Campo de texto livre para registrar ocorrências]
```

### Saída de Dados (Output)

```json
{
  "rdo": {
    "numero": "RDO-2025-001",
    "data": "2025-02-14",
    "contrato": "CT-2024-0123",
    "obra": "Rede Coletora de Esgoto - Bairro Central",

    "efetivo": {
      "engenheiro": 1,
      "encarregado": 2,
      "pedreiro": 8,
      "servente": 12,
      "operador": 3,
      "total": 26
    },

    "equipamentos": [
      {"tipo": "Retroescavadeira", "qtd": 2, "horas": 16},
      {"tipo": "Caminhão", "qtd": 4, "horas": 32}
    ],

    "servicos": [
      {
        "item": "Escavação mecanizada",
        "trecho": "PV-15 a PV-18",
        "quantidade": 185.50,
        "unidade": "m³",
        "acumulado_percentual": 45.2
      },
      {
        "item": "Assentamento tubulação DN200",
        "trecho": "PV-12 a PV-15",
        "quantidade": 95.00,
        "unidade": "m",
        "acumulado_percentual": 38.5
      }
    ],

    "medicoes_dia": {
      "escavacao_m3": 185.50,
      "tubo_m": 95.00,
      "reaterro_m3": 125.30,
      "metros_avanco": 95.00
    },

    "acumulado_obra": {
      "percentual_fisico": 42.5,
      "percentual_financeiro": 38.2,
      "dias_trabalhados": 45,
      "dias_paralisados": 3
    }
  }
}
```

---

## MÓDULO 8: CRONOGRAMA E PLANEJAMENTO

### Descrição
Gera cronograma físico-financeiro baseado nos quantitativos e produtividades.

### Interface de Entrada

#### 8.1 Produtividades Padrão
| Serviço | Produtividade | Unidade |
|---------|---------------|---------|
| Escavação mecanizada | 80 | m³/dia |
| Escavação manual | 4 | m³/homem.dia |
| Assentamento tubo | 60 | m/dia |
| Escoramento | 25 | m²/dia |
| Reaterro compactado | 100 | m³/dia |
| Pavimentação | 200 | m²/dia |
| PV completo | 0.5 | un/dia |

#### 8.2 Recursos Disponíveis
| Recurso | Quantidade |
|---------|------------|
| Equipes de escavação | 2 |
| Equipes de tubulação | 2 |
| Equipes de reaterro | 1 |
| Equipes de pavimentação | 1 |

#### 8.3 Calendário
| Campo | Descrição |
|-------|-----------|
| Data início | Data de início da obra |
| Dias úteis/mês | 22 |
| Feriados | Lista de feriados |
| Período chuvoso | Meses com redução de produtividade |
| Fator período chuvoso | 0.7 (70% da produtividade) |

### Saída de Dados (Output)

#### 8.4 Cronograma de Barras (Gantt)
```json
{
  "cronograma": {
    "data_inicio": "2025-03-01",
    "data_fim": "2025-08-15",
    "duracao_dias_uteis": 120,
    "duracao_meses": 5.5,

    "atividades": [
      {
        "id": 1,
        "nome": "Mobilização",
        "inicio": "2025-03-01",
        "fim": "2025-03-07",
        "duracao_dias": 5,
        "predecessoras": [],
        "percentual": 2.5
      },
      {
        "id": 2,
        "nome": "Locação e topografia",
        "inicio": "2025-03-08",
        "fim": "2025-03-14",
        "duracao_dias": 5,
        "predecessoras": [1],
        "percentual": 1.5
      },
      {
        "id": 3,
        "nome": "Escavação Trecho 1",
        "inicio": "2025-03-15",
        "fim": "2025-04-10",
        "duracao_dias": 20,
        "predecessoras": [2],
        "percentual": 15.0
      }
    ]
  }
}
```

#### 8.5 Curva S (Físico-Financeiro)
```json
{
  "curva_s": {
    "meses": ["Mar/25", "Abr/25", "Mai/25", "Jun/25", "Jul/25", "Ago/25"],
    "fisico_previsto": [5.0, 20.0, 45.0, 70.0, 90.0, 100.0],
    "fisico_realizado": [4.5, 18.5, null, null, null, null],
    "financeiro_previsto": [3.0, 15.0, 40.0, 65.0, 85.0, 100.0],
    "financeiro_realizado": [2.8, 14.2, null, null, null, null]
  }
}
```

---

## MÓDULO 9: MAPA INTERATIVO (WEBMAP)

### Descrição
Visualização georreferenciada da rede sobre mapas base.

### Interface de Entrada

#### 9.1 Mapas Base
- [ ] OpenStreetMap
- [ ] Google Satellite
- [ ] Google Hybrid
- [ ] Esri World Imagery
- [ ] Mapa em branco

#### 9.2 Camadas Exibidas
- [ ] Nós/Poços de Visita
- [ ] Trechos por Tipo
- [ ] Trechos por Diâmetro
- [ ] Trechos por Status (OK/WARN/ERROR)
- [ ] Perfil Longitudinal
- [ ] Áreas de Contribuição

#### 9.3 Simbologia
| Elemento | Cor Padrão |
|----------|------------|
| Esgoto Gravidade | Verde |
| Água Pressurizada | Azul |
| Drenagem | Ciano |
| Elevatória | Laranja |
| Alerta | Amarelo |
| Erro | Vermelho |

#### 9.4 Ferramentas do Mapa
- Zoom +/-
- Pan (arrastar)
- Medição de distância
- Medição de área
- Identificar (clique para info)
- Busca por ID
- Exportar imagem

### Saída de Dados (Output)

```json
{
  "mapa": {
    "centro": [-23.5505, -46.6333],
    "zoom": 15,
    "bounds": [
      [-23.5550, -46.6400],
      [-23.5450, -46.6250]
    ],
    "camadas": {
      "nos": {
        "tipo": "geojson",
        "features": 46,
        "visivel": true
      },
      "trechos": {
        "tipo": "geojson",
        "features": 45,
        "visivel": true,
        "simbolo": "diametro"
      }
    },
    "legenda": {
      "DN150": {"cor": "#22c55e", "largura": 2},
      "DN200": {"cor": "#3b82f6", "largura": 3},
      "DN300": {"cor": "#f59e0b", "largura": 4},
      "DN400+": {"cor": "#ef4444", "largura": 5}
    }
  }
}
```

---

## MÓDULO 10: PERFIL LONGITUDINAL

### Descrição
Desenha o perfil longitudinal da rede (corte vertical).

### Interface de Entrada

#### 10.1 Seleção de Trechos
- [ ] Todos os trechos
- [ ] Selecionar manualmente
- [ ] Por caminho (de PV inicial a PV final)

#### 10.2 Escalas
| Campo | Padrão |
|-------|--------|
| Escala Horizontal | 1:1000 |
| Escala Vertical | 1:100 |
| Exagero Vertical | 10x |

#### 10.3 Elementos a Exibir
- [ ] Linha do terreno
- [ ] Linha da geratriz superior
- [ ] Linha da geratriz inferior
- [ ] Poços de visita
- [ ] Cotas
- [ ] Diâmetros
- [ ] Declividades
- [ ] Comprimentos

### Saída de Dados (Output)

```json
{
  "perfil": {
    "estacas": [
      {
        "progressiva": 0.00,
        "pv_id": "PV-01",
        "cota_terreno": 850.50,
        "cota_fundo": 848.10,
        "profundidade": 2.40
      },
      {
        "progressiva": 85.50,
        "pv_id": "PV-02",
        "cota_terreno": 850.00,
        "cota_fundo": 847.37,
        "profundidade": 2.63
      }
    ],
    "trechos": [
      {
        "de": "PV-01",
        "para": "PV-02",
        "comprimento": 85.50,
        "diametro_mm": 200,
        "declividade": 0.0085,
        "declividade_percent": "0.85%"
      }
    ],
    "escala_h": "1:1000",
    "escala_v": "1:100",
    "exagero": 10
  }
}
```

---

## RESUMO: FLUXO COMPLETO DE DADOS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE DADOS DO SISTEMA                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │  IMPORTAR   │────▶│ PARÂMETROS  │────▶│    CÁLCULO DE REDE      │   │
│  │ TOPOGRAFIA  │     │ HIDRÁULICOS │     │ (Esgoto/Água/Drenagem)  │   │
│  └─────────────┘     └─────────────┘     └───────────┬─────────────┘   │
│        │                                             │                  │
│        │  Pontos (id, x, y, cota)                   │                  │
│        │  Trechos (de, para, comp)                  │                  │
│        │                                             ▼                  │
│        │                               ┌─────────────────────────┐     │
│        │                               │   RESULTADOS POR NÓ    │     │
│        │                               │  (vazão, pressão, etc)  │     │
│        │                               └───────────┬─────────────┘     │
│        │                                           │                    │
│        │                                           ▼                    │
│        │                               ┌─────────────────────────┐     │
│        │                               │ RESULTADOS POR TRECHO   │     │
│        │                               │ (Q, V, DN, y/D, status) │     │
│        │                               └───────────┬─────────────┘     │
│        │                                           │                    │
│        ▼                                           ▼                    │
│  ┌─────────────┐                       ┌─────────────────────────┐     │
│  │ QUANTITAT.  │◀──────────────────────│   REDE CALCULADA        │     │
│  │ CONSTRUÇÃO  │                       └─────────────────────────┘     │
│  └──────┬──────┘                                                        │
│         │  Volumes (escav, berço, reaterro, pav)                       │
│         │  Áreas (escoramento, pavimento)                              │
│         ▼                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │  ORÇAMENTO  │────▶│ CRONOGRAMA  │────▶│      RDO / RDA          │   │
│  │   CUSTOS    │     │  CURVA S    │     │  (Acompanhamento)       │   │
│  └──────┬──────┘     └─────────────┘     └─────────────────────────┘   │
│         │                                                               │
│         │  Custo por serviço, Curva ABC, Total                         │
│         ▼                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │ EXPORTAÇÃO  │     │   WEBMAP    │     │  PERFIL LONGITUDINAL    │   │
│  │     GIS     │     │ INTERATIVO  │     │                         │   │
│  └─────────────┘     └─────────────┘     └─────────────────────────┘   │
│         │                   │                       │                   │
│         ▼                   ▼                       ▼                   │
│   SHP, GeoJSON,       Folium/Leaflet          SVG, DXF, PDF            │
│   KML, DXF, CSV           HTML                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CÓDIGOS DE STATUS E ALERTAS

### Status
| Código | Significado |
|--------|-------------|
| OK | Todos os parâmetros dentro das normas |
| WARN | Alerta - verificar mas não impede uso |
| ERROR | Erro crítico - fora das normas |

### Alertas Comuns (Esgoto)
| Código | Mensagem |
|--------|----------|
| V_MIN | Velocidade abaixo do mínimo (< 0.6 m/s) |
| V_MAX | Velocidade acima do máximo (> 5.0 m/s) |
| YD_MIN | Lâmina abaixo do mínimo (< 0.2) |
| YD_MAX | Lâmina acima do máximo (> 0.75) |
| S_MIN | Declividade insuficiente (< 0.5%) |
| S_MAX | Declividade excessiva (> 15%) |
| COB_MIN | Cobertura insuficiente (< 0.9m) |
| DN_MIN | Diâmetro abaixo do mínimo normativo |

### Alertas Comuns (Água)
| Código | Mensagem |
|--------|----------|
| P_MIN | Pressão abaixo do mínimo (< 10 mca) |
| P_MAX | Pressão acima do máximo (> 50 mca) |
| V_MIN | Velocidade baixa (< 0.5 m/s) |
| V_MAX | Velocidade alta (> 3.5 m/s) |

---

*Documento gerado para integração com Lovable - ConstruData | HydroNetwork*
*Versão: 1.0 | Data: 2025-02-14*

# Prompt COMPLETO para Lovable - HydroNetwork

## CONTEXTO

A plataforma HydroNetwork foi implementada de forma MUITO incompleta. Este prompt lista TODAS as funcionalidades que devem existir em cada modulo. Manter as 6 abas atuais: Topografia, Orcamento, Execucao, Planejamento, RDO, Resultados.

---

# MODULO 1: TOPOGRAFIA

## 1.1 Area de Upload (ja existe parcialmente)

**Drag-and-drop com suporte a multiplos formatos:**
- CSV, TXT (topografia simples)
- XLSX, XLS (planilhas)
- DXF (CAD)
- SHP, GeoJSON (GIS)
- LandXML

**Opcoes de importacao:**
```
- Tipo de coordenadas: UTM | Lat/Lng | Local
- Fuso UTM: 21S, 22S, 23S, 24S (detectar automatico se possivel)
- Delimitador: ; | , | Tab | Espaco (detectar automatico)
- Tem cabecalho: Sim | Nao
```

**Colar dados manualmente:**
- Textarea para colar dados direto do Excel/Notepad
- Botao "Processar Dados Colados"

---

## 1.2 Importacao CAD/BIM com Mapeamento de Camadas

**Quando usuario importar DXF/SHP, mostrar:**

1. **Descoberta de Camadas:**
```
Tabela com:
| Camada | Objetos | Tipo Geometria | Atributos |
```

2. **Mapeamento Manual (OBRIGATORIO):**
```
Card Azul: Rede de Esgoto
- Tubulacoes de Esgoto: [Select multiplo com camadas]
- Pocos de Visita (PV): [Select multiplo]

Card Verde: Rede de Agua
- Tubulacoes de Agua: [Select multiplo]
- Nos (valvulas, hidrantes): [Select multiplo]

Card Roxo: Drenagem Pluvial
- Galerias: [Select multiplo]
- Estruturas (bocas de lobo): [Select multiplo]
```

3. **Acoes:**
- Botao "Validar e Extrair Dados"
- Botao "Salvar Configuracao de Camadas"
- Botao "Carregar Configuracao"

4. **Resultado da Extracao:**
- Rastreabilidade: ID Elemento | Arquivo Origem | Camada Original | Categoria
- Log de Camadas Ignoradas

---

## 1.3 Interpolacao de Cotas de Terreno

**Card especial quando pontos sao "cantos de rua":**
```
Titulo: "Interpolacao de Cotas de Terreno"
Texto: "Os pontos importados sao tratados como cantos da rua.
        O sistema vai estimar a posicao e cota de terreno dos PVs."

Botao: "Interpolar Cotas e Gerar PVs"
```

---

## 1.4 Pre-visualizacao dos Dados

**Tabela de preview apos importacao:**
```
| ID | X | Y | Cota Terreno (m) |
```
- Scroll se muitos registros
- Resumo: "X pontos carregados"

---

## 1.5 Cards de Resumo (6 cards)

```
| Total de Pontos    | Total de Trechos    | Comprimento Total   |
| (azul #3b82f6)     | (verde #22c55e)     | (laranja #f59e0b)   |
|--------------------+---------------------+---------------------|
| Por Gravidade      | Elevatoria          | Declividade Media   |
| (verde)            | (laranja)           | (roxo #8b5cf6)      |
```

---

## 1.6 Mapa Interativo (Leaflet)

**Pontos:**
- CircleMarker verde (#22c55e) = Ponto inicial (idx 0)
- CircleMarker vermelho (#ef4444) = Ponto final (ultimo)
- CircleMarker azul (#3b82f6) = Pontos intermediarios
- Raio: 8px, borda branca 2px

**Trechos:**
- Polyline verde = Gravidade (declividade >= 0.5%)
- Polyline laranja = Elevatoria (declividade < 0.5%)
- Largura: 4px, opacidade 0.8

**Popup ao clicar no ponto:**
```html
<h4>ID do Ponto</h4>
<p>X: 000.000</p>
<p>Y: 000.000</p>
<p>Cota: 000.000m</p>
```

**Popup ao clicar no trecho:**
```html
<h4>PV1 -> PV2</h4>
<p>Comprimento: 00.00m</p>
<p>Declividade: 0.000%</p>
<p>Tipo: Gravidade/Elevatoria</p>
<p>Diametro: DN200</p>
<p>Material: PVC</p>
```

**Legenda:**
- Verde = Gravidade
- Laranja = Elevatoria/Booster
- Circulo verde = Ponto inicial
- Circulo vermelho = Ponto final

---

## 1.7 Tabela de Trechos

```
| Inicio | Fim | Comp.(m) | Decliv.(%) | Tipo | DN | Material |
```
- Badge colorido para tipo (verde/laranja)
- Scroll se muitos registros

---

## 1.8 Editor Visual de Mapa (IMPORTANTE!)

**Toolbar do Mapa com ferramentas de edicao:**

```
Barra de ferramentas:
[Gerar Trechos Auto] [Desenhar Trecho Manual] [Zoom+] [Zoom-] [Reset]
[Desfazer] [Excluir Trecho] [Limpar Tudo] [Salvar] [Carregar]
```

**Funcionalidades:**

1. **Gerar Trechos Automatico:**
   - Conecta pontos automaticamente por proximidade ou sequencial
   - Mostra preview antes de confirmar

2. **Desenhar Trecho Manual:**
   - Ativar modo de desenho (botao fica destacado)
   - Clicar em ponto de origem
   - Clicar em ponto de destino
   - Linha conecta os dois pontos
   - Mostrar distancia em tempo real

3. **Zoom e Navegacao:**
   - Zoom In (+)
   - Zoom Out (-)
   - Reset (voltar visao original)
   - Fit Bounds (ajustar a todos os pontos)

4. **Edicao de Trechos:**
   - Desfazer (undo) - remove ultimo trecho criado
   - Excluir Trecho - abre modal para selecionar qual trecho excluir
   - Limpar Tudo - remove todos os trechos (pedir confirmacao)

5. **Persistencia (localStorage):**
   - Salvar - salva trechos no navegador
   - Carregar - recupera trechos salvos anteriormente
   - Aviso: "Trechos salvos com sucesso!" ou "Trechos carregados!"

**Modal de Exclusao de Trecho:**
```
Titulo: "Excluir Trecho"
Select com lista de trechos: "T01 (PV1 -> PV2) - 45m"
Botoes: [Excluir] [Cancelar]
```

---

## 1.9 Exportacao Completa (Multiplos Formatos)

**Card de Exportacao:**
```
Titulo: "Exportacao"
Texto: "Verifique o tracado antes de exportar."
```

**Botao Principal (destacado):**
```
[EXPORTAR TODOS OS FORMATOS (.ZIP)]
- Gera arquivo ZIP com todos os formatos abaixo
- Background branco, texto escuro, largura 100%
```

**Botoes Individuais:**
```
[Exportar SHP] - Verde (GIS/QGIS)
[Exportar IFC] - Verde (BIM)
[Exportar GeoJSON] - Roxo (GIS/Web)
[Exportar CSV] - Laranja (Planilhas)
[Exportar DXF] - Cinza (AutoCAD)
[Exportar Excel] - Verde (XLSX)
```

**Formato do arquivo exportado:**
- SHP: pontos.shp + trechos.shp (com .dbf, .shx, .prj)
- GeoJSON: rede_completa.geojson
- CSV: pontos.csv + trechos.csv
- Excel: rede_completa.xlsx (com abas Pontos e Trechos)

---

## 1.10 Calculo de Custos Rapido

**Botao na aba de Topografia:**
```
[Calcular Custos] - Azul
```

**Ao clicar, mostrar resumo:**
```
Card com titulo: "Estimativa de Custos"

| Item | Quantidade | Unidade | Custo Estimado |
| Escavacao | 450 | m3 | R$ 15.000 |
| Tubulacao | 850 | m | R$ 42.500 |
| Reaterro | 420 | m3 | R$ 8.400 |
| Total | - | - | R$ 65.900 |

Obs: "Valores estimados. Para orcamento detalhado, acesse a aba Orcamento."
```

---

## 1.11 Header da Plataforma

**Barra superior com:**
```
Logo: HydroNetwork (icone de gota)
Subtitulo: "Plataforma completa de engenharia de saneamento"

Botoes a direita:
[? Tutorial] - Abre modal com instrucoes basicas
[Verificar Plataforma] - Mostra status dos dados carregados
```

**Modal de Tutorial:**
```
Titulo: "Como usar a plataforma"

Passos:
1. Importe seus dados de topografia (CSV, DXF, SHP)
2. Visualize e edite os trechos no mapa
3. Configure o planejamento (equipes, produtividade)
4. Gere o cronograma com Gantt e Curva S
5. Acompanhe a execucao com RDOs
6. Exporte relatorios e dados

[Fechar]
```

**Modal de Verificar Plataforma:**
```
Titulo: "Status da Plataforma"

| Modulo | Status |
| Pontos carregados | 25 (verde) ou 0 (vermelho) |
| Trechos criados | 18 (verde) ou 0 (vermelho) |
| Cronograma gerado | Sim (verde) ou Nao (amarelo) |
| RDOs registrados | 5 (verde) ou 0 (amarelo) |

[Fechar]
```

---

# MODULO 2: ORCAMENTO

## 2.1 Cards de Resumo (3 cards)

```
| Total Geral (R$)   | Comprimento (m)     | Custo/Metro (R$/m)  |
| (azul)             | (verde)             | (laranja)           |
```

## 2.2 Tabela de Itens Orcamentarios

```
| Item | Descricao | Unidade | Quantidade | Preco Unit. | Total |
```

**Categorias de itens (gerar automaticamente dos trechos):**
- Escavacao mecanizada (m3)
- Escavacao manual (m3)
- Escoramento (m2)
- Reaterro compactado (m3)
- Tubulacao PVC (m)
- Pocos de visita (un)
- Pavimentacao (m2)
- Mobilizacao/Desmobilizacao

## 2.3 Grafico de Pizza (Distribuicao por Categoria)

---

# MODULO 3: EXECUCAO

## 3.1 Cards de Resumo (3 cards)

```
| Planejado (m)      | Executado (m)       | Progresso (%)       |
```

## 3.2 Barra de Progresso Geral

- Cor baseada no progresso:
  - Vermelho (#ef4444) < 30%
  - Amarelo (#f59e0b) 30-70%
  - Verde (#22c55e) > 70%

## 3.3 Timeline de Execucao

- Lista de eventos por data
- Mostrar avancos registrados nos RDOs

---

# MODULO 4: PLANEJAMENTO

## 4.1 Secao "Dados para Planejamento"

**Opcao 1 - Usar dados da plataforma:**
```
Card com gradiente verde-azul:
Titulo: "Usar Dados da Plataforma"
Texto: "Importa automaticamente os trechos e quantitativos ja calculados."
Botao: "Carregar Dados da Plataforma"

Info de dados disponiveis:
"X pontos, Y trechos, Z itens de custo, W materiais"
```

**Opcao 2 - Importar arquivo externo:**
```
Dropdown com:
- Tipo: Planilha (CSV, XLSX) | CAD (DWG, DXF) | GIS (SHP, GeoJSON) | BIM (IFC)
- Input de arquivo
```

---

## 4.2 Mapa Interativo dos Trechos (IMPORTANTE!)

**Apos carregar dados, mostrar mapa com os trechos importados:**

```
Card com titulo: "Visualizacao da Rede"
Subtitulo: "Trechos carregados para planejamento"
```

**Mapa Leaflet mostrando:**
- Todos os trechos importados da topografia
- Pontos (PVs) como CircleMarkers
- Trechos como Polylines coloridas por tipo:
  - Verde = Gravidade
  - Laranja = Elevatoria
  - Azul = Agua (se houver)

**Interatividade:**
- Popup ao clicar no trecho com informacoes:
  - ID do trecho
  - Comprimento
  - Diametro
  - Profundidade estimada
- Highlight ao passar o mouse
- Zoom automatico para ajustar aos trechos

**Controles do mapa:**
- Botao "Ajustar Visualizacao" (fit bounds)
- Toggle para mostrar/ocultar pontos
- Toggle para mostrar/ocultar labels

**Resumo abaixo do mapa:**
```
"Carregados: X trechos | Y metros totais | Z pontos"
```

---

## 4.3 Toolbox - Associar Dados

**Collapsible/Accordion:**
```
Titulo: "Toolbox - Associar Dados"

Dados Disponiveis (badges):
- Topografia: X pontos
- CAD: Y elementos
- GIS: Z features
- BIM: W objetos

Tipo de Elemento: [Select]
- PVs (Pocos de Visita) - Esgoto
- PVs - Drenagem
- Conexoes/Nos - Agua
- Caixas de Inspecao
- Hidrantes
- Registros/Valvulas
- Reservatorios
- ETA/ETE

Fonte de Dados: [Select]
- Pontos Topograficos
- Elementos do CAD
- Features do GIS
- Objetos do BIM

Metodo de Associacao: [Select]
- Por Proximidade (X,Y)
- Por ID/Nome
- Por Layer/Camada
- Por Atributo

Tolerancia de Proximidade: [Input number] metros

Botao: "Executar Associacao"
```

---

## 4.4 Configuracao de Equipes

```
Numero de Equipes: [Input 1-10]

Composicao da Equipe Padrao:
| Encarregado [1] | Oficiais [2] | Ajudantes [4] | Operador [1] |

Equipamentos por Equipe:
[ ] Retroescavadeira
[ ] Compactador
[ ] Caminhao Basculante
[ ] Bomba de Esgotamento

Profundidade Maxima para Escavacao Manual: [1.25m]
(Acima disso, usa retroescavadeira obrigatoriamente)
```

---

## 4.5 Parametros de Produtividade

```
Metros por Dia (Base): [12] m/dia
(Produtividade em condicoes normais, prof < 1.5m, DN150)

Modo de Agrupamento do Gantt: [Select]
- Por Segmento Diario (mais detalhado)
- Por Trecho Completo (menos linhas)
- Por Trecho + Atividade

[ ] Agrupar Trechos por Proximidade
```

**Dica (card amarelo):**
```
Para ter menos linhas no Gantt e dias mais corridos:
- Aumente os "Metros por Dia" (ex: 15-20 m/dia)
- Selecione "Por Trecho Completo"
- Aumente o numero de equipes
```

---

## 4.6 Periodo de Execucao

```
Data de Inicio: [Date picker]
Data de Termino (Previsao): [Date picker]

Horas de Trabalho/Dia: [8]
Dias da Semana: [Select]
- Segunda a Sexta (5 dias)
- Segunda a Sabado (6 dias)
- Todos os dias (7 dias)

Dias uteis calculados: XX dias [Botao Recalcular]
```

---

## 4.7 Gestao de Feriados

```
Adicionar Feriado:
[Date] [Nome do feriado] [+ Adicionar]

Botoes:
- Carregar Feriados Nacionais (Brasil)
- Limpar Todos

Tabela de feriados:
| Data | Feriado | [X Remover] |
```

---

## 4.8 Tabela de Produtividade

```
Fonte: SINAPI/SEINFRA/TCPO

| Servico | Unidade | Produtividade/Dia | Fonte |
| Escavacao mecanizada | m3 | 40 | SINAPI |
| Escavacao manual | m3 | 8 | SINAPI |
| Assentamento tubo | m | 25 | TCPO |
| Reaterro compactado | m3 | 30 | SINAPI |
...

[+ Adicionar Servico]
```

---

## 4.9 Regras Tecnicas (Alertas)

```
Verificacoes automaticas (nao modificam os dados):
- Metodo de escavacao vs profundidade
- Necessidade de escoramento (prof + solo)
- Presenca de agua -> ativacao de drenagem
- Largura da vala vs diametro do tubo
- Sequencia logica de atividades

Lista de alertas com icones:
⚠️ Trecho T05: Profundidade 2.5m requer escoramento
⚠️ Trecho T08: Declividade negativa detectada
```

---

## 4.10 RESULTADOS DO PLANEJAMENTO (apos clicar "Gerar Cronograma")

### 4.10.1 Cards de Resumo (4 cards)

```
| Dias Uteis         | Data Inicio         | Data Termino        | Custo Total         |
| (azul)             | (verde)             | (roxo)              | (laranja)           |
| "45"               | "12/02/2026"        | "15/04/2026"        | "R$ 125.000,00"     |
```

### 4.10.2 Grafico de Gantt COMPLETO

**Estrutura:**
```
Header: [Trecho] [Metros] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] ...

Cada linha:
| T01 | 45m | [gradiente][gradiente][ ][ ][ ][ ][ ][ ][ ][ ] |
| T02 | 38m | [ ][ ][gradiente][gradiente][ ][ ][ ][ ][ ][ ] |
| T03 | 52m | [ ][ ][ ][ ][gradiente][gradiente][T][ ][ ][ ] |
```

**Celula com trabalho:**
- Background: linear-gradient(90deg, #f59e0b 0%, #f59e0b 33%, #3b82f6 33%, #3b82f6 66%, #22c55e 66%, #22c55e 100%)
- Representa: Escavacao (amarelo) -> Assentamento (azul) -> Reaterro (verde)
- Texto central: numero de metros (ex: "12")
- Border-radius: 4px

**Celula de teste hidrostatico:**
- Background: #ef4444 (vermelho)
- Texto: "T"

**Celula vazia:**
- Background: #f1f5f9
- Border: 1px dashed #e2e8f0

**Legenda:**
```
[Gradiente] Ciclo Completo (Escavacao -> Assentamento -> Reaterro)
[Vermelho] Teste Hidrostatico
Tag: "Regra: Vala fechada no mesmo dia (Same-Day Completion)"
```

### 4.10.3 Curva S (Grafico de Linha - Chart.js)

```
Eixo X: Dias (D1, D2, D3, D4, D5...)
Eixo Y: Progresso (0% a 100%)

Linha 1: Fisico Planejado (%)
- Cor: #3b82f6 (azul)
- Area preenchida com opacidade 0.1
- Tensao: 0.3 (curva suave)

Linha 2: Financeiro Planejado (%)
- Cor: #22c55e (verde)
- Area preenchida com opacidade 0.1

Titulo: "Curva S - Avanco Fisico-Financeiro"

Legenda:
- Azul = Fisico Previsto
- Verde = Financeiro Previsto
```

### 4.10.4 Histograma de Recursos (Grafico de Barras - Chart.js)

**Controles:**
```
Visao: [Diaria | Semanal | Mensal]
Recurso: [Todos | Mao de Obra | Equipamentos | Custo]
```

**Grafico:**
```
Eixo X: Dias/Semanas/Meses
Eixo Y: Quantidade

Barras Azuis: Mao de Obra (pessoas)
Barras Roxas: Equipamentos (unidades)
Linha Verde: Custo Acumulado
Linha Laranja Tracejada: Media
```

**Estatisticas (4 mini-cards):**
```
| Pico Mao de Obra | Media Diaria | Total HH | Equip. x Dias |
| "24 pessoas"     | "18 pessoas" | "1.200"  | "45 dias"     |
```

**Legenda:**
```
[Azul] Mao de Obra (pessoas)
[Roxo] Equipamentos (unid.)
[Linha Verde] Custo Acumulado
[Linha Laranja Tracejada] Media
```

### 4.10.5 Tabela de Plano Diario Detalhado

```
| Dia | Trecho | Atividade | Equipes | Producao | Mao de Obra | Equipamentos | Custo Dia (R$) |
| 1   | T01    | Escavacao | 2       | 12m      | 16          | 2            | R$ 4.500       |
| 1   | T01    | Assentam. | 2       | 12m      | 8           | 0            | R$ 2.200       |
| 1   | T01    | Reaterro  | 2       | 12m      | 12          | 2            | R$ 3.800       |
| 2   | T01    | Escavacao | 2       | 12m      | 16          | 2            | R$ 4.500       |
...
```

---

## 4.11 Botoes de Acao

```
[Gerar Planejamento] - Azul primario
[Exportar Planejamento] - Verde
[Carregar Demo] - Roxo
```

---

# MODULO 5: RDO

## 5.1 Header com Cards de Resumo

```
| Total de RDOs      | RDOs Hoje           |
| "23"               | "2"                 |
```

**Botoes:**
```
[+ Novo RDO] - Azul
[Dashboard] - Verde
[Lista de RDOs] - Secundario
[Mapa] - Teal
[Importar Planejamento] - Roxo
```

---

## 5.2 Dashboard RDO

### 5.2.1 Cards de Resumo (4 cards)

```
| Total Planejado (m) | Total Executado (m) | Restante (m)        | Progresso (%)       |
| "850"               | "320"               | "530"               | "37.6%"             |
```

### 5.2.2 Barras de Progresso por Sistema

```
Agua (#60a5fa):
[===================>                    ] 45% - 180m / 400m

Esgoto (#22c55e):
[======================>                 ] 52% - 130m / 250m

Drenagem (#f59e0b):
[=====>                                  ] 15% - 30m / 200m
```

### 5.2.3 Grafico 1 - Evolucao Semanal (Linha)

```
Linha Tracejada Azul: Planejado
Linha Solida Verde com Area: Executado

Eixo X: Semanas (S1, S2, S3...)
Eixo Y: Metros acumulados
```

### 5.2.4 Grafico 2 - Status dos Trechos (Donut)

```
Verde: Concluido (35%)
Laranja: Em Execucao (25%)
Vermelho: Nao Iniciado (40%)

Centro: "40 trechos"
```

### 5.2.5 EVM - Earned Value Management (Tabela)

```
| Metrica | Valor |
| BAC (Budget at Completion) | R$ 500.000 |
| PV (Planned Value) | R$ 200.000 |
| EV (Earned Value) | R$ 180.000 |
| AC (Actual Cost) | R$ 195.000 |
| SPI (Schedule Performance Index) | 0.90 |
| CPI (Cost Performance Index) | 0.92 |
| EAC (Estimate at Completion) | R$ 543.478 |
| VAC (Variance at Completion) | -R$ 43.478 |
```

---

## 5.3 Formulario Novo RDO

### 5.3.1 Secao 1 - Informacoes Gerais

```
Data do Relatorio: [Date picker]
Numero do RDO: [Auto-gerado]
Responsavel: [Input texto]
```

### 5.3.2 Secao 2 - Condicoes Climaticas

```
Manha: [Bom | Nublado | Chuva | Impraticavel]
Tarde: [Bom | Nublado | Chuva | Impraticavel]
Noite: [Bom | Nublado | Chuva | Impraticavel]
Temperatura: [Input number] C
```

### 5.3.3 Secao 3 - Efetivo e Equipamentos

```
Mao de Obra:
| Funcao | Quantidade |
| Encarregado | [Input] |
| Oficial | [Input] |
| Ajudante | [Input] |
| Operador | [Input] |

Equipamentos:
| Equipamento | Quantidade | Horas |
| Retroescavadeira | [Input] | [Input] |
| Compactador | [Input] | [Input] |
| Caminhao | [Input] | [Input] |
```

### 5.3.4 Secao 4 - Servicos Executados

```
[+ Adicionar Servico]

| Servico | Quantidade | Unidade | [X] |
| [Input texto] | [Input number] | [Select m/m2/m3/un] | [Remover] |
```

### 5.3.5 Secao 5 - Avanco por Trecho (Planejamento)

```
[+ Adicionar Trecho]

| Trecho | Planejado | Exec. Anterior | Exec. Hoje | Acumulado | [X] |
| [Input] | [Input] | [Input] | [Input] | [Calculado] | [Remover] |
```

### 5.3.6 Secao 6 - Georreferenciamento

```
Coordenadas: [Input] , [Input]
[Botao: Obter GPS]

Mapa pequeno mostrando localizacao
```

### 5.3.7 Secao 7 - Observacoes e Ocorrencias

```
Observacoes: [Textarea]
Ocorrencias: [Textarea com borda vermelha]
```

### 5.3.8 Botoes

```
[Cancelar] - Secundario
[Salvar Rascunho] - Laranja
[Gerar RDO] - Verde
```

---

## 5.4 Lista de RDOs

```
Filtros:
[Input busca] [Select status: Todos/Rascunho/Enviado/Aprovado/Rejeitado]

Tabela:
| Data | Servicos | Trechos | Status | Acoes |
| 12/02/2026 | 5 | 3 | [Badge status] | [Ver] [Excluir] |
```

---

## 5.5 Mapa RDO (Leaflet)

**Filtros:**
```
Sistema: [Todos | Agua | Esgoto | Drenagem]
Status: [Todos | Concluido | Em Execucao | Nao Iniciado]
```

**Trechos coloridos por status:**
- Verde (#22c55e) = Concluido - linha 6px
- Laranja (#f59e0b) = Em Execucao - linha 4px
- Vermelho (#ef4444) = Nao Iniciado - linha 2px

**Popup ao clicar:**
```html
<h4>Trecho T01</h4>
<p>Status: Em Execucao</p>
<p>Planejado: 45m</p>
<p>Executado: 28m</p>
<div class="progress-bar">62%</div>
<p>Ultimo RDO: 11/02/2026</p>
```

**Botoes:**
```
[Exportar Mapa como PNG]
[Exportar GeoJSON]
```

---

## 5.6 Detalhe do RDO

**Quando clicar em um RDO especifico:**
- Mostrar todas as informacoes
- Tabelas de servicos e trechos
- Mapa com localizacao
- Botoes de exportacao: PDF, Excel, JSON, SHP

---

# MODULO 6: RESULTADOS

## 6.1 Cards de Resumo Final (4 cards)

```
| Total Trechos      | Comprimento Total   | Dias de Obra        | Custo Estimado      |
| "40"               | "850m"              | "45 dias"           | "R$ 500.000,00"     |
```

## 6.2 Tabela de Resultados Detalhados

```
| Trecho | Comprimento | Diametro | Declividade | Tipo | Custo |
```

## 6.3 Graficos de Resumo

- Pizza: Distribuicao por tipo de rede
- Barras: Custo por categoria

## 6.4 Botoes de Exportacao

```
[Exportar Trechos CSV]
[Exportar Projeto JSON]
[Exportar Relatorio PDF]
[Exportar GeoJSON]
```

---

# DEPENDENCIAS

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "chart.js": "^4.4.0",
    "react-leaflet": "^4.2.1",
    "xlsx": "^0.18.5",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.8"
  }
}
```

**CSS obrigatorio:**
```typescript
import 'leaflet/dist/leaflet.css';
```

---

# ESTILO VISUAL

**Cores:**
- Azul: #3b82f6
- Verde: #22c55e
- Laranja: #f59e0b
- Roxo: #8b5cf6
- Vermelho: #ef4444
- Teal: #14b8a6

**Cards:**
- Background: white
- Border-radius: 12px
- Border: 1px solid #e2e8f0
- Shadow: 0 1px 3px rgba(0,0,0,0.1)

**Botoes:**
- Border-radius: 8px
- Padding: 10px 20px
- Font-weight: 500

---

# CODIGO TYPESCRIPT (src/engine/)

Usar os arquivos ja existentes:

```typescript
// Topografia
import { parseCSV, createSampleTopography, exportToCSV } from '../engine/reader';
import { createTrechosFromTopography, summarizeNetwork, trechosToRecords } from '../engine/domain';

// Planejamento
import { generateFullSchedule, generateCurveSData, generateHistogramData } from '../engine/planning';

// Orcamento
import { generateBudgetFromTrechos } from '../engine/budget';

// RDO
import { RDOEngine } from '../engine/rdo';
import { RDODashboard } from '../engine/dashboard';

// Materiais
import { MaterialsCatalog } from '../engine/materials';

// Peer Review
import { PeerReviewEngine } from '../engine/peer-review';
```

---

# PRIORIDADE DE IMPLEMENTACAO

1. **CRITICA**: Mapa interativo na Topografia (Leaflet)
2. **CRITICA**: Gantt + Curva S + Histograma no Planejamento (Chart.js)
3. **ALTA**: Dashboard RDO com graficos + EVM
4. **ALTA**: Mapa de progresso no RDO
5. **MEDIA**: Importacao CAD/BIM com mapeamento de camadas
6. **MEDIA**: Tabela de produtividade + Gestao de feriados
7. **BAIXA**: Formulario completo do RDO
8. **BAIXA**: Resultados com graficos

# Technical Writer - HydroNetwork/Lovable Edition

> Documento expandido com foco em documentacao tecnica para plataformas de engenharia sanitaria

**Data:** 2026-02-15
**Branch:** `claude/build-python-engine-bEGd9`
**Foco:** Documentacao tecnica, API references, guias de usuario
**Metodologia:** Analise de prompt + extensao para dominio de engenharia sanitaria

---

## Sumario Executivo

Este documento analisa e expande o prompt **Technical Writer** para o contexto do HydroNetwork, uma plataforma de engenharia sanitaria. A analise inclui:

- Avaliacao critica do prompt original
- Identificacao de gaps para dominio de engenharia
- Extensoes especificas para documentacao tecnica de GIS, hidraulica e orcamento
- Templates e exemplos praticos
- Integracoes com stack tecnologico (FastAPI, Supabase, Lovable)

| Aspecto | Avaliacao | Observacao |
|---------|-----------|------------|
| Clareza de Triggers | Alta | Triggers bem definidos e acionaveis |
| Foco em Audiencia | Excelente | "Write for your audience" como principio central |
| Acoes Praticas | Boa | 5 acoes claras, mas falta especificidade de dominio |
| Acessibilidade | Excelente | WCAG como requisito explicito |
| Limites (Boundaries) | Claros | Boa separacao de responsabilidades |

---

## Triggers

### Original
- API documentation and technical specification creation requests
- User guide and tutorial development needs for technical products
- Documentation improvement and accessibility enhancement requirements
- Technical content structuring and information architecture development

### HydroNetwork Especifico
- **Documentacao de API FastAPI**: Endpoints de calculo hidraulico, processamento topografico, exportacao GIS
- **Guias de usuario para engenheiros**: Tutoriais de importacao CSV/DXF, calculo de redes de esgoto
- **Especificacoes de integracao**: Conexao Supabase, deploy em Railway, webhooks
- **Documentacao de formatos de arquivo**: Estrutura de CSV topografico, parametros de exportacao SHP/GeoJSON
- **Manuais de campo**: Guias rapidos para uso em tablets durante levantamento topografico
- **Glossario tecnico**: Terminologia de engenharia sanitaria (PV, TIL, SINAPI, SICRO, greide)

---

## Behavioral Mindset

> Write for your audience, not for yourself. Prioritize clarity over completeness and always include working examples. Structure content for scanning and task completion, ensuring every piece of information serves the reader's goals.

### Analise Critica

**Pontos Fortes:**
- Foco explicito no leitor, nao no escritor
- Priorizacao de clareza sobre completude (evita documentacao verbosa)
- Enfase em exemplos funcionais (critical para APIs)
- Estrutura para scanning (engenheiros tem pouco tempo)

**Gap Identificado:**
O mindset original nao aborda:
- Documentacao multilingue (Portugal vs Brasil)
- Contexto de campo vs escritorio
- Diferentes niveis de expertise tecnica dentro do publico-alvo

### Extensao HydroNetwork

**Para engenharia sanitaria:** Engenheiros de campo precisam de documentacao que funcione offline, com prints de tela claros e procedimentos numerados. Engenheiros de escritorio precisam de referencias tecnicas completas com formulas e justificativas normativas (NBR 9649, NBR 12211).

```markdown
## Perfis de Usuario - HydroNetwork

| Perfil | Contexto | Necessidade | Formato Preferido |
|--------|----------|-------------|-------------------|
| Eng. Campo | Tablet, obra | Passos rapidos, offline | PDF, checklists |
| Eng. Projeto | Desktop, escritorio | Formulas, referencias | HTML, busca |
| Tecnico | Mobile, levantamento | Input de dados | Tooltips, videos |
| Gestor | Reuniao, relatorios | Visao geral, KPIs | Dashboards, resumos |
```

---

## Focus Areas

### Core (Original)

| Area | Descricao | Relevancia HydroNetwork |
|------|-----------|------------------------|
| **Audience Analysis** | Avaliacao de nivel, identificacao de objetivos | CRITICA - usuarios de Jr a Sr |
| **Content Structure** | Arquitetura de informacao, navegacao | ALTA - modulos complexos |
| **Clear Communication** | Linguagem clara, precisao tecnica | CRITICA - termos normativos |
| **Practical Examples** | Codigo funcional, procedimentos | ESSENCIAL - API docs |
| **Accessibility Design** | WCAG, screen readers, linguagem inclusiva | MEDIA - foco desktop |

### HydroNetwork Especifico

| Area | Descricao | Prioridade |
|------|-----------|------------|
| **Documentacao de API REST** | Endpoints FastAPI com exemplos curl/Python | CRITICA |
| **Glossario Normativo** | Termos NBR 9649, SINAPI, SICRO com definicoes | ALTA |
| **Diagramas de Fluxo** | Workflows de calculo, importacao, exportacao | ALTA |
| **Troubleshooting GIS** | Erros comuns de coordenadas, reprojecao | ALTA |
| **Versionamento de Docs** | Changelog de API, breaking changes | MEDIA |
| **Localizacao PT-BR** | Terminologia brasileira de engenharia | MEDIA |

---

## Key Actions

### Original
1. **Analyze Audience Needs**: Understand reader skill level and specific goals for effective targeting
2. **Structure Content Logically**: Organize information for optimal comprehension and task completion
3. **Write Clear Instructions**: Create step-by-step procedures with working examples and verification steps
4. **Ensure Accessibility**: Apply accessibility standards and inclusive design principles systematically
5. **Validate Usability**: Test documentation for task completion success and clarity verification

### HydroNetwork Especifico

6. **Documentar Endpoints API**: Criar referencias OpenAPI/Swagger com exemplos reais de payloads
7. **Mapear Fluxos de Usuario**: Diagramar jornadas completas (import CSV -> calcular -> exportar SHP)
8. **Incluir Validacoes de Campo**: Documentar limites, formatos aceitos, mensagens de erro
9. **Referenciar Normas**: Citar NBR, ABNT, SINAPI com links quando aplicavel
10. **Criar Quick Reference Cards**: Resumos de 1 pagina para uso em campo
11. **Manter Changelog**: Registrar mudancas de API com impacto em integradores

---

## Templates de Documentacao

### Template 1: Endpoint API

```markdown
## POST /api/topografia/calcular

Calcula cotas e declividades a partir de pontos topograficos.

### Request

**Headers:**
| Header | Valor | Obrigatorio |
|--------|-------|-------------|
| Authorization | Bearer {token} | Sim |
| Content-Type | application/json | Sim |

**Body:**
\`\`\`json
{
  "pontos": [
    {"id": "P1", "x": 321456.78, "y": 7654321.00, "z": 125.50},
    {"id": "P2", "x": 321478.90, "y": 7654345.00, "z": 124.80}
  ],
  "sistema_coordenadas": "UTM23S",
  "calcular_greide": true
}
\`\`\`

### Response

**200 OK:**
\`\`\`json
{
  "trechos": [
    {
      "de": "P1",
      "para": "P2",
      "distancia_m": 32.45,
      "declividade_percent": 2.16,
      "cota_montante": 125.50,
      "cota_jusante": 124.80
    }
  ],
  "warnings": []
}
\`\`\`

**400 Bad Request:**
\`\`\`json
{
  "error": "COORDENADAS_INVALIDAS",
  "message": "Ponto P2 fora dos limites UTM zona 23S",
  "details": {"ponto": "P2", "x": 321478.90}
}
\`\`\`

### Exemplo cURL

\`\`\`bash
curl -X POST https://api.hydronetwork.com/api/topografia/calcular \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"pontos": [...], "sistema_coordenadas": "UTM23S"}'
\`\`\`

### Exemplo Python

\`\`\`python
import requests

response = requests.post(
    "https://api.hydronetwork.com/api/topografia/calcular",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "pontos": pontos_lista,
        "sistema_coordenadas": "UTM23S",
        "calcular_greide": True
    }
)
resultado = response.json()
\`\`\`

### Erros Comuns

| Codigo | Erro | Solucao |
|--------|------|---------|
| 400 | COORDENADAS_INVALIDAS | Verificar se coordenadas estao no sistema correto |
| 401 | TOKEN_EXPIRADO | Renovar token de autenticacao |
| 422 | PONTOS_INSUFICIENTES | Enviar no minimo 2 pontos |
```

### Template 2: Guia de Usuario

```markdown
# Importando Dados Topograficos

Este guia explica como importar pontos topograficos de um arquivo CSV para o HydroNetwork.

## Pre-requisitos

- [ ] Arquivo CSV com colunas: ID, X, Y, Z (ou Cota)
- [ ] Coordenadas no sistema UTM (zonas 21S a 24S) ou WGS84
- [ ] Conta ativa no HydroNetwork (DEMO ou PRO)

## Passo a Passo

### 1. Preparar o Arquivo CSV

Seu arquivo deve seguir este formato:

\`\`\`csv
ID,X,Y,Z
P1,321456.78,7654321.00,125.50
P2,321478.90,7654345.00,124.80
PV1,321490.00,7654360.00,124.20
\`\`\`

> **Nota:** Use ponto (.) como separador decimal, nao virgula.

### 2. Acessar a Tela de Importacao

1. No menu lateral, clique em **Topografia**
2. Clique no botao **Importar CSV**
3. Arraste o arquivo ou clique para selecionar

![Tela de importacao CSV](../assets/docs/import-csv-screen.png)

### 3. Mapear Colunas

O sistema detectara automaticamente as colunas. Verifique se o mapeamento esta correto:

| Coluna no CSV | Campo HydroNetwork |
|---------------|-------------------|
| ID | Identificador do Ponto |
| X | Coordenada Este (E) |
| Y | Coordenada Norte (N) |
| Z | Cota (metros) |

### 4. Selecionar Sistema de Coordenadas

Escolha o sistema usado no levantamento:

- **UTM Zona 21S** - Oeste do Brasil (MT, MS, RO)
- **UTM Zona 22S** - Centro-Oeste (GO, DF, MG oeste)
- **UTM Zona 23S** - Sudeste (SP, MG, RJ, ES)
- **UTM Zona 24S** - Leste (BA, SE, AL, PE)

### 5. Validar e Importar

1. Clique em **Validar Dados**
2. Corrija erros indicados em vermelho
3. Clique em **Confirmar Importacao**

## Verificacao

Apos importar, verifique se os pontos aparecem corretamente:

- [ ] Todos os pontos visiveis no mapa
- [ ] Cotas dentro do esperado para a regiao
- [ ] Sem pontos duplicados

## Problemas Comuns

### "Coordenadas fora dos limites"

**Causa:** Sistema de coordenadas incorreto ou dados em graus decimais.

**Solucao:** Verifique se o sistema selecionado corresponde ao do levantamento. Coordenadas UTM tem valores como 321456.78 (E) e 7654321.00 (N). Coordenadas em graus decimais sao como -23.5505 e -46.6333.

### "Arquivo nao reconhecido"

**Causa:** Delimitador incorreto ou encoding do arquivo.

**Solucao:** Abra o CSV no Notepad e verifique se usa virgula (,) ou ponto-e-virgula (;) como separador. Salve como UTF-8.
```

### Template 3: Troubleshooting Guide

```markdown
# Troubleshooting: Erros de Coordenadas GIS

## Sintomas

- Pontos aparecem no lugar errado no mapa
- Mensagem "Coordenadas fora dos limites do Brasil"
- Exportacao SHP gera arquivo vazio

## Diagnostico Rapido

### 1. Identificar Sistema de Coordenadas

Execute no console do navegador (F12):

\`\`\`javascript
console.log(project.coordinateSystem);
// Esperado: "UTM23S", "WGS84", ou "SIRGAS2000"
\`\`\`

### 2. Verificar Valores Tipicos

| Sistema | Coordenada X/E | Coordenada Y/N |
|---------|---------------|----------------|
| UTM 23S | 100.000 - 900.000 | 7.000.000 - 8.000.000 |
| WGS84 | -73 a -34 (longitude) | -33 a 5 (latitude) |
| SIRGAS2000 | Similar ao WGS84 | Similar ao WGS84 |

### 3. Verificar Origem dos Dados

- GPS Garmin/Trimble: Geralmente WGS84
- Estacao Total: Geralmente UTM local
- DXF de AutoCAD: Verificar propriedades do desenho

## Solucoes por Erro

### Erro: "EPSG nao suportado"

\`\`\`
Erro: EPSG:31983 nao suportado
\`\`\`

**Causa:** Codigo EPSG nao reconhecido pelo sistema.

**Solucao:**
1. Converta para UTM ou WGS84 antes de importar
2. Use QGIS: Camada > Salvar Como > CRS: EPSG:32723 (UTM 23S)

### Erro: "Pontos espelhados"

**Causa:** Eixos X/Y invertidos (comum em DXF).

**Solucao:**
\`\`\`python
# No processamento, inverter eixos
df['X'], df['Y'] = df['Y'], df['X']
\`\`\`

### Erro: "Declividade impossivel (> 100%)"

**Causa:** Cotas em centimetros em vez de metros.

**Solucao:**
\`\`\`python
# Converter centimetros para metros
df['Z'] = df['Z'] / 100
\`\`\`

## Contato Suporte

Se o problema persistir:
1. Exporte o projeto como JSON (Configuracoes > Exportar Projeto)
2. Envie para suporte@hydronetwork.com com descricao do erro
```

---

## Outputs

### Original
- **API Documentation**: Comprehensive references with working examples and integration guidance
- **User Guides**: Step-by-step tutorials with appropriate complexity and helpful context
- **Technical Specifications**: Clear system documentation with architecture details and implementation guidance
- **Troubleshooting Guides**: Problem resolution documentation with common issues and solution paths
- **Installation Documentation**: Setup procedures with verification steps and environment configuration

### HydroNetwork Especifico

| Output | Descricao | Formato |
|--------|-----------|---------|
| **OpenAPI Spec** | Documentacao Swagger/ReDoc do FastAPI | YAML/JSON |
| **Guia de Integracao Supabase** | Auth, RLS, Storage para Lovable | Markdown + codigo |
| **Manual de Campo** | Quick reference para tablets | PDF A5 |
| **Glossario SINAPI/SICRO** | Termos de orcamentacao | Tabela pesquisavel |
| **Changelog API** | Breaking changes, deprecations | CHANGELOG.md |
| **Diagramas de Fluxo** | Workflows visuais | Mermaid/SVG |
| **Videos Tutoriais** | Screencasts de features complexas | MP4/YouTube |
| **Tooltips Contextuais** | Microcopy para UI Lovable | JSON i18n |

---

## Arquitetura de Documentacao Proposta

```
docs/
├── api/
│   ├── openapi.yaml           # Spec OpenAPI 3.0
│   ├── endpoints/
│   │   ├── topografia.md
│   │   ├── orcamento.md
│   │   ├── hidraulica.md
│   │   └── exportacao.md
│   └── authentication.md
├── guias/
│   ├── inicio-rapido.md       # Primeiro projeto em 10 min
│   ├── importacao-dados.md
│   ├── calculo-rede.md
│   ├── exportacao-gis.md
│   └── troubleshooting.md
├── referencias/
│   ├── glossario.md           # Termos tecnicos
│   ├── normas-abnt.md         # Referencias NBR
│   ├── formulas.md            # Equacoes hidraulicas
│   └── limites-sistema.md     # Restricoes DEMO vs PRO
├── integracao/
│   ├── supabase.md
│   ├── railway.md
│   └── lovable.md
├── campo/
│   ├── quick-reference.pdf
│   └── checklists/
│       ├── levantamento.pdf
│       └── verificacao.pdf
└── changelog/
    ├── CHANGELOG.md
    └── migration-guides/
```

---

## Accessibility Standards para Documentacao

### Checklist WCAG 2.1 AA

```markdown
## Estrutura
- [x] Headings hierarquicos (H1 > H2 > H3)
- [x] Listas para itens relacionados
- [x] Tabelas com headers (<th scope="col">)
- [x] Skip links para navegacao longa

## Texto
- [x] Linguagem clara (nivel leitura 8a serie)
- [x] Abreviacoes expandidas na primeira ocorrencia
- [x] Termos tecnicos linkados ao glossario
- [x] Contraste minimo 4.5:1

## Imagens
- [x] Alt text descritivo para screenshots
- [x] Texto alternativo para diagramas complexos
- [x] Captions para contexto adicional
- [x] Nao depender apenas de cor para informacao

## Codigo
- [x] Syntax highlighting com contraste adequado
- [x] Exemplos copiaveis (botao copy)
- [x] Comentarios explicativos em exemplos longos
- [x] Versoes alternativas (curl, Python, JavaScript)

## Navegacao
- [x] TOC (Table of Contents) no inicio
- [x] Breadcrumbs para localizacao
- [x] Links para secoes relacionadas
- [x] Busca funcional com resultados claros
```

---

## Boundaries

### Will
- Create comprehensive technical documentation with appropriate audience targeting and practical examples
- Write clear API references and user guides with accessibility standards and usability focus
- Structure content for optimal comprehension and successful task completion
- **Documentar endpoints FastAPI com exemplos curl/Python funcionais**
- **Criar guias de usuario para fluxos de engenharia (import, calculo, export)**
- **Manter glossario de termos tecnicos (SINAPI, NBR, hidraulica)**
- **Produzir quick reference cards para uso em campo**
- **Documentar troubleshooting de erros comuns de GIS**

### Will Not
- Implement application features or write production code beyond documentation examples
- Make architectural decisions or design user interfaces outside documentation scope
- Create marketing content or non-technical communications
- **Desenvolver codigo de producao para HydroNetwork**
- **Decidir arquitetura de backend ou frontend**
- **Escrever copy de marketing ou landing pages**
- **Realizar calculos hidraulicos ou topograficos**
- **Auditar codigo de seguranca**

---

## Metricas de Qualidade de Documentacao

| Metrica | Target | Medicao |
|---------|--------|---------|
| Time to First Success | < 10 min | Tempo para completar tutorial inicial |
| Search Success Rate | > 80% | Usuarios encontram resposta na busca |
| Task Completion Rate | > 90% | Usuarios completam procedimentos |
| Support Ticket Reduction | -30% | Tickets sobre features documentadas |
| NPS Documentacao | > 50 | Pesquisa de satisfacao |
| Freshness | < 30 dias | Tempo desde ultima revisao |

---

## Integracao com Stack HydroNetwork

### Documentacao FastAPI (Auto-gerada)

```python
# main.py - Docstrings que viram documentacao
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

class PontoTopografico(BaseModel):
    """Representa um ponto de levantamento topografico.

    Attributes:
        id: Identificador unico do ponto (ex: P1, PV1)
        x: Coordenada Este em metros (sistema UTM)
        y: Coordenada Norte em metros (sistema UTM)
        z: Cota/elevacao em metros
    """
    id: str = Field(..., example="P1", description="Identificador do ponto")
    x: float = Field(..., example=321456.78, description="Coordenada E (metros)")
    y: float = Field(..., example=7654321.00, description="Coordenada N (metros)")
    z: float = Field(..., example=125.50, description="Cota em metros")

@app.post("/api/topografia/calcular",
          summary="Calcular greide e declividades",
          description="""
          Processa lista de pontos topograficos e calcula:
          - Distancias entre pontos consecutivos
          - Declividades em percentual
          - Cotas de montante e jusante

          **Limites:**
          - DEMO: maximo 10 pontos
          - PRO: sem limite
          """,
          response_description="Trechos calculados com metricas")
async def calcular_topografia(pontos: List[PontoTopografico]):
    ...
```

### Tooltips para Lovable UI

```typescript
// tooltips.ts - Microcopy para componentes
export const tooltips = {
  topografia: {
    coordenadaX: "Coordenada Este (E) no sistema UTM. Valores tipicos: 100.000 a 900.000",
    coordenadaY: "Coordenada Norte (N) no sistema UTM. Valores tipicos: 7.000.000 a 8.000.000",
    cota: "Elevacao do terreno em metros. Obtida por levantamento topografico ou GPS",
    sistemaCoord: "Sistema de referencia das coordenadas. UTM e o mais comum em engenharia",
  },
  orcamento: {
    codigoSinapi: "Codigo de 5 digitos da tabela SINAPI/Caixa. Ex: 72897",
    bdi: "Bonificacao e Despesas Indiretas. Percentual sobre custo direto (tipico: 25-30%)",
  },
  hidraulica: {
    manning: "Coeficiente de rugosidade de Manning. PVC: 0.010, Concreto: 0.013",
    declividade: "Inclinacao da tubulacao em m/m ou %. Minimo NBR 9649: 0.5%",
  }
};

// Uso no componente
<Input
  label="Coordenada X (E)"
  tooltip={tooltips.topografia.coordenadaX}
/>
```

---

## Proximos Passos Recomendados

### Prioridade Alta
1. [ ] Criar OpenAPI spec completo para endpoints existentes
2. [ ] Documentar fluxo de importacao CSV (guia mais solicitado)
3. [ ] Montar glossario SINAPI/SICRO com 50 termos mais usados
4. [ ] Produzir quick reference card para levantamento topografico

### Prioridade Media
5. [ ] Gravar video tutorial de primeiro projeto
6. [ ] Criar troubleshooting guide para erros de coordenadas
7. [ ] Documentar integracao Supabase para desenvolvedores
8. [ ] Implementar busca na documentacao

### Prioridade Baixa
9. [ ] Traduzir documentacao para ingles (mercado internacional)
10. [ ] Criar versao PDF offline de todos os guias
11. [ ] Implementar feedback loop (foi util? sim/nao)

---

## Conclusao

O prompt **Technical Writer** fornece uma base solida para documentacao tecnica, com enfase correta em:
- Foco no usuario (nao no escritor)
- Clareza sobre completude
- Exemplos funcionais
- Acessibilidade

Para o contexto **HydroNetwork**, as extensoes criticas sao:
1. Templates especificos para API REST de engenharia
2. Glossario normativo (NBR, SINAPI, SICRO)
3. Documentacao offline para uso em campo
4. Troubleshooting de erros GIS comuns
5. Integracao com auto-documentacao do FastAPI

A implementacao dessas extensoes reduzira tickets de suporte e acelerara a adocao da plataforma por novos usuarios.

# Arquitetura Completa: Lovable + Supabase + Railway + GitHub + VS Code + Claude Code

## Visao Geral da Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USUARIO FINAL                                       │
│                         (Navegador Web / Mobile)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOVABLE (Frontend)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ React + TS  │  │   Shadcn    │  │   Leaflet   │  │      Chart.js           │ │
│  │    Pages    │  │     UI      │  │    Mapas    │  │      Graficos           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                    Supabase Client (Auth + Realtime)                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
          │                              │                           │
          ▼                              ▼                           ▼
┌──────────────────┐        ┌──────────────────────┐      ┌──────────────────────┐
│    SUPABASE      │        │   RAILWAY / RENDER   │      │      SUPABASE        │
│   (Auth + DB)    │        │   (Motor Python)     │      │     (Storage)        │
│                  │        │                      │      │                      │
│ - Autenticacao   │        │ - FastAPI Server     │      │ - Arquivos CSV       │
│ - PostgreSQL     │        │ - Calculos GIS       │      │ - Arquivos DXF       │
│ - Row Level Sec  │        │ - GeoPandas          │      │ - Shapefiles         │
│ - Realtime       │        │ - EPANET             │      │ - GeoPackages        │
└──────────────────┘        └──────────────────────┘      └──────────────────────┘
          │                              │                           │
          └──────────────────────────────┼───────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
          ┌──────────────────┐                    ┌──────────────────┐
          │      GITHUB      │                    │     VS CODE      │
          │  (Repositorio)   │                    │ (Desenvolvimento)│
          │                  │◄──────────────────►│                  │
          │ - Codigo fonte   │                    │ - Editar codigo  │
          │ - CI/CD Actions  │                    │ - Debug local    │
          │ - Versionamento  │                    │ - Terminal       │
          └──────────────────┘                    └──────────────────┘
                    │                                         │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────┐
                            │   CLAUDE CODE    │
                            │  (Assistente AI) │
                            │                  │
                            │ - Gerar codigo   │
                            │ - Debug          │
                            │ - Refatorar      │
                            │ - Documentar     │
                            └──────────────────┘
```

---

## 1. LOVABLE - Frontend Completo

### O que vai na Lovable

A Lovable sera responsavel por **toda a interface do usuario** - desde a landing page ate os dashboards complexos.

### Paginas a Criar

```
/                           → Landing Page (marketing)
/hub                        → Hub de Noticias
/login                      → Autenticacao (Supabase Auth)
/registro                   → Cadastro de usuarios
/app                        → Dashboard principal
/app/topografia             → Modulo de Topografia
/app/orcamento              → Modulo de Orcamento
/app/planejamento           → Modulo de Planejamento
/app/rdo                    → Modulo RDO
/app/resultados             → Resultados e Exportacao
/app/configuracoes          → Configuracoes do usuario
```

### Componentes React (Shadcn UI)

```typescript
// Estrutura de pastas no Lovable
src/
├── components/
│   ├── ui/                    # Shadcn components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   └── toast.tsx
│   │
│   ├── topografia/
│   │   ├── FileUploader.tsx        # Drag-drop de arquivos
│   │   ├── DataTable.tsx           # Tabela editavel de pontos
│   │   ├── MapViewer.tsx           # Mapa Leaflet interativo
│   │   └── ImportPreview.tsx       # Preview de dados importados
│   │
│   ├── orcamento/
│   │   ├── CostTable.tsx           # Tabela de custos unitarios
│   │   ├── BudgetSummary.tsx       # Cards de resumo
│   │   ├── CostChart.tsx           # Grafico de custos por categoria
│   │   └── ExportButton.tsx        # Exportar para Excel
│   │
│   ├── planejamento/
│   │   ├── GanttChart.tsx          # Cronograma Gantt
│   │   ├── ResourceTable.tsx       # Equipes e equipamentos
│   │   ├── MaterialSchedule.tsx    # Cronograma de materiais
│   │   ├── ABCChart.tsx            # Curva ABC/Pareto
│   │   └── ProgressMap.tsx         # Mapa de progresso
│   │
│   ├── rdo/
│   │   ├── DailyForm.tsx           # Formulario de RDO
│   │   ├── ServiceCatalog.tsx      # Catalogo de servicos
│   │   ├── ProgressDashboard.tsx   # Dashboard EVM
│   │   ├── CurveSChart.tsx         # Curva S
│   │   └── PhotoUpload.tsx         # Upload de fotos
│   │
│   └── shared/
│       ├── Navbar.tsx              # Navegacao principal
│       ├── Sidebar.tsx             # Menu lateral
│       ├── LoadingSpinner.tsx      # Estados de loading
│       └── ErrorBoundary.tsx       # Tratamento de erros
│
├── pages/
│   ├── Index.tsx                   # Landing page
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Topografia.tsx
│   ├── Orcamento.tsx
│   ├── Planejamento.tsx
│   ├── RDO.tsx
│   └── Resultados.tsx
│
├── hooks/
│   ├── useAuth.ts                  # Hook de autenticacao
│   ├── useProject.ts               # Hook de projeto atual
│   ├── usePythonAPI.ts             # Hook para chamar Railway
│   └── useRealtime.ts              # Hook para Supabase Realtime
│
├── lib/
│   ├── supabase.ts                 # Cliente Supabase
│   ├── api.ts                      # Cliente para Railway API
│   └── utils.ts                    # Funcoes utilitarias
│
└── types/
    ├── topografia.ts               # Tipos de topografia
    ├── orcamento.ts                # Tipos de orcamento
    ├── planejamento.ts             # Tipos de planejamento
    └── rdo.ts                      # Tipos de RDO
```

### Integracao com Supabase (no Lovable)

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Hook de autenticacao
export function useAuth() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, supabase }
}
```

### Integracao com Railway API (no Lovable)

```typescript
// src/lib/api.ts
const RAILWAY_API_URL = import.meta.env.VITE_RAILWAY_API_URL

export async function callPythonAPI(endpoint: string, data: any) {
  const response = await fetch(`${RAILWAY_API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}

// Exemplo de uso
export async function processTopografia(pontos: PontoTopografico[]) {
  return callPythonAPI('/api/topografia/process', { pontos })
}

export async function calculateOrcamento(trechos: Trecho[]) {
  return callPythonAPI('/api/orcamento/calculate', { trechos })
}

export async function generatePlanejamento(trechos: Trecho[], config: PlanConfig) {
  return callPythonAPI('/api/planejamento/generate', { trechos, config })
}

export async function exportShapefile(projeto: Projeto) {
  return callPythonAPI('/api/gis/export/shapefile', { projeto })
}
```

### Variaveis de Ambiente (Lovable)

```env
# .env no Lovable
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_RAILWAY_API_URL=https://hydronetwork-api.up.railway.app
```

---

## 2. SUPABASE - Backend as a Service

### O que vai no Supabase

O Supabase sera responsavel por:
- **Autenticacao** de usuarios
- **Banco de dados** PostgreSQL
- **Storage** de arquivos
- **Realtime** para colaboracao

### Estrutura do Banco de Dados

```sql
-- =====================================================
-- SCHEMA: AUTENTICACAO E USUARIOS
-- =====================================================

-- Perfis de usuario (extende auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  empresa TEXT,
  cargo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planos de assinatura
CREATE TABLE public.planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,               -- 'free', 'pro', 'enterprise'
  limite_projetos INTEGER NOT NULL,
  limite_storage_mb INTEGER NOT NULL,
  preco_mensal DECIMAL(10,2),
  features JSONB
);

-- Assinaturas dos usuarios
CREATE TABLE public.assinaturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id),
  status TEXT DEFAULT 'active',      -- 'active', 'cancelled', 'expired'
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  stripe_subscription_id TEXT
);

-- =====================================================
-- SCHEMA: PROJETOS
-- =====================================================

-- Projetos de saneamento
CREATE TABLE public.projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,                -- 'esgoto', 'agua', 'drenagem'
  municipio TEXT,
  estado TEXT,
  status TEXT DEFAULT 'rascunho',    -- 'rascunho', 'em_andamento', 'concluido'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SCHEMA: TOPOGRAFIA
-- =====================================================

-- Pontos topograficos
CREATE TABLE public.pontos_topograficos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  ponto_id TEXT NOT NULL,            -- 'P1', 'P2', etc.
  x DECIMAL(15,6) NOT NULL,          -- Coordenada Este
  y DECIMAL(15,6) NOT NULL,          -- Coordenada Norte
  cota DECIMAL(10,4) NOT NULL,       -- Elevacao
  descricao TEXT,
  ordem INTEGER,                      -- Ordem na rede
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trechos da rede
CREATE TABLE public.trechos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  ponto_inicial_id UUID REFERENCES public.pontos_topograficos(id),
  ponto_final_id UUID REFERENCES public.pontos_topograficos(id),
  comprimento DECIMAL(10,4),         -- metros
  declividade DECIMAL(8,6),          -- percentual
  tipo TEXT NOT NULL,                -- 'gravidade', 'elevatoria'
  diametro_mm INTEGER DEFAULT 150,
  material TEXT DEFAULT 'PVC',
  profundidade_inicial DECIMAL(6,3),
  profundidade_final DECIMAL(6,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SCHEMA: ORCAMENTO
-- =====================================================

-- Base de custos (catalogo)
CREATE TABLE public.base_custos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),  -- NULL = catalogo padrao
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,             -- 'm', 'm2', 'm3', 'un', 'vb'
  custo_unitario DECIMAL(12,4) NOT NULL,
  categoria TEXT NOT NULL,           -- 'escavacao', 'tubulacao', 'poco', etc.
  fonte TEXT,                        -- 'SINAPI', 'SICRO', 'Proprio'
  data_referencia DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens de orcamento do projeto
CREATE TABLE public.orcamento_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  trecho_id UUID REFERENCES public.trechos(id),
  base_custo_id UUID REFERENCES public.base_custos(id),
  quantidade DECIMAL(12,4) NOT NULL,
  custo_total DECIMAL(14,4) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SCHEMA: PLANEJAMENTO
-- =====================================================

-- Configuracao de planejamento
CREATE TABLE public.planejamento_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  metros_por_dia DECIMAL(6,2) DEFAULT 50,
  horas_por_dia INTEGER DEFAULT 8,
  dias_por_semana INTEGER DEFAULT 5,
  data_inicio DATE,
  equipes JSONB,                     -- [{nome, encarregado, oficiais, ajudantes}]
  equipamentos JSONB,                -- [{tipo, quantidade, custo_hora}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dias de obra planejados
CREATE TABLE public.planejamento_dias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  dia_numero INTEGER NOT NULL,
  data DATE NOT NULL,
  trechos_ids UUID[],                -- Array de trechos do dia
  metros_planejados DECIMAL(10,2),
  status TEXT DEFAULT 'pendente',    -- 'pendente', 'em_andamento', 'concluido'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cronograma de materiais
CREATE TABLE public.planejamento_materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade DECIMAL(12,4) NOT NULL,
  unidade TEXT NOT NULL,
  lead_time_dias INTEGER DEFAULT 7,
  data_pedido DATE,
  data_entrega DATE,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SCHEMA: RDO (Relatorio Diario de Obra)
-- =====================================================

-- RDOs
CREATE TABLE public.rdos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  clima TEXT,                        -- 'ensolarado', 'nublado', 'chuvoso'
  temperatura_min INTEGER,
  temperatura_max INTEGER,
  horario_inicio TIME,
  horario_fim TIME,
  observacoes TEXT,
  status TEXT DEFAULT 'rascunho',    -- 'rascunho', 'finalizado', 'aprovado'
  aprovado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servicos executados no RDO
CREATE TABLE public.rdo_servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE,
  trecho_id UUID REFERENCES public.trechos(id),
  servico TEXT NOT NULL,             -- 'escavacao', 'assentamento', etc.
  quantidade DECIMAL(10,4) NOT NULL,
  unidade TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipe presente no dia
CREATE TABLE public.rdo_equipe (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  funcao TEXT NOT NULL,
  horario_entrada TIME,
  horario_saida TIME,
  horas_trabalhadas DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ocorrencias
CREATE TABLE public.rdo_ocorrencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                -- 'acidente', 'atraso', 'clima', 'material'
  descricao TEXT NOT NULL,
  impacto TEXT,
  acao_tomada TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SCHEMA: ARQUIVOS
-- =====================================================

-- Metadados de arquivos
CREATE TABLE public.arquivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,                -- 'csv', 'xlsx', 'dxf', 'shp', 'gpkg', 'foto'
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,        -- Path no Supabase Storage
  processado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos_topograficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

-- Politicas: usuarios so veem seus proprios dados
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own projects"
  ON public.projetos FOR ALL
  USING (auth.uid() = user_id);

-- (Adicionar politicas similares para outras tabelas)

-- =====================================================
-- FUNCOES E TRIGGERS
-- =====================================================

-- Funcao para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funcao para criar perfil automaticamente apos signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'));
  RETURN NEW;
END;
$$ language 'plpgsql' security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Storage Buckets

```sql
-- Criar buckets no Supabase Storage

-- Bucket para uploads de topografia (CSV, XLSX, DXF)
INSERT INTO storage.buckets (id, name, public)
VALUES ('topografia', 'topografia', false);

-- Bucket para arquivos GIS exportados (SHP, GPKG)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false);

-- Bucket para fotos de RDO
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-rdo', 'fotos-rdo', false);

-- Politicas de acesso
CREATE POLICY "Users can upload to topografia"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'topografia' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own topografia files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'topografia' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Realtime (Colaboracao)

```typescript
// Habilitar realtime em tabelas especificas
// No Supabase Dashboard: Database > Replication > Enable for tables

// No Lovable - escutar mudancas em tempo real
const channel = supabase
  .channel('projeto-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'trechos',
      filter: `projeto_id=eq.${projetoId}`
    },
    (payload) => {
      console.log('Trecho atualizado:', payload)
      // Atualizar UI automaticamente
    }
  )
  .subscribe()
```

---

## 3. RAILWAY / RENDER - Motor Python

### O que vai no Railway/Render

O Railway (ou Render) hospedara o **Motor Python** com todos os calculos pesados:
- Processamento GIS (GeoPandas, Shapely)
- Calculos hidraulicos (EPANET)
- Geracao de Shapefiles e GeoPackages
- Processamento de arquivos DXF/DWG
- Calculos complexos de orcamento e planejamento

### Estrutura da API FastAPI

```python
# api/main.py

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os

app = FastAPI(
    title="HydroNetwork Engine API",
    description="Motor de calculos para engenharia de saneamento",
    version="2.0.0"
)

# CORS para permitir Lovable
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://seu-projeto.lovable.app",
        "http://localhost:5173"  # Dev local
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# MODELOS PYDANTIC
# =====================================================

class PontoTopografico(BaseModel):
    id: str
    x: float
    y: float
    cota: float
    descricao: Optional[str] = None

class Trecho(BaseModel):
    id: str
    ponto_inicial: PontoTopografico
    ponto_final: PontoTopografico
    comprimento: float
    declividade: float
    tipo: str  # 'gravidade' ou 'elevatoria'
    diametro_mm: int = 150
    material: str = 'PVC'

class ProcessTopografiaRequest(BaseModel):
    pontos: List[PontoTopografico]
    auto_trechos: bool = True

class ProcessTopografiaResponse(BaseModel):
    pontos: List[PontoTopografico]
    trechos: List[Trecho]
    estatisticas: dict

class OrcamentoRequest(BaseModel):
    trechos: List[Trecho]
    base_custos_id: Optional[str] = None

class PlanejamentoRequest(BaseModel):
    trechos: List[Trecho]
    metros_por_dia: float = 50
    data_inicio: str
    equipes: List[dict]

class ExportGISRequest(BaseModel):
    projeto_id: str
    formato: str  # 'shapefile' ou 'geopackage'
    crs: str = 'EPSG:31983'

# =====================================================
# ENDPOINTS: TOPOGRAFIA
# =====================================================

@app.post("/api/topografia/process", response_model=ProcessTopografiaResponse)
async def process_topografia(request: ProcessTopografiaRequest):
    """
    Processa pontos topograficos e gera trechos automaticamente.
    """
    from src.engine.domain import create_trechos_from_topography
    from src.engine.geometry import calculate_statistics

    pontos = request.pontos
    trechos = []

    if request.auto_trechos:
        trechos = create_trechos_from_topography(pontos)

    estatisticas = calculate_statistics(pontos, trechos)

    return ProcessTopografiaResponse(
        pontos=pontos,
        trechos=trechos,
        estatisticas=estatisticas
    )

@app.post("/api/topografia/import/dxf")
async def import_dxf(file_url: str, layer_mapping: dict):
    """
    Importa arquivo DXF e extrai pontos topograficos.
    """
    from src.gis.importers.dxf_advanced import DXFAdvancedImporter

    importer = DXFAdvancedImporter()
    # Baixar arquivo do Supabase Storage
    # Processar com ezdxf
    # Retornar pontos
    pass

# =====================================================
# ENDPOINTS: ORCAMENTO
# =====================================================

@app.post("/api/orcamento/calculate")
async def calculate_orcamento(request: OrcamentoRequest):
    """
    Calcula orcamento completo baseado nos trechos.
    """
    from src.engine.budget import calculate_budget

    resultado = calculate_budget(
        trechos=request.trechos,
        base_custos_id=request.base_custos_id
    )

    return resultado

@app.post("/api/orcamento/export/excel")
async def export_orcamento_excel(projeto_id: str):
    """
    Exporta orcamento para Excel formatado.
    """
    from src.engine.budget import export_to_excel

    # Gerar Excel
    # Upload para Supabase Storage
    # Retornar URL
    pass

# =====================================================
# ENDPOINTS: PLANEJAMENTO
# =====================================================

@app.post("/api/planejamento/generate")
async def generate_planejamento(request: PlanejamentoRequest):
    """
    Gera cronograma de planejamento com Same-Day Rule.
    """
    from src.engine.planning import generate_schedule

    resultado = generate_schedule(
        trechos=request.trechos,
        metros_por_dia=request.metros_por_dia,
        data_inicio=request.data_inicio,
        equipes=request.equipes
    )

    return resultado

@app.post("/api/planejamento/materiais")
async def generate_material_schedule(projeto_id: str):
    """
    Gera cronograma de materiais com lead times.
    """
    from src.planning.materials import generate_material_schedule

    pass

@app.post("/api/planejamento/abc")
async def generate_abc_curve(projeto_id: str):
    """
    Gera curva ABC (Pareto) para materiais/custos.
    """
    from src.planning.materials import generate_abc_analysis

    pass

# =====================================================
# ENDPOINTS: GIS / EXPORTACAO
# =====================================================

@app.post("/api/gis/export/shapefile")
async def export_shapefile(request: ExportGISRequest):
    """
    Exporta projeto para Shapefile (11 camadas).
    """
    from src.gis.exporters.shp import ShapefileExporter

    exporter = ShapefileExporter()
    # Gerar shapefile
    # Compactar em ZIP
    # Upload para Supabase Storage
    # Retornar URL de download
    pass

@app.post("/api/gis/export/geopackage")
async def export_geopackage(request: ExportGISRequest):
    """
    Exporta projeto para GeoPackage.
    """
    from src.gis.exporters.geopackage import GeoPackageExporter

    pass

@app.post("/api/gis/reproject")
async def reproject_coordinates(pontos: List[dict], from_crs: str, to_crs: str):
    """
    Reprojeta coordenadas entre sistemas de referencia.
    """
    from src.gis.map_engine.coordinate_systems import reproject

    pass

# =====================================================
# ENDPOINTS: HIDRAULICA
# =====================================================

@app.post("/api/hydraulics/simulate")
async def simulate_network(projeto_id: str):
    """
    Simula rede hidraulica usando EPANET.
    """
    from src.hydraulics.epanet_wrapper import EPANETWrapper

    pass

# =====================================================
# ENDPOINTS: PEER REVIEW
# =====================================================

@app.post("/api/peer-review/analyze")
async def analyze_project(projeto_id: str):
    """
    Analisa projeto com regras ABNT e gera findings.
    """
    from src.peer_review.engine import PeerReviewEngine

    engine = PeerReviewEngine()
    # Carregar projeto
    # Executar regras
    # Retornar findings
    pass

# =====================================================
# HEALTH CHECK
# =====================================================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/")
async def root():
    return {"message": "HydroNetwork Engine API", "docs": "/docs"}
```

### Dockerfile (Railway/Render)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias do sistema para GIS
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo
COPY . .

# Expor porta
EXPOSE 8000

# Comando de inicio
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### railway.json (Configuracao)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "uvicorn api.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### render.yaml (Alternativa)

```yaml
services:
  - type: web
    name: hydronetwork-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn api.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

### Variaveis de Ambiente (Railway/Render)

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# CORS
ALLOWED_ORIGINS=https://seu-projeto.lovable.app

# Python
PYTHONUNBUFFERED=1

# GIS
GDAL_DATA=/usr/share/gdal
PROJ_LIB=/usr/share/proj
```

---

## 4. GITHUB - Repositorio e CI/CD

### O que vai no GitHub

- **Codigo fonte** completo (Lovable sincronizado + Motor Python)
- **GitHub Actions** para CI/CD
- **Issues** para tracking de bugs e features
- **Projects** para Kanban

### Estrutura do Repositorio

```
hydronetwork/
├── .github/
│   └── workflows/
│       ├── test.yml              # Testes automaticos
│       ├── deploy-railway.yml    # Deploy para Railway
│       └── lint.yml              # Linting
│
├── api/                          # Motor Python (Railway)
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── src/                          # Modulos Python
│   ├── core/
│   ├── engine/
│   ├── gis/
│   ├── planning/
│   ├── rdo/
│   ├── hydraulics/
│   └── peer_review/
│
├── web/                          # Frontend (sincronizado do Lovable)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── tests/                        # Testes unitarios
│   ├── test_topografia.py
│   ├── test_orcamento.py
│   └── test_planejamento.py
│
├── docs/                         # Documentacao
│   └── api.md
│
├── .gitignore
├── pyproject.toml
├── requirements.txt
└── README.md
```

### GitHub Actions - CI/CD

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-python:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run tests
        run: pytest tests/ --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml

  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install linters
        run: pip install ruff mypy

      - name: Run ruff
        run: ruff check src/

      - name: Run mypy
        run: mypy src/ --ignore-missing-imports
```

```yaml
# .github/workflows/deploy-railway.yml
name: Deploy to Railway

on:
  push:
    branches: [main]
    paths:
      - 'api/**'
      - 'src/**'
      - 'requirements.txt'
      - 'Dockerfile'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: hydronetwork-api
```

---

## 5. VS CODE - Ambiente de Desenvolvimento Local

### O que fazer no VS Code

- **Desenvolver** o Motor Python localmente
- **Testar** a API antes de deploy
- **Debug** de codigo complexo
- **Gerenciar** Git (commits, branches, PRs)

### Extensoes Recomendadas

```json
// .vscode/extensions.json
{
  "recommendations": [
    // Python
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.debugpy",

    // Formatacao
    "charliermarsh.ruff",
    "ms-python.black-formatter",

    // Git
    "eamodio.gitlens",
    "mhutchie.git-graph",

    // API
    "humao.rest-client",
    "rangav.vscode-thunder-client",

    // Docker
    "ms-azuretools.vscode-docker",

    // Outros
    "streetsidesoftware.code-spell-checker-portuguese-brazilian",
    "yzhang.markdown-all-in-one"
  ]
}
```

### Configuracoes do VS Code

```json
// .vscode/settings.json
{
  // Python
  "python.defaultInterpreterPath": ".venv/bin/python",
  "python.analysis.typeCheckingMode": "basic",

  // Formatacao
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true
  },

  // Linting
  "ruff.lint.enable": true,
  "ruff.format.enable": true,

  // Terminal
  "terminal.integrated.defaultProfile.linux": "bash",

  // Arquivos
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    ".pytest_cache": true,
    ".mypy_cache": true,
    ".ruff_cache": true
  }
}
```

### Launch Configurations (Debug)

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI Server",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["api.main:app", "--reload", "--port", "8000"],
      "jinja": true,
      "env": {
        "SUPABASE_URL": "${env:SUPABASE_URL}",
        "SUPABASE_SERVICE_KEY": "${env:SUPABASE_SERVICE_KEY}"
      }
    },
    {
      "name": "Run Tests",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["tests/", "-v"]
    },
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Workflow de Desenvolvimento Local

```bash
# 1. Clonar repositorio
git clone https://github.com/seu-usuario/hydronetwork.git
cd hydronetwork

# 2. Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 3. Instalar dependencias
pip install -r requirements.txt
pip install -e .  # Instalar em modo editavel

# 4. Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 5. Rodar servidor local
uvicorn api.main:app --reload --port 8000

# 6. Rodar testes
pytest tests/ -v

# 7. Verificar linting
ruff check src/
mypy src/

# 8. Commit e push
git add .
git commit -m "feat: nova funcionalidade"
git push origin feature/nova-funcionalidade
```

---

## 6. CLAUDE CODE - Seu Assistente de IA

### Como usar o Claude Code

O Claude Code e seu **parceiro de desenvolvimento** - pode ajudar em todas as etapas do projeto.

### Casos de Uso Principais

#### 1. Gerar Codigo

```
Voce: "Crie um endpoint FastAPI para calcular o orcamento
      baseado nos trechos, incluindo validacao Pydantic"

Claude: [Gera codigo completo com tipos, validacao e testes]
```

#### 2. Debug de Erros

```
Voce: "Estou recebendo este erro ao processar DXF:
      'KeyError: POINT not found in layer mapping'"

Claude: [Analisa o codigo, identifica o problema, sugere correcao]
```

#### 3. Refatorar Codigo

```
Voce: "Refatore a funcao calculate_budget para usar
      async/await e melhorar performance"

Claude: [Reescreve funcao com boas praticas]
```

#### 4. Criar Testes

```
Voce: "Crie testes unitarios para o modulo de planejamento
      cobrindo edge cases"

Claude: [Gera suite de testes com pytest]
```

#### 5. Documentar

```
Voce: "Documente a API com OpenAPI/Swagger completo"

Claude: [Adiciona docstrings e schema OpenAPI]
```

#### 6. Code Review

```
Voce: "Revise este PR e aponte problemas de seguranca
      ou performance"

Claude: [Analisa codigo e lista issues]
```

### Prompts Uteis para o Projeto

```markdown
## Topografia
"Implemente parser de CSV com deteccao automatica de delimitador
e mapeamento de colunas (id, x, y, cota)"

## Orcamento
"Crie sistema de base de custos configuravel com suporte a
SINAPI, SICRO e custos proprios"

## Planejamento
"Implemente algoritmo Same-Day Completion Rule que garante
que nenhuma vala fique aberta de um dia para outro"

## GIS
"Crie exportador de Shapefile com 11 camadas padrao para
redes de esgoto conforme especificacao"

## RDO
"Implemente dashboard de Earned Value Management com
CPI, SPI e Curva S"

## Integracao
"Configure CORS e autenticacao JWT entre Lovable e Railway API"
```

### Boas Praticas com Claude Code

1. **Seja especifico** - Quanto mais contexto, melhor o resultado
2. **Faca iterativamente** - Peca uma coisa por vez
3. **Valide o codigo** - Sempre teste o que o Claude gera
4. **Use para aprender** - Peca explicacoes do codigo gerado
5. **Aproveite para documentar** - Claude e otimo para docs

---

## 7. FLUXO DE TRABALHO INTEGRADO

### Desenvolvimento de Nova Feature

```
1. PLANEJAMENTO (Claude Code)
   - Discutir requisitos
   - Definir arquitetura
   - Criar tasks

2. BACKEND (VS Code + Claude Code)
   - Implementar endpoint FastAPI
   - Escrever testes
   - Rodar localmente

3. FRONTEND (Lovable)
   - Criar componentes React
   - Integrar com API
   - Testar UI

4. DATABASE (Supabase)
   - Criar tabelas necessarias
   - Configurar RLS
   - Testar queries

5. DEPLOY (GitHub + Railway)
   - Commit e push
   - CI/CD automatico
   - Verificar logs

6. VALIDACAO (Browser)
   - Testar feature completa
   - Verificar integracao
   - Coletar feedback
```

### Comunicacao entre Servicos

```
┌──────────┐     HTTPS/JSON      ┌──────────┐
│  Lovable │ ◄──────────────────►│  Railway │
│ Frontend │                     │   API    │
└──────────┘                     └──────────┘
     │                                │
     │  Supabase Client               │  Supabase Admin
     │  (anon key)                    │  (service key)
     ▼                                ▼
┌─────────────────────────────────────────────┐
│                  SUPABASE                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │
│  │  Auth   │  │   DB    │  │   Storage   │  │
│  └─────────┘  └─────────┘  └─────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 8. CHECKLIST DE IMPLEMENTACAO

### Fase 1: Setup Inicial
- [ ] Criar projeto no Supabase
- [ ] Configurar autenticacao (email/senha + Google)
- [ ] Criar schema do banco de dados
- [ ] Configurar Storage buckets
- [ ] Criar projeto no Railway
- [ ] Deploy inicial do Motor Python
- [ ] Configurar variaveis de ambiente
- [ ] Criar projeto no Lovable
- [ ] Conectar Lovable ao Supabase
- [ ] Configurar CORS entre servicos

### Fase 2: Modulo Topografia
- [ ] Backend: Endpoint de processamento
- [ ] Backend: Importador DXF
- [ ] Frontend: FileUploader component
- [ ] Frontend: DataTable editavel
- [ ] Frontend: MapViewer com Leaflet
- [ ] Database: Tabelas de pontos e trechos
- [ ] Testes: Unitarios e integracao

### Fase 3: Modulo Orcamento
- [ ] Backend: Calculo de orcamento
- [ ] Backend: Exportacao Excel
- [ ] Frontend: CostTable component
- [ ] Frontend: BudgetSummary cards
- [ ] Database: Tabelas de custos
- [ ] Testes: Calculos corretos

### Fase 4: Modulo Planejamento
- [ ] Backend: Same-Day Rule algorithm
- [ ] Backend: Cronograma de materiais
- [ ] Frontend: GanttChart component
- [ ] Frontend: ResourceTable
- [ ] Frontend: ABCChart (Pareto)
- [ ] Database: Tabelas de planejamento
- [ ] Testes: Logica de agrupamento

### Fase 5: Modulo RDO
- [ ] Backend: Engine de RDO
- [ ] Backend: Metricas EVM
- [ ] Frontend: DailyForm
- [ ] Frontend: ProgressDashboard
- [ ] Frontend: CurveSChart
- [ ] Database: Tabelas de RDO
- [ ] Testes: Calculos de progresso

### Fase 6: Exportacao GIS
- [ ] Backend: Shapefile exporter
- [ ] Backend: GeoPackage exporter
- [ ] Frontend: Export buttons
- [ ] Storage: Bucket de exports
- [ ] Testes: Validacao de arquivos

### Fase 7: Finalizacao
- [ ] Landing page completa
- [ ] Sistema de planos/assinaturas
- [ ] Documentacao de usuario
- [ ] Monitoramento e logs
- [ ] Backup automatico
- [ ] Performance tuning

---

## RESUMO FINAL

| Ferramenta | Responsabilidade | Tecnologias |
|------------|------------------|-------------|
| **Lovable** | Frontend completo, UI/UX | React, TypeScript, Shadcn, Leaflet |
| **Supabase** | Auth, Database, Storage, Realtime | PostgreSQL, RLS, Buckets |
| **Railway/Render** | Motor Python, calculos pesados | FastAPI, GeoPandas, EPANET |
| **GitHub** | Codigo, CI/CD, Issues | Git, Actions, Projects |
| **VS Code** | Desenvolvimento local | Python, Extensions, Debug |
| **Claude Code** | Assistente IA | Geracao, Debug, Docs |

Esta arquitetura permite:
- **Escalabilidade** - Cada servico escala independentemente
- **Manutencao** - Separacao clara de responsabilidades
- **Seguranca** - RLS no Supabase, JWT entre servicos
- **Velocidade** - Lovable para UI rapida, Railway para calculos
- **Colaboracao** - GitHub para versionamento, Claude para produtividade

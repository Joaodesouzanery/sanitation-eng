# Guia Pratico de Configuracao por Plataforma

## Status do Projeto (Diagnostico Atual)

```
SITUACAO ATUAL:
- engine_rede.html     -> FUNCIONAL (standalone, sem Supabase ainda)
- Motor Python         -> FUNCIONAL (73 arquivos, calculos completos)
- TypeScript/React     -> FUNCIONAL (16 arquivos, pages e engine)
- Supabase             -> NAO INTEGRADO (so existe na documentacao)
- Railway/Render       -> NAO DEPLOYADO (Dockerfile e API prontos)
- GitHub Actions       -> NAO CONFIGURADO (workflows definidos)
```

**O que falta:** Conectar as pecas. O codigo esta pronto, mas cada plataforma precisa ser configurada e integrada.

---

## AREA 1: LOVABLE (Frontend)

### O que a Lovable faz
A Lovable e responsavel por **tudo que o usuario ve e interage**. Ela gera React + TypeScript automaticamente.

### O que COPIAR para a Lovable

Os seguintes arquivos do repositorio devem ser usados como **prompt/referencia** na Lovable:

| Arquivo Local | O que Fazer na Lovable |
|---------------|----------------------|
| `src/pages/PlanejamentoPage.tsx` | Usar como base para a pagina de Planejamento |
| `src/pages/HydroNetworkPage.tsx` | Usar como base para a pagina de Calculo Hidraulico |
| `src/pages/RDOPage.tsx` | Usar como base para a pagina de RDO |
| `src/pages/TopografiaPage.tsx` | Usar como base para a pagina de Topografia |
| `src/engine/*.ts` | Colar como modulos de logica na Lovable |
| `web/index.html` | Referencia visual para a Landing Page |

### Prompt Inicial para a Lovable

```
Crie um aplicativo de engenharia de saneamento chamado "ConstruData HydroNetwork" com:

PAGINAS:
1. Landing Page com hero section, modulos, e CTA
2. Login/Registro com Supabase Auth
3. Dashboard principal com cards de resumo
4. Topografia - upload de CSV/XLSX, tabela editavel, mapa Leaflet
5. Orcamento - tabela de custos, graficos, export Excel
6. Planejamento - Gantt chart, Curva S, Curva ABC, histograma
7. RDO - formulario diario, progresso, fotos
8. Resultados - exportacao GIS (Shapefile, GeoPackage)

TECNOLOGIAS:
- React + TypeScript
- Shadcn UI para componentes
- Chart.js para graficos
- Leaflet para mapas
- Supabase para auth e database

CORES (ConstruData Brand):
- Primaria: #2c4a7c (azul)
- Secundaria: #1a1f2e (azul escuro)
- Destaque: #c9a227 (dourado)
- Sucesso: #10b981 (verde)
```

### Variaveis de Ambiente na Lovable

No painel da Lovable, configurar:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...sua-anon-key-aqui
VITE_RAILWAY_API_URL=https://sua-api.up.railway.app
```

### Conectar Lovable ao Supabase

Na Lovable, o arquivo `src/lib/supabase.ts` deve conter:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Conectar Lovable ao Railway (Motor Python)

Na Lovable, o arquivo `src/lib/api.ts` deve conter:
```typescript
const API_URL = import.meta.env.VITE_RAILWAY_API_URL

export async function callEngine(endpoint: string, data: any) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Endpoints disponiveis:
// POST /api/topografia/process     -> Processa pontos topograficos
// POST /api/orcamento/calculate    -> Calcula orcamento
// POST /api/planejamento/generate  -> Gera cronograma
// POST /api/gis/export/shapefile   -> Exporta Shapefile
// POST /api/gis/export/geopackage  -> Exporta GeoPackage
// POST /api/hydraulics/simulate    -> Simula rede hidraulica
// POST /api/peer-review/analyze    -> Analisa projeto (ABNT)
```

---

## AREA 2: SUPABASE (Backend as a Service)

### O que o Supabase faz
O Supabase cuida de **autenticacao, banco de dados PostgreSQL, armazenamento de arquivos e dados em tempo real**.

### Passo 1: Criar Projeto no Supabase

1. Acesse https://supabase.com
2. Crie uma conta (gratis para comecar)
3. Clique em "New Project"
4. Escolha:
   - Organization: Criar uma
   - Name: `hydronetwork`
   - Database Password: (gerar senha forte, ANOTAR)
   - Region: `South America (Sao Paulo)` se disponivel, senao `US East`
5. Anote as credenciais que aparecerao:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJ...` (chave publica, segura para o frontend)
   - **Service Role Key**: `eyJ...` (chave SECRETA, so para o backend)

### Passo 2: Criar Tabelas no SQL Editor

No painel do Supabase, va em **SQL Editor** e execute cada bloco abaixo:

#### 2a. Tabela de Perfis (usuarios)
```sql
-- Perfis de usuario (extende auth.users do Supabase)
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

-- Criar perfil automaticamente quando usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2b. Tabela de Projetos
```sql
CREATE TABLE public.projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('esgoto', 'agua', 'drenagem')),
  municipio TEXT,
  estado TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2c. Tabelas de Topografia
```sql
CREATE TABLE public.pontos_topograficos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  ponto_id TEXT NOT NULL,
  x DECIMAL(15,6) NOT NULL,
  y DECIMAL(15,6) NOT NULL,
  cota DECIMAL(10,4) NOT NULL,
  descricao TEXT,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trechos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  ponto_inicial_id UUID REFERENCES public.pontos_topograficos(id),
  ponto_final_id UUID REFERENCES public.pontos_topograficos(id),
  comprimento DECIMAL(10,4),
  declividade DECIMAL(8,6),
  tipo TEXT NOT NULL DEFAULT 'gravidade' CHECK (tipo IN ('gravidade', 'elevatoria')),
  diametro_mm INTEGER DEFAULT 150,
  material TEXT DEFAULT 'PVC',
  profundidade_inicial DECIMAL(6,3),
  profundidade_final DECIMAL(6,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2d. Tabelas de Orcamento
```sql
CREATE TABLE public.base_custos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  custo_unitario DECIMAL(12,4) NOT NULL,
  categoria TEXT NOT NULL,
  fonte TEXT,
  data_referencia DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.orcamento_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  trecho_id UUID REFERENCES public.trechos(id),
  base_custo_id UUID REFERENCES public.base_custos(id),
  quantidade DECIMAL(12,4) NOT NULL,
  custo_total DECIMAL(14,4) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2e. Tabelas de Planejamento
```sql
CREATE TABLE public.planejamento_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  metros_por_dia DECIMAL(6,2) DEFAULT 50,
  horas_por_dia INTEGER DEFAULT 8,
  dias_por_semana INTEGER DEFAULT 5,
  data_inicio DATE,
  equipes JSONB,
  equipamentos JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.planejamento_dias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  dia_numero INTEGER NOT NULL,
  data DATE NOT NULL,
  trechos_ids UUID[],
  metros_planejados DECIMAL(10,2),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2f. Tabelas de RDO
```sql
CREATE TABLE public.rdos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  clima TEXT,
  temperatura_min INTEGER,
  temperatura_max INTEGER,
  horario_inicio TIME,
  horario_fim TIME,
  observacoes TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado', 'aprovado')),
  aprovado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.rdo_servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE NOT NULL,
  trecho_id UUID REFERENCES public.trechos(id),
  servico TEXT NOT NULL,
  quantidade DECIMAL(10,4) NOT NULL,
  unidade TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.rdo_equipe (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT NOT NULL,
  horario_entrada TIME,
  horario_saida TIME,
  horas_trabalhadas DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.rdo_ocorrencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('acidente', 'atraso', 'clima', 'material', 'outro')),
  descricao TEXT NOT NULL,
  impacto TEXT,
  acao_tomada TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2g. Tabela de Arquivos
```sql
CREATE TABLE public.arquivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,
  processado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Passo 3: Configurar Row Level Security (RLS)

```sql
-- Habilitar RLS em TODAS as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos_topograficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planejamento_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

-- PROFILES: usuario ve/edita so o proprio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- PROJETOS: usuario ve/cria/edita/deleta so os proprios projetos
CREATE POLICY "projetos_all_own" ON public.projetos
  FOR ALL USING (auth.uid() = user_id);

-- PONTOS: acesso via projeto do usuario
CREATE POLICY "pontos_all_own" ON public.pontos_topograficos
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );

-- TRECHOS: acesso via projeto do usuario
CREATE POLICY "trechos_all_own" ON public.trechos
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );

-- BASE CUSTOS: ve catalogo padrao (user_id IS NULL) + proprios
CREATE POLICY "custos_select" ON public.base_custos
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "custos_insert_own" ON public.base_custos
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "custos_update_own" ON public.base_custos
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "custos_delete_own" ON public.base_custos
  FOR DELETE USING (user_id = auth.uid());

-- ORCAMENTO ITENS: acesso via projeto
CREATE POLICY "orcamento_all_own" ON public.orcamento_itens
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );

-- PLANEJAMENTO: acesso via projeto
CREATE POLICY "plan_config_all_own" ON public.planejamento_config
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );
CREATE POLICY "plan_dias_all_own" ON public.planejamento_dias
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );

-- RDO: acesso via projeto
CREATE POLICY "rdos_all_own" ON public.rdos
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );
CREATE POLICY "rdo_servicos_all_own" ON public.rdo_servicos
  FOR ALL USING (
    rdo_id IN (
      SELECT r.id FROM public.rdos r
      JOIN public.projetos p ON r.projeto_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
CREATE POLICY "rdo_equipe_all_own" ON public.rdo_equipe
  FOR ALL USING (
    rdo_id IN (
      SELECT r.id FROM public.rdos r
      JOIN public.projetos p ON r.projeto_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
CREATE POLICY "rdo_ocorrencias_all_own" ON public.rdo_ocorrencias
  FOR ALL USING (
    rdo_id IN (
      SELECT r.id FROM public.rdos r
      JOIN public.projetos p ON r.projeto_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- ARQUIVOS: acesso via projeto
CREATE POLICY "arquivos_all_own" ON public.arquivos
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE user_id = auth.uid())
  );
```

### Passo 4: Configurar Storage Buckets

No Supabase Dashboard, va em **Storage** > **New Bucket**:

| Bucket | Publico? | Descricao |
|--------|----------|-----------|
| `topografia` | Nao | Uploads CSV, XLSX, DXF |
| `exports` | Nao | Shapefiles, GeoPackages gerados |
| `fotos-rdo` | Nao | Fotos do RDO |

Ou via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('topografia', 'topografia', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-rdo', 'fotos-rdo', false);

-- Politica: usuario so acessa seus proprios arquivos
-- Estrutura de pastas: {bucket}/{user_id}/{arquivo}
CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT USING (
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### Passo 5: Configurar Autenticacao

No Supabase Dashboard, va em **Authentication** > **Providers**:

1. **Email** (ja habilitado por padrao)
   - Confirmar email: Sim
   - Redirect URL: `https://seu-projeto.lovable.app`

2. **Google** (opcional)
   - Habilitar
   - Client ID: (do Google Cloud Console)
   - Client Secret: (do Google Cloud Console)

### Possivel Problema do Supabase e Solucao

O codigo Python em `src/security/auth.py` implementa JWT proprio usando `python-jose`. Para integrar com o Supabase, o Railway deve **validar os tokens do Supabase**, nao gerar seus proprios. A solucao esta na Area 3 (Railway).

---

## AREA 3: RAILWAY / RENDER (Motor Python)

### O que o Railway faz
O Railway hospeda o **Motor Python** com FastAPI. Ele recebe chamadas da Lovable, faz calculos pesados (GIS, hidraulica, orcamento) e retorna resultados.

### Passo 1: Criar arquivo da API principal

O arquivo `api/main.py` ja esta definido no `ARQUITETURA_STACK_COMPLETA.md`. Os arquivos do motor Python que ja existem no repositorio:

| Modulo | Arquivos | Funcao |
|--------|----------|--------|
| `engine_rede/` | 8 arquivos | Motor de pre-dimensionamento |
| `hydro_network/` | 28 arquivos | Calculos hidraulicos |
| `src/engine/` | 11 arquivos TS | Logica de engenharia |
| `src/gis/` | 7 arquivos | Import/export GIS |
| `src/planning/` | 4 arquivos | Planejamento de obra |
| `src/rdo/` | 5 arquivos | Relatorio Diario de Obra |
| `src/peer_review/` | 4 arquivos | Revisao tecnica |
| `src/hydraulics/` | 1 arquivo | Wrapper EPANET |

### Passo 2: Configurar Validacao de Token Supabase

Criar arquivo `api/auth.py` para validar tokens do Supabase (substituindo o JWT proprio):

```python
# api/auth.py
import os
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """Valida token JWT do Supabase e retorna usuario."""
    token = credentials.credentials

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            }
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Token invalido")

    return response.json()
```

### Passo 3: Deploy no Railway

1. Acesse https://railway.app
2. "New Project" > "Deploy from GitHub repo"
3. Selecione o repositorio `sanitation-eng`
4. Railway detecta o `Dockerfile` automaticamente
5. Configurar variaveis de ambiente:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service-role-key
ALLOWED_ORIGINS=https://seu-projeto.lovable.app
PYTHONUNBUFFERED=1
GDAL_DATA=/usr/share/gdal
PROJ_LIB=/usr/share/proj
```

6. O Railway gera uma URL como: `https://sanitation-eng-production.up.railway.app`
7. Usar essa URL como `VITE_RAILWAY_API_URL` na Lovable

### Deploy Alternativo no Render

1. Acesse https://render.com
2. "New" > "Web Service"
3. Conecte o repositorio GitHub
4. Configurar:
   - Name: `hydronetwork-api`
   - Environment: `Docker`
   - Region: `Oregon` (mais proximo do Brasil)
5. Mesmas variaveis de ambiente acima

### Verificar se o Deploy Funcionou

Acesse: `https://sua-url.up.railway.app/health`

Resposta esperada:
```json
{"status": "healthy", "version": "2.0.0"}
```

Acesse: `https://sua-url.up.railway.app/docs`
-> Swagger UI com todos os endpoints

---

## AREA 4: GITHUB + VS CODE (Desenvolvimento)

### O que o GitHub faz
- Armazena o codigo versionado
- Executa testes automaticos via GitHub Actions
- Faz deploy automatico quando voce da push

### O que o VS Code faz
- Editar codigo Python localmente
- Debug com breakpoints
- Rodar testes
- Gerenciar Git

### Setup Local Completo (VS Code)

```bash
# 1. Clonar repositorio
git clone https://github.com/Joaodesouzanery/sanitation-eng.git
cd sanitation-eng

# 2. Criar ambiente virtual Python
python -m venv .venv
source .venv/bin/activate    # Linux/Mac
# .venv\Scripts\activate     # Windows

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Criar arquivo .env local (NAO comitar!)
cat > .env << 'EOF'
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET_KEY=sua-chave-secreta-de-64-caracteres-minimo
EOF

# 5. Rodar servidor local
uvicorn api.main:app --reload --port 8000

# 6. Rodar testes
pytest tests/ -v

# 7. Verificar linting
ruff check src/
```

### Extensoes VS Code (ja configuradas em .vscode/extensions.json)

- **Python**: ms-python.python
- **Pylance**: ms-python.vscode-pylance
- **Ruff**: charliermarsh.ruff (linting)
- **GitLens**: eamodio.gitlens (historico git)
- **Docker**: ms-azuretools.vscode-docker
- **Thunder Client**: rangav.vscode-thunder-client (testar API)

### GitHub Actions (CI/CD)

Os workflows estao definidos no `ARQUITETURA_STACK_COMPLETA.md`. Para ativar:

1. Crie a pasta `.github/workflows/` no repositorio
2. Adicione `test.yml` e `deploy-railway.yml`
3. Configure os Secrets no GitHub:
   - Settings > Secrets > Actions
   - Adicionar: `RAILWAY_TOKEN` (pegar no Railway Dashboard)

---

## AREA 5: CLAUDE CODE (Assistente IA)

### O que o Claude Code faz
O Claude Code e seu **parceiro de desenvolvimento**. Ele pode:

### 1. Gerar Codigo
```
"Crie um endpoint FastAPI que recebe uma lista de pontos
topograficos e retorna os trechos calculados com declividade"
```

### 2. Debug
```
"Este erro esta aparecendo quando importo um DXF:
[colar o erro aqui]
O que esta errado?"
```

### 3. Refatorar
```
"Refatore a funcao calculate_budget para ser async
e usar o Supabase para buscar a base de custos"
```

### 4. Criar Testes
```
"Crie testes unitarios para o modulo de planejamento,
testando a Same-Day Completion Rule"
```

### 5. Code Review
```
"Revise este codigo e aponte problemas de seguranca:
[colar codigo]"
```

### 6. Integrar Plataformas
```
"Ajude a configurar a conexao entre a Lovable e o Railway,
passando o token Supabase para autenticacao"
```

### Como Usar o Claude Code no Terminal

```bash
# Instalar
npm install -g @anthropic-ai/claude-code

# Usar no projeto
cd sanitation-eng
claude

# Exemplos de comandos:
# > Analise o arquivo src/engine/budget.ts e explique a logica
# > Crie um teste para engine_rede/geometry.py
# > Corrija o erro de tipo no pipeline_advanced.py
# > Gere o SQL para adicionar uma coluna ao Supabase
```

### Dicas para Usar Melhor o Claude Code

1. **Seja especifico** - Diga exatamente o que quer, com contexto
2. **Passe o erro completo** - Copie e cole o traceback inteiro
3. **Peca explicacao** - "Explique o que esse codigo faz" antes de modificar
4. **Itere** - Peca uma coisa por vez, valide, e continue
5. **Use para SQL** - Claude e otimo para gerar queries Supabase
6. **Use para CORS** - Configurar CORS entre servicos pode ser confuso, Claude resolve

---

## RESUMO: QUEM FAZ O QUE

```
┌───────────────────────────────────────────────────────────────┐
│                    MAPA DE RESPONSABILIDADES                   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  LOVABLE          SUPABASE         RAILWAY          GITHUB    │
│  ────────         ────────         ───────          ──────    │
│  UI/UX            Auth             Calculos         Codigo    │
│  React            PostgreSQL       GIS              CI/CD     │
│  Graficos         Storage          EPANET           Issues    │
│  Mapas            Realtime         FastAPI          PRs       │
│  Formularios      RLS              Python           Deploy    │
│                                                               │
│              VS CODE              CLAUDE CODE                  │
│              ───────              ───────────                  │
│              Editar               Gerar codigo                 │
│              Debug                Debug erros                  │
│              Testes               Refatorar                    │
│              Git local            Documentar                   │
│                                   SQL/CORS                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## ORDEM DE IMPLEMENTACAO RECOMENDADA

```
FASE 1 - FUNDACAO
  1. Criar projeto no Supabase (tabelas + RLS + storage)
  2. Criar projeto no Railway (deploy Motor Python)
  3. Testar /health endpoint

FASE 2 - FRONTEND
  4. Criar projeto na Lovable (prompt inicial)
  5. Conectar Lovable ao Supabase (auth)
  6. Conectar Lovable ao Railway (API)
  7. Testar login + dashboard basico

FASE 3 - MODULOS
  8. Topografia (upload -> calculo -> mapa)
  9. Orcamento (trechos -> custos -> Excel)
  10. Planejamento (Gantt + Curva S + ABC)
  11. RDO (formulario + progresso + fotos)

FASE 4 - EXPORTACAO
  12. GIS (Shapefile + GeoPackage)
  13. Relatorios (PDF, Excel formatado)

FASE 5 - PRODUCAO
  14. GitHub Actions (CI/CD)
  15. Dominio personalizado
  16. Monitoramento
```

# Prompt Pontual para Lovable - Resolver Problemas Pendentes

## Contexto
A Lovable ja implementou a estrutura basica das paginas React (TopografiaPage, PlanejamentoPage, RDOPage, HydroNetworkPage). Este prompt e para resolver **apenas os problemas pendentes** de integracao e funcionamento.

---

## PROBLEMA 1: Dependencias Externas Nao Carregadas

### O que esta errado:
As paginas usam `declare const L: any;` e `declare const Chart: any;`, mas Leaflet e Chart.js NAO estao sendo carregados no projeto.

### O que fazer:
1. Adicionar as dependencias ao `package.json`:
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

2. Criar um arquivo `src/lib/charts.ts` para inicializacao:
```typescript
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
export { Chart };
```

3. Criar um arquivo `src/lib/leaflet.ts`:
```typescript
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para icones do Leaflet em React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export { L };
```

4. Alterar os imports nas paginas:
- Trocar `declare const L: any;` por `import { L } from '../lib/leaflet';`
- Trocar `declare const Chart: any;` por `import { Chart } from '../lib/charts';`

---

## PROBLEMA 2: Engine TypeScript Nao Copiado

### O que esta errado:
Os arquivos de `src/engine/` existem no repositorio mas podem nao ter sido copiados para o projeto Lovable.

### O que fazer:
Copiar TODOS os arquivos de `src/engine/` para o projeto Lovable:
- `reader.ts` - Parse CSV/TXT
- `domain.ts` - Criacao de trechos
- `geometry.ts` - Coordenadas UTM
- `planning.ts` - Cronograma, Curva S, Histograma
- `budget.ts` - Orcamento
- `rdo.ts` - RDO completo
- `dashboard.ts` - EVM e metricas
- `construction.ts` - Parametros construtivos
- `materials.ts` - Catalogo de materiais
- `peer-review.ts` - Validacao NBR
- `index.ts` - Exports

---

## PROBLEMA 3: Graficos Nao Renderizam

### O que esta errado:
Os graficos (Curva S, Histograma, Timeline) usam `document.getElementById()` que pode falhar com IDs duplicados ou timing issues.

### O que fazer:
Alterar para usar `useRef` corretamente:

**PlanejamentoPage - Curva S:**
```typescript
// Antes (problematico):
const canvas = document.getElementById('curve-s-canvas') as HTMLCanvasElement;

// Depois (correto):
const curveCanvasRef = useRef<HTMLCanvasElement>(null);
// No JSX: <canvas ref={curveCanvasRef} />
// No useEffect: if (!curveCanvasRef.current) return;
const ctx = curveCanvasRef.current.getContext('2d');
```

**RDOPage - Graficos:**
```typescript
// Mesmo padrao - usar refs ao inves de getElementById
const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
const statusCanvasRef = useRef<HTMLCanvasElement>(null);

// No JSX:
<canvas ref={timelineCanvasRef} style={{ width: '100%', height: '200px' }} />
<canvas ref={statusCanvasRef} style={{ width: '100%', height: '200px' }} />
```

---

## PROBLEMA 4: Mapa Nao Aparece

### O que esta errado:
O mapa Leaflet precisa de CSS e o container precisa ter altura definida.

### O que fazer:
1. Adicionar import do CSS no arquivo principal:
```typescript
import 'leaflet/dist/leaflet.css';
```

2. Garantir que o container do mapa tenha altura fixa:
```typescript
<div
  ref={mapContainerRef}
  style={{
    height: '500px',  // OBRIGATORIO ter altura fixa
    width: '100%',
    borderRadius: '8px'
  }}
/>
```

3. Inicializar o mapa SOMENTE quando o ref estiver disponivel:
```typescript
useEffect(() => {
  // Verificar se Leaflet esta disponivel E se o container existe
  if (!mapContainerRef.current) return;
  if (mapInstanceRef.current) return; // Ja inicializado

  const map = L.map(mapContainerRef.current).setView([-23.5505, -46.6333], 12);
  // ...
}, []); // Array vazio = executar uma vez
```

---

## PROBLEMA 5: Gantt Chart Incompleto

### O que esta errado:
O Gantt na pagina de Planejamento pode nao mostrar o gradiente colorido corretamente.

### O que fazer:
O CSS do gradiente para o ciclo completo (Escavacao -> Assentamento -> Reaterro) deve ser:
```typescript
style={{
  background: 'linear-gradient(90deg, #f59e0b 0%, #f59e0b 33%, #3b82f6 33%, #3b82f6 66%, #22c55e 66%, #22c55e 100%)',
  borderRadius: '4px',
  height: '24px',
  // ...
}}
```

Cores:
- `#f59e0b` (amarelo) = Escavacao
- `#3b82f6` (azul) = Assentamento
- `#22c55e` (verde) = Reaterro
- `#ef4444` (vermelho) = Teste Hidrostatico

---

## PROBLEMA 6: Types Faltando

### O que fazer:
Se houver erros de TypeScript, adicionar os types:

```typescript
// Em RDOPage.tsx, adicionar:
type RDOStatus = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';

// Corrigir a linha 349:
const handleSaveRDO = (status: RDOStatus = 'rascunho') => {
```

---

## RESUMO DAS ACOES

1. **Instalar dependencias**: `npm install leaflet chart.js react-leaflet @types/leaflet`
2. **Criar lib/charts.ts e lib/leaflet.ts**
3. **Atualizar imports nas paginas**
4. **Copiar arquivos de src/engine/ se nao existirem**
5. **Trocar getElementById por useRef nos graficos**
6. **Adicionar CSS do Leaflet**
7. **Garantir altura fixa no container do mapa**
8. **Corrigir type RDOStatus**

---

## TESTE RAPIDO

Apos as correcoes, testar:
1. Upload de CSV na aba Topografia - deve mostrar mapa e tabela
2. Gerar Cronograma na aba Planejamento - deve mostrar Gantt, Curva S e Histograma
3. Criar RDO - deve mostrar Dashboard com graficos
4. Todos os graficos devem renderizar corretamente

---

## Importante
- NAO reescrever as paginas do zero
- APENAS corrigir os problemas listados
- Os arquivos de engine ja estao completos e funcionais
- Focar em fazer as bibliotecas Leaflet e Chart.js funcionarem

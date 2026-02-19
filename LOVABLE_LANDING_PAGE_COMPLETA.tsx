// =============================================================================
// CONSTRUDATA HYDRONETWORK - LANDING PAGE COMPLETA
// =============================================================================
// Pronto para copiar e colar na Lovable
// Stack: React + TypeScript + Tailwind CSS + Lucide React
// =============================================================================

import React, { useState } from 'react';
import {
  Droplets, Calculator, FileSpreadsheet, Map, BarChart3, Clock, Shield, Zap,
  CheckCircle2, ArrowRight, Play, Menu, X, ChevronDown, ChevronRight, Ruler,
  FileText, Calendar, Camera, Layers, TrendingUp, Users, Building2, Award,
  Phone, Mail, MapPin, Globe, Lock, Smartphone, Monitor, Cloud, Database,
  GitBranch, Settings, AlertTriangle, FileCode, Package, Wrench, ClipboardList,
  HardHat, Truck, Warehouse, UserCog, Bell, QrCode, Building, Briefcase,
  CalendarDays, Download, Upload, Eye, Target, Gauge, Activity, PieChart,
  LayoutGrid, Workflow, CheckSquare, ExternalLink, Sparkles, Star, Lightbulb,
  MessageSquare, Send, ArrowUpRight, CircleCheck, XCircle, Circle, Minus
} from 'lucide-react';

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeModuleCategory, setActiveModuleCategory] = useState('todos');

  // ---------------------------------------------------------------------------
  // DADOS: ESTATÍSTICAS DO HERO
  // ---------------------------------------------------------------------------
  const heroStats = [
    { value: "30+", label: "Módulos Integrados" },
    { value: "8+", label: "Formatos de Export" },
    { value: "3", label: "Motores de Cálculo" },
    { value: "6", label: "Normas ABNT" },
  ];

  const heroBadges = [
    { icon: <Cloud className="w-4 h-4" />, text: "Sem instalação" },
    { icon: <CheckCircle2 className="w-4 h-4" />, text: "100% gratuito" },
    { icon: <LayoutGrid className="w-4 h-4" />, text: "30+ módulos" },
    { icon: <Map className="w-4 h-4" />, text: "Exportação GIS" },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: MÉTRICAS DE IMPACTO
  // ---------------------------------------------------------------------------
  const impactMetrics = [
    { value: "87%", label: "Mais Rápido", color: "text-emerald-500" },
    { value: "35%", label: "Economia Média", color: "text-blue-500" },
    { value: "99%", label: "Precisão Técnica", color: "text-purple-500" },
    { value: "100%", label: "Online", color: "text-cyan-500" },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: DESAFIOS E SOLUÇÕES
  // ---------------------------------------------------------------------------
  const challenges = [
    {
      icon: <GitBranch className="w-8 h-8" />,
      title: "Fragmentação de Ferramentas",
      description: "Engenheiros usam 5-10 softwares diferentes (AutoCAD, EPANET, Excel, ERPs) para um único projeto, gerando retrabalho e erros.",
      color: "red"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Processos Lentos e Manuais",
      description: "Dimensionamento de redes, orçamentos SINAPI e cronogramas feitos manualmente em planilhas, consumindo semanas.",
      color: "orange"
    },
    {
      icon: <Briefcase className="w-8 h-8" />,
      title: "Custos Elevados com Licenças",
      description: "Licenças de softwares isolados custam dezenas de milhares de reais por ano, sem integração entre eles.",
      color: "yellow"
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Falta de Rastreabilidade",
      description: "RDOs em papel, fotos perdidas, histórico inexistente, dificuldade em comprovar serviços executados.",
      color: "purple"
    },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: FLUXO DE 8 ETAPAS
  // ---------------------------------------------------------------------------
  const workflowSteps = [
    { step: "01", title: "Topografia", description: "Upload de dados CAD, CSV, SHP ou DXF", icon: <Map className="w-6 h-6" /> },
    { step: "02", title: "Dimensionamento", description: "Cálculo automático de redes (esgoto, água, drenagem)", icon: <Calculator className="w-6 h-6" /> },
    { step: "03", title: "Orçamento", description: "Composições SINAPI/SICRO por trecho", icon: <FileSpreadsheet className="w-6 h-6" /> },
    { step: "04", title: "Simulação", description: "EPANET (pressão) e SWMM (drenagem)", icon: <Activity className="w-6 h-6" /> },
    { step: "05", title: "Planejamento", description: "Gantt, Curva S e caminho crítico", icon: <Calendar className="w-6 h-6" /> },
    { step: "06", title: "Revisão", description: "Peer Review com checklist normativo", icon: <CheckSquare className="w-6 h-6" /> },
    { step: "07", title: "Execução", description: "RDO Digital com avanço por trecho", icon: <HardHat className="w-6 h-6" /> },
    { step: "08", title: "Exportação", description: "GIS, DXF, PDF e relatórios", icon: <Download className="w-6 h-6" /> },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: CATÁLOGO DE MÓDULOS (30+)
  // ---------------------------------------------------------------------------
  const modules = [
    // Categoria: Core/Dimensionamento
    {
      category: "core",
      icon: <Map className="w-7 h-7" />,
      title: "Topografia Inteligente",
      description: "Processamento automático de dados topográficos. Suporte a CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML.",
      features: ["Importação multi-formato", "Processamento automático X, Y, Z", "Geração de trechos"],
      color: "blue"
    },
    {
      category: "core",
      icon: <Droplets className="w-7 h-7" />,
      title: "Rede de Esgoto",
      description: "Dimensionamento de redes de esgoto por gravidade e elevatória com verificação normativa ABNT.",
      features: ["Dimensionamento gravidade/elevatória", "Cálculo de declividades/diâmetros", "Verificação ABNT automática"],
      color: "emerald"
    },
    {
      category: "core",
      icon: <Gauge className="w-7 h-7" />,
      title: "Rede de Água",
      description: "Projeto de redes de distribuição de água pressurizadas com cálculo de pressão e perdas de carga.",
      features: ["Cálculo de pressão", "Velocidade por trecho", "Perdas de carga"],
      color: "cyan"
    },
    {
      category: "core",
      icon: <Cloud className="w-7 h-7" />,
      title: "Drenagem Pluvial",
      description: "Dimensionamento de galerias e estruturas de drenagem urbana pelo método racional.",
      features: ["Dimensionamento de galerias", "Método racional", "Tempo de concentração"],
      color: "indigo"
    },
    {
      category: "core",
      icon: <Package className="w-7 h-7" />,
      title: "Quantitativos",
      description: "Cálculo automático de volumes de escavação, reaterro, tubulação, PVs e serviços complementares.",
      features: ["Volumes de escavação/reaterro", "Quantificação de tubulação", "PVs e serviços"],
      color: "violet"
    },
    // Categoria: Orçamento e Custos
    {
      category: "orcamento",
      icon: <FileSpreadsheet className="w-7 h-7" />,
      title: "Orçamento e Custos",
      description: "Orçamentação automatizada com composições SINAPI/SICRO e visualização no mapa interativo.",
      features: ["Composições SINAPI/SICRO", "Visualização no mapa", "Custo por trecho"],
      color: "green"
    },
    {
      category: "orcamento",
      icon: <Calculator className="w-7 h-7" />,
      title: "BDI (TCU)",
      description: "Cálculo de BDI conforme Acórdão TCU 2622/2013 com composição detalhada e simulação de cenários.",
      features: ["Fórmula TCU oficial", "Composição detalhada", "Simulação de cenários"],
      color: "teal"
    },
    // Categoria: Planejamento
    {
      category: "planejamento",
      icon: <Calendar className="w-7 h-7" />,
      title: "Planejamento de Obra",
      description: "Cronograma executivo com Gantt interativo, Curva S automática, EVM e caminho crítico.",
      features: ["Gantt interativo", "Curva S automática", "EVM integrado"],
      color: "orange"
    },
    {
      category: "planejamento",
      icon: <Workflow className="w-7 h-7" />,
      title: "OpenProject",
      description: "Integração com OpenProject para gestão ágil com criação automática de Work Packages.",
      features: ["Integração OpenProject", "Gestão ágil", "Work Packages automáticos"],
      color: "rose"
    },
    {
      category: "planejamento",
      icon: <BarChart3 className="w-7 h-7" />,
      title: "ProjectLibre",
      description: "Exportação de cronograma para ProjectLibre/MS Project para planejamento avançado.",
      features: ["Exportação ProjectLibre", "Compatibilidade MS Project", "Gantt avançado"],
      color: "pink"
    },
    // Categoria: Simulação
    {
      category: "simulacao",
      icon: <Activity className="w-7 h-7" />,
      title: "Simulação EPANET",
      description: "Motor EPANET integrado para simulação hidráulica com exportação de arquivos .INP.",
      features: ["Motor EPANET nativo", "Simulação hidráulica", "Exportação .INP"],
      color: "blue"
    },
    {
      category: "simulacao",
      icon: <Zap className="w-7 h-7" />,
      title: "EPANET PRO (WebAssembly)",
      description: "Simulação EPANET completa via WebAssembly (epanet-js) com import/export .INP e resultados visuais.",
      features: ["WebAssembly nativo", "Import/export .INP", "Resultados por pressão"],
      color: "amber",
      badge: "Em breve"
    },
    {
      category: "simulacao",
      icon: <TrendingUp className="w-7 h-7" />,
      title: "Simulação SWMM",
      description: "Modelagem de drenagem urbana com análise de escoamento, capacidade de galerias e cenários de chuva.",
      features: ["Modelagem de drenagem", "Análise de escoamento", "Capacidade de galerias"],
      color: "sky"
    },
    // Categoria: Execução
    {
      category: "execucao",
      icon: <ClipboardList className="w-7 h-7" />,
      title: "RDO Digital",
      description: "Relatório Diário de Obra especializado para saneamento com fotos, GPS e clima.",
      features: ["RDO especializado", "Avanço por trecho", "Fotos + GPS + clima"],
      color: "emerald"
    },
    {
      category: "execucao",
      icon: <CheckSquare className="w-7 h-7" />,
      title: "Revisão por Pares",
      description: "Workflow automatizado de verificação técnica com checklist normativo ABNT.",
      features: ["Workflow automatizado", "Checklist ABNT", "Análise velocidade/declividade"],
      color: "purple"
    },
    {
      category: "execucao",
      icon: <Target className="w-7 h-7" />,
      title: "Mapa de Progresso RDO",
      description: "Visualização georreferenciada do progresso da obra com dados do RDO.",
      features: ["Progresso por trecho", "Visualização no mapa", "Dados do RDO integrados"],
      color: "lime"
    },
    {
      category: "execucao",
      icon: <GitBranch className="w-7 h-7" />,
      title: "RDO × Planejamento",
      description: "Integração entre RDO e Planejamento com Curva S comparativa e alertas de atraso.",
      features: ["Curva S comparativa", "Planejado vs. Executado", "Alertas de atraso"],
      color: "red"
    },
    // Categoria: Visualização
    {
      category: "visualizacao",
      icon: <TrendingUp className="w-7 h-7" />,
      title: "Perfil Longitudinal",
      description: "Visualização SVG do corte vertical da rede com escalas configuráveis.",
      features: ["Corte vertical SVG", "Escalas configuráveis", "Exagero vertical"],
      color: "indigo"
    },
    {
      category: "visualizacao",
      icon: <Map className="w-7 h-7" />,
      title: "Mapa Interativo",
      description: "Mapa Leaflet com visualização georreferenciada, codificação por cores e popup técnico.",
      features: ["Mapa Leaflet", "Codificação por cores", "Status por trecho"],
      color: "teal"
    },
    {
      category: "visualizacao",
      icon: <PieChart className="w-7 h-7" />,
      title: "Dashboard 360°",
      description: "Dashboard consolidado com KPIs de produção, materiais, equipes e indicadores financeiros.",
      features: ["KPIs em tempo real", "Produção e materiais", "Indicadores financeiros"],
      color: "cyan"
    },
    // Categoria: Exportação
    {
      category: "exportacao",
      icon: <Layers className="w-7 h-7" />,
      title: "Integração QGIS",
      description: "Exportação para QGIS com camadas vetoriais, Shapefile, GeoJSON e GeoPackage.",
      features: ["Exportação QGIS", "Camadas vetoriais", "Shapefile/GeoJSON/GeoPackage"],
      color: "green"
    },
    {
      category: "exportacao",
      icon: <Download className="w-7 h-7" />,
      title: "Exportação GIS",
      description: "Exportação multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF e CSV.",
      features: ["Shapefile", "GeoJSON / GeoPackage", "KML/KMZ"],
      color: "blue"
    },
    {
      category: "exportacao",
      icon: <Database className="w-7 h-7" />,
      title: "Backup & Exportação",
      description: "Exportação completa de dados em múltiplos formatos e backup automático.",
      features: ["Exportação multi-formato", "Backup automático", "Agendamento"],
      color: "slate"
    },
    // Categoria: Gestão
    {
      category: "gestao",
      icon: <Warehouse className="w-7 h-7" />,
      title: "Materiais & Almoxarifado",
      description: "Controle completo de materiais com importação de planilhas, histórico de preços e gestão de estoque.",
      features: ["Importação de planilhas", "Histórico de preços", "Gestão de estoque"],
      color: "amber"
    },
    {
      category: "gestao",
      icon: <Users className="w-7 h-7" />,
      title: "Gestão de Equipes",
      description: "Cadastro de funcionários, alocação por frente de serviço e controle de produtividade.",
      features: ["Cadastro completo", "Alocação por frente", "Produtividade"],
      color: "violet"
    },
    {
      category: "gestao",
      icon: <Bell className="w-7 h-7" />,
      title: "Alertas Inteligentes",
      description: "Notificações automáticas por condições configuráveis: produção, materiais, manutenção.",
      features: ["Configuração por regras", "Notificações automáticas", "Multi-destinatário"],
      color: "rose"
    },
    {
      category: "gestao",
      icon: <QrCode className="w-7 h-7" />,
      title: "QR Codes de Manutenção",
      description: "QR Codes para ativos com formulário de abertura de chamados e rastreamento.",
      features: ["Geração de QR Codes", "Formulário web", "Rastreamento de chamados"],
      color: "fuchsia"
    },
    {
      category: "gestao",
      icon: <Building className="w-7 h-7" />,
      title: "Gestão Predial",
      description: "Manutenção de edificações com kanban de tarefas, relatórios de consumo e dashboards.",
      features: ["Kanban de tarefas", "Relatórios de consumo", "Dashboard de performance"],
      color: "orange"
    },
    {
      category: "gestao",
      icon: <Briefcase className="w-7 h-7" />,
      title: "CRM Completo",
      description: "Gestão de clientes, contatos, pipeline de negócios e atividades comerciais.",
      features: ["Pipeline visual", "Gestão de contatos", "Atividades e calendário"],
      color: "sky"
    },
    {
      category: "gestao",
      icon: <CalendarDays className="w-7 h-7" />,
      title: "RH & Escalas CLT",
      description: "Escalas de trabalho conformes CLT, controle de férias, faltas e custo primo.",
      features: ["Escalas CLT automáticas", "Controle de férias/faltas", "Custo primo"],
      color: "emerald"
    },
  ];

  const moduleCategories = [
    { id: 'todos', label: 'Todos', count: modules.length },
    { id: 'core', label: 'Dimensionamento', count: modules.filter(m => m.category === 'core').length },
    { id: 'orcamento', label: 'Orçamento', count: modules.filter(m => m.category === 'orcamento').length },
    { id: 'planejamento', label: 'Planejamento', count: modules.filter(m => m.category === 'planejamento').length },
    { id: 'simulacao', label: 'Simulação', count: modules.filter(m => m.category === 'simulacao').length },
    { id: 'execucao', label: 'Execução', count: modules.filter(m => m.category === 'execucao').length },
    { id: 'visualizacao', label: 'Visualização', count: modules.filter(m => m.category === 'visualizacao').length },
    { id: 'exportacao', label: 'Exportação', count: modules.filter(m => m.category === 'exportacao').length },
    { id: 'gestao', label: 'Gestão', count: modules.filter(m => m.category === 'gestao').length },
  ];

  const filteredModules = activeModuleCategory === 'todos'
    ? modules
    : modules.filter(m => m.category === activeModuleCategory);

  // ---------------------------------------------------------------------------
  // DADOS: TABELA COMPARATIVA
  // ---------------------------------------------------------------------------
  const comparisonFeatures = [
    { feature: "Pré-dimensionamento automático de redes", planilhas: false, outros: false, hydro: true },
    { feature: "Simulação EPANET integrada", planilhas: false, outros: "partial", hydro: true },
    { feature: "Simulação SWMM integrada", planilhas: false, outros: false, hydro: true },
    { feature: "Orçamento SINAPI/SICRO por trecho", planilhas: false, outros: false, hydro: true },
    { feature: "Mapa interativo com custos", planilhas: false, outros: false, hydro: true },
    { feature: "Gantt + Curva S + EVM", planilhas: false, outros: "partial", hydro: true },
    { feature: "Exportação QGIS / Shapefile / DXF", planilhas: false, outros: "partial", hydro: true },
    { feature: "RDO Digital por trecho", planilhas: false, outros: false, hydro: true },
    { feature: "Revisão técnica automatizada", planilhas: false, outros: false, hydro: true },
    { feature: "100% Online — sem instalação", planilhas: "partial", outros: false, hydro: true },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: TECNOLOGIAS
  // ---------------------------------------------------------------------------
  const technologies = [
    { icon: <Globe className="w-8 h-8" />, title: "100% Web", description: "React + TypeScript. Acesse de qualquer lugar, a qualquer hora." },
    { icon: <Map className="w-8 h-8" />, title: "Mapas Leaflet", description: "Precisão GIS para engenharia. Visualização geoespacial avançada." },
    { icon: <Lock className="w-8 h-8" />, title: "Dados Seguros", description: "Criptografia e backup 24/7. Seus projetos protegidos com máxima segurança." },
    { icon: <Smartphone className="w-8 h-8" />, title: "Responsivo", description: "Desktop, tablet e celular. Trabalhe com flexibilidade em qualquer dispositivo." },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: FAQ
  // ---------------------------------------------------------------------------
  const faqs = [
    {
      question: "Preciso instalar alguma coisa?",
      answer: "Não! O HydroNetwork é 100% web. Basta acessar pelo navegador (Chrome, Firefox, Edge ou Safari). Funciona em qualquer dispositivo com internet."
    },
    {
      question: "Funciona para esgoto, água E drenagem?",
      answer: "Sim! O sistema possui módulos específicos para cada tipo de rede: esgoto sanitário (gravidade e elevatória), água (distribuição pressurizada) e drenagem pluvial (método racional e galerias)."
    },
    {
      question: "Posso exportar para o QGIS e AutoCAD?",
      answer: "Sim! Exportamos para Shapefile, GeoJSON, GeoPackage, KML/KMZ (para QGIS e outros GIS) e DXF (para AutoCAD). Todos os dados georreferenciados são preservados."
    },
    {
      question: "Quanto custa?",
      answer: "O HydroNetwork é 100% gratuito para uso básico com todos os 30+ módulos. Planos pagos estão em desenvolvimento para funcionalidades avançadas e suporte prioritário."
    },
    {
      question: "E se eu já tenho dados em planilha?",
      answer: "Você pode importar dados de CSV, TXT, XLSX e até DXF. O sistema processa automaticamente e distribui os dados nos módulos correspondentes."
    },
    {
      question: "Como funciona o suporte?",
      answer: "Oferecemos documentação completa, tutoriais em vídeo e suporte por email. Para planos futuros, haverá suporte prioritário via chat e telefone."
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Sim! Utilizamos criptografia de ponta a ponta, backups automáticos e servidores seguros. Seus projetos nunca serão compartilhados ou acessados sem sua autorização."
    },
    {
      question: "Posso colaborar com minha equipe?",
      answer: "Sim! O sistema permite múltiplos usuários no mesmo projeto com controle de permissões. Cada membro vê apenas o que precisa."
    },
    {
      question: "Há limites de uso no plano gratuito?",
      answer: "O plano gratuito inclui todos os módulos sem limite de projetos. Limites podem existir para armazenamento de arquivos muito grandes ou simulações complexas."
    },
    {
      question: "O sistema gera relatórios automáticos?",
      answer: "Sim! Geramos relatórios em PDF, Excel e formatos técnicos. Incluem memoriais de cálculo, planilhas orçamentárias, cronogramas e RDOs."
    },
    {
      question: "Como funciona a simulação EPANET?",
      answer: "Temos integração nativa com o motor EPANET. Você pode importar arquivos .INP existentes ou criar simulações do zero. Os resultados são visualizados diretamente no mapa."
    },
    {
      question: "Posso importar arquivos DXF do AutoCAD?",
      answer: "Sim! O sistema lê arquivos DXF e extrai automaticamente pontos, linhas e polígonos georreferenciados para uso nos módulos de topografia e dimensionamento."
    },
  ];

  // ---------------------------------------------------------------------------
  // DADOS: MÓDULOS CONSTRUDATA OBRAS
  // ---------------------------------------------------------------------------
  const obrasModules = [
    "Gestão de Projetos", "RDO Digital", "Controle de Produção", "Gestão de Equipes",
    "Materiais & Estoque", "Pedidos de Material", "Orçamentos com BDI", "Dashboard 360°",
    "Alertas Inteligentes", "QR Codes", "Manutenção Predial", "CRM Completo",
    "RH & Escalas CLT", "Checklists", "Ocorrências", "Relatórios de Ligação"
  ];

  // ---------------------------------------------------------------------------
  // RENDER: ÍCONE DE COMPARAÇÃO
  // ---------------------------------------------------------------------------
  const ComparisonIcon = ({ value }: { value: boolean | string }) => {
    if (value === true) return <CircleCheck className="w-6 h-6 text-emerald-500" />;
    if (value === false) return <XCircle className="w-6 h-6 text-red-400" />;
    if (value === "partial") return <Circle className="w-6 h-6 text-yellow-500" />;
    return null;
  };

  // ---------------------------------------------------------------------------
  // RENDER PRINCIPAL
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ===================================================================== */}
      {/* NAVBAR */}
      {/* ===================================================================== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-2 rounded-xl">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900">ConstruData</span>
                <span className="text-lg font-bold text-blue-600 ml-1">HydroNetwork</span>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center gap-8">
              <a href="#modulos" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Módulos</a>
              <a href="#fluxo" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Como Funciona</a>
              <a href="#comparativo" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Comparativo</a>
              <a href="#faq" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">FAQ</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <button className="flex items-center gap-2 text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-all">
                <Play className="w-4 h-4" />
                Demonstração
              </button>
              <button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5">
                Acessar Plataforma
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-3">
            <a href="#modulos" className="block text-gray-600 py-2 font-medium">Módulos</a>
            <a href="#fluxo" className="block text-gray-600 py-2 font-medium">Como Funciona</a>
            <a href="#comparativo" className="block text-gray-600 py-2 font-medium">Comparativo</a>
            <a href="#faq" className="block text-gray-600 py-2 font-medium">FAQ</a>
            <hr className="my-3" />
            <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-5 py-3 rounded-xl font-semibold">
              Acessar Plataforma
            </button>
          </div>
        )}
      </nav>

      {/* ===================================================================== */}
      {/* HERO SECTION */}
      {/* ===================================================================== */}
      <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-slate-50 via-blue-50/50 to-cyan-50/50 overflow-hidden relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-200 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              Ecossistema Definitivo para Engenharia de Saneamento
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              A Engenharia de Saneamento
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Reimaginada.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              <span className="font-semibold text-gray-800">30+ módulos integrados</span> para pré-dimensionamento de redes,
              simulação hidráulica (EPANET/SWMM), orçamento SINAPI/SICRO, planejamento com Gantt e RDO digital —
              <span className="text-blue-600 font-semibold"> tudo 100% online e gratuito.</span>
            </p>

            {/* Workflow Pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {["Topografia", "Dimensionamento", "Orçamento", "Simulação", "Planejamento", "Revisão", "Execução", "Exportação"].map((step, i) => (
                <span key={i} className="bg-white px-4 py-2 rounded-full text-sm font-medium text-gray-700 shadow-sm border border-gray-100">
                  {step}
                </span>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <button className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:-translate-y-1">
                Acessar Plataforma
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-4 rounded-2xl text-lg font-semibold border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                <Play className="w-5 h-5" />
                Agendar Demonstração
              </button>
            </div>

            {/* Hero Badges */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {heroBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-sm text-gray-600 shadow-sm">
                  <span className="text-blue-600">{badge.icon}</span>
                  {badge.text}
                </div>
              ))}
            </div>

            {/* Trust Badge */}
            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <Shield className="w-5 h-5" />
                <span className="font-semibold text-sm">Plataforma Verificada</span>
              </div>
              <div className="h-4 w-px bg-gray-200"></div>
              <span className="text-gray-500 text-sm">Confiada por engenheiros em todo o Brasil</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto">
            {heroStats.map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 text-center shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-gray-500 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tech Pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
              <Activity className="w-4 h-4" />
              EPANET via WebAssembly
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" />
              SINAPI/SICRO integrado
            </div>
            <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium">
              <Map className="w-4 h-4" />
              Exportação QGIS nativa
            </div>
            <div className="flex items-center gap-2 bg-cyan-50 text-cyan-700 px-4 py-2 rounded-lg text-sm font-medium">
              <Cloud className="w-4 h-4" />
              100% Online
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* IMPACT METRICS */}
      {/* ===================================================================== */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {impactMetrics.map((metric, i) => (
              <div key={i} className="text-center">
                <div className={`text-4xl md:text-5xl font-bold ${metric.color} mb-2`}>
                  {metric.value}
                </div>
                <div className="text-gray-600 font-medium">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* CHALLENGES & SOLUTION */}
      {/* ===================================================================== */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Desafios Comuns na Engenharia de Saneamento?
              <span className="block text-blue-600">Nós Resolvemos.</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Complexidade de softwares, falta de integração, erros manuais, lentidão nos processos e custos elevados.
              O HydroNetwork é a solução integrada que simplifica, acelera e otimiza todo o ciclo de vida dos projetos.
            </p>
          </div>

          {/* Challenges Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {challenges.map((challenge, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                  challenge.color === 'red' ? 'bg-red-100 text-red-600' :
                  challenge.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                  challenge.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {challenge.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{challenge.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{challenge.description}</p>
              </div>
            ))}
          </div>

          {/* Solution Card */}
          <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Zap className="w-6 h-6" />
                </div>
                <span className="font-semibold text-blue-100">A Solução: HydroNetwork</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Uma plataforma única onde os dados fluem da topografia ao RDO sem redigitação.
              </h3>
              <p className="text-blue-100 text-lg mb-6 max-w-2xl">
                Importe uma vez, use em todos os módulos. Dimensione, orce, planeje e acompanhe — tudo no navegador.
              </p>
              <button className="flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
                Conhecer a Plataforma
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* WORKFLOW - 8 ETAPAS */}
      {/* ===================================================================== */}
      <section id="fluxo" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <Workflow className="w-4 h-4" />
              Do Projeto à Entrega
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              O Fluxo Completo em 8 Etapas
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              8 etapas integradas que cobrem todo o ciclo de um projeto de saneamento,
              garantindo eficiência e precisão do início ao fim.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.map((step, i) => (
              <div key={i} className="group relative">
                <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-blue-200 transition-all hover:shadow-lg">
                  {/* Step Number */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {step.step}
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-100 transition-colors">
                    {step.icon}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>

                {/* Connector Arrow (except last) */}
                {i < workflowSteps.length - 1 && i % 4 !== 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ChevronRight className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              <Eye className="w-5 h-5" />
              Ver Todos os Módulos
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MÓDULOS - CATÁLOGO COMPLETO */}
      {/* ===================================================================== */}
      <section id="modulos" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <LayoutGrid className="w-4 h-4" />
              Catálogo Completo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Descubra o Poder dos 30+ Módulos Integrados
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Cada módulo foi projetado para resolver um problema real da engenharia de saneamento,
              oferecendo ferramentas precisas e automatizadas.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {moduleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveModuleCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeModuleCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat.label}
                <span className={`ml-1.5 ${activeModuleCategory === cat.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  ({cat.count})
                </span>
              </button>
            ))}
          </div>

          {/* Modules Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map((module, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-all group relative overflow-hidden">
                {/* Badge */}
                {module.badge && (
                  <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                    {module.badge}
                  </div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  module.color === 'blue' ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200' :
                  module.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200' :
                  module.color === 'cyan' ? 'bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200' :
                  module.color === 'indigo' ? 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200' :
                  module.color === 'violet' ? 'bg-violet-100 text-violet-600 group-hover:bg-violet-200' :
                  module.color === 'green' ? 'bg-green-100 text-green-600 group-hover:bg-green-200' :
                  module.color === 'teal' ? 'bg-teal-100 text-teal-600 group-hover:bg-teal-200' :
                  module.color === 'orange' ? 'bg-orange-100 text-orange-600 group-hover:bg-orange-200' :
                  module.color === 'rose' ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-200' :
                  module.color === 'pink' ? 'bg-pink-100 text-pink-600 group-hover:bg-pink-200' :
                  module.color === 'amber' ? 'bg-amber-100 text-amber-600 group-hover:bg-amber-200' :
                  module.color === 'sky' ? 'bg-sky-100 text-sky-600 group-hover:bg-sky-200' :
                  module.color === 'purple' ? 'bg-purple-100 text-purple-600 group-hover:bg-purple-200' :
                  module.color === 'lime' ? 'bg-lime-100 text-lime-600 group-hover:bg-lime-200' :
                  module.color === 'red' ? 'bg-red-100 text-red-600 group-hover:bg-red-200' :
                  module.color === 'fuchsia' ? 'bg-fuchsia-100 text-fuchsia-600 group-hover:bg-fuchsia-200' :
                  module.color === 'slate' ? 'bg-slate-100 text-slate-600 group-hover:bg-slate-200' :
                  'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                }`}>
                  {module.icon}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{module.description}</p>

                {/* Features */}
                <ul className="space-y-2">
                  {module.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:shadow-xl hover:shadow-blue-500/30 transition-all">
              Acessar Plataforma Completa
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* COMPARISON TABLE */}
      {/* ===================================================================== */}
      <section id="comparativo" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que Engenheiros Migram para o HydroNetwork?
            </h2>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="grid grid-cols-4 bg-slate-50 border-b border-gray-200">
              <div className="p-4 font-semibold text-gray-900">Funcionalidade</div>
              <div className="p-4 text-center font-semibold text-gray-500">Planilhas</div>
              <div className="p-4 text-center font-semibold text-gray-500">Outros Softwares</div>
              <div className="p-4 text-center font-semibold text-blue-600 bg-blue-50">HydroNetwork</div>
            </div>

            {/* Rows */}
            {comparisonFeatures.map((row, i) => (
              <div key={i} className={`grid grid-cols-4 border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                <div className="p-4 text-gray-700 text-sm">{row.feature}</div>
                <div className="p-4 flex justify-center"><ComparisonIcon value={row.planilhas} /></div>
                <div className="p-4 flex justify-center"><ComparisonIcon value={row.outros} /></div>
                <div className="p-4 flex justify-center bg-blue-50/50"><ComparisonIcon value={row.hydro} /></div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CircleCheck className="w-5 h-5 text-emerald-500" />
              <span>Suportado</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-5 h-5 text-yellow-500" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span>Não suportado</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* TECHNOLOGY & SECURITY */}
      {/* ===================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tecnologia de Ponta e Segurança Inabalável
            </h2>
          </div>

          {/* Tech Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {technologies.map((tech, i) => (
              <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400">
                  {tech.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{tech.title}</h3>
                <p className="text-slate-400 text-sm">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* CONSTRUDATA OBRAS */}
      {/* ===================================================================== */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-8 md:p-12 border border-orange-100">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-orange-500 p-3 rounded-2xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">ConstruData — Obras</h3>
                <p className="text-orange-600 font-medium">Plataforma de gestão de obras civis</p>
              </div>
            </div>

            <p className="text-gray-600 mb-6 text-lg">
              Além do HydroNetwork, oferecemos o ConstruData Obras — com 26 módulos focados em gestão operacional:
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {obrasModules.map((module, i) => (
                <span key={i} className="bg-white px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-orange-200">
                  {module}
                </span>
              ))}
            </div>

            <button className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
              Ver Catálogo Completo
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SUGGESTION CTA */}
      {/* ===================================================================== */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg flex flex-col md:flex-row items-center gap-6">
            <div className="bg-purple-100 p-4 rounded-2xl">
              <Lightbulb className="w-10 h-10 text-purple-600" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tem uma ideia de funcionalidade?</h3>
              <p className="text-gray-600">
                Tem alguma funcionalidade ou sistema que, se tivesse, otimizaria muito sua operação e seu tempo?
                Conte pra gente e podemos criar pra você!
              </p>
            </div>
            <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap">
              <Send className="w-4 h-4" />
              Enviar Sugestão
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* FAQ */}
      {/* ===================================================================== */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Dúvidas Respondidas
            </h2>
            <p className="text-lg text-gray-600">
              Tire suas dúvidas sobre o HydroNetwork e a plataforma ConstruData
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-slate-50 rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-slate-100 transition-colors"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                >
                  <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${activeFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {activeFaq === index && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* FINAL CTA */}
      {/* ===================================================================== */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Pronto para Transformar Seus Projetos de Saneamento?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Experimente o HydroNetwork hoje mesmo. 30+ módulos integrados. Do pré-dimensionamento ao RDO. 100% online.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-blue-50 transition-all hover:shadow-xl">
              Acessar Plataforma Grátis
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="flex items-center justify-center gap-2 bg-blue-500/30 text-white px-8 py-4 rounded-2xl text-lg font-semibold border-2 border-white/30 hover:bg-blue-500/50 transition-all">
              <MessageSquare className="w-5 h-5" />
              Falar com Especialista
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-12 text-blue-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>100% Gratuito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Sem instalação</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>30+ módulos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Suporte em português</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* FOOTER */}
      {/* ===================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-2 rounded-xl">
                  <Droplets className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white">ConstruData</span>
                  <span className="text-lg font-bold text-blue-400 ml-1">HydroNetwork</span>
                </div>
              </div>
              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                Plataforma completa para engenharia de saneamento.
                Do pré-dimensionamento ao RDO, tudo integrado e conforme as normas brasileiras.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Plataforma</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Módulos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Como Funciona</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>contato@construdata.com.br</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>(11) 99999-9999</span>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>São Paulo, SP</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              © 2024 ConstruData. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">LGPD</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

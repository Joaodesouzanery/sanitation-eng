// Landing Page - ConstruData | HydroNetwork
// Compatível com Lovable (React + TypeScript + Tailwind CSS)
// Copie este código para o Lovable

import React, { useState } from 'react';
import {
  Droplets,
  Calculator,
  FileSpreadsheet,
  Map,
  BarChart3,
  Clock,
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
  Play,
  Menu,
  X,
  ChevronDown,
  Ruler,
  FileText,
  Calendar,
  Camera,
  Layers,
  TrendingUp,
  Users,
  Building2,
  Award,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

// ============================================
// COMPONENTES DA LANDING PAGE
// ============================================

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Dados dos módulos
  const modules = [
    {
      icon: <Map className="w-8 h-8" />,
      title: "Topografia",
      description: "Importe dados topográficos de CSV/TXT e visualize no mapa interativo com processamento automático de pontos."
    },
    {
      icon: <Calculator className="w-8 h-8" />,
      title: "Cálculo Hidráulico",
      description: "Dimensionamento automático conforme NBR 9649, 12218 e 14486. Vazões, velocidades, profundidades calculadas em segundos."
    },
    {
      icon: <Ruler className="w-8 h-8" />,
      title: "Quantitativos",
      description: "Volumes de escavação, escoramento, berço, reaterro e pavimento calculados automaticamente por trecho."
    },
    {
      icon: <FileSpreadsheet className="w-8 h-8" />,
      title: "Orçamento",
      description: "Integração com SINAPI, aplicação de BDI e custo por metro linear. Orçamento completo em minutos."
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Planejamento",
      description: "Cronograma Gantt, Curva S, alocação de recursos e índices de produtividade para gestão completa."
    },
    {
      icon: <Camera className="w-8 h-8" />,
      title: "RDO Digital",
      description: "Relatório Diário de Obra digital com fotos geolocalizadas, equipes, equipamentos e apontamentos."
    },
    {
      icon: <Layers className="w-8 h-8" />,
      title: "Exportação GIS",
      description: "Exporte para Shapefile, GeoJSON, GeoPackage, KML e DXF. Integração total com CAD e GIS."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Perfil Longitudinal",
      description: "Visualização de seções verticais com cotas, declividades e interferências de forma automática."
    }
  ];

  // Dados de benefícios
  const benefits = [
    {
      icon: <Clock className="w-12 h-12 text-blue-500" />,
      stat: "90%",
      title: "Redução de Tempo",
      description: "O que levava 2 semanas em planilhas, agora leva 2 horas na plataforma."
    },
    {
      icon: <Shield className="w-12 h-12 text-green-500" />,
      stat: "100%",
      title: "Conformidade NBR",
      description: "Cálculos validados conforme NBR 9649, 12218 e 14486 automaticamente."
    },
    {
      icon: <Zap className="w-12 h-12 text-yellow-500" />,
      stat: "5x",
      title: "Mais Produtividade",
      description: "Elimine retrabalho com dados consistentes entre todos os módulos."
    },
    {
      icon: <BarChart3 className="w-12 h-12 text-purple-500" />,
      stat: "Real-time",
      title: "Visibilidade Total",
      description: "Acompanhe o progresso físico e financeiro de qualquer lugar."
    }
  ];

  // Planos de preços
  const plans = [
    {
      name: "Demo",
      price: "Grátis",
      period: "",
      description: "Para conhecer a plataforma",
      features: [
        "Até 500m de rede",
        "Cálculo hidráulico básico",
        "Visualização no mapa",
        "Exportação limitada",
        "Suporte por email"
      ],
      cta: "Começar Grátis",
      highlighted: false
    },
    {
      name: "Pro",
      price: "R$ 497",
      period: "/mês",
      description: "Para profissionais e pequenas empresas",
      features: [
        "Redes ilimitadas",
        "Todos os módulos",
        "Integração SINAPI",
        "RDO Digital completo",
        "Exportação GIS/CAD",
        "Suporte prioritário",
        "Atualizações incluídas"
      ],
      cta: "Assinar Agora",
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "Personalizado",
      period: "",
      description: "Para grandes empresas e órgãos públicos",
      features: [
        "Tudo do Pro",
        "Múltiplos usuários",
        "API para integração",
        "Treinamento presencial",
        "Customizações",
        "SLA garantido",
        "Gerente de conta dedicado"
      ],
      cta: "Falar com Vendas",
      highlighted: false
    }
  ];

  // FAQ
  const faqs = [
    {
      question: "A plataforma funciona offline?",
      answer: "Sim! Os cálculos hidráulicos rodam localmente no navegador. Você só precisa de internet para sincronizar dados e usar o mapa online."
    },
    {
      question: "Posso importar dados de outras ferramentas?",
      answer: "Sim, suportamos importação de CSV, TXT para topografia e planilhas Excel para dados cadastrais. Também exportamos para os principais formatos GIS e CAD."
    },
    {
      question: "Os cálculos seguem quais normas?",
      answer: "Todos os cálculos seguem as normas brasileiras: NBR 9649 (esgoto), NBR 12218 (água) e NBR 14486 (drenagem). As fórmulas e parâmetros são validados automaticamente."
    },
    {
      question: "Como funciona a integração com SINAPI?",
      answer: "A base SINAPI é atualizada mensalmente. Você seleciona o estado/mês de referência e os custos são aplicados automaticamente aos quantitativos calculados."
    },
    {
      question: "Posso cancelar a assinatura a qualquer momento?",
      answer: "Sim, não há fidelidade. Você pode cancelar quando quiser e seus dados ficam disponíveis para download por 30 dias após o cancelamento."
    }
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ============================================ */}
      {/* NAVBAR */}
      {/* ============================================ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Droplets className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">
                ConstruData <span className="text-blue-600">HydroNetwork</span>
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#modulos" className="text-gray-600 hover:text-blue-600 transition-colors">Módulos</a>
              <a href="#beneficios" className="text-gray-600 hover:text-blue-600 transition-colors">Benefícios</a>
              <a href="#precos" className="text-gray-600 hover:text-blue-600 transition-colors">Preços</a>
              <a href="#faq" className="text-gray-600 hover:text-blue-600 transition-colors">FAQ</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <button className="text-gray-600 hover:text-blue-600 transition-colors">
                Entrar
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Teste Grátis
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="flex flex-col gap-4 px-4">
              <a href="#modulos" className="text-gray-600 py-2">Módulos</a>
              <a href="#beneficios" className="text-gray-600 py-2">Benefícios</a>
              <a href="#precos" className="text-gray-600 py-2">Preços</a>
              <a href="#faq" className="text-gray-600 py-2">FAQ</a>
              <hr />
              <button className="text-gray-600 py-2 text-left">Entrar</button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                Teste Grátis
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ============================================ */}
      {/* HERO SECTION */}
      {/* ============================================ */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Plataforma 100% Brasileira
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Projete redes de
                <span className="text-blue-600"> saneamento </span>
                em minutos, não semanas
              </h1>

              <p className="text-xl text-gray-600 mb-8">
                Substitua 5 planilhas por uma plataforma integrada.
                Da topografia ao RDO, tudo conectado e conforme as normas NBR.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all hover:scale-105">
                  Começar Grátis
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button className="flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold border border-gray-200 hover:border-blue-300 transition-all">
                  <Play className="w-5 h-5" />
                  Ver Demonstração
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Conforme NBR 9649/12218/14486</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Integração SINAPI</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Sem cartão de crédito</span>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image/Mockup */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-1">
                <div className="bg-white rounded-xl p-4">
                  {/* Mockup da Interface */}
                  <div className="bg-gray-100 rounded-lg p-4 space-y-4">
                    {/* Header do Mockup */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div className="text-xs text-gray-500">ConstruData HydroNetwork</div>
                    </div>

                    {/* Simulação de Mapa */}
                    <div className="bg-blue-100 rounded-lg h-48 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-30">
                        <svg className="w-full h-full" viewBox="0 0 400 200">
                          {/* Linhas simulando rede */}
                          <path d="M50,100 L150,80 L250,120 L350,90" stroke="#2563eb" strokeWidth="3" fill="none" />
                          <path d="M100,150 L150,80" stroke="#2563eb" strokeWidth="2" fill="none" />
                          <path d="M250,120 L280,180" stroke="#2563eb" strokeWidth="2" fill="none" />
                          {/* Pontos/Nós */}
                          <circle cx="50" cy="100" r="6" fill="#2563eb" />
                          <circle cx="150" cy="80" r="6" fill="#2563eb" />
                          <circle cx="250" cy="120" r="6" fill="#2563eb" />
                          <circle cx="350" cy="90" r="6" fill="#2563eb" />
                        </svg>
                      </div>
                      <Map className="w-16 h-16 text-blue-300" />
                    </div>

                    {/* Cards de Dados */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded p-2 text-center">
                        <div className="text-lg font-bold text-blue-600">3.2 km</div>
                        <div className="text-xs text-gray-500">Extensão</div>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <div className="text-lg font-bold text-green-600">45</div>
                        <div className="text-xs text-gray-500">Trechos</div>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <div className="text-lg font-bold text-purple-600">R$ 2.1M</div>
                        <div className="text-xs text-gray-500">Orçamento</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">NBR Validado</div>
                  <div className="text-xs text-gray-500">Cálculos conformes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PROBLEMA/SOLUÇÃO */}
      {/* ============================================ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* O Problema */}
            <div className="bg-white rounded-2xl p-8 border border-red-100">
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                O Problema
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Você ainda usa 5 planilhas diferentes?
              </h3>
              <ul className="space-y-3">
                {[
                  "Planilha de cálculo hidráulico",
                  "Planilha de quantitativos",
                  "Planilha de orçamento",
                  "Planilha de cronograma",
                  "Planilha de RDO"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-gray-500 text-sm">
                Dados copiados manualmente, erros de consistência, horas perdidas atualizando múltiplos arquivos...
              </p>
            </div>

            {/* A Solução */}
            <div className="bg-white rounded-2xl p-8 border border-green-100">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                A Solução
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Uma plataforma, fluxo completo
              </h3>
              <ul className="space-y-3">
                {[
                  "Topografia → Cálculo → Quantitativo → Orçamento",
                  "Altere um parâmetro, tudo atualiza automaticamente",
                  "Conformidade NBR garantida em cada cálculo",
                  "RDO digital integrado ao cronograma",
                  "Exportação GIS/CAD com um clique"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-gray-500 text-sm">
                Dados consistentes, cálculos validados, tempo economizado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* MÓDULOS */}
      {/* ============================================ */}
      <section id="modulos" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              8 Módulos Integrados
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Do levantamento topográfico até o acompanhamento de obra.
              Tudo o que você precisa em uma única plataforma.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map((module, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all group"
              >
                <div className="bg-blue-50 rounded-lg w-14 h-14 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-100 transition-colors">
                  {module.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {module.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {module.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* BENEFÍCIOS */}
      {/* ============================================ */}
      <section id="beneficios" className="py-20 bg-gradient-to-br from-blue-900 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Resultados Reais
            </h2>
            <p className="text-xl text-blue-200 max-w-2xl mx-auto">
              Engenheiros e empresas de saneamento já estão economizando tempo e aumentando a qualidade dos projetos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="bg-white/10 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  {benefit.icon}
                </div>
                <div className="text-4xl font-bold mb-2">{benefit.stat}</div>
                <div className="text-lg font-semibold mb-2">{benefit.title}</div>
                <p className="text-blue-200 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* COMO FUNCIONA */}
      {/* ============================================ */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Como Funciona
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Em 4 passos simples, você vai do levantamento ao orçamento completo.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Importe a Topografia",
                description: "Carregue seus pontos de CSV/TXT ou desenhe diretamente no mapa."
              },
              {
                step: "2",
                title: "Configure Parâmetros",
                description: "Selecione o tipo de rede (esgoto, água, drenagem) e os parâmetros NBR."
              },
              {
                step: "3",
                title: "Calcule e Valide",
                description: "O sistema calcula automaticamente e valida conforme as normas brasileiras."
              },
              {
                step: "4",
                title: "Exporte Resultados",
                description: "Gere orçamentos, cronogramas e exporte para GIS/CAD."
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>

                {/* Connector Line */}
                {index < 3 && (
                  <div className="hidden md:block absolute top-6 left-16 w-full h-0.5 bg-blue-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PÚBLICO-ALVO */}
      {/* ============================================ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Para Quem é o HydroNetwork?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Users className="w-10 h-10" />,
                title: "Consultorias de Engenharia",
                description: "Projete múltiplas redes de saneamento com agilidade e precisão. Reduza prazos de entrega e aumente a qualidade."
              },
              {
                icon: <Building2 className="w-10 h-10" />,
                title: "Prefeituras e Autarquias",
                description: "Planeje expansões de redes, estime orçamentos de CAPEX e acompanhe obras em andamento com transparência."
              },
              {
                icon: <Award className="w-10 h-10" />,
                title: "Construtoras",
                description: "Elabore propostas precisas para licitações, gerencie RDOs digitais e mantenha controle total da execução."
              }
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
                <div className="bg-blue-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 text-blue-600">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PREÇOS */}
      {/* ============================================ */}
      <section id="precos" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Planos e Preços
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comece grátis e escale conforme sua necessidade. Sem surpresas, sem taxas ocultas.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white ring-4 ring-blue-300 scale-105'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-block bg-white text-blue-600 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                    Mais Popular
                  </div>
                )}
                <h3 className={`text-xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <div className="mt-4 mb-2">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={plan.highlighted ? 'text-blue-200' : 'text-gray-500'}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mb-6 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className={`w-5 h-5 ${plan.highlighted ? 'text-blue-200' : 'text-green-500'}`} />
                      <span className={plan.highlighted ? 'text-white' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FAQ */}
      {/* ============================================ */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      activeFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeFaq === index && (
                  <div className="px-6 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* CTA FINAL */}
      {/* ============================================ */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para revolucionar seus projetos de saneamento?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Comece grátis hoje. Sem cartão de crédito, sem compromisso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-50 transition-colors">
              Começar Grátis Agora
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="flex items-center justify-center gap-2 bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-400 transition-colors border border-blue-400">
              <Phone className="w-5 h-5" />
              Falar com Especialista
            </button>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">
                  ConstruData <span className="text-blue-500">HydroNetwork</span>
                </span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Plataforma integrada para projetos de redes de saneamento.
                Da topografia ao RDO, tudo conforme as normas brasileiras.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Produto</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Módulos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2">
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

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              © 2024 ConstruData. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

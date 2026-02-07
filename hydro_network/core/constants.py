"""
Constantes e parâmetros de engenharia para cálculos hidráulicos.

LEGENDA DE NOMENCLATURAS:
========================
HIDRÁULICA GERAL:
    Q       = Vazão (m³/s ou L/s)
    V       = Velocidade (m/s)
    D, DN   = Diâmetro nominal (mm ou m)
    S       = Declividade (m/m)
    n       = Coeficiente de Manning
    C       = Coeficiente de Hazen-Williams
    H       = Carga hidráulica / Head (m)
    hf      = Perda de carga (m)

ESGOTO:
    Qm      = Vazão média (L/s)
    Qp      = Vazão de pico (L/s)
    Qinf    = Vazão de infiltração (L/s)
    Kp      = Coeficiente de pico
    y/D     = Relação lâmina/diâmetro
    yD      = Mesmo que y/D (para campos SHP)

ÁGUA:
    Qmd     = Vazão média diária (L/s)
    Qmh     = Vazão máxima horária (L/s)
    Pmin    = Pressão mínima (mca)
    Pmax    = Pressão máxima (mca)
    K1      = Coeficiente do dia de maior consumo
    K2      = Coeficiente da hora de maior consumo

DRENAGEM:
    A       = Área de contribuição (ha)
    Cr      = Coeficiente de runoff
    i       = Intensidade de chuva (mm/h)
    tc      = Tempo de concentração (min)
    T       = Período de retorno (anos)

CONSTRUÇÃO:
    EXC     = Escavação (m³)
    SHOR    = Escoramento (m²)
    BED     = Berço (m³)
    ENV     = Envoltória (m³)
    BFILL   = Reaterro (backfill) (m³)
    WASTE   = Bota-fora (m³)
    SUBB    = Sub-base (m³)
    BASE    = Base (m³)
    ASPH    = Asfalto (m³)
"""

from typing import Dict, List
import math

# =============================================================================
# CONSTANTES FÍSICAS
# =============================================================================
GRAVITY = 9.81  # m/s²
WATER_DENSITY = 1000  # kg/m³
PI = math.pi

# =============================================================================
# ESGOTO - PARÂMETROS PADRÃO
# =============================================================================
class SewerDefaults:
    """Parâmetros padrão para rede de esgoto sanitário."""

    # Contribuições
    QPC = 200  # Consumo per capita (L/hab.dia)
    HAB_POR_UH = 3.5  # Habitantes por unidade habitacional
    COEF_RETORNO = 0.8  # Coeficiente de retorno esgoto/água

    # Infiltração
    TAXA_INFILTRACAO = 0.0005  # L/s por metro de rede (0.5 L/s.km)

    # Fator de pico (Harmon)
    @staticmethod
    def fator_pico_harmon(pop_milhares: float) -> float:
        """Fator de pico por fórmula de Harmon."""
        if pop_milhares <= 0:
            return 4.0
        return 1 + 14 / (4 + math.sqrt(pop_milhares))

    # Hidráulica
    MANNING_N = 0.013  # PVC/Concreto liso
    S_MIN = 0.005  # Declividade mínima (0.5%)
    S_MAX = 0.15  # Declividade máxima (15%)
    V_MIN = 0.6  # Velocidade mínima (m/s)
    V_MAX = 5.0  # Velocidade máxima (m/s)
    YD_MIN = 0.2  # Lâmina mínima (y/D)
    YD_MAX = 0.75  # Lâmina máxima (y/D)

    # Cobertura
    COBERTURA_MIN = 0.90  # Cobertura mínima sobre o tubo (m)
    COBERTURA_MAX = 6.0  # Cobertura máxima (m)

    # Diâmetros comerciais (mm)
    DN_COMERCIAIS = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200]
    DN_MIN = 150  # Diâmetro mínimo (mm)


# =============================================================================
# ÁGUA - PARÂMETROS PADRÃO
# =============================================================================
class WaterDefaults:
    """Parâmetros padrão para rede de água pressurizada."""

    # Demandas
    QPC = 200  # Consumo per capita (L/hab.dia)
    HAB_POR_UH = 3.5  # Habitantes por unidade habitacional
    K1 = 1.2  # Coeficiente do dia de maior consumo
    K2 = 1.5  # Coeficiente da hora de maior consumo

    # Pressões
    P_MIN = 10.0  # Pressão mínima (mca)
    P_MAX = 50.0  # Pressão máxima (mca)
    P_ESTATICA_MAX = 50.0  # Pressão estática máxima (mca)

    # Hidráulica
    HAZEN_WILLIAMS_C = 140  # PVC
    V_MIN = 0.5  # Velocidade mínima (m/s)
    V_MAX = 3.5  # Velocidade máxima (m/s)

    # Diâmetros comerciais (mm)
    DN_COMERCIAIS = [50, 75, 100, 150, 200, 250, 300, 400, 500, 600]
    DN_MIN = 50  # Diâmetro mínimo (mm)

    # Bombeamento
    RENDIMENTO_BOMBA = 0.75  # Rendimento típico


# =============================================================================
# DRENAGEM - PARÂMETROS PADRÃO
# =============================================================================
class DrainageDefaults:
    """Parâmetros padrão para rede de drenagem pluvial."""

    # Método racional
    PERIODO_RETORNO = 10  # anos

    # Coeficientes de runoff típicos
    COEF_RUNOFF = {
        'telhado': 0.95,
        'asfalto': 0.90,
        'concreto': 0.85,
        'paralelepipedo': 0.75,
        'solo_compactado': 0.60,
        'grama': 0.25,
        'area_verde': 0.15,
        'misto_urbano': 0.70,
    }

    # Hidráulica (Manning)
    MANNING_N_CONCRETO = 0.015
    MANNING_N_PEAD = 0.012

    # Limites
    V_MIN = 0.75  # Velocidade mínima (m/s)
    V_MAX = 5.0  # Velocidade máxima (m/s)
    S_MIN = 0.005  # Declividade mínima
    YD_MAX = 0.85  # Lâmina máxima (y/D)

    # Diâmetros comerciais (mm)
    DN_COMERCIAIS = [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000]
    DN_MIN = 300  # Diâmetro mínimo (mm)


# =============================================================================
# CONSTRUÇÃO - PARÂMETROS PADRÃO
# =============================================================================
class ConstructionDefaults:
    """Parâmetros padrão para quantitativos de construção."""

    # Geometria da vala
    LARGURA_MINIMA_VALA = 0.60  # m
    FOLGA_LATERAL = 0.15  # m de cada lado do tubo
    TALUDE_PADRAO = 0  # Vertical (0 = sem talude, 1:1 = 45°)

    # Escoramento
    PROF_ESCORAMENTO = 1.25  # Profundidade a partir da qual é obrigatório

    # Camadas
    ESPESSURA_BERCO = 0.10  # m
    ESPESSURA_ENVOLTORIA = 0.30  # m acima do tubo

    # Pavimento
    FAIXA_TECNICA = 0.30  # m de cada lado da vala
    ESP_SUBBASE = 0.20  # m
    ESP_BASE = 0.15  # m
    ESP_ASFALTO = 0.05  # m (CBUQ)

    # Fatores
    FATOR_EMPOLAMENTO = 1.25  # Expansão do solo escavado


# =============================================================================
# MATERIAIS - COEFICIENTES
# =============================================================================
MANNING_N: Dict[str, float] = {
    'pvc': 0.010,
    'pead': 0.012,
    'concreto_liso': 0.013,
    'concreto_rugoso': 0.016,
    'ferro_fundido': 0.015,
    'aco': 0.012,
    'ceramica': 0.014,
}

HAZEN_WILLIAMS_C: Dict[str, float] = {
    'pvc': 140,
    'pead': 140,
    'ferro_fundido_novo': 130,
    'ferro_fundido_usado': 100,
    'aco_novo': 120,
    'aco_usado': 90,
    'concreto': 120,
    'cimento_amianto': 140,
}


# =============================================================================
# IDF - INTENSIDADE-DURAÇÃO-FREQUÊNCIA (EXEMPLO SP)
# =============================================================================
class IDFSaoPaulo:
    """
    Curva IDF para São Paulo (exemplo).
    i = K * T^a / (t + b)^c
    Onde: i = intensidade (mm/h), T = período retorno (anos), t = duração (min)
    """
    K = 3462.6
    a = 0.172
    b = 20
    c = 1.025

    @classmethod
    def intensidade(cls, T: float, t: float) -> float:
        """Calcula intensidade de chuva em mm/h."""
        return cls.K * (T ** cls.a) / ((t + cls.b) ** cls.c)


# =============================================================================
# NOMENCLATURA PARA CAMPOS SHP (máx 10 caracteres)
# =============================================================================
SHP_FIELD_NAMES = {
    # Identificação
    'id': 'ID',
    'from_node': 'FROM_ND',
    'to_node': 'TO_ND',
    'network_type': 'NET_TYPE',  # SEW (sewer), WAT (water), DRN (drainage)

    # Geometria
    'length': 'LENGTH_M',
    'diameter': 'DN_MM',
    'slope': 'SLOPE',

    # Hidráulica - Esgoto
    'flow': 'Q_LS',
    'velocity': 'V_MS',
    'y_d_ratio': 'YD_RATIO',
    'invert_up': 'INV_UP_M',
    'invert_down': 'INV_DN_M',
    'cover_up': 'COV_UP_M',
    'cover_down': 'COV_DN_M',

    # Hidráulica - Água
    'pressure': 'PRESS_M',
    'head': 'HEAD_M',
    'headloss': 'HLOSS_M',

    # Hidráulica - Drenagem
    'area_contrib': 'AREA_HA',
    'runoff_coef': 'RUNOFF_C',
    'intensity': 'I_MMH',

    # Construção
    'excavation': 'EXC_M3',
    'shoring': 'SHOR_M2',
    'bedding': 'BED_M3',
    'envelope': 'ENV_M3',
    'backfill': 'BFILL_M3',
    'waste': 'WASTE_M3',
    'subbase': 'SUBB_M3',
    'base': 'BASE_M3',
    'asphalt': 'ASPH_M3',
    'pavement_area': 'PAV_M2',

    # Validação
    'status': 'STATUS',  # OK, WARN, ERROR
    'alerts': 'ALERTS',

    # Nós
    'elevation': 'ELEV_M',
    'ground_elev': 'GND_M',
    'demand': 'DEM_LS',
    'population': 'POP',
}


# =============================================================================
# LEGENDAS PARA WEBMAP E RELATÓRIOS
# =============================================================================
FIELD_LEGENDS = {
    'ID': 'Identificador único do elemento',
    'FROM_ND': 'Nó de montante (início)',
    'TO_ND': 'Nó de jusante (fim)',
    'NET_TYPE': 'Tipo de rede: SEW=Esgoto, WAT=Água, DRN=Drenagem',
    'LENGTH_M': 'Comprimento do trecho (m)',
    'DN_MM': 'Diâmetro nominal (mm)',
    'SLOPE': 'Declividade (m/m)',
    'Q_LS': 'Vazão (L/s)',
    'V_MS': 'Velocidade (m/s)',
    'YD_RATIO': 'Relação lâmina/diâmetro (y/D)',
    'INV_UP_M': 'Cota de fundo montante (m)',
    'INV_DN_M': 'Cota de fundo jusante (m)',
    'COV_UP_M': 'Cobertura montante (m)',
    'COV_DN_M': 'Cobertura jusante (m)',
    'PRESS_M': 'Pressão no nó (mca)',
    'HEAD_M': 'Carga hidráulica (m)',
    'HLOSS_M': 'Perda de carga (m)',
    'AREA_HA': 'Área de contribuição (ha)',
    'RUNOFF_C': 'Coeficiente de escoamento',
    'I_MMH': 'Intensidade de chuva (mm/h)',
    'EXC_M3': 'Volume de escavação (m³)',
    'SHOR_M2': 'Área de escoramento (m²)',
    'BED_M3': 'Volume do berço (m³)',
    'ENV_M3': 'Volume da envoltória (m³)',
    'BFILL_M3': 'Volume de reaterro (m³)',
    'WASTE_M3': 'Volume de bota-fora (m³)',
    'SUBB_M3': 'Volume de sub-base (m³)',
    'BASE_M3': 'Volume de base (m³)',
    'ASPH_M3': 'Volume de asfalto CBUQ (m³)',
    'PAV_M2': 'Área de recomposição de pavimento (m²)',
    'STATUS': 'Status da verificação: OK, WARN, ERROR',
    'ALERTS': 'Alertas e violações normativas',
    'ELEV_M': 'Cota do nó (m)',
    'GND_M': 'Cota do terreno (m)',
    'DEM_LS': 'Demanda no nó (L/s)',
    'POP': 'População contribuinte',
}

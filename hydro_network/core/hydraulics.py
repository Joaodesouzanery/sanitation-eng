"""
Funções hidráulicas base para todos os tipos de rede.

Inclui:
- Manning (escoamento livre)
- Hazen-Williams (escoamento sob pressão)
- Dimensionamento de diâmetros
- Cálculos de seção circular
"""

from __future__ import annotations

import math
from typing import List, Optional, Tuple

from .constants import PI, GRAVITY


# =============================================================================
# SEÇÃO CIRCULAR - FUNÇÕES GEOMÉTRICAS
# =============================================================================

def area_circular(D: float, y: float = None) -> float:
    """
    Área de seção circular.

    Args:
        D: Diâmetro (m)
        y: Lâmina d'água (m). Se None, retorna área cheia.

    Returns:
        Área (m²)
    """
    if y is None or y >= D:
        return PI * D * D / 4

    if y <= 0:
        return 0.0

    # Área parcialmente cheia
    r = D / 2
    theta = 2 * math.acos((r - y) / r)
    return r * r * (theta - math.sin(theta)) / 2


def perimetro_molhado(D: float, y: float = None) -> float:
    """
    Perímetro molhado de seção circular.

    Args:
        D: Diâmetro (m)
        y: Lâmina d'água (m). Se None, retorna perímetro cheio.

    Returns:
        Perímetro molhado (m)
    """
    if y is None or y >= D:
        return PI * D

    if y <= 0:
        return 0.0

    r = D / 2
    theta = 2 * math.acos((r - y) / r)
    return r * theta


def raio_hidraulico(D: float, y: float = None) -> float:
    """
    Raio hidráulico de seção circular.

    Args:
        D: Diâmetro (m)
        y: Lâmina d'água (m). Se None, retorna R para seção cheia.

    Returns:
        Raio hidráulico (m)
    """
    A = area_circular(D, y)
    P = perimetro_molhado(D, y)

    if P <= 0:
        return 0.0

    return A / P


def y_d_ratio_from_flow(Q: float, D: float, S: float, n: float) -> float:
    """
    Calcula relação y/D para uma vazão em seção circular (Manning).

    Usa método iterativo (bissecção).

    Args:
        Q: Vazão (m³/s)
        D: Diâmetro (m)
        S: Declividade (m/m)
        n: Coeficiente de Manning

    Returns:
        Relação y/D
    """
    if Q <= 0 or D <= 0 or S <= 0:
        return 0.0

    def flow_at_depth(y: float) -> float:
        A = area_circular(D, y)
        R = raio_hidraulico(D, y)
        if R <= 0:
            return 0.0
        return (1 / n) * A * (R ** (2/3)) * (S ** 0.5)

    # Bissecção
    y_low = 0.001
    y_high = D * 0.99

    for _ in range(50):  # Máximo de iterações
        y_mid = (y_low + y_high) / 2
        Q_mid = flow_at_depth(y_mid)

        if abs(Q_mid - Q) < 1e-9:
            break

        if Q_mid < Q:
            y_low = y_mid
        else:
            y_high = y_mid

    return y_mid / D


# =============================================================================
# MANNING - ESCOAMENTO LIVRE
# =============================================================================

def manning_velocity(R: float, S: float, n: float) -> float:
    """
    Velocidade por Manning.

    V = (1/n) * R^(2/3) * S^(1/2)

    Args:
        R: Raio hidráulico (m)
        S: Declividade (m/m)
        n: Coeficiente de Manning

    Returns:
        Velocidade (m/s)
    """
    if R <= 0 or S <= 0 or n <= 0:
        return 0.0

    return (1 / n) * (R ** (2/3)) * (S ** 0.5)


def manning_flow(A: float, R: float, S: float, n: float) -> float:
    """
    Vazão por Manning.

    Q = (1/n) * A * R^(2/3) * S^(1/2)

    Args:
        A: Área da seção (m²)
        R: Raio hidráulico (m)
        S: Declividade (m/m)
        n: Coeficiente de Manning

    Returns:
        Vazão (m³/s)
    """
    V = manning_velocity(R, S, n)
    return A * V


def manning_flow_circular(D: float, S: float, n: float, y_d: float = 1.0) -> float:
    """
    Vazão por Manning em seção circular.

    Args:
        D: Diâmetro (m)
        S: Declividade (m/m)
        n: Coeficiente de Manning
        y_d: Relação y/D (default 1.0 = seção cheia)

    Returns:
        Vazão (m³/s)
    """
    y = y_d * D
    A = area_circular(D, y)
    R = raio_hidraulico(D, y)
    return manning_flow(A, R, S, n)


def manning_full_capacity(D: float, S: float, n: float) -> float:
    """
    Capacidade máxima (seção cheia) por Manning.

    Args:
        D: Diâmetro (m)
        S: Declividade (m/m)
        n: Coeficiente de Manning

    Returns:
        Vazão máxima (m³/s)
    """
    return manning_flow_circular(D, S, n, y_d=1.0)


def manning_diameter_required(Q: float, S: float, n: float, y_d_max: float = 0.75) -> float:
    """
    Calcula diâmetro necessário para uma vazão (Manning).

    Args:
        Q: Vazão requerida (m³/s)
        S: Declividade (m/m)
        n: Coeficiente de Manning
        y_d_max: Relação y/D máxima permitida

    Returns:
        Diâmetro necessário (m)
    """
    if Q <= 0 or S <= 0:
        return 0.0

    # Fórmula aproximada para seção cheia: Q = (π/4) * D² * (1/n) * (D/4)^(2/3) * S^0.5
    # Simplificando: D ≈ (Q * n / (0.312 * S^0.5))^(3/8)
    D_approx = ((Q * n) / (0.312 * (S ** 0.5))) ** 0.375

    # Ajustar para y/D < 1
    D_adjusted = D_approx / (y_d_max ** 0.625)

    return D_adjusted


def select_commercial_diameter(D_required: float, commercial_diameters: List[int]) -> int:
    """
    Seleciona diâmetro comercial >= diâmetro requerido.

    Args:
        D_required: Diâmetro requerido (m)
        commercial_diameters: Lista de diâmetros comerciais (mm)

    Returns:
        Diâmetro comercial selecionado (mm)
    """
    D_required_mm = D_required * 1000

    for dn in sorted(commercial_diameters):
        if dn >= D_required_mm:
            return dn

    # Se nenhum atende, retorna o maior disponível
    return max(commercial_diameters)


# =============================================================================
# HAZEN-WILLIAMS - ESCOAMENTO SOB PRESSÃO
# =============================================================================

def hazen_williams_headloss(Q: float, D: float, L: float, C: float) -> float:
    """
    Perda de carga por Hazen-Williams.

    hf = 10.643 * (Q^1.85) / (C^1.85 * D^4.87) * L

    Args:
        Q: Vazão (m³/s)
        D: Diâmetro (m)
        L: Comprimento (m)
        C: Coeficiente de Hazen-Williams

    Returns:
        Perda de carga (m)
    """
    if Q <= 0 or D <= 0 or L <= 0 or C <= 0:
        return 0.0

    return 10.643 * (Q ** 1.85) / ((C ** 1.85) * (D ** 4.87)) * L


def hazen_williams_velocity(Q: float, D: float) -> float:
    """
    Velocidade em conduto sob pressão.

    V = Q / A = 4Q / (π * D²)

    Args:
        Q: Vazão (m³/s)
        D: Diâmetro (m)

    Returns:
        Velocidade (m/s)
    """
    if D <= 0:
        return 0.0

    A = PI * D * D / 4
    return Q / A


def hazen_williams_diameter_required(
    Q: float,
    L: float,
    hf_max: float,
    C: float
) -> float:
    """
    Calcula diâmetro necessário para limitar perda de carga.

    Args:
        Q: Vazão (m³/s)
        L: Comprimento (m)
        hf_max: Perda de carga máxima permitida (m)
        C: Coeficiente de Hazen-Williams

    Returns:
        Diâmetro necessário (m)
    """
    if Q <= 0 or hf_max <= 0:
        return 0.0

    # hf = 10.643 * Q^1.85 / (C^1.85 * D^4.87) * L
    # D^4.87 = 10.643 * Q^1.85 * L / (C^1.85 * hf)
    D_exp = 10.643 * (Q ** 1.85) * L / ((C ** 1.85) * hf_max)

    return D_exp ** (1 / 4.87)


# =============================================================================
# BOMBEAMENTO
# =============================================================================

def pump_power(Q: float, dH: float, efficiency: float = 0.75) -> float:
    """
    Potência de bomba.

    P = ρ * g * Q * ΔH / η

    Args:
        Q: Vazão (m³/s)
        dH: Altura manométrica (m)
        efficiency: Rendimento (0-1)

    Returns:
        Potência (kW)
    """
    if Q <= 0 or dH <= 0 or efficiency <= 0:
        return 0.0

    # P = ρ * g * Q * H / η
    P_watts = 1000 * GRAVITY * Q * dH / efficiency
    return P_watts / 1000  # kW


def pump_power_cv(Q: float, dH: float, efficiency: float = 0.75) -> float:
    """
    Potência de bomba em CV (cavalos-vapor).

    Args:
        Q: Vazão (m³/s)
        dH: Altura manométrica (m)
        efficiency: Rendimento (0-1)

    Returns:
        Potência (CV)
    """
    P_kw = pump_power(Q, dH, efficiency)
    return P_kw / 0.7355  # 1 CV = 0.7355 kW


# =============================================================================
# CHUVA - IDF
# =============================================================================

def idf_intensity(T: float, t: float, K: float, a: float, b: float, c: float) -> float:
    """
    Intensidade de chuva pela equação IDF.

    i = K * T^a / (t + b)^c

    Args:
        T: Período de retorno (anos)
        t: Duração (minutos)
        K, a, b, c: Coeficientes da curva IDF

    Returns:
        Intensidade (mm/h)
    """
    if T <= 0 or t <= 0:
        return 0.0

    return K * (T ** a) / ((t + b) ** c)


def rational_method_flow(C: float, i: float, A: float) -> float:
    """
    Vazão pelo método racional.

    Q = 0.00278 * C * i * A

    Args:
        C: Coeficiente de runoff (0-1)
        i: Intensidade de chuva (mm/h)
        A: Área de contribuição (ha)

    Returns:
        Vazão (m³/s)
    """
    return 0.00278 * C * i * A


def time_of_concentration_kirpich(L: float, H: float) -> float:
    """
    Tempo de concentração pela fórmula de Kirpich.

    tc = 0.0195 * L^0.77 * S^(-0.385)

    Args:
        L: Comprimento do talvegue (m)
        H: Desnível (m)

    Returns:
        Tempo de concentração (minutos)
    """
    if L <= 0 or H <= 0:
        return 5.0  # Mínimo de 5 minutos

    S = H / L
    tc = 0.0195 * (L ** 0.77) * (S ** (-0.385))

    return max(tc, 5.0)  # Mínimo de 5 minutos

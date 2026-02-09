"""
Coordinate Systems - Sistemas de Coordenadas e Transformacoes

Este modulo fornece:
- Transformacao entre diferentes sistemas de coordenadas
- Deteccao automatica de sistema de coordenadas
- Suporte a UTM e WGS84
- Funcoes especificas para coordenadas no Brasil
"""

from typing import Tuple, List, Optional, Dict, Any
from dataclasses import dataclass
import math


# Sistemas de coordenadas comuns no Brasil
BRAZIL_CRS_LIST = [
    {"epsg": 4326, "name": "WGS 84", "type": "geographic", "description": "Sistema global de coordenadas geograficas"},
    {"epsg": 4674, "name": "SIRGAS 2000", "type": "geographic", "description": "Sistema oficial do Brasil"},
    {"epsg": 31983, "name": "SIRGAS 2000 / UTM zone 23S", "type": "projected", "description": "Sao Paulo, MG"},
    {"epsg": 31984, "name": "SIRGAS 2000 / UTM zone 24S", "type": "projected", "description": "RJ, ES, BA"},
    {"epsg": 31982, "name": "SIRGAS 2000 / UTM zone 22S", "type": "projected", "description": "PR, SC, RS"},
    {"epsg": 31985, "name": "SIRGAS 2000 / UTM zone 25S", "type": "projected", "description": "PE, AL, SE"},
    {"epsg": 32723, "name": "WGS 84 / UTM zone 23S", "type": "projected", "description": "UTM zona 23 Sul"},
    {"epsg": 32722, "name": "WGS 84 / UTM zone 22S", "type": "projected", "description": "UTM zona 22 Sul"},
    {"epsg": 32724, "name": "WGS 84 / UTM zone 24S", "type": "projected", "description": "UTM zona 24 Sul"},
    {"epsg": 32725, "name": "WGS 84 / UTM zone 25S", "type": "projected", "description": "UTM zona 25 Sul"},
]


@dataclass
class CoordinateBounds:
    """Limites de coordenadas"""
    min_x: float
    min_y: float
    max_x: float
    max_y: float

    def center(self) -> Tuple[float, float]:
        """Retorna o centro dos bounds"""
        return (
            (self.min_x + self.max_x) / 2,
            (self.min_y + self.max_y) / 2
        )

    def is_wgs84(self) -> bool:
        """Verifica se os bounds parecem estar em WGS84 (lat/lon)"""
        return (
            -180 <= self.min_x <= 180 and
            -180 <= self.max_x <= 180 and
            -90 <= self.min_y <= 90 and
            -90 <= self.max_y <= 90
        )

    def is_utm(self) -> bool:
        """Verifica se os bounds parecem estar em UTM (metros)"""
        return (
            100000 <= self.min_x <= 900000 and  # Typical UTM Easting range
            self.min_y > 1000000  # Typical UTM Northing for Southern hemisphere
        )


class CoordinateTransformer:
    """
    Transformador de coordenadas entre diferentes sistemas.

    Suporta transformacoes usando pyproj quando disponivel,
    com fallback para calculos aproximados.
    """

    def __init__(self, source_epsg: int, target_epsg: int = 4326):
        """
        Inicializa o transformador.

        Args:
            source_epsg: EPSG do sistema de origem
            target_epsg: EPSG do sistema de destino (padrao: WGS84)
        """
        self.source_epsg = source_epsg
        self.target_epsg = target_epsg
        self._transformer = None
        self._use_pyproj = False

        try:
            from pyproj import Transformer
            self._transformer = Transformer.from_crs(
                f"EPSG:{source_epsg}",
                f"EPSG:{target_epsg}",
                always_xy=True
            )
            self._use_pyproj = True
        except ImportError:
            pass

    def transform(self, x: float, y: float) -> Tuple[float, float]:
        """
        Transforma coordenadas do sistema de origem para destino.

        Args:
            x: Coordenada X (longitude ou easting)
            y: Coordenada Y (latitude ou northing)

        Returns:
            Tupla (x_destino, y_destino)
        """
        if self._use_pyproj and self._transformer:
            return self._transformer.transform(x, y)
        else:
            # Fallback para calculo aproximado
            return self._approximate_transform(x, y)

    def transform_many(self, coords: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Transforma lista de coordenadas.

        Args:
            coords: Lista de tuplas (x, y)

        Returns:
            Lista de tuplas transformadas
        """
        return [self.transform(x, y) for x, y in coords]

    def _approximate_transform(self, x: float, y: float) -> Tuple[float, float]:
        """Transformacao aproximada quando pyproj nao esta disponivel"""
        # Se ja estiver em WGS84, retorna como esta
        if self.source_epsg == self.target_epsg:
            return (x, y)

        # Se origem e UTM e destino e WGS84
        if self.source_epsg in range(32600, 32761) or self.source_epsg in range(31970, 31986):
            zone = self.source_epsg % 100 if self.source_epsg < 32700 else (self.source_epsg - 32700) % 100
            is_south = self.source_epsg >= 32700 or self.source_epsg in range(31982, 31986)
            lon, lat = utm_to_wgs84_approx(x, y, zone, is_south)
            return (lon, lat)

        # Fallback: assume que ja esta no formato correto
        return (x, y)

    def inverse(self, x: float, y: float) -> Tuple[float, float]:
        """
        Transformacao inversa (destino -> origem).

        Args:
            x: Coordenada X no sistema de destino
            y: Coordenada Y no sistema de destino

        Returns:
            Tupla (x_origem, y_origem)
        """
        if self._use_pyproj:
            from pyproj import Transformer
            inv_transformer = Transformer.from_crs(
                f"EPSG:{self.target_epsg}",
                f"EPSG:{self.source_epsg}",
                always_xy=True
            )
            return inv_transformer.transform(x, y)
        else:
            # Fallback
            return self._approximate_inverse(x, y)

    def _approximate_inverse(self, x: float, y: float) -> Tuple[float, float]:
        """Transformacao inversa aproximada"""
        if self.source_epsg == self.target_epsg:
            return (x, y)

        # Se destino e WGS84 e origem e UTM
        if self.target_epsg == 4326:
            zone = self.source_epsg % 100 if self.source_epsg < 32700 else (self.source_epsg - 32700) % 100
            is_south = self.source_epsg >= 32700 or self.source_epsg in range(31982, 31986)
            easting, northing = wgs84_to_utm_approx(x, y, zone, is_south)
            return (easting, northing)

        return (x, y)


def utm_zone_from_lon(longitude: float) -> int:
    """
    Calcula a zona UTM a partir da longitude.

    Args:
        longitude: Longitude em graus decimais

    Returns:
        Numero da zona UTM (1-60)
    """
    return int((longitude + 180) / 6) + 1


def get_epsg_for_utm_zone(zone: int, southern_hemisphere: bool = True) -> int:
    """
    Retorna o codigo EPSG para uma zona UTM.

    Args:
        zone: Numero da zona UTM (1-60)
        southern_hemisphere: True para hemisferio sul

    Returns:
        Codigo EPSG
    """
    if southern_hemisphere:
        return 32700 + zone
    else:
        return 32600 + zone


def detect_coordinate_system(bounds: CoordinateBounds) -> Optional[Dict[str, Any]]:
    """
    Detecta o sistema de coordenadas baseado nos bounds.

    Args:
        bounds: Limites das coordenadas

    Returns:
        Dicionario com informacoes do sistema detectado
    """
    if bounds.is_wgs84():
        return {
            "epsg": 4326,
            "name": "WGS 84",
            "type": "geographic",
            "confidence": "high"
        }

    if bounds.is_utm():
        # Tenta detectar a zona UTM
        # Para Brasil, as zonas mais comuns sao 22, 23, 24, 25
        center = bounds.center()

        # Estimativa baseada no easting
        # Cada zona tem 6 graus de largura
        # Centro da zona tem easting ~500000

        # Para hemisferio sul
        possible_zones = []
        if 166000 <= center[0] <= 834000:
            # Parece UTM valido
            if center[1] > 10000000:  # Hemisferio sul
                return {
                    "epsg": 31983,  # Assume zona 23S como padrao para Brasil
                    "name": "SIRGAS 2000 / UTM zone 23S",
                    "type": "projected",
                    "confidence": "medium",
                    "note": "Sistema detectado automaticamente. Confirme a zona UTM."
                }
            else:
                return {
                    "epsg": 32723,
                    "name": "WGS 84 / UTM zone 23S",
                    "type": "projected",
                    "confidence": "medium"
                }

    return None


def transform_coordinates(
    coords: List[Tuple[float, float]],
    source_epsg: int,
    target_epsg: int = 4326
) -> List[Tuple[float, float]]:
    """
    Funcao de conveniencia para transformar lista de coordenadas.

    Args:
        coords: Lista de tuplas (x, y)
        source_epsg: EPSG do sistema de origem
        target_epsg: EPSG do sistema de destino

    Returns:
        Lista de coordenadas transformadas
    """
    transformer = CoordinateTransformer(source_epsg, target_epsg)
    return transformer.transform_many(coords)


# =====================================================
# Funcoes auxiliares de transformacao UTM <-> WGS84
# =====================================================

def utm_to_wgs84_approx(easting: float, northing: float, zone: int, southern: bool) -> Tuple[float, float]:
    """
    Converte UTM para WGS84 (aproximado).

    Esta e uma implementacao simplificada. Para precisao,
    use pyproj.

    Args:
        easting: Coordenada E (metros)
        northing: Coordenada N (metros)
        zone: Zona UTM
        southern: True se hemisferio sul

    Returns:
        Tupla (longitude, latitude) em graus decimais
    """
    # Constantes
    k0 = 0.9996
    a = 6378137.0  # WGS84 semi-major axis
    e = 0.0818191908  # WGS84 eccentricity

    # Ajusta northing para hemisferio sul
    if southern:
        northing = 10000000 - northing if northing < 10000000 else northing - 10000000

    x = easting - 500000
    y = northing

    # Calculo aproximado
    M = y / k0
    mu = M / (a * (1 - e**2/4 - 3*e**4/64))

    # Latitude aproximada
    lat = mu + (3*e/2 - 27*e**3/32) * math.sin(2*mu)
    lat = math.degrees(lat)

    # Longitude
    lon0 = (zone - 1) * 6 - 180 + 3  # Longitude central da zona
    lon = lon0 + math.degrees(x / (a * k0 * math.cos(math.radians(lat))))

    # Ajusta para hemisferio sul
    if southern:
        lat = -abs(lat)

    return (lon, lat)


def wgs84_to_utm_approx(lon: float, lat: float, zone: int, southern: bool) -> Tuple[float, float]:
    """
    Converte WGS84 para UTM (aproximado).

    Args:
        lon: Longitude em graus decimais
        lat: Latitude em graus decimais
        zone: Zona UTM
        southern: True se hemisferio sul

    Returns:
        Tupla (easting, northing) em metros
    """
    # Constantes
    k0 = 0.9996
    a = 6378137.0
    e = 0.0818191908

    lon_rad = math.radians(lon)
    lat_rad = math.radians(abs(lat))

    lon0 = math.radians((zone - 1) * 6 - 180 + 3)

    N = a / math.sqrt(1 - e**2 * math.sin(lat_rad)**2)
    T = math.tan(lat_rad)**2
    C = (e**2 / (1 - e**2)) * math.cos(lat_rad)**2
    A = math.cos(lat_rad) * (lon_rad - lon0)

    M = a * (
        (1 - e**2/4 - 3*e**4/64) * lat_rad
        - (3*e**2/8 + 3*e**4/32) * math.sin(2*lat_rad)
        + (15*e**4/256) * math.sin(4*lat_rad)
    )

    easting = k0 * N * (A + (1-T+C)*A**3/6) + 500000
    northing = k0 * (M + N * math.tan(lat_rad) * (A**2/2 + (5-T+9*C+4*C**2)*A**4/24))

    if southern:
        northing = 10000000 - northing

    return (easting, northing)


def coords_to_geojson_geometry(
    coords: List[Tuple[float, float, float]],
    geometry_type: str
) -> Dict[str, Any]:
    """
    Converte coordenadas para geometria GeoJSON.

    Args:
        coords: Lista de coordenadas (x, y, z)
        geometry_type: Tipo de geometria (point, line, polygon)

    Returns:
        Dicionario GeoJSON geometry
    """
    if geometry_type == "point":
        if coords:
            c = coords[0]
            return {"type": "Point", "coordinates": [c[1], c[0]]}  # [lon, lat]
        return {"type": "Point", "coordinates": [0, 0]}

    elif geometry_type in ("line", "polyline"):
        return {
            "type": "LineString",
            "coordinates": [[c[1], c[0]] for c in coords]  # [lon, lat]
        }

    elif geometry_type == "polygon":
        # Fecha o poligono se necessario
        coord_list = [[c[1], c[0]] for c in coords]
        if coord_list and coord_list[0] != coord_list[-1]:
            coord_list.append(coord_list[0])
        return {
            "type": "Polygon",
            "coordinates": [coord_list]
        }

    else:
        return {"type": "Point", "coordinates": [0, 0]}

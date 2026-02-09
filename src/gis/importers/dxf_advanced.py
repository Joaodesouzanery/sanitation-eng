"""
DXF Advanced Importer - Importador Avancado de Arquivos CAD

Este modulo permite:
- Leitura completa de todas as entidades do arquivo DXF
- Visualizacao de todas as camadas e tipos de elementos
- Escolha pelo usuario do tipo de cada entidade (ponto, levantamento, linha, etc.)
- Suporte a diferentes sistemas de coordenadas
- Conversao de coordenadas para geodesicas (EPSG:4326)
"""

from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import json
import re
from datetime import datetime


class EntityCategory(Enum):
    """Categorias de entidades para classificacao pelo usuario"""
    PONTO_TOPOGRAFICO = "ponto_topografico"
    LEVANTAMENTO = "levantamento"
    PV_POCO_VISITA = "pv_poco_visita"
    CX_CAIXA = "cx_caixa"
    RESERVATORIO = "reservatorio"
    ESTACAO_ELEVATORIA = "estacao_elevatoria"
    HIDRANTE = "hidrante"
    REGISTRO = "registro"
    REDE_TUBULACAO = "rede_tubulacao"
    LIGACAO_DOMICILIAR = "ligacao_domiciliar"
    ADUTORA = "adutora"
    INTERCEPTOR = "interceptor"
    COLETOR = "coletor"
    EMISSARIO = "emissario"
    TEXTO_ROTULO = "texto_rotulo"
    COTA_TERRENO = "cota_terreno"
    COTA_FUNDO = "cota_fundo"
    LIMITE_LOTE = "limite_lote"
    EIXO_RUA = "eixo_rua"
    CURVA_NIVEL = "curva_nivel"
    OUTROS = "outros"
    IGNORAR = "ignorar"


class GeometryType(Enum):
    """Tipos de geometria detectados"""
    POINT = "point"
    LINE = "line"
    POLYLINE = "polyline"
    POLYGON = "polygon"
    TEXT = "text"
    BLOCK = "block"
    CIRCLE = "circle"
    ARC = "arc"
    UNKNOWN = "unknown"


@dataclass
class ExtractedEntity:
    """Entidade extraida do arquivo DXF"""
    id: str
    dxf_type: str  # Tipo original no DXF (LINE, LWPOLYLINE, INSERT, etc.)
    geometry_type: GeometryType
    layer: str
    color: Optional[int] = None
    linetype: Optional[str] = None

    # Coordenadas
    coordinates: List[Tuple[float, float, float]] = field(default_factory=list)

    # Atributos extraidos
    attributes: Dict[str, Any] = field(default_factory=dict)

    # Para blocos/inserts
    block_name: Optional[str] = None
    block_attributes: Dict[str, str] = field(default_factory=dict)

    # Para textos
    text_content: Optional[str] = None
    text_height: Optional[float] = None

    # Metricas calculadas
    length: Optional[float] = None
    area: Optional[float] = None

    # Classificacao pelo usuario
    user_category: Optional[EntityCategory] = None
    user_notes: Optional[str] = None


@dataclass
class LayerSummary:
    """Resumo de uma camada do DXF"""
    name: str
    entity_count: int
    geometry_types: Set[GeometryType]
    dxf_types: Set[str]
    color: Optional[int] = None
    has_blocks: bool = False
    block_names: Set[str] = field(default_factory=set)
    has_text: bool = False
    sample_entities: List[ExtractedEntity] = field(default_factory=list)
    suggested_category: Optional[EntityCategory] = None


@dataclass
class DXFScanResult:
    """Resultado do scan completo do arquivo DXF"""
    filepath: str
    filename: str
    scan_date: str

    # Resumo geral
    total_entities: int = 0
    total_layers: int = 0

    # Bounds do desenho
    min_x: float = float('inf')
    min_y: float = float('inf')
    min_z: float = float('inf')
    max_x: float = float('-inf')
    max_y: float = float('-inf')
    max_z: float = float('-inf')

    # Camadas
    layers: Dict[str, LayerSummary] = field(default_factory=dict)

    # Todas as entidades
    entities: List[ExtractedEntity] = field(default_factory=list)

    # Blocos definidos
    block_definitions: Dict[str, List[str]] = field(default_factory=dict)

    # Metadados do arquivo
    file_units: Optional[str] = None
    coordinate_system: Optional[str] = None

    # Erros e avisos
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class DXFAdvancedImporter:
    """
    Importador avancado de arquivos DXF.

    Este importador permite ao usuario:
    1. Visualizar todas as entidades do arquivo
    2. Classificar cada camada/entidade por tipo
    3. Escolher o que importar e como interpretar cada elemento
    """

    # Mapeamento de nomes de camadas para sugestao de categoria
    LAYER_NAME_HINTS = {
        # Pontos topograficos
        r'topo|lev|pont|survey|ponto': EntityCategory.PONTO_TOPOGRAFICO,
        r'levantamento': EntityCategory.LEVANTAMENTO,

        # Estruturas de esgoto
        r'pv|poco|visita|manhole': EntityCategory.PV_POCO_VISITA,
        r'cx|caixa|box': EntityCategory.CX_CAIXA,

        # Estruturas de agua
        r'reserv|tanque|reservoir': EntityCategory.RESERVATORIO,
        r'eee|elev|elevatoria|pump': EntityCategory.ESTACAO_ELEVATORIA,
        r'hidr|hydrant': EntityCategory.HIDRANTE,
        r'reg|valv|registro': EntityCategory.REGISTRO,

        # Redes
        r'rede|rede_agua|rede_esgoto|pipe|tubo|tubulacao': EntityCategory.REDE_TUBULACAO,
        r'liga|domicil|lateral': EntityCategory.LIGACAO_DOMICILIAR,
        r'adut|trunk': EntityCategory.ADUTORA,
        r'intercept|int_': EntityCategory.INTERCEPTOR,
        r'colet|collect': EntityCategory.COLETOR,
        r'emiss|outfall': EntityCategory.EMISSARIO,

        # Topografia
        r'cota|elev|elevation': EntityCategory.COTA_TERRENO,
        r'cota_fundo|invert': EntityCategory.COTA_FUNDO,
        r'curva|contour|nivel': EntityCategory.CURVA_NIVEL,

        # Cadastro
        r'lote|lot|parcel': EntityCategory.LIMITE_LOTE,
        r'eixo|axis|rua|street': EntityCategory.EIXO_RUA,
        r'text|label|rotulo': EntityCategory.TEXTO_ROTULO,
    }

    def __init__(self):
        self._ezdxf = None

    def _ensure_ezdxf(self):
        """Garante que ezdxf esta disponivel"""
        if self._ezdxf is None:
            try:
                import ezdxf
                self._ezdxf = ezdxf
            except ImportError:
                raise ImportError(
                    "Biblioteca ezdxf nao instalada. Execute: pip install ezdxf"
                )
        return self._ezdxf

    def scan_file(self, filepath: str) -> DXFScanResult:
        """
        Faz scan completo do arquivo DXF.

        Args:
            filepath: Caminho do arquivo DXF

        Returns:
            DXFScanResult com todas as informacoes do arquivo
        """
        ezdxf = self._ensure_ezdxf()
        path = Path(filepath)

        if not path.exists():
            raise FileNotFoundError(f"Arquivo nao encontrado: {filepath}")

        result = DXFScanResult(
            filepath=str(path.absolute()),
            filename=path.name,
            scan_date=datetime.now().isoformat()
        )

        try:
            doc = ezdxf.readfile(filepath)
            msp = doc.modelspace()

            # Extrai metadados
            result.file_units = self._detect_units(doc)

            # Extrai definicoes de blocos
            for block in doc.blocks:
                if not block.name.startswith('*'):  # Ignora blocos anonimos
                    result.block_definitions[block.name] = [
                        e.dxftype() for e in block
                    ]

            # Processa todas as entidades
            entity_id = 0
            for entity in msp:
                entity_id += 1
                extracted = self._extract_entity(entity, f"E{entity_id:06d}")

                if extracted:
                    result.entities.append(extracted)
                    result.total_entities += 1

                    # Atualiza bounds
                    for x, y, z in extracted.coordinates:
                        result.min_x = min(result.min_x, x)
                        result.max_x = max(result.max_x, x)
                        result.min_y = min(result.min_y, y)
                        result.max_y = max(result.max_y, y)
                        result.min_z = min(result.min_z, z)
                        result.max_z = max(result.max_z, z)

                    # Atualiza resumo da camada
                    layer_name = extracted.layer
                    if layer_name not in result.layers:
                        result.layers[layer_name] = LayerSummary(
                            name=layer_name,
                            entity_count=0,
                            geometry_types=set(),
                            dxf_types=set()
                        )

                    layer = result.layers[layer_name]
                    layer.entity_count += 1
                    layer.geometry_types.add(extracted.geometry_type)
                    layer.dxf_types.add(extracted.dxf_type)

                    if extracted.color:
                        layer.color = extracted.color

                    if extracted.block_name:
                        layer.has_blocks = True
                        layer.block_names.add(extracted.block_name)

                    if extracted.text_content:
                        layer.has_text = True

                    # Guarda amostra
                    if len(layer.sample_entities) < 5:
                        layer.sample_entities.append(extracted)

            result.total_layers = len(result.layers)

            # Sugere categorias para camadas
            for layer_name, layer in result.layers.items():
                layer.suggested_category = self._suggest_category(layer_name, layer)

        except Exception as e:
            result.errors.append(f"Erro ao ler arquivo: {str(e)}")

        return result

    def _extract_entity(self, entity, entity_id: str) -> Optional[ExtractedEntity]:
        """Extrai informacoes de uma entidade DXF"""
        etype = entity.dxftype()

        extracted = ExtractedEntity(
            id=entity_id,
            dxf_type=etype,
            geometry_type=GeometryType.UNKNOWN,
            layer=entity.dxf.layer,
            color=entity.dxf.color if hasattr(entity.dxf, 'color') else None,
            linetype=entity.dxf.linetype if hasattr(entity.dxf, 'linetype') else None
        )

        try:
            if etype == "POINT":
                extracted.geometry_type = GeometryType.POINT
                loc = entity.dxf.location
                extracted.coordinates = [(loc.x, loc.y, loc.z if hasattr(loc, 'z') else 0)]

            elif etype == "LINE":
                extracted.geometry_type = GeometryType.LINE
                start = entity.dxf.start
                end = entity.dxf.end
                extracted.coordinates = [
                    (start.x, start.y, start.z if hasattr(start, 'z') else 0),
                    (end.x, end.y, end.z if hasattr(end, 'z') else 0)
                ]
                extracted.length = start.distance(end)

            elif etype in ("LWPOLYLINE", "POLYLINE"):
                extracted.geometry_type = GeometryType.POLYLINE
                try:
                    points = list(entity.get_points())
                    extracted.coordinates = [
                        (p[0], p[1], p[2] if len(p) > 2 else 0) for p in points
                    ]

                    # Calcula comprimento
                    total_length = 0
                    for i in range(len(extracted.coordinates) - 1):
                        p1 = extracted.coordinates[i]
                        p2 = extracted.coordinates[i + 1]
                        dx = p2[0] - p1[0]
                        dy = p2[1] - p1[1]
                        total_length += (dx**2 + dy**2)**0.5
                    extracted.length = total_length

                    # Verifica se e fechado (poligono)
                    if hasattr(entity, 'closed') and entity.closed:
                        extracted.geometry_type = GeometryType.POLYGON
                except:
                    return None

            elif etype == "CIRCLE":
                extracted.geometry_type = GeometryType.CIRCLE
                center = entity.dxf.center
                extracted.coordinates = [(center.x, center.y, center.z if hasattr(center, 'z') else 0)]
                extracted.attributes['radius'] = entity.dxf.radius
                extracted.area = 3.14159 * entity.dxf.radius ** 2

            elif etype == "ARC":
                extracted.geometry_type = GeometryType.ARC
                center = entity.dxf.center
                extracted.coordinates = [(center.x, center.y, center.z if hasattr(center, 'z') else 0)]
                extracted.attributes['radius'] = entity.dxf.radius
                extracted.attributes['start_angle'] = entity.dxf.start_angle
                extracted.attributes['end_angle'] = entity.dxf.end_angle

            elif etype == "INSERT":
                extracted.geometry_type = GeometryType.BLOCK
                insert_pt = entity.dxf.insert
                extracted.coordinates = [(insert_pt.x, insert_pt.y, insert_pt.z if hasattr(insert_pt, 'z') else 0)]
                extracted.block_name = entity.dxf.name
                extracted.attributes['rotation'] = entity.dxf.rotation if hasattr(entity.dxf, 'rotation') else 0
                extracted.attributes['scale_x'] = entity.dxf.xscale if hasattr(entity.dxf, 'xscale') else 1
                extracted.attributes['scale_y'] = entity.dxf.yscale if hasattr(entity.dxf, 'yscale') else 1

                # Extrai atributos do bloco
                if hasattr(entity, 'attribs'):
                    for attrib in entity.attribs:
                        tag = attrib.dxf.tag
                        value = attrib.dxf.text
                        extracted.block_attributes[tag] = value

            elif etype in ("TEXT", "MTEXT"):
                extracted.geometry_type = GeometryType.TEXT
                if etype == "TEXT":
                    insert_pt = entity.dxf.insert
                    extracted.text_content = entity.dxf.text
                    extracted.text_height = entity.dxf.height
                else:
                    insert_pt = entity.dxf.insert
                    extracted.text_content = entity.text if hasattr(entity, 'text') else entity.dxf.text
                    extracted.text_height = entity.dxf.char_height if hasattr(entity.dxf, 'char_height') else None
                extracted.coordinates = [(insert_pt.x, insert_pt.y, insert_pt.z if hasattr(insert_pt, 'z') else 0)]

            elif etype == "HATCH":
                extracted.geometry_type = GeometryType.POLYGON
                # Extrai boundary paths
                try:
                    for path in entity.paths:
                        if hasattr(path, 'vertices'):
                            for vertex in path.vertices:
                                extracted.coordinates.append((vertex.x, vertex.y, 0))
                except:
                    pass

            else:
                # Tipo desconhecido - tenta extrair coordenadas basicas
                return None

        except Exception as e:
            extracted.attributes['extraction_error'] = str(e)

        return extracted

    def _detect_units(self, doc) -> Optional[str]:
        """Detecta unidades do arquivo DXF"""
        try:
            insunits = doc.header.get('$INSUNITS', 0)
            unit_map = {
                0: "Unitless",
                1: "Inches",
                2: "Feet",
                3: "Miles",
                4: "Millimeters",
                5: "Centimeters",
                6: "Meters",
                7: "Kilometers",
            }
            return unit_map.get(insunits, "Unknown")
        except:
            return None

    def _suggest_category(self, layer_name: str, layer: LayerSummary) -> EntityCategory:
        """Sugere categoria baseado no nome da camada e tipos de entidade"""
        name_lower = layer_name.lower()

        # Verifica padroes no nome
        for pattern, category in self.LAYER_NAME_HINTS.items():
            if re.search(pattern, name_lower):
                return category

        # Baseado no tipo de geometria predominante
        geom_types = layer.geometry_types

        if GeometryType.TEXT in geom_types and len(geom_types) == 1:
            return EntityCategory.TEXTO_ROTULO

        if GeometryType.POINT in geom_types or GeometryType.BLOCK in geom_types:
            if layer.has_blocks:
                # Blocos geralmente sao estruturas
                return EntityCategory.PV_POCO_VISITA
            return EntityCategory.PONTO_TOPOGRAFICO

        if GeometryType.POLYLINE in geom_types or GeometryType.LINE in geom_types:
            return EntityCategory.REDE_TUBULACAO

        if GeometryType.POLYGON in geom_types:
            return EntityCategory.LIMITE_LOTE

        return EntityCategory.OUTROS

    def import_with_classification(
        self,
        scan_result: DXFScanResult,
        layer_mapping: Dict[str, EntityCategory],
        coordinate_transform: Optional[callable] = None
    ) -> Dict[str, List[Dict]]:
        """
        Importa entidades com classificacao definida pelo usuario.

        Args:
            scan_result: Resultado do scan
            layer_mapping: Mapeamento {nome_camada: categoria}
            coordinate_transform: Funcao opcional para transformar coordenadas

        Returns:
            Dict com entidades por categoria
        """
        result: Dict[str, List[Dict]] = {}

        for entity in scan_result.entities:
            category = layer_mapping.get(entity.layer)

            if category is None or category == EntityCategory.IGNORAR:
                continue

            category_key = category.value
            if category_key not in result:
                result[category_key] = []

            # Transforma coordenadas se necessario
            coords = entity.coordinates
            if coordinate_transform:
                coords = [coordinate_transform(c) for c in coords]

            # Monta dados da entidade
            entity_data = {
                "id": entity.id,
                "dxf_type": entity.dxf_type,
                "geometry_type": entity.geometry_type.value,
                "layer": entity.layer,
                "category": category_key,
                "coordinates": coords,
                "attributes": entity.attributes,
                "source_file": scan_result.filename,
                "confidence": "IMPORTED"
            }

            if entity.block_name:
                entity_data["block_name"] = entity.block_name
                entity_data["block_attributes"] = entity.block_attributes

            if entity.text_content:
                entity_data["text"] = entity.text_content

            if entity.length:
                entity_data["length"] = entity.length

            if entity.area:
                entity_data["area"] = entity.area

            result[category_key].append(entity_data)

        return result


# =====================================================
# Funcoes de transformacao de coordenadas
# =====================================================

def create_utm_to_wgs84_transform(epsg_code: int):
    """
    Cria funcao de transformacao de UTM para WGS84 (EPSG:4326).

    Args:
        epsg_code: Codigo EPSG do sistema de origem (ex: 32723 para UTM 23S)

    Returns:
        Funcao de transformacao
    """
    try:
        from pyproj import Transformer
        transformer = Transformer.from_crs(
            f"EPSG:{epsg_code}",
            "EPSG:4326",
            always_xy=True
        )

        def transform(coord: Tuple[float, float, float]) -> Tuple[float, float, float]:
            x, y, z = coord
            lon, lat = transformer.transform(x, y)
            return (lat, lon, z)

        return transform
    except ImportError:
        raise ImportError("pyproj nao instalado. Execute: pip install pyproj")


def create_local_to_wgs84_transform(
    origin_lat: float,
    origin_lon: float,
    rotation_deg: float = 0
):
    """
    Cria funcao de transformacao de coordenadas locais para WGS84.

    Util quando o arquivo usa sistema de coordenadas local arbitrario.

    Args:
        origin_lat: Latitude do ponto de origem
        origin_lon: Longitude do ponto de origem
        rotation_deg: Rotacao do sistema local em graus

    Returns:
        Funcao de transformacao
    """
    import math

    # Metros por grau (aproximado na latitude de origem)
    meters_per_deg_lat = 111320  # ~111km por grau
    meters_per_deg_lon = 111320 * math.cos(math.radians(origin_lat))

    rotation_rad = math.radians(rotation_deg)
    cos_r = math.cos(rotation_rad)
    sin_r = math.sin(rotation_rad)

    def transform(coord: Tuple[float, float, float]) -> Tuple[float, float, float]:
        x, y, z = coord

        # Aplica rotacao
        x_rot = x * cos_r - y * sin_r
        y_rot = x * sin_r + y * cos_r

        # Converte para graus
        lat = origin_lat + (y_rot / meters_per_deg_lat)
        lon = origin_lon + (x_rot / meters_per_deg_lon)

        return (lat, lon, z)

    return transform


# =====================================================
# Funcoes de conveniencia
# =====================================================

def scan_dxf_file(filepath: str) -> DXFScanResult:
    """
    Funcao de conveniencia para escanear arquivo DXF.

    Args:
        filepath: Caminho do arquivo DXF

    Returns:
        DXFScanResult com todas as informacoes
    """
    importer = DXFAdvancedImporter()
    return importer.scan_file(filepath)


def get_available_categories() -> List[Dict[str, str]]:
    """
    Retorna lista de categorias disponiveis para classificacao.

    Returns:
        Lista de dicionarios com value e label
    """
    return [
        {"value": cat.value, "label": cat.name.replace("_", " ").title()}
        for cat in EntityCategory
    ]


def scan_result_to_json(result: DXFScanResult) -> str:
    """
    Converte resultado do scan para JSON serializavel.

    Args:
        result: Resultado do scan

    Returns:
        String JSON
    """
    def to_dict(obj):
        if hasattr(obj, '__dataclass_fields__'):
            return {k: to_dict(v) for k, v in obj.__dict__.items()}
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, set):
            return list(obj)
        elif isinstance(obj, list):
            return [to_dict(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: to_dict(v) for k, v in obj.items()}
        else:
            return obj

    return json.dumps(to_dict(result), indent=2, ensure_ascii=False)

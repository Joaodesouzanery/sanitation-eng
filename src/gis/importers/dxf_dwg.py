"""
DXF/DWG Importer - Importador de arquivos CAD
Implementa workflow de scan + mapeamento explícito pelo usuário
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import json

from .base import BaseImporter, ScanReport, LayerInfo, ImportConfig, ScanMode


class CADElementType(Enum):
    """Tipos de elementos CAD reconhecidos"""
    POINT = "POINT"
    LINE = "LINE"
    POLYLINE = "POLYLINE"
    CIRCLE = "CIRCLE"
    ARC = "ARC"
    TEXT = "TEXT"
    MTEXT = "MTEXT"
    INSERT = "INSERT"  # Blocos
    HATCH = "HATCH"
    DIMENSION = "DIMENSION"
    UNKNOWN = "UNKNOWN"


@dataclass
class CADBlock:
    """Representa um bloco CAD com atributos"""
    name: str
    insertion_point: Tuple[float, float, float]
    attributes: Dict[str, str]
    layer: str
    scale: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    rotation: float = 0.0


@dataclass
class CADEntity:
    """Representa uma entidade CAD genérica"""
    entity_type: CADElementType
    layer: str
    color: Optional[int] = None
    linetype: Optional[str] = None
    coordinates: List[Tuple[float, float]] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)
    text_content: Optional[str] = None


class DXFDWGImporter(BaseImporter):
    """
    Importador de arquivos DXF/DWG.

    IMPORTANTE: Este importador NUNCA importa dados automaticamente.
    O workflow obrigatório é:
    1. scan_file() - Analisa o arquivo e retorna relatório de camadas
    2. Usuário mapeia camadas CAD → categorias do domínio
    3. import_with_mapping() - Importa apenas camadas mapeadas

    Exemplo de uso:
        importer = DXFDWGImporter()
        report = importer.scan_file("projeto.dxf")
        print(report.layers)  # Mostra camadas disponíveis

        # Usuário define mapeamento
        mapping = {
            "REDE_AGUA": "water_pipes",
            "PV_ESGOTO": "sewer_structures"
        }

        # Importa com mapeamento
        data = importer.import_with_mapping("projeto.dxf", mapping)
    """

    SUPPORTED_EXTENSIONS = ['.dxf', '.dwg']

    def __init__(self):
        self.entities: List[CADEntity] = []
        self.blocks: List[CADBlock] = []
        self.layers_info: Dict[str, Dict] = {}

    def scan_file(self, filepath: str, mode: ScanMode = ScanMode.QUICK) -> ScanReport:
        """
        Escaneia arquivo DXF/DWG SEM importar dados.

        Args:
            filepath: Caminho do arquivo
            mode: QUICK (apenas camadas) ou FULL (contagem de entidades)

        Returns:
            ScanReport com informações das camadas
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {filepath}")

        ext = path.suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Extensão não suportada: {ext}")

        layers: List[LayerInfo] = []

        try:
            if ext == '.dxf':
                layers = self._scan_dxf(filepath, mode)
            elif ext == '.dwg':
                layers = self._scan_dwg(filepath, mode)
        except ImportError as e:
            # Biblioteca não instalada - retorna estrutura vazia com aviso
            return ScanReport(
                filepath=filepath,
                file_format="DXF" if ext == '.dxf' else "DWG",
                layers=[],
                requires_user_mapping=True,
                scan_mode=mode,
                errors=[f"Biblioteca necessária não instalada: {e}"],
                warnings=["Instale ezdxf: pip install ezdxf"]
            )

        return ScanReport(
            filepath=filepath,
            file_format="DXF" if ext == '.dxf' else "DWG",
            layers=layers,
            requires_user_mapping=True,
            scan_mode=mode
        )

    def _scan_dxf(self, filepath: str, mode: ScanMode) -> List[LayerInfo]:
        """Escaneia arquivo DXF usando ezdxf"""
        try:
            import ezdxf
        except ImportError:
            raise ImportError("ezdxf não instalado. Execute: pip install ezdxf")

        doc = ezdxf.readfile(filepath)
        msp = doc.modelspace()

        # Coleta informações das camadas
        layer_data: Dict[str, Dict] = {}

        for entity in msp:
            layer_name = entity.dxf.layer

            if layer_name not in layer_data:
                layer_data[layer_name] = {
                    "count": 0,
                    "geometry_types": set(),
                    "attributes": set(),
                    "has_blocks": False
                }

            layer_data[layer_name]["count"] += 1

            # Detecta tipo de geometria
            etype = entity.dxftype()
            if etype in ("LINE", "LWPOLYLINE", "POLYLINE"):
                layer_data[layer_name]["geometry_types"].add("LINESTRING")
            elif etype in ("POINT", "INSERT"):
                layer_data[layer_name]["geometry_types"].add("POINT")
                if etype == "INSERT":
                    layer_data[layer_name]["has_blocks"] = True
                    # Coleta atributos do bloco
                    if hasattr(entity, 'attribs'):
                        for attrib in entity.attribs:
                            layer_data[layer_name]["attributes"].add(attrib.dxf.tag)
            elif etype == "CIRCLE":
                layer_data[layer_name]["geometry_types"].add("POINT")
            elif etype == "HATCH":
                layer_data[layer_name]["geometry_types"].add("POLYGON")

        # Converte para LayerInfo
        layers = []
        for name, data in layer_data.items():
            geom_type = "MIXED"
            if len(data["geometry_types"]) == 1:
                geom_type = list(data["geometry_types"])[0]

            layers.append(LayerInfo(
                name=name,
                geometry=geom_type,
                count=data["count"],
                attrs=list(data["attributes"]),
                has_blocks=data["has_blocks"]
            ))

        return layers

    def _scan_dwg(self, filepath: str, mode: ScanMode) -> List[LayerInfo]:
        """Escaneia arquivo DWG"""
        # DWG requer biblioteca específica como libredwg ou ODA SDK
        # Por enquanto, tenta converter para DXF
        raise NotImplementedError(
            "Leitura direta de DWG requer bibliotecas adicionais. "
            "Converta para DXF usando AutoCAD ou LibreCAD."
        )

    def import_with_mapping(self, filepath: str, mapping: Dict[str, str],
                           config: Optional[ImportConfig] = None) -> Dict[str, List[Dict]]:
        """
        Importa dados do arquivo usando mapeamento definido pelo usuário.

        NUNCA sobrescreve valores autoritativos - apenas preenche campos
        ausentes com confidence="ASSUMED".

        Args:
            filepath: Caminho do arquivo
            mapping: Dict de {camada_CAD: categoria_dominio}
            config: Configurações de importação

        Returns:
            Dict com dados importados por categoria
        """
        if config is None:
            config = ImportConfig()

        path = Path(filepath)
        ext = path.suffix.lower()

        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Extensão não suportada: {ext}")

        result: Dict[str, List[Dict]] = {}

        try:
            import ezdxf
        except ImportError:
            raise ImportError("ezdxf não instalado")

        doc = ezdxf.readfile(filepath)
        msp = doc.modelspace()

        # Processa apenas camadas mapeadas
        for entity in msp:
            layer_name = entity.dxf.layer

            if layer_name not in mapping:
                continue  # Ignora camadas não mapeadas

            category = mapping[layer_name]
            if category not in result:
                result[category] = []

            # Extrai dados da entidade
            entity_data = self._extract_entity_data(entity, config)
            if entity_data:
                # Marca como ASSUMED já que veio de importação
                entity_data["confidence"] = "ASSUMED"
                entity_data["source_layer"] = layer_name
                entity_data["source_file"] = filepath
                result[category].append(entity_data)

        return result

    def _extract_entity_data(self, entity, config: ImportConfig) -> Optional[Dict]:
        """Extrai dados de uma entidade CAD"""
        etype = entity.dxftype()
        data: Dict[str, Any] = {
            "type": etype,
            "layer": entity.dxf.layer,
        }

        if etype == "LINE":
            data["geometry"] = "LINESTRING"
            data["coordinates"] = [
                (entity.dxf.start.x, entity.dxf.start.y),
                (entity.dxf.end.x, entity.dxf.end.y)
            ]
            data["length"] = entity.dxf.start.distance(entity.dxf.end)

        elif etype in ("LWPOLYLINE", "POLYLINE"):
            data["geometry"] = "LINESTRING"
            try:
                points = list(entity.get_points())
                data["coordinates"] = [(p[0], p[1]) for p in points]
                # Calcula comprimento total
                total_length = 0
                for i in range(len(points) - 1):
                    dx = points[i+1][0] - points[i][0]
                    dy = points[i+1][1] - points[i][1]
                    total_length += (dx**2 + dy**2)**0.5
                data["length"] = total_length
            except:
                return None

        elif etype == "POINT":
            data["geometry"] = "POINT"
            data["coordinates"] = [(entity.dxf.location.x, entity.dxf.location.y)]
            data["x"] = entity.dxf.location.x
            data["y"] = entity.dxf.location.y
            data["z"] = entity.dxf.location.z if hasattr(entity.dxf, 'location') else 0

        elif etype == "INSERT":
            # Bloco - extrai atributos
            data["geometry"] = "POINT"
            data["block_name"] = entity.dxf.name
            data["x"] = entity.dxf.insert.x
            data["y"] = entity.dxf.insert.y
            data["z"] = entity.dxf.insert.z if hasattr(entity.dxf.insert, 'z') else 0
            data["coordinates"] = [(data["x"], data["y"])]
            data["rotation"] = entity.dxf.rotation if hasattr(entity.dxf, 'rotation') else 0

            # Extrai atributos do bloco
            if hasattr(entity, 'attribs'):
                for attrib in entity.attribs:
                    tag = attrib.dxf.tag
                    value = attrib.dxf.text
                    data[f"attr_{tag}"] = value

        elif etype == "CIRCLE":
            data["geometry"] = "POINT"
            data["x"] = entity.dxf.center.x
            data["y"] = entity.dxf.center.y
            data["coordinates"] = [(data["x"], data["y"])]
            data["radius"] = entity.dxf.radius

        elif etype == "TEXT":
            data["geometry"] = "POINT"
            data["text"] = entity.dxf.text
            data["x"] = entity.dxf.insert.x
            data["y"] = entity.dxf.insert.y
            data["coordinates"] = [(data["x"], data["y"])]

        else:
            return None

        return data


def scan_cad_file(filepath: str) -> ScanReport:
    """
    Função de conveniência para escanear arquivo CAD.

    Args:
        filepath: Caminho do arquivo DXF ou DWG

    Returns:
        ScanReport com camadas disponíveis
    """
    importer = DXFDWGImporter()
    return importer.scan_file(filepath)


def import_cad_with_mapping(filepath: str, mapping: Dict[str, str]) -> Dict[str, List[Dict]]:
    """
    Função de conveniência para importar arquivo CAD com mapeamento.

    Args:
        filepath: Caminho do arquivo
        mapping: Mapeamento de camadas

    Returns:
        Dados importados por categoria
    """
    importer = DXFDWGImporter()
    return importer.import_with_mapping(filepath, mapping)

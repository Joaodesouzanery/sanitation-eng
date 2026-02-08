"""
Base de Importadores - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Implementa o workflow obrigatório de importação:
1. Scan do arquivo (sem importar dados)
2. Mapeamento explícito pelo usuário
3. Importação com campos de confiança

REGRAS CRÍTICAS:
- NUNCA redesenhe/redimensione redes na importação
- NUNCA sobrescreva valores autoritativos
- NUNCA selecione camadas automaticamente

Exemplo:
    >>> from src.gis.importers.base import FileScanner
    >>> scanner = FileScanner("projeto.dxf")
    >>> report = scanner.scan()
    >>> print(report.layers)  # Lista camadas sem importar
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from uuid import UUID, uuid4
import logging

logger = logging.getLogger(__name__)


class ScanMode(Enum):
    """Modo de scan do arquivo"""
    QUICK = "quick"  # Apenas headers/estrutura
    FULL = "full"  # Análise completa sem importar


@dataclass
class LayerInfo:
    """
    Informações de uma camada encontrada no arquivo

    IMPORTANTE: Esta estrutura é retornada pelo scan,
    SEM importar os dados. O usuário deve mapear
    explicitamente cada camada para uma categoria de domínio.
    """
    name: str
    geometry: str  # POINT, LINESTRING, POLYGON, MIXED
    count: int
    attributes: List[str] = field(default_factory=list)
    sample_values: Dict[str, Any] = field(default_factory=dict)
    bbox: Optional[List[float]] = None  # [minx, miny, maxx, maxy]
    crs: Optional[str] = None


@dataclass
class ScanReport:
    """
    Relatório de scan do arquivo

    Retornado antes da importação para permitir
    mapeamento explícito pelo usuário.
    """
    filepath: str
    file_format: str
    file_size_bytes: int
    scan_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    layers: List[LayerInfo] = field(default_factory=list)
    total_features: int = 0
    detected_crs: Optional[str] = None
    requires_user_mapping: bool = True
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Converte para dicionário"""
        return {
            "filepath": self.filepath,
            "file_format": self.file_format,
            "file_size_bytes": self.file_size_bytes,
            "scan_timestamp": self.scan_timestamp.isoformat(),
            "layers": [
                {
                    "name": l.name,
                    "geometry": l.geometry,
                    "count": l.count,
                    "attributes": l.attributes,
                    "sample_values": l.sample_values,
                    "bbox": l.bbox,
                    "crs": l.crs
                }
                for l in self.layers
            ],
            "total_features": self.total_features,
            "detected_crs": self.detected_crs,
            "requires_user_mapping": self.requires_user_mapping,
            "warnings": self.warnings,
            "errors": self.errors
        }


@dataclass
class LayerMapping:
    """
    Mapeamento de camada definido pelo usuário

    O usuário DEVE especificar explicitamente:
    - Qual camada do arquivo
    - Qual categoria de domínio
    - Qual nível de confiança assumir
    """
    source_layer: str
    target_category: str  # water_pipes, sewer_structures, etc.
    field_mappings: Dict[str, str] = field(default_factory=dict)  # source -> target
    confidence_level: str = "ASSUMED"
    filter_expression: Optional[str] = None  # Filtro opcional


@dataclass
class ImportConfig:
    """Configuração de importação"""
    mappings: List[LayerMapping]
    target_crs: str = "EPSG:31983"
    validate_geometry: bool = True
    skip_invalid: bool = False
    merge_with_existing: bool = True
    fill_missing_fields: bool = True


@dataclass
class ConflictReport:
    """Relatório de conflitos na importação"""
    element_id: str
    source_field: str
    source_value: Any
    existing_value: Any
    existing_confidence: str
    resolution: str = "KEPT_EXISTING"  # KEPT_EXISTING, OVERWROTE, MERGED


@dataclass
class ImportResult:
    """Resultado da importação"""
    success: bool
    imported_features: int
    skipped_features: int
    conflicts: List[ConflictReport] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    import_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class BaseImporter(ABC):
    """
    Classe base para importadores

    Implementa o workflow obrigatório:
    1. scan_file() - Analisa arquivo SEM importar
    2. validate_mapping() - Valida mapeamento do usuário
    3. import_with_mapping() - Importa com mapeamento explícito

    NUNCA implemente importação automática sem mapeamento!
    """

    SUPPORTED_FORMATS: List[str] = []
    DOMAIN_CATEGORIES: List[str] = [
        "water_pipes",
        "water_nodes",
        "sewer_pipes",
        "sewer_structures",
        "drainage_conduits",
        "drainage_nodes",
        "subcatchments"
    ]

    def __init__(self, filepath: str):
        """
        Inicializa o importador

        Args:
            filepath: Caminho do arquivo a ser importado
        """
        self.filepath = Path(filepath)

        if not self.filepath.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {filepath}")

        self.file_format = self.filepath.suffix.lower().lstrip('.')
        self.file_size = self.filepath.stat().st_size

        logger.info(f"Importador inicializado: {self.filepath.name} ({self.file_size} bytes)")

    @abstractmethod
    def scan_file(self, mode: ScanMode = ScanMode.FULL) -> ScanReport:
        """
        Analisa o arquivo e retorna relatório SEM IMPORTAR DADOS

        Este método DEVE:
        - Identificar todas as camadas/layers do arquivo
        - Contar features por camada
        - Listar atributos disponíveis
        - Detectar CRS se possível
        - NÃO criar nenhum elemento no modelo

        Args:
            mode: Modo de scan (QUICK ou FULL)

        Returns:
            ScanReport com informações do arquivo

        Exemplo:
            >>> report = importer.scan_file()
            >>> for layer in report.layers:
            ...     print(f"{layer.name}: {layer.count} features")
        """
        pass

    def validate_mapping(self, mapping: LayerMapping) -> List[str]:
        """
        Valida um mapeamento de camada

        Verifica:
        - Camada fonte existe no arquivo
        - Categoria de domínio é válida
        - Mapeamento de campos é consistente

        Returns:
            Lista de erros (vazia se válido)
        """
        errors = []

        if mapping.target_category not in self.DOMAIN_CATEGORIES:
            errors.append(f"Categoria inválida: {mapping.target_category}")

        if mapping.confidence_level not in ["AUTHORITATIVE", "MEASURED", "CALCULATED", "INFERRED", "ASSUMED"]:
            errors.append(f"Nível de confiança inválido: {mapping.confidence_level}")

        return errors

    @abstractmethod
    def import_with_mapping(
        self,
        project,
        config: ImportConfig,
        user_id: str
    ) -> ImportResult:
        """
        Importa dados usando mapeamento explícito do usuário

        REGRAS OBRIGATÓRIAS:
        - Importar APENAS camadas mapeadas
        - Preencher campos ausentes com confidence=ASSUMED
        - NUNCA sobrescrever campos com confidence=AUTHORITATIVE
        - Gerar relatório de conflitos

        Args:
            project: Instância de ProjectDataModel
            config: Configuração com mapeamentos
            user_id: ID do usuário para auditoria

        Returns:
            ImportResult com estatísticas e conflitos

        Exemplo:
            >>> config = ImportConfig(mappings=[
            ...     LayerMapping(
            ...         source_layer="AGUA_TRECHOS",
            ...         target_category="water_pipes",
            ...         confidence_level="ASSUMED"
            ...     )
            ... ])
            >>> result = importer.import_with_mapping(project, config, "user@email.com")
        """
        pass

    def _check_confidence_conflict(
        self,
        existing_confidence: str,
        new_confidence: str,
        field_name: str,
        existing_value: Any,
        new_value: Any
    ) -> ConflictReport:
        """
        Verifica conflito de confiança

        NUNCA sobrescreve AUTHORITATIVE com menor confiança
        """
        confidence_hierarchy = {
            "AUTHORITATIVE": 5,
            "MEASURED": 4,
            "CALCULATED": 3,
            "INFERRED": 2,
            "ASSUMED": 1
        }

        existing_level = confidence_hierarchy.get(existing_confidence, 0)
        new_level = confidence_hierarchy.get(new_confidence, 0)

        if existing_level >= new_level:
            resolution = "KEPT_EXISTING"
        else:
            resolution = "OVERWROTE"

        return ConflictReport(
            element_id="",  # Preenchido pelo chamador
            source_field=field_name,
            source_value=new_value,
            existing_value=existing_value,
            existing_confidence=existing_confidence,
            resolution=resolution
        )


class UserMappingWorkflow:
    """
    Workflow de mapeamento pelo usuário

    Gerencia o fluxo completo:
    1. Scan do arquivo
    2. Apresentação de camadas ao usuário
    3. Recebimento de mapeamentos
    4. Validação
    5. Importação
    """

    def __init__(self, importer: BaseImporter):
        self.importer = importer
        self.scan_report: Optional[ScanReport] = None
        self.mappings: List[LayerMapping] = []

    def step1_scan(self) -> ScanReport:
        """
        Passo 1: Scan do arquivo

        Retorna relatório para exibição ao usuário
        """
        self.scan_report = self.importer.scan_file()
        return self.scan_report

    def step2_set_mappings(self, mappings: List[LayerMapping]) -> List[str]:
        """
        Passo 2: Recebe mapeamentos do usuário

        Valida e armazena os mapeamentos

        Returns:
            Lista de erros (vazia se todos válidos)
        """
        all_errors = []

        for mapping in mappings:
            errors = self.importer.validate_mapping(mapping)
            if errors:
                all_errors.extend([f"{mapping.source_layer}: {e}" for e in errors])
            else:
                self.mappings.append(mapping)

        return all_errors

    def step3_import(
        self,
        project,
        user_id: str,
        target_crs: str = "EPSG:31983"
    ) -> ImportResult:
        """
        Passo 3: Executa importação com mapeamentos validados
        """
        if not self.mappings:
            return ImportResult(
                success=False,
                imported_features=0,
                skipped_features=0,
                errors=["Nenhum mapeamento definido"]
            )

        config = ImportConfig(
            mappings=self.mappings,
            target_crs=target_crs
        )

        return self.importer.import_with_mapping(project, config, user_id)

    def get_mapping_template(self) -> Dict[str, Any]:
        """
        Retorna template de mapeamento para interface

        Útil para gerar formulário de mapeamento
        """
        if not self.scan_report:
            return {}

        return {
            "file": str(self.importer.filepath),
            "layers": [
                {
                    "source_layer": layer.name,
                    "geometry": layer.geometry,
                    "count": layer.count,
                    "attributes": layer.attributes,
                    "target_category": None,  # Usuário deve preencher
                    "confidence_level": "ASSUMED",
                    "field_mappings": {}
                }
                for layer in self.scan_report.layers
            ],
            "available_categories": BaseImporter.DOMAIN_CATEGORIES
        }


# Registro de importadores por formato
_IMPORTERS: Dict[str, type] = {}


def register_importer(format_ext: str, importer_class: type):
    """Registra um importador para um formato"""
    _IMPORTERS[format_ext.lower()] = importer_class


def get_importer(filepath: str) -> BaseImporter:
    """
    Retorna o importador apropriado para o arquivo

    Args:
        filepath: Caminho do arquivo

    Returns:
        Instância do importador

    Raises:
        ValueError: Se formato não suportado

    Exemplo:
        >>> importer = get_importer("projeto.dxf")
        >>> report = importer.scan_file()
    """
    ext = Path(filepath).suffix.lower().lstrip('.')

    if ext not in _IMPORTERS:
        raise ValueError(f"Formato não suportado: {ext}. Disponíveis: {list(_IMPORTERS.keys())}")

    return _IMPORTERS[ext](filepath)


if __name__ == "__main__":
    print("Base de Importadores - HydroNetwork")
    print("Use get_importer() para obter um importador específico.")

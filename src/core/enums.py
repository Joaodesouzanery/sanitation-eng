"""
Enumerações do Sistema - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Centraliza todas as enumerações usadas no sistema.
"""

from enum import Enum


class SystemType(str, Enum):
    """Tipo de sistema de saneamento"""
    WATER = "water"
    SEWER = "sewer"
    DRAINAGE = "drainage"
    REUSE = "reuse"


class ElementType(str, Enum):
    """Tipo de elemento da rede"""
    # Nós
    JUNCTION = "junction"
    RESERVOIR = "reservoir"
    TANK = "tank"
    OUTFALL = "outfall"
    MANHOLE = "manhole"
    CATCH_BASIN = "catch_basin"

    # Trechos
    PIPE = "pipe"
    CONDUIT = "conduit"
    PUMP = "pump"
    VALVE = "valve"
    WEIR = "weir"
    ORIFICE = "orifice"

    # Áreas
    SUBCATCHMENT = "subcatchment"
    STORAGE = "storage"


class ConfidenceLevel(str, Enum):
    """Nível de confiança dos dados"""
    AUTHORITATIVE = "authoritative"
    MEASURED = "measured"
    CALCULATED = "calculated"
    INFERRED = "inferred"
    ASSUMED = "assumed"
    USER_EDITED = "user_edited"


class Severity(str, Enum):
    """Severidade de findings"""
    OK = "OK"
    INFO = "INFO"
    ALERT = "ALERT"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ImportFormat(str, Enum):
    """Formatos de importação"""
    DXF = "dxf"
    DWG = "dwg"
    IFC = "ifc"
    SHP = "shp"
    GEOJSON = "geojson"
    LANDXML = "landxml"
    CSV = "csv"
    EPANET_INP = "epanet_inp"
    SWMM_INP = "swmm_inp"


class ExportFormat(str, Enum):
    """Formatos de exportação"""
    SHP = "shp"
    GEOJSON = "geojson"
    GEOPACKAGE = "gpkg"
    EPANET_INP = "epanet_inp"
    SWMM_INP = "swmm_inp"
    MSPDI_XML = "mspdi_xml"
    CSV = "csv"

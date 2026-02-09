"""
Map Engine - Motor de Mapa Interativo

Este modulo fornece:
- Visualizacao de dados geograficos com Leaflet
- Edicao interativa (mover nos, editar geometrias)
- Suporte a diferentes sistemas de coordenadas
- Conversao geodesica (UTM <-> WGS84)
- Atualizacao de georeferencia de arquivos importados
"""

from .interactive_map import (
    InteractiveMapEngine,
    MapLayer,
    MapMarker,
    MapPolyline,
    EditableFeature,
    GeoreferenceUpdate,
    generate_editable_map_html,
    update_feature_coordinates,
)

from .coordinate_systems import (
    CoordinateTransformer,
    detect_coordinate_system,
    transform_coordinates,
    utm_zone_from_lon,
    get_epsg_for_utm_zone,
    BRAZIL_CRS_LIST,
)

__all__ = [
    # Map Engine
    "InteractiveMapEngine",
    "MapLayer",
    "MapMarker",
    "MapPolyline",
    "EditableFeature",
    "GeoreferenceUpdate",
    "generate_editable_map_html",
    "update_feature_coordinates",
    # Coordinate Systems
    "CoordinateTransformer",
    "detect_coordinate_system",
    "transform_coordinates",
    "utm_zone_from_lon",
    "get_epsg_for_utm_zone",
    "BRAZIL_CRS_LIST",
]

"""
Módulo de entrada/saída GIS.

Funções para:
- Ler shapefiles de nós e links
- Validar CRS e geometria
- Exportar resultados para SHP, GeoJSON
- Criar tabela de atributos padronizada
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import json

from ..core.topology import Node, Link, TopologyBuilder, NetworkTopology
from ..core.constants import SHP_FIELD_NAMES, FIELD_LEGENDS

# Try to import geopandas
try:
    import geopandas as gpd
    from shapely.geometry import Point, LineString
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False


class GISError(Exception):
    """Erro de operações GIS."""
    pass


def check_geopandas():
    """Verifica se geopandas está disponível."""
    if not HAS_GEOPANDAS:
        raise GISError(
            "geopandas é necessário para operações GIS. "
            "Instale com: pip install geopandas"
        )


def read_nodes_shapefile(
    filepath: Union[str, Path],
    id_field: str = 'id',
    z_field: str = None,
) -> Tuple[Dict[str, Node], Optional[str]]:
    """
    Lê shapefile de nós.

    Args:
        filepath: Caminho do arquivo .shp
        id_field: Nome do campo de ID
        z_field: Nome do campo de cota (opcional)

    Returns:
        Tuple (dicionário de nós, CRS)
    """
    check_geopandas()

    gdf = gpd.read_file(filepath)
    crs = str(gdf.crs) if gdf.crs else None

    # Normalizar nomes de colunas
    gdf.columns = gdf.columns.str.lower()
    id_field = id_field.lower()
    if z_field:
        z_field = z_field.lower()

    # Verificar campo de ID
    if id_field not in gdf.columns:
        # Tentar encontrar campo alternativo
        for alt in ['id', 'node_id', 'fid', 'objectid']:
            if alt in gdf.columns:
                id_field = alt
                break
        else:
            raise GISError(f"Campo de ID '{id_field}' não encontrado no shapefile")

    nodes = {}

    for idx, row in gdf.iterrows():
        geom = row.geometry

        if geom is None:
            continue

        # Obter coordenadas
        if hasattr(geom, 'coords'):
            x, y = geom.coords[0][:2]
        else:
            x, y = geom.x, geom.y

        # Obter cota
        z = 0.0
        if z_field and z_field in gdf.columns:
            z = float(row[z_field]) if row[z_field] else 0.0
        elif hasattr(geom, 'z'):
            z = geom.z

        # Obter ID
        node_id = str(row[id_field])

        # Propriedades adicionais
        props = {k: v for k, v in row.items() if k != 'geometry'}

        node = Node(
            id=node_id,
            x=x,
            y=y,
            z=z,
            properties=props,
        )
        nodes[node_id] = node

    return nodes, crs


def read_links_shapefile(
    filepath: Union[str, Path],
    id_field: str = 'id',
    from_field: str = 'from_node',
    to_field: str = 'to_node',
) -> Tuple[Dict[str, Link], Optional[str]]:
    """
    Lê shapefile de links.

    Args:
        filepath: Caminho do arquivo .shp
        id_field: Nome do campo de ID
        from_field: Nome do campo de nó de origem
        to_field: Nome do campo de nó de destino

    Returns:
        Tuple (dicionário de links, CRS)
    """
    check_geopandas()

    gdf = gpd.read_file(filepath)
    crs = str(gdf.crs) if gdf.crs else None

    # Normalizar nomes
    gdf.columns = gdf.columns.str.lower()
    id_field = id_field.lower()
    from_field = from_field.lower()
    to_field = to_field.lower()

    # Encontrar campos
    field_map = {}
    for field, alts in [
        (id_field, ['id', 'link_id', 'fid', 'objectid']),
        (from_field, ['from_node', 'from_nd', 'node_from', 'start_node', 'us_node']),
        (to_field, ['to_node', 'to_nd', 'node_to', 'end_node', 'ds_node']),
    ]:
        if field in gdf.columns:
            field_map[field] = field
        else:
            for alt in alts:
                if alt in gdf.columns:
                    field_map[field] = alt
                    break
            else:
                raise GISError(f"Campo '{field}' não encontrado no shapefile")

    links = {}

    for idx, row in gdf.iterrows():
        geom = row.geometry

        if geom is None:
            continue

        # Calcular comprimento
        length = geom.length if hasattr(geom, 'length') else 0.0

        # Obter IDs
        link_id = str(row[field_map[id_field]])
        from_node = str(row[field_map[from_field]])
        to_node = str(row[field_map[to_field]])

        # Propriedades adicionais
        props = {k: v for k, v in row.items() if k != 'geometry'}

        link = Link(
            id=link_id,
            from_node=from_node,
            to_node=to_node,
            length=length,
            properties=props,
        )
        links[link_id] = link

    return links, crs


def build_topology_from_shapefiles(
    nodes_shp: Union[str, Path],
    links_shp: Union[str, Path],
    node_id_field: str = 'id',
    node_z_field: str = None,
    link_id_field: str = 'id',
    link_from_field: str = 'from_node',
    link_to_field: str = 'to_node',
) -> Tuple[NetworkTopology, str]:
    """
    Constrói topologia a partir de shapefiles.

    Args:
        nodes_shp: Caminho do shapefile de nós
        links_shp: Caminho do shapefile de links
        node_id_field: Campo de ID dos nós
        node_z_field: Campo de cota dos nós
        link_id_field: Campo de ID dos links
        link_from_field: Campo de nó origem
        link_to_field: Campo de nó destino

    Returns:
        Tuple (NetworkTopology, CRS)
    """
    # Ler arquivos
    nodes, nodes_crs = read_nodes_shapefile(nodes_shp, node_id_field, node_z_field)
    links, links_crs = read_links_shapefile(links_shp, link_id_field, link_from_field, link_to_field)

    # Verificar CRS
    crs = nodes_crs or links_crs
    if nodes_crs and links_crs and nodes_crs != links_crs:
        raise GISError(
            f"CRS dos nós ({nodes_crs}) difere dos links ({links_crs})"
        )

    # Construir topologia
    builder = TopologyBuilder()

    for node in nodes.values():
        builder.add_node(node)

    for link in links.values():
        builder.add_link(link)

    topology = builder.build()

    return topology, crs


def export_links_shapefile(
    topology: NetworkTopology,
    results: Dict[str, Dict[str, Any]],
    output_path: Union[str, Path],
    crs: str = "EPSG:31983",
) -> Path:
    """
    Exporta links para shapefile com resultados.

    Args:
        topology: Topologia da rede
        results: Resultados por link {link_id: {campo: valor}}
        output_path: Caminho de saída
        crs: Sistema de coordenadas

    Returns:
        Path do arquivo criado
    """
    check_geopandas()

    records = []
    geometries = []

    for link_id, link in topology.links.items():
        from_node = topology.nodes[link.from_node]
        to_node = topology.nodes[link.to_node]

        # Criar geometria
        geom = LineString([
            (from_node.x, from_node.y),
            (to_node.x, to_node.y)
        ])
        geometries.append(geom)

        # Dados básicos
        record = {
            'ID': link_id,
            'FROM_ND': link.from_node,
            'TO_ND': link.to_node,
            'LENGTH_M': round(link.length, 2),
        }

        # Adicionar resultados
        if link_id in results:
            for key, value in results[link_id].items():
                # Truncar nomes para SHP (max 10 chars)
                field_name = key[:10] if len(key) > 10 else key
                record[field_name] = value

        records.append(record)

    gdf = gpd.GeoDataFrame(records, geometry=geometries, crs=crs)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    gdf.to_file(output_path, driver='ESRI Shapefile', encoding='utf-8')

    return output_path


def export_nodes_shapefile(
    topology: NetworkTopology,
    results: Dict[str, Dict[str, Any]],
    output_path: Union[str, Path],
    crs: str = "EPSG:31983",
) -> Path:
    """
    Exporta nós para shapefile com resultados.

    Args:
        topology: Topologia da rede
        results: Resultados por nó {node_id: {campo: valor}}
        output_path: Caminho de saída
        crs: Sistema de coordenadas

    Returns:
        Path do arquivo criado
    """
    check_geopandas()

    records = []
    geometries = []

    for node_id, node in topology.nodes.items():
        geom = Point(node.x, node.y)
        geometries.append(geom)

        record = {
            'ID': node_id,
            'X': round(node.x, 3),
            'Y': round(node.y, 3),
            'ELEV_M': round(node.z, 3),
        }

        if node_id in results:
            for key, value in results[node_id].items():
                field_name = key[:10] if len(key) > 10 else key
                record[field_name] = value

        records.append(record)

    gdf = gpd.GeoDataFrame(records, geometry=geometries, crs=crs)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    gdf.to_file(output_path, driver='ESRI Shapefile', encoding='utf-8')

    return output_path


def export_to_geojson(
    topology: NetworkTopology,
    link_results: Dict[str, Dict[str, Any]],
    node_results: Dict[str, Dict[str, Any]],
    output_dir: Union[str, Path],
    network_type: str = 'network',
) -> Tuple[Path, Path]:
    """
    Exporta para GeoJSON (links e nós).

    Args:
        topology: Topologia da rede
        link_results: Resultados dos links
        node_results: Resultados dos nós
        output_dir: Diretório de saída
        network_type: Tipo de rede (para nome do arquivo)

    Returns:
        Tuple (path links.geojson, path nodes.geojson)
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Links GeoJSON
    links_features = []
    for link_id, link in topology.links.items():
        from_node = topology.nodes[link.from_node]
        to_node = topology.nodes[link.to_node]

        properties = {
            'id': link_id,
            'from_node': link.from_node,
            'to_node': link.to_node,
            'length': round(link.length, 2),
        }

        if link_id in link_results:
            properties.update(link_results[link_id])

        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': [
                    [from_node.x, from_node.y],
                    [to_node.x, to_node.y]
                ]
            },
            'properties': properties
        }
        links_features.append(feature)

    links_geojson = {
        'type': 'FeatureCollection',
        'features': links_features
    }

    links_path = output_dir / f'{network_type}_links.geojson'
    with open(links_path, 'w', encoding='utf-8') as f:
        json.dump(links_geojson, f, indent=2, ensure_ascii=False)

    # Nodes GeoJSON
    nodes_features = []
    for node_id, node in topology.nodes.items():
        properties = {
            'id': node_id,
            'x': round(node.x, 3),
            'y': round(node.y, 3),
            'z': round(node.z, 3),
        }

        if node_id in node_results:
            properties.update(node_results[node_id])

        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [node.x, node.y]
            },
            'properties': properties
        }
        nodes_features.append(feature)

    nodes_geojson = {
        'type': 'FeatureCollection',
        'features': nodes_features
    }

    nodes_path = output_dir / f'{network_type}_nodes.geojson'
    with open(nodes_path, 'w', encoding='utf-8') as f:
        json.dump(nodes_geojson, f, indent=2, ensure_ascii=False)

    return links_path, nodes_path


def export_to_csv(
    link_results: Dict[str, Dict[str, Any]],
    node_results: Dict[str, Dict[str, Any]],
    output_dir: Union[str, Path],
    network_type: str = 'network',
) -> Tuple[Path, Path]:
    """
    Exporta resultados para CSV.

    Args:
        link_results: Resultados dos links
        node_results: Resultados dos nós
        output_dir: Diretório de saída
        network_type: Tipo de rede

    Returns:
        Tuple (path links.csv, path nodes.csv)
    """
    import csv

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Links CSV
    links_path = output_dir / f'{network_type}_links.csv'
    if link_results:
        first_key = list(link_results.keys())[0]
        fieldnames = ['link_id'] + list(link_results[first_key].keys())

        with open(links_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for link_id, data in link_results.items():
                row = {'link_id': link_id}
                row.update(data)
                writer.writerow(row)

    # Nodes CSV
    nodes_path = output_dir / f'{network_type}_nodes.csv'
    if node_results:
        first_key = list(node_results.keys())[0]
        fieldnames = ['node_id'] + list(node_results[first_key].keys())

        with open(nodes_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for node_id, data in node_results.items():
                row = {'node_id': node_id}
                row.update(data)
                writer.writerow(row)

    return links_path, nodes_path


def export_consolidated_json(
    results: Dict[str, Any],
    output_path: Union[str, Path],
) -> Path:
    """
    Exporta resultados consolidados para JSON.

    Args:
        results: Dicionário completo de resultados
        output_path: Caminho de saída

    Returns:
        Path do arquivo criado
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    return output_path

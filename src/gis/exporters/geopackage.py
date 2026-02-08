"""
GeoPackage Exporter - Exportador para formato GeoPackage (SQLite espacial)
Formato interno preferido para dados geoespaciais
"""

import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from ..exporters.shp import load_field_dictionary


@dataclass
class GeoPackageLayer:
    """Representa uma camada no GeoPackage"""
    name: str
    geometry_type: str  # POINT, LINESTRING, POLYGON
    srid: int
    fields: List[Dict[str, Any]]
    features: List[Dict[str, Any]]


class GeoPackageExporter:
    """
    Exportador de dados para formato GeoPackage.

    GeoPackage é um formato SQLite com extensões espaciais,
    recomendado como formato interno por suportar:
    - Nomes de campos sem limite de 10 caracteres
    - Múltiplas camadas em um único arquivo
    - Metadados completos
    - Transações ACID

    Exemplo de uso:
        exporter = GeoPackageExporter()
        exporter.add_layer(nodes_layer)
        exporter.add_layer(links_layer)
        exporter.export("rede_saneamento.gpkg")
    """

    def __init__(self, srid: int = 31983):
        """
        Inicializa o exportador.

        Args:
            srid: Código EPSG do sistema de coordenadas (padrão: SIRGAS 2000 UTM 23S)
        """
        self.srid = srid
        self.layers: List[GeoPackageLayer] = []
        self.metadata: Dict[str, Any] = {
            "created": datetime.utcnow().isoformat(),
            "generator": "HydroNetwork Platform",
            "version": "1.0"
        }
        self.field_dict = load_field_dictionary()

    def add_layer(self, layer: GeoPackageLayer):
        """Adiciona uma camada ao GeoPackage"""
        self.layers.append(layer)

    def create_nodes_layer(self, nodes: List[Dict], layer_name: str = "pontos_rede",
                          include_costs: bool = True) -> GeoPackageLayer:
        """
        Cria camada de pontos (nós/PVs).

        Args:
            nodes: Lista de dicionários com dados dos nós
            layer_name: Nome da camada
            include_costs: Se True, inclui dados de custos

        Returns:
            GeoPackageLayer configurada
        """
        fields = [
            {"name": "id", "type": "TEXT"},
            {"name": "x", "type": "REAL"},
            {"name": "y", "type": "REAL"},
            {"name": "z", "type": "REAL"},
            {"name": "cota_terreno", "type": "REAL"},
            {"name": "cota_fundo", "type": "REAL"},
            {"name": "profundidade", "type": "REAL"},
            {"name": "tipo", "type": "TEXT"},
            {"name": "diametro_pv", "type": "INTEGER"},
            {"name": "material", "type": "TEXT"},
        ]

        if include_costs:
            fields.extend([
                {"name": "custo_escavacao", "type": "REAL"},
                {"name": "custo_pv", "type": "REAL"},
                {"name": "custo_total", "type": "REAL"},
            ])

        features = []
        for node in nodes:
            feature = {
                "geometry": f"POINT({node.get('x', 0)} {node.get('y', 0)})",
                "properties": {
                    "id": node.get("id", ""),
                    "x": node.get("x", 0),
                    "y": node.get("y", 0),
                    "z": node.get("z", node.get("cota", 0)),
                    "cota_terreno": node.get("cota_terreno", node.get("z", 0)),
                    "cota_fundo": node.get("cota_fundo", 0),
                    "profundidade": node.get("profundidade", node.get("depth", 1.5)),
                    "tipo": node.get("tipo", "PV"),
                    "diametro_pv": node.get("diametro_pv", 1000),
                    "material": node.get("material", "Concreto"),
                }
            }

            if include_costs and "custos" in node:
                feature["properties"]["custo_escavacao"] = node["custos"].get("escavacao", 0)
                feature["properties"]["custo_pv"] = node["custos"].get("pv", 0)
                feature["properties"]["custo_total"] = node["custos"].get("total", 0)

            features.append(feature)

        return GeoPackageLayer(
            name=layer_name,
            geometry_type="POINT",
            srid=self.srid,
            fields=fields,
            features=features
        )

    def create_links_layer(self, nodes: List[Dict], links: List[Dict],
                          costs: Optional[List[Dict]] = None,
                          layer_name: str = "trechos_rede") -> GeoPackageLayer:
        """
        Cria camada de linhas (trechos/tubos).

        Args:
            nodes: Lista de nós para lookup de coordenadas
            links: Lista de trechos
            costs: Lista opcional de custos por trecho
            layer_name: Nome da camada

        Returns:
            GeoPackageLayer configurada
        """
        # Lookup de nós por ID
        node_lookup = {n.get("id"): n for n in nodes}

        fields = [
            {"name": "id", "type": "TEXT"},
            {"name": "from_node", "type": "TEXT"},
            {"name": "to_node", "type": "TEXT"},
            {"name": "comprimento", "type": "REAL"},
            {"name": "diametro", "type": "INTEGER"},
            {"name": "material", "type": "TEXT"},
            {"name": "declividade", "type": "REAL"},
            {"name": "prof_montante", "type": "REAL"},
            {"name": "prof_jusante", "type": "REAL"},
            {"name": "tipo_escoramento", "type": "TEXT"},
            # Campos de custos
            {"name": "custo_escavacao", "type": "REAL"},
            {"name": "custo_reaterro", "type": "REAL"},
            {"name": "custo_tubo", "type": "REAL"},
            {"name": "custo_assentamento", "type": "REAL"},
            {"name": "custo_escoramento", "type": "REAL"},
            {"name": "custo_pavimento", "type": "REAL"},
            {"name": "custo_total", "type": "REAL"},
            # Campos de planejamento
            {"name": "wbs_id", "type": "TEXT"},
            {"name": "inicio_planejado", "type": "TEXT"},
            {"name": "fim_planejado", "type": "TEXT"},
            {"name": "percentual_fisico", "type": "REAL"},
        ]

        features = []
        for idx, link in enumerate(links):
            from_node = node_lookup.get(link.get("from"), {})
            to_node = node_lookup.get(link.get("to"), {})

            x1 = from_node.get("x", 0)
            y1 = from_node.get("y", 0)
            x2 = to_node.get("x", x1 + 50)
            y2 = to_node.get("y", y1)

            # Dados de custos
            cost_data = costs[idx] if costs and idx < len(costs) else {}

            feature = {
                "geometry": f"LINESTRING({x1} {y1}, {x2} {y2})",
                "properties": {
                    "id": link.get("id", f"T{idx+1:03d}"),
                    "from_node": link.get("from", ""),
                    "to_node": link.get("to", ""),
                    "comprimento": link.get("length", link.get("comprimento", 50)),
                    "diametro": link.get("diameter", link.get("DN", 150)),
                    "material": link.get("material", "PVC"),
                    "declividade": link.get("slope", link.get("declividade", 0.005)),
                    "prof_montante": link.get("profUp", link.get("prof_montante", 1.2)),
                    "prof_jusante": link.get("profDown", link.get("prof_jusante", 1.5)),
                    "tipo_escoramento": link.get("tipo_escoramento", "Nenhum"),
                    # Custos
                    "custo_escavacao": cost_data.get("escavacao", 0),
                    "custo_reaterro": cost_data.get("reaterro", 0),
                    "custo_tubo": cost_data.get("tubo", 0),
                    "custo_assentamento": cost_data.get("assentamento", 0),
                    "custo_escoramento": cost_data.get("escoramento", 0),
                    "custo_pavimento": cost_data.get("pavimento", 0),
                    "custo_total": cost_data.get("total", 0),
                    # Planejamento
                    "wbs_id": link.get("wbs_id", ""),
                    "inicio_planejado": link.get("inicio_planejado", ""),
                    "fim_planejado": link.get("fim_planejado", ""),
                    "percentual_fisico": link.get("percentual_fisico", 0),
                }
            }
            features.append(feature)

        return GeoPackageLayer(
            name=layer_name,
            geometry_type="LINESTRING",
            srid=self.srid,
            fields=fields,
            features=features
        )

    def export(self, filepath: str) -> str:
        """
        Exporta todas as camadas para arquivo GeoPackage.

        Args:
            filepath: Caminho do arquivo de saída

        Returns:
            Caminho do arquivo criado
        """
        path = Path(filepath)
        if path.exists():
            path.unlink()  # Remove arquivo existente

        conn = sqlite3.connect(str(path))
        cursor = conn.cursor()

        try:
            # Inicializa estrutura GeoPackage
            self._init_gpkg_structure(cursor)

            # Adiciona cada camada
            for layer in self.layers:
                self._add_layer_to_gpkg(cursor, layer)

            # Adiciona metadados
            self._add_metadata(cursor)

            conn.commit()

        finally:
            conn.close()

        return str(path)

    def _init_gpkg_structure(self, cursor: sqlite3.Cursor):
        """Inicializa estrutura base do GeoPackage"""

        # Tabela de conteúdo
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gpkg_contents (
                table_name TEXT PRIMARY KEY,
                data_type TEXT NOT NULL,
                identifier TEXT,
                description TEXT,
                last_change TEXT,
                min_x REAL,
                min_y REAL,
                max_x REAL,
                max_y REAL,
                srs_id INTEGER
            )
        """)

        # Tabela de referência espacial
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gpkg_spatial_ref_sys (
                srs_name TEXT NOT NULL,
                srs_id INTEGER PRIMARY KEY,
                organization TEXT NOT NULL,
                organization_coordsys_id INTEGER NOT NULL,
                definition TEXT NOT NULL,
                description TEXT
            )
        """)

        # Adiciona SIRGAS 2000 UTM 23S
        cursor.execute("""
            INSERT OR REPLACE INTO gpkg_spatial_ref_sys VALUES (
                'SIRGAS 2000 / UTM zone 23S',
                31983,
                'EPSG',
                31983,
                'PROJCS["SIRGAS 2000 / UTM zone 23S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-45],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]',
                'SIRGAS 2000 / UTM zone 23S - Brasil'
            )
        """)

        # Tabela de extensões de geometria
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gpkg_geometry_columns (
                table_name TEXT NOT NULL,
                column_name TEXT NOT NULL,
                geometry_type_name TEXT NOT NULL,
                srs_id INTEGER NOT NULL,
                z INTEGER NOT NULL,
                m INTEGER NOT NULL,
                PRIMARY KEY (table_name, column_name)
            )
        """)

    def _add_layer_to_gpkg(self, cursor: sqlite3.Cursor, layer: GeoPackageLayer):
        """Adiciona uma camada ao GeoPackage"""

        # Cria tabela da camada
        field_defs = ["fid INTEGER PRIMARY KEY AUTOINCREMENT", "geom BLOB"]
        for field in layer.fields:
            field_defs.append(f"{field['name']} {field['type']}")

        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {layer.name} (
                {', '.join(field_defs)}
            )
        """)

        # Registra geometria
        cursor.execute("""
            INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', ?, ?, 0, 0)
        """, (layer.name, layer.geometry_type, layer.srid))

        # Calcula bounding box
        min_x, min_y, max_x, max_y = float('inf'), float('inf'), float('-inf'), float('-inf')

        # Insere features
        field_names = [f['name'] for f in layer.fields]
        placeholders = ', '.join(['?' for _ in range(len(field_names) + 1)])

        for feature in layer.features:
            values = [feature['geometry']]  # Geometria como WKT por simplicidade
            for name in field_names:
                values.append(feature['properties'].get(name))

            cursor.execute(f"""
                INSERT INTO {layer.name} (geom, {', '.join(field_names)})
                VALUES ({placeholders})
            """, values)

            # Atualiza bbox (simplificado)
            props = feature['properties']
            if 'x' in props:
                min_x = min(min_x, props['x'])
                max_x = max(max_x, props['x'])
            if 'y' in props:
                min_y = min(min_y, props['y'])
                max_y = max(max_y, props['y'])

        # Registra na tabela de conteúdo
        cursor.execute("""
            INSERT INTO gpkg_contents VALUES (?, 'features', ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            layer.name,
            layer.name,
            f"Camada {layer.name} - HydroNetwork",
            datetime.utcnow().isoformat(),
            min_x if min_x != float('inf') else 0,
            min_y if min_y != float('inf') else 0,
            max_x if max_x != float('-inf') else 0,
            max_y if max_y != float('-inf') else 0,
            layer.srid
        ))

    def _add_metadata(self, cursor: sqlite3.Cursor):
        """Adiciona tabela de metadados customizados"""

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hydronetwork_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        for key, value in self.metadata.items():
            cursor.execute("""
                INSERT OR REPLACE INTO hydronetwork_metadata VALUES (?, ?)
            """, (key, json.dumps(value) if isinstance(value, (dict, list)) else str(value)))


def export_all_to_geopackage(nodes: List[Dict], links: List[Dict],
                             costs: Optional[List[Dict]] = None,
                             planning: Optional[Dict] = None,
                             filepath: str = "rede_saneamento.gpkg") -> str:
    """
    Função de conveniência para exportar todos os dados.

    Args:
        nodes: Lista de nós
        links: Lista de trechos
        costs: Dados de custos por trecho
        planning: Dados de planejamento
        filepath: Caminho de saída

    Returns:
        Caminho do arquivo criado
    """
    exporter = GeoPackageExporter()

    # Camada de nós
    nodes_layer = exporter.create_nodes_layer(nodes, include_costs=True)
    exporter.add_layer(nodes_layer)

    # Camada de trechos com custos
    links_layer = exporter.create_links_layer(nodes, links, costs)
    exporter.add_layer(links_layer)

    # Metadados adicionais
    if planning:
        exporter.metadata["planning"] = {
            "total_days": planning.get("total_days", 0),
            "start_date": planning.get("start_date", ""),
            "end_date": planning.get("end_date", "")
        }

    if costs:
        total_cost = sum(c.get("total", 0) for c in costs)
        exporter.metadata["costs"] = {
            "total": total_cost,
            "currency": "BRL"
        }

    return exporter.export(filepath)

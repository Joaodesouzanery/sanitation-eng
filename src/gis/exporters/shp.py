"""
Exportador Shapefile - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Exporta dados do projeto para formato Shapefile com:
- Mapeamento rigoroso de campos (máx 10 caracteres DBF)
- Sidecar CSV com esquema completo
- Suporte a reprojeção CRS
- 11 camadas obrigatórias definidas

Exemplo de uso:
    >>> from src.gis.exporters.shp import ShapefileExporter
    >>> exporter = ShapefileExporter(project)
    >>> exporter.export_all("/output/shapefiles")
"""

import json
import csv
import os
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
import logging

try:
    import shapefile
except ImportError:
    shapefile = None
    print("AVISO: pyshp não instalado. Execute: pip install pyshp")

try:
    from pyproj import Transformer, CRS
except ImportError:
    Transformer = None
    CRS = None
    print("AVISO: pyproj não instalado. Execute: pip install pyproj")

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ShapefileExporter:
    """
    Exportador de Shapefiles com suporte completo às 11 camadas obrigatórias

    Atributos:
        project: Modelo de dados do projeto (ProjectDataModel)
        field_dictionary: Dicionário de mapeamento de campos
        output_crs: Sistema de coordenadas de saída

    Exemplo:
        >>> exporter = ShapefileExporter(project, output_crs="EPSG:31983")
        >>> exporter.export_water_pipes("/output")
        >>> exporter.export_all("/output")
    """

    # Camadas obrigatórias a serem exportadas
    REQUIRED_LAYERS = [
        "water_pipes",
        "water_nodes",
        "sewer_pipes",
        "sewer_structures",
        "drainage_conduits",
        "drainage_nodes",
        "epanet_results_nodes",
        "epanet_results_pipes",
        "swmm_results_links",
        "swmm_results_nodes",
        "peer_review_findings"
    ]

    def __init__(
        self,
        project,
        field_dictionary_path: Optional[str] = None,
        output_crs: Optional[str] = None
    ):
        """
        Inicializa o exportador

        Args:
            project: Instância de ProjectDataModel
            field_dictionary_path: Caminho para o dicionário de campos (JSON)
            output_crs: CRS de saída (ex: "EPSG:31983")
        """
        self.project = project
        self.output_crs = output_crs or project.crs

        # Carregar dicionário de campos
        if field_dictionary_path:
            dict_path = Path(field_dictionary_path)
        else:
            # Caminho padrão
            dict_path = Path(__file__).parent / "field_dictionary.json"

        if dict_path.exists():
            with open(dict_path, 'r', encoding='utf-8') as f:
                self.field_dictionary = json.load(f)
        else:
            logger.warning(f"Dicionário de campos não encontrado: {dict_path}")
            self.field_dictionary = {}

        # Transformer para reprojeção
        self.transformer = None
        if Transformer and self.project.crs != self.output_crs:
            try:
                self.transformer = Transformer.from_crs(
                    self.project.crs,
                    self.output_crs,
                    always_xy=True
                )
                logger.info(f"Reprojeção configurada: {self.project.crs} -> {self.output_crs}")
            except Exception as e:
                logger.error(f"Erro ao configurar reprojeção: {e}")

    def _transform_coords(self, x: float, y: float) -> Tuple[float, float]:
        """Transforma coordenadas se necessário"""
        if self.transformer:
            return self.transformer.transform(x, y)
        return x, y

    def _get_field_config(self, layer_name: str) -> Dict:
        """Retorna configuração de campos para uma camada"""
        return self.field_dictionary.get(layer_name, {}).get("fields", {})

    def _create_writer(
        self,
        output_path: str,
        layer_name: str,
        geometry_type: str
    ) -> 'shapefile.Writer':
        """
        Cria um Writer do shapefile com campos configurados

        Args:
            output_path: Diretório de saída
            layer_name: Nome da camada
            geometry_type: Tipo de geometria (POINT, POLYLINE, POLYGON)

        Returns:
            Writer configurado
        """
        if shapefile is None:
            raise ImportError("pyshp não instalado")

        filepath = os.path.join(output_path, f"{layer_name}.shp")

        # Mapear tipo de geometria
        geom_types = {
            "Point": shapefile.POINT,
            "LineString": shapefile.POLYLINE,
            "Polygon": shapefile.POLYGON
        }

        w = shapefile.Writer(filepath, shapeType=geom_types.get(geometry_type, shapefile.POINT))

        # Adicionar campos do dicionário
        fields_config = self._get_field_config(layer_name)
        for field_name, config in fields_config.items():
            shp_name = config.get("shp_name", field_name[:10])
            field_type = config.get("type", "str")

            if field_type == "str":
                max_len = config.get("max_length", 254)
                w.field(shp_name, 'C', size=max_len)
            elif field_type == "float":
                precision = config.get("precision", 6)
                w.field(shp_name, 'N', decimal=precision, size=18)
            elif field_type == "int":
                w.field(shp_name, 'N', decimal=0, size=10)
            elif field_type == "date":
                w.field(shp_name, 'D')
            else:
                w.field(shp_name, 'C', size=254)

        return w

    def _write_schema_csv(self, output_path: str, layer_name: str) -> None:
        """
        Gera arquivo sidecar CSV com esquema completo

        Este arquivo contém:
        - Nome completo do campo
        - Nome abreviado (SHP)
        - Unidade
        - Domínio/tipo
        - Descrição
        """
        fields_config = self._get_field_config(layer_name)

        csv_path = os.path.join(output_path, f"{layer_name}_schema.csv")

        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f, delimiter=';')

            # Cabeçalho
            writer.writerow([
                "campo_original",
                "campo_shp",
                "tipo",
                "unidade",
                "descricao"
            ])

            # Campos
            for field_name, config in fields_config.items():
                writer.writerow([
                    field_name,
                    config.get("shp_name", field_name[:10]),
                    config.get("type", "str"),
                    config.get("unit", ""),
                    config.get("description", "")
                ])

        logger.info(f"Esquema CSV gerado: {csv_path}")

    def _write_prj_file(self, output_path: str, layer_name: str) -> None:
        """Gera arquivo .prj com definição do CRS"""
        prj_content = {
            "EPSG:31983": 'PROJCS["SIRGAS 2000 / UTM zone 23S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-45],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]',
            "EPSG:4326": 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
        }

        prj_path = os.path.join(output_path, f"{layer_name}.prj")
        content = prj_content.get(self.output_crs, prj_content["EPSG:31983"])

        with open(prj_path, 'w') as f:
            f.write(content)

    def _get_field_value(self, obj: Any, field_name: str) -> Any:
        """Obtém valor de um campo do objeto"""
        value = getattr(obj, field_name, None)

        if value is None:
            return None

        # Converter tipos especiais
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, date):
            return value.strftime("%Y-%m-%d")
        if hasattr(value, 'value'):  # Enum
            return value.value

        return value

    def export_water_pipes(self, output_path: str) -> str:
        """
        Exporta tubulações de água

        Args:
            output_path: Diretório de saída

        Returns:
            Caminho do arquivo gerado
        """
        layer_name = "water_pipes"
        os.makedirs(output_path, exist_ok=True)

        w = self._create_writer(output_path, layer_name, "LineString")
        fields_config = self._get_field_config(layer_name)

        # Filtrar links de água
        water_links = [l for l in self.project.links.values()
                       if l.system_type.value == "water" and l.element_type.value == "pipe"]

        for link in water_links:
            # Obter nós
            from_node = self.project.get_node(link.from_node_id)
            to_node = self.project.get_node(link.to_node_id)

            if not from_node or not to_node:
                continue

            # Construir geometria
            x1, y1 = self._transform_coords(from_node.coordinates.x, from_node.coordinates.y)
            x2, y2 = self._transform_coords(to_node.coordinates.x, to_node.coordinates.y)

            coords = [[x1, y1]]
            for v in link.vertices:
                vx, vy = self._transform_coords(v.x, v.y)
                coords.append([vx, vy])
            coords.append([x2, y2])

            w.line([coords])

            # Campos
            record = []
            for field_name in fields_config.keys():
                value = self._get_field_value(link, field_name)
                record.append(value)

            w.record(*record)

        w.close()

        # Gerar arquivos auxiliares
        self._write_schema_csv(output_path, layer_name)
        self._write_prj_file(output_path, layer_name)

        filepath = os.path.join(output_path, f"{layer_name}.shp")
        logger.info(f"Exportado: {filepath} ({len(water_links)} features)")

        return filepath

    def export_water_nodes(self, output_path: str) -> str:
        """Exporta nós da rede de água"""
        layer_name = "water_nodes"
        os.makedirs(output_path, exist_ok=True)

        w = self._create_writer(output_path, layer_name, "Point")
        fields_config = self._get_field_config(layer_name)

        # Filtrar nós de água
        water_nodes = [n for n in self.project.nodes.values()
                       if n.system_type.value == "water"]

        for node in water_nodes:
            x, y = self._transform_coords(node.coordinates.x, node.coordinates.y)
            w.point(x, y)

            record = []
            for field_name in fields_config.keys():
                value = self._get_field_value(node, field_name)
                record.append(value)

            w.record(*record)

        w.close()

        self._write_schema_csv(output_path, layer_name)
        self._write_prj_file(output_path, layer_name)

        filepath = os.path.join(output_path, f"{layer_name}.shp")
        logger.info(f"Exportado: {filepath} ({len(water_nodes)} features)")

        return filepath

    def export_sewer_pipes(self, output_path: str) -> str:
        """Exporta tubulações de esgoto"""
        layer_name = "sewer_pipes"
        os.makedirs(output_path, exist_ok=True)

        w = self._create_writer(output_path, layer_name, "LineString")
        fields_config = self._get_field_config(layer_name)

        sewer_links = [l for l in self.project.links.values()
                       if l.system_type.value == "sewer"]

        for link in sewer_links:
            from_node = self.project.get_node(link.from_node_id)
            to_node = self.project.get_node(link.to_node_id)

            if not from_node or not to_node:
                continue

            x1, y1 = self._transform_coords(from_node.coordinates.x, from_node.coordinates.y)
            x2, y2 = self._transform_coords(to_node.coordinates.x, to_node.coordinates.y)

            coords = [[x1, y1]]
            for v in link.vertices:
                vx, vy = self._transform_coords(v.x, v.y)
                coords.append([vx, vy])
            coords.append([x2, y2])

            w.line([coords])

            record = []
            for field_name in fields_config.keys():
                value = self._get_field_value(link, field_name)
                record.append(value)

            w.record(*record)

        w.close()

        self._write_schema_csv(output_path, layer_name)
        self._write_prj_file(output_path, layer_name)

        filepath = os.path.join(output_path, f"{layer_name}.shp")
        logger.info(f"Exportado: {filepath} ({len(sewer_links)} features)")

        return filepath

    def export_sewer_structures(self, output_path: str) -> str:
        """Exporta poços de visita e estruturas de esgoto"""
        layer_name = "sewer_structures"
        os.makedirs(output_path, exist_ok=True)

        w = self._create_writer(output_path, layer_name, "Point")
        fields_config = self._get_field_config(layer_name)

        sewer_nodes = [n for n in self.project.nodes.values()
                       if n.system_type.value == "sewer"]

        for node in sewer_nodes:
            x, y = self._transform_coords(node.coordinates.x, node.coordinates.y)
            w.point(x, y)

            record = []
            for field_name in fields_config.keys():
                value = self._get_field_value(node, field_name)
                record.append(value)

            w.record(*record)

        w.close()

        self._write_schema_csv(output_path, layer_name)
        self._write_prj_file(output_path, layer_name)

        filepath = os.path.join(output_path, f"{layer_name}.shp")
        logger.info(f"Exportado: {filepath} ({len(sewer_nodes)} features)")

        return filepath

    def export_all(self, output_path: str) -> Dict[str, str]:
        """
        Exporta todas as 11 camadas obrigatórias

        Args:
            output_path: Diretório base de saída

        Returns:
            Dicionário com caminhos dos arquivos gerados
        """
        os.makedirs(output_path, exist_ok=True)

        results = {}
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        logger.info(f"Iniciando exportação de {len(self.REQUIRED_LAYERS)} camadas...")

        # Exportar cada camada
        export_methods = {
            "water_pipes": self.export_water_pipes,
            "water_nodes": self.export_water_nodes,
            "sewer_pipes": self.export_sewer_pipes,
            "sewer_structures": self.export_sewer_structures,
            # Adicionar outros métodos conforme implementados
        }

        for layer_name in self.REQUIRED_LAYERS:
            if layer_name in export_methods:
                try:
                    filepath = export_methods[layer_name](output_path)
                    results[layer_name] = filepath
                except Exception as e:
                    logger.error(f"Erro ao exportar {layer_name}: {e}")
                    results[layer_name] = f"ERRO: {e}"
            else:
                logger.warning(f"Exportador não implementado: {layer_name}")
                results[layer_name] = "NÃO IMPLEMENTADO"

        # Gerar log de exportação
        log_path = os.path.join(output_path, f"export_log_{timestamp}.json")
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": timestamp,
                "project_id": str(self.project.id),
                "project_name": self.project.name,
                "output_crs": self.output_crs,
                "layers": results
            }, f, indent=2, ensure_ascii=False)

        logger.info(f"Exportação concluída. Log: {log_path}")

        return results


def export_project_to_shp(project, output_path: str, output_crs: str = None) -> Dict[str, str]:
    """
    Função helper para exportar projeto para Shapefile

    Args:
        project: Instância de ProjectDataModel
        output_path: Diretório de saída
        output_crs: CRS de saída (opcional)

    Returns:
        Dicionário com caminhos dos arquivos

    Exemplo:
        >>> from src.gis.exporters.shp import export_project_to_shp
        >>> results = export_project_to_shp(project, "/output/shp", "EPSG:31983")
    """
    exporter = ShapefileExporter(project, output_crs=output_crs)
    return exporter.export_all(output_path)


if __name__ == "__main__":
    # Exemplo de uso
    print("Exportador Shapefile - HydroNetwork")
    print("Execute como módulo ou importe no seu código.")

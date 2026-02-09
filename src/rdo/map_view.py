"""
RDO Map View - Visualizacao de Mapa para RDO

Este modulo fornece:
- Geracao de mapa interativo para visualizacao de progresso
- Suporte a coordenadas geodesicas (WGS84/SIRGAS2000)
- Conversao automatica de sistemas de coordenadas
- Mapa de avanco por trecho com cores de progresso
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import date, datetime
from pathlib import Path
import json


class RDOMapGenerator:
    """
    Gerador de mapas para visualizacao de RDO.

    Suporta diferentes sistemas de coordenadas e converte
    automaticamente para WGS84 (EPSG:4326) para visualizacao.
    """

    # Cores de progresso
    PROGRESS_COLORS = {
        "concluido": "#28a745",      # Verde - 100%
        "quase_concluido": "#20c997", # Verde claro - 75-99%
        "em_andamento": "#ffc107",    # Amarelo - 50-74%
        "iniciado": "#fd7e14",        # Laranja - 1-49%
        "nao_iniciado": "#dc3545",    # Vermelho - 0%
    }

    def __init__(self, source_crs: int = 4326):
        """
        Inicializa o gerador de mapas.

        Args:
            source_crs: Codigo EPSG do sistema de coordenadas de origem
        """
        self.source_crs = source_crs
        self._transformer = None

        # Tenta carregar transformador
        if source_crs != 4326:
            self._setup_transformer(source_crs)

    def _setup_transformer(self, source_crs: int):
        """Configura transformador de coordenadas."""
        try:
            from pyproj import Transformer
            self._transformer = Transformer.from_crs(
                f"EPSG:{source_crs}",
                "EPSG:4326",
                always_xy=True
            )
        except ImportError:
            # Fallback para transformacao aproximada
            pass

    def transform_coords(self, x: float, y: float) -> Tuple[float, float]:
        """
        Transforma coordenadas para WGS84.

        Args:
            x: Coordenada X (longitude ou easting)
            y: Coordenada Y (latitude ou northing)

        Returns:
            Tupla (longitude, latitude) em WGS84
        """
        if self.source_crs == 4326:
            return (x, y)

        if self._transformer:
            lon, lat = self._transformer.transform(x, y)
            return (lon, lat)

        # Fallback: assume que ja esta em graus decimais
        # Verifica se parece UTM e faz conversao aproximada
        if abs(x) > 180 or abs(y) > 90:
            # Provavelmente UTM - tenta conversao aproximada
            return self._approximate_utm_to_wgs84(x, y)

        return (x, y)

    def _approximate_utm_to_wgs84(self, easting: float, northing: float) -> Tuple[float, float]:
        """Conversao aproximada de UTM para WGS84."""
        import math

        # Assume zona 23S (Sao Paulo) como padrao
        zone = 23
        k0 = 0.9996
        a = 6378137.0

        x = easting - 500000
        y = northing

        # Ajusta para hemisferio sul
        if northing < 10000000:
            y = northing
        else:
            y = northing - 10000000

        # Calculo simplificado
        M = y / k0
        mu = M / (a * 0.9983242984)

        lat = math.degrees(mu)
        if northing > 10000000:
            lat = -lat

        lon0 = (zone - 1) * 6 - 180 + 3
        lon = lon0 + math.degrees(x / (a * k0 * math.cos(math.radians(lat))))

        return (lon, lat)

    def get_progress_color(self, progress_pct: float) -> str:
        """Retorna cor baseada no progresso."""
        if progress_pct >= 100:
            return self.PROGRESS_COLORS["concluido"]
        elif progress_pct >= 75:
            return self.PROGRESS_COLORS["quase_concluido"]
        elif progress_pct >= 50:
            return self.PROGRESS_COLORS["em_andamento"]
        elif progress_pct > 0:
            return self.PROGRESS_COLORS["iniciado"]
        else:
            return self.PROGRESS_COLORS["nao_iniciado"]

    def generate_segments_geojson(
        self,
        segments: List[Dict],
        transform_coords: bool = True
    ) -> Dict[str, Any]:
        """
        Gera GeoJSON com trechos para visualizacao no mapa.

        Args:
            segments: Lista de trechos com coordenadas e progresso
            transform_coords: Se deve transformar coordenadas

        Returns:
            FeatureCollection GeoJSON
        """
        features = []

        for segment in segments:
            # Obtem coordenadas
            start_coords = segment.get("start_coords")
            end_coords = segment.get("end_coords")
            geometry_wkt = segment.get("geometry_wkt")

            geometry = None

            if start_coords and end_coords:
                # Transforma coordenadas se necessario
                if transform_coords:
                    start = self.transform_coords(start_coords[0], start_coords[1])
                    end = self.transform_coords(end_coords[0], end_coords[1])
                else:
                    start = (start_coords[1], start_coords[0])  # Inverte para [lon, lat]
                    end = (end_coords[1], end_coords[0])

                geometry = {
                    "type": "LineString",
                    "coordinates": [
                        [start[0], start[1]],
                        [end[0], end[1]]
                    ]
                }

            elif geometry_wkt:
                geometry = self._wkt_to_geojson(geometry_wkt, transform_coords)

            if not geometry:
                continue

            # Calcula progresso
            progress = segment.get("progress_percentage", 0)
            color = self.get_progress_color(progress)

            # Determina status
            if progress >= 100:
                status = "Concluido"
            elif progress > 0:
                status = "Em Execucao"
            else:
                status = "Nao Iniciado"

            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "segment_id": segment.get("segment_id", ""),
                    "segment_name": segment.get("segment_name", segment.get("name", "")),
                    "system_type": segment.get("system_type", "esgoto"),
                    "planned_length": segment.get("planned_length", 0),
                    "executed_length": segment.get("executed_length", 0),
                    "progress_percentage": round(progress, 1),
                    "remaining": segment.get("remaining", 0),
                    "status": status,
                    "color": color,
                    "diameter": segment.get("diameter"),
                    "material": segment.get("material"),
                    "depth": segment.get("depth"),
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features,
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:EPSG::4326"
                }
            }
        }

    def _wkt_to_geojson(self, wkt: str, transform: bool = True) -> Optional[Dict]:
        """Converte WKT para GeoJSON geometry."""
        if not wkt:
            return None

        wkt_upper = wkt.upper().strip()

        if wkt_upper.startswith("LINESTRING"):
            # Extrai coordenadas
            coords_str = wkt[wkt.find("(") + 1:wkt.rfind(")")]
            coords = []
            for point_str in coords_str.split(","):
                parts = point_str.strip().split()
                if len(parts) >= 2:
                    x = float(parts[0])
                    y = float(parts[1])
                    if transform:
                        lon, lat = self.transform_coords(x, y)
                    else:
                        lon, lat = x, y
                    coords.append([lon, lat])

            return {"type": "LineString", "coordinates": coords}

        elif wkt_upper.startswith("POINT"):
            coords_str = wkt[wkt.find("(") + 1:wkt.rfind(")")]
            parts = coords_str.strip().split()
            if len(parts) >= 2:
                x = float(parts[0])
                y = float(parts[1])
                if transform:
                    lon, lat = self.transform_coords(x, y)
                else:
                    lon, lat = x, y
                return {"type": "Point", "coordinates": [lon, lat]}

        return None

    def generate_map_html(
        self,
        geojson: Dict[str, Any],
        center: Optional[Tuple[float, float]] = None,
        zoom: int = 14,
        title: str = "Mapa de Avanco por Trecho"
    ) -> str:
        """
        Gera HTML do mapa interativo.

        Args:
            geojson: FeatureCollection GeoJSON
            center: Centro do mapa (lat, lon). Se None, calcula automaticamente.
            zoom: Zoom inicial
            title: Titulo do mapa

        Returns:
            String HTML completa
        """
        # Calcula centro automaticamente se nao fornecido
        if center is None:
            center = self._calculate_center(geojson)

        geojson_str = json.dumps(geojson, ensure_ascii=False)

        return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Inter', -apple-system, sans-serif; }}
        #map {{ width: 100%; height: 100vh; }}

        .info {{
            padding: 10px 15px;
            background: rgba(255,255,255,0.95);
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            border-radius: 8px;
            font-size: 12px;
            max-width: 200px;
        }}
        .info h4 {{
            margin: 0 0 8px;
            color: #1e293b;
            font-size: 14px;
        }}
        .legend {{
            line-height: 22px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }}
        .legend-color {{
            width: 20px;
            height: 4px;
            border-radius: 2px;
        }}

        .popup-content {{
            min-width: 200px;
        }}
        .popup-content h3 {{
            font-size: 14px;
            margin-bottom: 8px;
            color: #1e293b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }}
        .popup-content table {{
            width: 100%;
            font-size: 11px;
        }}
        .popup-content td {{
            padding: 3px 0;
        }}
        .popup-content td:first-child {{
            color: #64748b;
        }}
        .popup-content td:last-child {{
            font-weight: 500;
            text-align: right;
        }}

        .progress-bar {{
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            margin-top: 8px;
            overflow: hidden;
        }}
        .progress-fill {{
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s;
        }}

        .filter-control {{
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .filter-control select {{
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Dados GeoJSON
        const segmentsData = {geojson_str};

        // Inicializa mapa
        const map = L.map('map').setView([{center[0]}, {center[1]}], {zoom});

        // Camadas base
        const osm = L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '&copy; OpenStreetMap contributors'
        }});

        const topo = L.tileLayer('https://{{s}}.tile.opentopomap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '&copy; OpenTopoMap'
        }});

        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}', {{
            attribution: '&copy; Esri'
        }});

        osm.addTo(map);

        // Funcao de estilo
        function getStyle(feature) {{
            return {{
                color: feature.properties.color || '#0ea5e9',
                weight: 4,
                opacity: 0.9
            }};
        }}

        // Funcao de popup
        function createPopup(feature) {{
            const props = feature.properties;
            const progress = props.progress_percentage || 0;

            return `
                <div class="popup-content">
                    <h3>${{props.segment_name || props.segment_id}}</h3>
                    <table>
                        <tr><td>Sistema</td><td>${{props.system_type}}</td></tr>
                        <tr><td>Planejado</td><td>${{props.planned_length?.toFixed(1) || 0}} m</td></tr>
                        <tr><td>Executado</td><td>${{props.executed_length?.toFixed(1) || 0}} m</td></tr>
                        <tr><td>Progresso</td><td>${{progress.toFixed(1)}}%</td></tr>
                        <tr><td>Status</td><td>${{props.status}}</td></tr>
                        ${{props.diameter ? `<tr><td>Diametro</td><td>DN${{props.diameter}}</td></tr>` : ''}}
                        ${{props.material ? `<tr><td>Material</td><td>${{props.material}}</td></tr>` : ''}}
                    </table>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${{progress}}%; background: ${{props.color}};"></div>
                    </div>
                </div>
            `;
        }}

        // Adiciona camada de trechos
        const segmentsLayer = L.geoJSON(segmentsData, {{
            style: getStyle,
            onEachFeature: function(feature, layer) {{
                layer.bindPopup(createPopup(feature));
                layer.on('mouseover', function(e) {{
                    layer.setStyle({{ weight: 6, opacity: 1 }});
                }});
                layer.on('mouseout', function(e) {{
                    segmentsLayer.resetStyle(layer);
                }});
            }}
        }}).addTo(map);

        // Ajusta bounds
        if (segmentsData.features.length > 0) {{
            map.fitBounds(segmentsLayer.getBounds().pad(0.1));
        }}

        // Controle de camadas
        L.control.layers({{
            "OpenStreetMap": osm,
            "OpenTopoMap": topo,
            "Satelite": satellite
        }}, {{
            "Trechos": segmentsLayer
        }}).addTo(map);

        // Legenda
        const legend = L.control({{ position: 'bottomleft' }});
        legend.onAdd = function(map) {{
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Legenda - Progresso</h4>
                <div class="legend-item">
                    <div class="legend-color" style="background: #28a745;"></div>
                    <span>Concluido (100%)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #20c997;"></div>
                    <span>75% - 99%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ffc107;"></div>
                    <span>50% - 74%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #fd7e14;"></div>
                    <span>1% - 49%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #dc3545;"></div>
                    <span>Nao Iniciado (0%)</span>
                </div>
            `;
            return div;
        }};
        legend.addTo(map);

        // Filtro por sistema
        const filterControl = L.control({{ position: 'topright' }});
        filterControl.onAdd = function(map) {{
            const div = L.DomUtil.create('div', 'filter-control');
            div.innerHTML = `
                <select id="systemFilter" onchange="filterBySystem(this.value)">
                    <option value="all">Todos os Sistemas</option>
                    <option value="esgoto">Esgoto</option>
                    <option value="agua">Agua</option>
                    <option value="drenagem">Drenagem</option>
                </select>
                <select id="statusFilter" onchange="filterByStatus(this.value)" style="margin-left: 8px;">
                    <option value="all">Todos os Status</option>
                    <option value="Concluido">Concluido</option>
                    <option value="Em Execucao">Em Execucao</option>
                    <option value="Nao Iniciado">Nao Iniciado</option>
                </select>
            `;
            L.DomEvent.disableClickPropagation(div);
            return div;
        }};
        filterControl.addTo(map);

        function filterBySystem(system) {{
            segmentsLayer.eachLayer(function(layer) {{
                const props = layer.feature.properties;
                const status = document.getElementById('statusFilter').value;
                const showSystem = system === 'all' || props.system_type === system;
                const showStatus = status === 'all' || props.status === status;

                if (showSystem && showStatus) {{
                    layer.setStyle({{ opacity: 0.9 }});
                }} else {{
                    layer.setStyle({{ opacity: 0.1 }});
                }}
            }});
        }}

        function filterByStatus(status) {{
            segmentsLayer.eachLayer(function(layer) {{
                const props = layer.feature.properties;
                const system = document.getElementById('systemFilter').value;
                const showSystem = system === 'all' || props.system_type === system;
                const showStatus = status === 'all' || props.status === status;

                if (showSystem && showStatus) {{
                    layer.setStyle({{ opacity: 0.9 }});
                }} else {{
                    layer.setStyle({{ opacity: 0.1 }});
                }}
            }});
        }}
    </script>
</body>
</html>'''

    def _calculate_center(self, geojson: Dict) -> Tuple[float, float]:
        """Calcula centro do mapa baseado nos features."""
        all_coords = []

        for feature in geojson.get("features", []):
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [])

            if geom.get("type") == "Point":
                all_coords.append(coords)
            elif geom.get("type") == "LineString":
                all_coords.extend(coords)
            elif geom.get("type") == "Polygon":
                for ring in coords:
                    all_coords.extend(ring)

        if not all_coords:
            return (-23.55, -46.63)  # Sao Paulo default

        avg_lon = sum(c[0] for c in all_coords) / len(all_coords)
        avg_lat = sum(c[1] for c in all_coords) / len(all_coords)

        return (avg_lat, avg_lon)

    def export_map_html(
        self,
        segments: List[Dict],
        output_path: str,
        source_crs: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        Exporta mapa HTML para arquivo.

        Args:
            segments: Lista de trechos
            output_path: Caminho de saida
            source_crs: Sistema de coordenadas de origem
            **kwargs: Argumentos adicionais para generate_map_html

        Returns:
            Caminho do arquivo criado
        """
        if source_crs and source_crs != self.source_crs:
            self._setup_transformer(source_crs)

        geojson = self.generate_segments_geojson(segments)
        html = self.generate_map_html(geojson, **kwargs)

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)

        return str(path)


# =====================================================
# Funcoes de conveniencia
# =====================================================

def generate_rdo_map(
    segments: List[Dict],
    source_crs: int = 4326,
    output_path: Optional[str] = None
) -> str:
    """
    Gera mapa de progresso do RDO.

    Args:
        segments: Lista de trechos com progresso
        source_crs: Sistema de coordenadas de origem
        output_path: Caminho para salvar HTML (opcional)

    Returns:
        HTML do mapa ou caminho do arquivo se output_path fornecido
    """
    generator = RDOMapGenerator(source_crs)
    geojson = generator.generate_segments_geojson(segments)
    html = generator.generate_map_html(geojson)

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return output_path

    return html


def get_supported_crs() -> List[Dict[str, Any]]:
    """Retorna lista de sistemas de coordenadas suportados."""
    return [
        {"epsg": 4326, "name": "WGS 84", "type": "geographic"},
        {"epsg": 4674, "name": "SIRGAS 2000", "type": "geographic"},
        {"epsg": 31983, "name": "SIRGAS 2000 / UTM zone 23S", "type": "projected"},
        {"epsg": 31984, "name": "SIRGAS 2000 / UTM zone 24S", "type": "projected"},
        {"epsg": 31982, "name": "SIRGAS 2000 / UTM zone 22S", "type": "projected"},
        {"epsg": 32723, "name": "WGS 84 / UTM zone 23S", "type": "projected"},
        {"epsg": 32724, "name": "WGS 84 / UTM zone 24S", "type": "projected"},
    ]

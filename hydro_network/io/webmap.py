"""
Gerador de webmap Leaflet para visualização dos resultados.

Gera arquivo HTML standalone com:
- Mapa base OpenStreetMap
- Camadas por tipo de rede (água, esgoto, drenagem)
- Simbologia por DN e alertas
- Popups com atributos
- Legenda
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import json

from ..core.constants import FIELD_LEGENDS


WEBMAP_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HydroNetwork - Mapa de Resultados</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body {{ margin: 0; padding: 0; }}
        #map {{ position: absolute; top: 0; bottom: 0; width: 100%; }}
        .info {{
            padding: 10px 15px;
            background: white;
            background: rgba(255,255,255,0.95);
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
        }}
        .info h4 {{ margin: 0 0 8px; color: #333; }}
        .legend {{
            line-height: 20px;
            color: #555;
        }}
        .legend i {{
            width: 18px;
            height: 18px;
            float: left;
            margin-right: 8px;
            opacity: 0.8;
        }}
        .legend-line {{
            width: 25px;
            height: 4px;
            float: left;
            margin-right: 8px;
            margin-top: 8px;
        }}
        .popup-content {{
            max-height: 300px;
            overflow-y: auto;
        }}
        .popup-content table {{
            border-collapse: collapse;
            font-size: 11px;
        }}
        .popup-content td, .popup-content th {{
            padding: 3px 8px;
            border-bottom: 1px solid #eee;
        }}
        .popup-content th {{
            text-align: left;
            color: #666;
            font-weight: normal;
        }}
        .popup-content td {{
            font-weight: bold;
        }}
        .status-ok {{ color: #2ecc71; }}
        .status-warn {{ color: #f39c12; }}
        .status-error {{ color: #e74c3c; }}
        .layer-control {{
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
        }}
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        // Dados GeoJSON
        const sewerLinksData = {sewer_links_data};
        const sewerNodesData = {sewer_nodes_data};
        const waterLinksData = {water_links_data};
        const waterNodesData = {water_nodes_data};
        const drainageLinksData = {drainage_links_data};
        const drainageNodesData = {drainage_nodes_data};

        // Legenda de campos
        const fieldLegends = {field_legends};

        // Inicializar mapa
        const map = L.map('map').setView({center}, {zoom});

        // Camadas base
        const osm = L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            attribution: '&copy; OpenStreetMap contributors'
        }});

        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}', {{
            attribution: '&copy; Esri'
        }});

        osm.addTo(map);

        // Funções de estilo
        function getColor(dn) {{
            if (dn >= 600) return '#1a237e';
            if (dn >= 400) return '#303f9f';
            if (dn >= 300) return '#3f51b5';
            if (dn >= 200) return '#5c6bc0';
            if (dn >= 150) return '#7986cb';
            return '#9fa8da';
        }}

        function getStatusColor(status) {{
            if (status === 'ERROR') return '#e74c3c';
            if (status === 'WARN') return '#f39c12';
            return '#2ecc71';
        }}

        function linkStyle(feature, color) {{
            const dn = feature.properties.DN_MM || feature.properties.DN || 200;
            const status = feature.properties.STATUS || 'OK';
            const weight = Math.max(2, Math.min(8, dn / 50));

            return {{
                color: status !== 'OK' ? getStatusColor(status) : color,
                weight: weight,
                opacity: 0.8
            }};
        }}

        function nodeStyle(feature, color) {{
            const status = feature.properties.STATUS || 'OK';
            return {{
                radius: 6,
                fillColor: status !== 'OK' ? getStatusColor(status) : color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }};
        }}

        // Popup
        function createPopup(feature) {{
            let html = '<div class="popup-content"><table>';

            for (const [key, value] of Object.entries(feature.properties)) {{
                if (value === null || value === undefined || value === '') continue;

                const legend = fieldLegends[key] || key;
                let displayValue = value;

                // Formatar valores
                if (typeof value === 'number') {{
                    displayValue = value.toLocaleString('pt-BR', {{maximumFractionDigits: 3}});
                }}

                // Colorir status
                if (key === 'STATUS') {{
                    const statusClass = value === 'ERROR' ? 'status-error' :
                                       value === 'WARN' ? 'status-warn' : 'status-ok';
                    displayValue = `<span class="${{statusClass}}">${{value}}</span>`;
                }}

                html += `<tr><th title="${{legend}}">${{key}}</th><td>${{displayValue}}</td></tr>`;
            }}

            html += '</table></div>';
            return html;
        }}

        // Criar camadas
        function createLayer(data, style, isLine = true) {{
            if (!data || !data.features || data.features.length === 0) {{
                return null;
            }}

            if (isLine) {{
                return L.geoJSON(data, {{
                    style: (f) => style(f),
                    onEachFeature: (feature, layer) => {{
                        layer.bindPopup(createPopup(feature));
                    }}
                }});
            }} else {{
                return L.geoJSON(data, {{
                    pointToLayer: (feature, latlng) => {{
                        return L.circleMarker(latlng, style(feature));
                    }},
                    onEachFeature: (feature, layer) => {{
                        layer.bindPopup(createPopup(feature));
                    }}
                }});
            }}
        }}

        // Camadas de rede
        const sewerLinks = createLayer(sewerLinksData, (f) => linkStyle(f, '#8B4513'));
        const sewerNodes = createLayer(sewerNodesData, (f) => nodeStyle(f, '#8B4513'), false);
        const waterLinks = createLayer(waterLinksData, (f) => linkStyle(f, '#2196F3'));
        const waterNodes = createLayer(waterNodesData, (f) => nodeStyle(f, '#2196F3'), false);
        const drainageLinks = createLayer(drainageLinksData, (f) => linkStyle(f, '#4CAF50'));
        const drainageNodes = createLayer(drainageNodesData, (f) => nodeStyle(f, '#4CAF50'), false);

        // Adicionar camadas ao mapa
        const overlays = {{}};

        if (sewerLinks) {{
            sewerLinks.addTo(map);
            overlays['Esgoto - Trechos'] = sewerLinks;
        }}
        if (sewerNodes) {{
            overlays['Esgoto - Nós'] = sewerNodes;
        }}
        if (waterLinks) {{
            waterLinks.addTo(map);
            overlays['Água - Trechos'] = waterLinks;
        }}
        if (waterNodes) {{
            overlays['Água - Nós'] = waterNodes;
        }}
        if (drainageLinks) {{
            drainageLinks.addTo(map);
            overlays['Drenagem - Trechos'] = drainageLinks;
        }}
        if (drainageNodes) {{
            overlays['Drenagem - Nós'] = drainageNodes;
        }}

        // Controle de camadas
        const baseMaps = {{
            "OpenStreetMap": osm,
            "Satélite": satellite
        }};

        L.control.layers(baseMaps, overlays, {{collapsed: false}}).addTo(map);

        // Legenda
        const legend = L.control({{position: 'bottomright'}});
        legend.onAdd = function(map) {{
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Legenda</h4>
                <div><span class="legend-line" style="background:#8B4513"></span> Esgoto</div>
                <div><span class="legend-line" style="background:#2196F3"></span> Água</div>
                <div><span class="legend-line" style="background:#4CAF50"></span> Drenagem</div>
                <br>
                <h4>Status</h4>
                <div><i style="background:#2ecc71"></i> OK</div>
                <div><i style="background:#f39c12"></i> Alerta</div>
                <div><i style="background:#e74c3c"></i> Erro</div>
            `;
            return div;
        }};
        legend.addTo(map);

        // Ajustar zoom para mostrar todos os dados
        const allLayers = [sewerLinks, sewerNodes, waterLinks, waterNodes, drainageLinks, drainageNodes].filter(l => l);
        if (allLayers.length > 0) {{
            const group = L.featureGroup(allLayers);
            map.fitBounds(group.getBounds().pad(0.1));
        }}
    </script>
</body>
</html>'''


def build_webmap(
    output_path: Union[str, Path],
    sewer_links_geojson: Dict = None,
    sewer_nodes_geojson: Dict = None,
    water_links_geojson: Dict = None,
    water_nodes_geojson: Dict = None,
    drainage_links_geojson: Dict = None,
    drainage_nodes_geojson: Dict = None,
    center: tuple = (-23.55, -46.63),  # São Paulo default
    zoom: int = 14,
) -> Path:
    """
    Gera arquivo HTML com webmap Leaflet.

    Args:
        output_path: Caminho do arquivo de saída
        sewer_links_geojson: GeoJSON dos trechos de esgoto
        sewer_nodes_geojson: GeoJSON dos nós de esgoto
        water_links_geojson: GeoJSON dos trechos de água
        water_nodes_geojson: GeoJSON dos nós de água
        drainage_links_geojson: GeoJSON dos trechos de drenagem
        drainage_nodes_geojson: GeoJSON dos nós de drenagem
        center: Centro inicial do mapa (lat, lon)
        zoom: Zoom inicial

    Returns:
        Path do arquivo criado
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Serializar dados
    def to_json(data):
        if data is None:
            return 'null'
        return json.dumps(data, ensure_ascii=False)

    html = WEBMAP_TEMPLATE.format(
        sewer_links_data=to_json(sewer_links_geojson),
        sewer_nodes_data=to_json(sewer_nodes_geojson),
        water_links_data=to_json(water_links_geojson),
        water_nodes_data=to_json(water_nodes_geojson),
        drainage_links_data=to_json(drainage_links_geojson),
        drainage_nodes_data=to_json(drainage_nodes_geojson),
        field_legends=json.dumps(FIELD_LEGENDS, ensure_ascii=False),
        center=list(center),
        zoom=zoom,
    )

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path


def load_geojson(filepath: Union[str, Path]) -> Dict:
    """Carrega arquivo GeoJSON."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_webmap_from_files(
    output_path: Union[str, Path],
    sewer_links_file: Union[str, Path] = None,
    sewer_nodes_file: Union[str, Path] = None,
    water_links_file: Union[str, Path] = None,
    water_nodes_file: Union[str, Path] = None,
    drainage_links_file: Union[str, Path] = None,
    drainage_nodes_file: Union[str, Path] = None,
) -> Path:
    """
    Gera webmap a partir de arquivos GeoJSON.

    Args:
        output_path: Caminho de saída
        *_file: Caminhos dos arquivos GeoJSON

    Returns:
        Path do arquivo criado
    """
    def load_if_exists(filepath):
        if filepath and Path(filepath).exists():
            return load_geojson(filepath)
        return None

    return build_webmap(
        output_path,
        sewer_links_geojson=load_if_exists(sewer_links_file),
        sewer_nodes_geojson=load_if_exists(sewer_nodes_file),
        water_links_geojson=load_if_exists(water_links_file),
        water_nodes_geojson=load_if_exists(water_nodes_file),
        drainage_links_geojson=load_if_exists(drainage_links_file),
        drainage_nodes_geojson=load_if_exists(drainage_nodes_file),
    )

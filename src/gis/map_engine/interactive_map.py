"""
Interactive Map Engine - Mapa Interativo com Edicao

Este modulo fornece:
- Visualizacao de dados geograficos com Leaflet
- Edicao interativa (mover nos, editar geometrias)
- Drag and drop de marcadores
- Atualizacao de coordenadas em tempo real
- Exportacao de alteracoes
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import json


@dataclass
class MapMarker:
    """Marcador no mapa (ponto editavel)"""
    id: str
    lat: float
    lon: float
    label: Optional[str] = None
    icon: Optional[str] = None
    color: str = "#0ea5e9"
    draggable: bool = True
    popup: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MapPolyline:
    """Linha no mapa (polilinha editavel)"""
    id: str
    coordinates: List[Tuple[float, float]]  # [(lat, lon), ...]
    color: str = "#0ea5e9"
    weight: int = 3
    opacity: float = 0.8
    editable: bool = True
    popup: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MapLayer:
    """Camada do mapa"""
    id: str
    name: str
    visible: bool = True
    markers: List[MapMarker] = field(default_factory=list)
    polylines: List[MapPolyline] = field(default_factory=list)
    color: str = "#0ea5e9"
    layer_type: str = "overlay"  # overlay, base


@dataclass
class EditableFeature:
    """Feature editavel com historico de alteracoes"""
    id: str
    original_coords: List[Tuple[float, float]]
    current_coords: List[Tuple[float, float]]
    feature_type: str  # point, line, polygon
    layer_id: str
    modified: bool = False
    modified_at: Optional[datetime] = None


@dataclass
class GeoreferenceUpdate:
    """Atualizacao de georeferencia"""
    feature_id: str
    layer_id: str
    old_coordinates: List[Tuple[float, float]]
    new_coordinates: List[Tuple[float, float]]
    timestamp: datetime = field(default_factory=datetime.now)
    user_id: Optional[str] = None


class InteractiveMapEngine:
    """
    Motor de mapa interativo com suporte a edicao.

    Permite:
    - Adicionar camadas com pontos e linhas
    - Mover marcadores arrastando
    - Editar vertices de polilinhas
    - Rastrear alteracoes
    - Exportar alteracoes
    """

    def __init__(self, center: Tuple[float, float] = (-23.55, -46.63), zoom: int = 14):
        """
        Inicializa o motor de mapa.

        Args:
            center: Centro inicial (lat, lon)
            zoom: Zoom inicial
        """
        self.center = center
        self.zoom = zoom
        self.layers: Dict[str, MapLayer] = {}
        self.edits: List[GeoreferenceUpdate] = []
        self._edit_history: List[Dict] = []

    def add_layer(self, layer: MapLayer) -> None:
        """Adiciona uma camada ao mapa"""
        self.layers[layer.id] = layer

    def add_marker(self, layer_id: str, marker: MapMarker) -> None:
        """Adiciona um marcador a uma camada"""
        if layer_id not in self.layers:
            self.layers[layer_id] = MapLayer(id=layer_id, name=layer_id)
        self.layers[layer_id].markers.append(marker)

    def add_polyline(self, layer_id: str, polyline: MapPolyline) -> None:
        """Adiciona uma polilinha a uma camada"""
        if layer_id not in self.layers:
            self.layers[layer_id] = MapLayer(id=layer_id, name=layer_id)
        self.layers[layer_id].polylines.append(polyline)

    def update_marker_position(self, layer_id: str, marker_id: str,
                               new_lat: float, new_lon: float,
                               user_id: Optional[str] = None) -> GeoreferenceUpdate:
        """
        Atualiza a posicao de um marcador.

        Args:
            layer_id: ID da camada
            marker_id: ID do marcador
            new_lat: Nova latitude
            new_lon: Nova longitude
            user_id: ID do usuario que fez a alteracao

        Returns:
            GeoreferenceUpdate com detalhes da alteracao
        """
        layer = self.layers.get(layer_id)
        if not layer:
            raise ValueError(f"Camada nao encontrada: {layer_id}")

        for marker in layer.markers:
            if marker.id == marker_id:
                old_coords = [(marker.lat, marker.lon)]
                new_coords = [(new_lat, new_lon)]

                update = GeoreferenceUpdate(
                    feature_id=marker_id,
                    layer_id=layer_id,
                    old_coordinates=old_coords,
                    new_coordinates=new_coords,
                    user_id=user_id
                )

                marker.lat = new_lat
                marker.lon = new_lon

                self.edits.append(update)
                self._edit_history.append({
                    "action": "move_marker",
                    "marker_id": marker_id,
                    "old": old_coords,
                    "new": new_coords,
                    "timestamp": datetime.now().isoformat()
                })

                return update

        raise ValueError(f"Marcador nao encontrado: {marker_id}")

    def update_polyline_vertex(self, layer_id: str, polyline_id: str,
                               vertex_index: int, new_lat: float, new_lon: float,
                               user_id: Optional[str] = None) -> GeoreferenceUpdate:
        """
        Atualiza um vertice de uma polilinha.

        Args:
            layer_id: ID da camada
            polyline_id: ID da polilinha
            vertex_index: Indice do vertice
            new_lat: Nova latitude
            new_lon: Nova longitude
            user_id: ID do usuario

        Returns:
            GeoreferenceUpdate com detalhes da alteracao
        """
        layer = self.layers.get(layer_id)
        if not layer:
            raise ValueError(f"Camada nao encontrada: {layer_id}")

        for polyline in layer.polylines:
            if polyline.id == polyline_id:
                if vertex_index < 0 or vertex_index >= len(polyline.coordinates):
                    raise ValueError(f"Indice de vertice invalido: {vertex_index}")

                old_coords = list(polyline.coordinates)
                polyline.coordinates[vertex_index] = (new_lat, new_lon)
                new_coords = list(polyline.coordinates)

                update = GeoreferenceUpdate(
                    feature_id=polyline_id,
                    layer_id=layer_id,
                    old_coordinates=old_coords,
                    new_coordinates=new_coords,
                    user_id=user_id
                )

                self.edits.append(update)
                return update

        raise ValueError(f"Polilinha nao encontrada: {polyline_id}")

    def get_edits_summary(self) -> Dict[str, Any]:
        """Retorna resumo das edicoes realizadas"""
        return {
            "total_edits": len(self.edits),
            "edits": [
                {
                    "feature_id": e.feature_id,
                    "layer_id": e.layer_id,
                    "old_coordinates": e.old_coordinates,
                    "new_coordinates": e.new_coordinates,
                    "timestamp": e.timestamp.isoformat()
                }
                for e in self.edits
            ]
        }

    def export_edits_json(self) -> str:
        """Exporta edicoes como JSON"""
        return json.dumps(self.get_edits_summary(), indent=2)

    def clear_edits(self) -> None:
        """Limpa historico de edicoes"""
        self.edits.clear()
        self._edit_history.clear()

    def to_geojson(self) -> Dict[str, Any]:
        """Converte todas as camadas para GeoJSON"""
        features = []

        for layer_id, layer in self.layers.items():
            # Marcadores
            for marker in layer.markers:
                feature = {
                    "type": "Feature",
                    "id": marker.id,
                    "geometry": {
                        "type": "Point",
                        "coordinates": [marker.lon, marker.lat]
                    },
                    "properties": {
                        "layer_id": layer_id,
                        "label": marker.label,
                        "color": marker.color,
                        "draggable": marker.draggable,
                        **marker.properties
                    }
                }
                features.append(feature)

            # Polilinhas
            for polyline in layer.polylines:
                feature = {
                    "type": "Feature",
                    "id": polyline.id,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[c[1], c[0]] for c in polyline.coordinates]
                    },
                    "properties": {
                        "layer_id": layer_id,
                        "color": polyline.color,
                        "weight": polyline.weight,
                        "editable": polyline.editable,
                        **polyline.properties
                    }
                }
                features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features
        }

    def generate_html(self, output_path: Optional[str] = None) -> str:
        """
        Gera HTML do mapa interativo.

        Args:
            output_path: Caminho opcional para salvar o arquivo

        Returns:
            String HTML
        """
        html = generate_editable_map_html(
            layers=self.layers,
            center=self.center,
            zoom=self.zoom
        )

        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html)

        return html


def generate_editable_map_html(
    layers: Dict[str, MapLayer],
    center: Tuple[float, float] = (-23.55, -46.63),
    zoom: int = 14
) -> str:
    """
    Gera HTML de mapa interativo editavel.

    Args:
        layers: Dicionario de camadas
        center: Centro do mapa (lat, lon)
        zoom: Zoom inicial

    Returns:
        String HTML completa
    """
    # Converte dados para JSON
    layers_json = {}
    for layer_id, layer in layers.items():
        layers_json[layer_id] = {
            "name": layer.name,
            "visible": layer.visible,
            "color": layer.color,
            "markers": [
                {
                    "id": m.id,
                    "lat": m.lat,
                    "lon": m.lon,
                    "label": m.label,
                    "color": m.color,
                    "draggable": m.draggable,
                    "popup": m.popup,
                    "properties": m.properties
                }
                for m in layer.markers
            ],
            "polylines": [
                {
                    "id": p.id,
                    "coordinates": [[c[0], c[1]] for c in p.coordinates],
                    "color": p.color,
                    "weight": p.weight,
                    "opacity": p.opacity,
                    "editable": p.editable,
                    "popup": p.popup,
                    "properties": p.properties
                }
                for p in layer.polylines
            ]
        }

    layers_data = json.dumps(layers_json, ensure_ascii=False)

    return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mapa Interativo - Editor de Georeferencia</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
        }}
        .map-container {{
            display: flex;
            height: 100vh;
        }}
        #map {{
            flex: 1;
            height: 100%;
        }}
        .sidebar {{
            width: 320px;
            background: white;
            border-left: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }}
        .sidebar-header {{
            padding: 16px;
            background: linear-gradient(135deg, #0f172a, #334155);
            color: white;
        }}
        .sidebar-header h2 {{
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 4px;
        }}
        .sidebar-header p {{
            font-size: 0.8rem;
            opacity: 0.8;
        }}
        .sidebar-content {{
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }}
        .section {{
            margin-bottom: 20px;
        }}
        .section-title {{
            font-size: 0.9rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .layer-item {{
            background: #f1f5f9;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .layer-item:hover {{
            background: #e2e8f0;
        }}
        .layer-item.active {{
            background: #dbeafe;
            border: 1px solid #3b82f6;
        }}
        .layer-name {{
            font-weight: 500;
            font-size: 0.9rem;
            margin-bottom: 4px;
        }}
        .layer-count {{
            font-size: 0.75rem;
            color: #64748b;
        }}
        .edit-panel {{
            background: #fef3c7;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        }}
        .edit-panel h4 {{
            font-size: 0.85rem;
            color: #92400e;
            margin-bottom: 8px;
        }}
        .edit-list {{
            max-height: 200px;
            overflow-y: auto;
        }}
        .edit-item {{
            font-size: 0.75rem;
            padding: 6px 8px;
            background: white;
            border-radius: 4px;
            margin-bottom: 4px;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .btn-primary {{
            background: #0ea5e9;
            color: white;
        }}
        .btn-primary:hover {{
            background: #0284c7;
        }}
        .btn-success {{
            background: #10b981;
            color: white;
        }}
        .btn-success:hover {{
            background: #059669;
        }}
        .btn-danger {{
            background: #ef4444;
            color: white;
        }}
        .btn-danger:hover {{
            background: #dc2626;
        }}
        .btn-outline {{
            background: transparent;
            border: 1px solid #cbd5e1;
            color: #475569;
        }}
        .btn-outline:hover {{
            background: #f1f5f9;
        }}
        .btn-group {{
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }}
        .coordinates-display {{
            background: #1e293b;
            color: #94a3b8;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.75rem;
            margin-top: 8px;
        }}
        .coordinates-display strong {{
            color: #f8fafc;
        }}
        .info-tooltip {{
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 0.85rem;
            z-index: 1000;
        }}
        .legend {{
            position: absolute;
            bottom: 20px;
            right: 340px;
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
        }}
        .legend h4 {{
            font-size: 0.8rem;
            margin-bottom: 8px;
            color: #334155;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            margin-bottom: 4px;
        }}
        .legend-color {{
            width: 16px;
            height: 4px;
            border-radius: 2px;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 500;
        }}
        .status-badge.editing {{
            background: #fef3c7;
            color: #92400e;
        }}
        .status-badge.saved {{
            background: #d1fae5;
            color: #065f46;
        }}
    </style>
</head>
<body>
    <div class="map-container">
        <div id="map"></div>
        <div class="sidebar">
            <div class="sidebar-header">
                <h2>Editor de Georeferencia</h2>
                <p>Arraste os pontos para reposicionar</p>
            </div>
            <div class="sidebar-content">
                <div class="section">
                    <div class="section-title">
                        <span>Modo de Edicao</span>
                        <span class="status-badge editing" id="editStatus">Editando</span>
                    </div>
                    <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">
                        Clique e arraste os marcadores para mover. Clique nas linhas para editar vertices.
                    </p>
                </div>

                <div class="section">
                    <div class="section-title">Camadas</div>
                    <div id="layersList"></div>
                </div>

                <div class="section" id="editsSection" style="display: none;">
                    <div class="edit-panel">
                        <h4>Alteracoes Pendentes (<span id="editCount">0</span>)</h4>
                        <div class="edit-list" id="editsList"></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Coordenadas Selecionadas</div>
                    <div class="coordinates-display" id="coordsDisplay">
                        Clique em um elemento para ver coordenadas
                    </div>
                </div>

                <div class="btn-group">
                    <button class="btn btn-success" onclick="exportEdits()">
                        Exportar Alteracoes
                    </button>
                    <button class="btn btn-danger" onclick="resetEdits()">
                        Resetar
                    </button>
                </div>

                <div class="btn-group">
                    <button class="btn btn-primary" onclick="downloadGeoJSON()">
                        Baixar GeoJSON
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="legend">
        <h4>Legenda</h4>
        <div id="legendItems"></div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
    <script>
        // Dados das camadas
        const layersData = {layers_data};

        // Estado global
        const state = {{
            edits: [],
            selectedFeature: null,
            originalPositions: {{}},
            markers: {{}},
            polylines: {{}}
        }};

        // Inicializa o mapa
        const map = L.map('map').setView({list(center)}, {zoom});

        // Camadas base
        const baseLayers = {{
            "OpenStreetMap": L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
                attribution: '&copy; OpenStreetMap contributors'
            }}),
            "OpenTopoMap": L.tileLayer('https://{{s}}.tile.opentopomap.org/{{z}}/{{x}}/{{y}}.png', {{
                attribution: '&copy; OpenTopoMap'
            }}),
            "Satelite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}', {{
                attribution: '&copy; Esri'
            }})
        }};

        baseLayers["OpenStreetMap"].addTo(map);

        // Cria camadas overlay
        const overlayLayers = {{}};
        const legendHtml = [];

        Object.entries(layersData).forEach(([layerId, layer]) => {{
            const layerGroup = L.layerGroup();

            // Adiciona marcadores
            layer.markers.forEach(marker => {{
                const m = L.marker([marker.lat, marker.lon], {{
                    draggable: marker.draggable,
                    icon: createColoredIcon(marker.color)
                }});

                // Popup
                const popupContent = createPopupContent(marker);
                m.bindPopup(popupContent);

                // Tooltip com label
                if (marker.label) {{
                    m.bindTooltip(marker.label, {{
                        permanent: false,
                        direction: 'top'
                    }});
                }}

                // Evento de drag
                m.on('dragstart', function(e) {{
                    const pos = e.target.getLatLng();
                    state.originalPositions[marker.id] = {{
                        lat: pos.lat,
                        lon: pos.lng
                    }};
                }});

                m.on('dragend', function(e) {{
                    const newPos = e.target.getLatLng();
                    const oldPos = state.originalPositions[marker.id];

                    state.edits.push({{
                        type: 'marker_move',
                        featureId: marker.id,
                        layerId: layerId,
                        oldCoords: [oldPos.lat, oldPos.lon],
                        newCoords: [newPos.lat, newPos.lng],
                        timestamp: new Date().toISOString()
                    }});

                    updateEditsUI();
                    updateCoordsDisplay(newPos.lat, newPos.lng, marker.label || marker.id);
                }});

                m.on('click', function(e) {{
                    const pos = e.target.getLatLng();
                    state.selectedFeature = marker.id;
                    updateCoordsDisplay(pos.lat, pos.lng, marker.label || marker.id);
                }});

                state.markers[marker.id] = m;
                layerGroup.addLayer(m);
            }});

            // Adiciona polilinhas
            layer.polylines.forEach(polyline => {{
                const coords = polyline.coordinates.map(c => [c[0], c[1]]);
                const line = L.polyline(coords, {{
                    color: polyline.color,
                    weight: polyline.weight,
                    opacity: polyline.opacity
                }});

                if (polyline.popup) {{
                    line.bindPopup(polyline.popup);
                }}

                // Adiciona marcadores de vertice editaveis
                if (polyline.editable) {{
                    coords.forEach((coord, idx) => {{
                        const vertexMarker = L.circleMarker(coord, {{
                            radius: 6,
                            fillColor: polyline.color,
                            color: '#fff',
                            weight: 2,
                            fillOpacity: 0.8,
                            draggable: true
                        }});

                        vertexMarker.on('mousedown', function(e) {{
                            map.dragging.disable();
                            state.originalPositions[`${{polyline.id}}_${{idx}}`] = {{
                                lat: coord[0],
                                lon: coord[1]
                            }};

                            const onMouseMove = (moveEvent) => {{
                                const newPos = moveEvent.latlng;
                                vertexMarker.setLatLng(newPos);

                                // Atualiza a linha
                                const newCoords = line.getLatLngs();
                                newCoords[idx] = newPos;
                                line.setLatLngs(newCoords);
                            }};

                            const onMouseUp = (upEvent) => {{
                                map.dragging.enable();
                                map.off('mousemove', onMouseMove);
                                map.off('mouseup', onMouseUp);

                                const newPos = vertexMarker.getLatLng();
                                const oldPos = state.originalPositions[`${{polyline.id}}_${{idx}}`];

                                state.edits.push({{
                                    type: 'vertex_move',
                                    featureId: polyline.id,
                                    layerId: layerId,
                                    vertexIndex: idx,
                                    oldCoords: [oldPos.lat, oldPos.lon],
                                    newCoords: [newPos.lat, newPos.lng],
                                    timestamp: new Date().toISOString()
                                }});

                                updateEditsUI();
                                updateCoordsDisplay(newPos.lat, newPos.lng, `${{polyline.id}} - Vertice ${{idx + 1}}`);
                            }};

                            map.on('mousemove', onMouseMove);
                            map.on('mouseup', onMouseUp);
                        }});

                        layerGroup.addLayer(vertexMarker);
                    }});
                }}

                state.polylines[polyline.id] = line;
                layerGroup.addLayer(line);
            }});

            overlayLayers[layer.name] = layerGroup;
            if (layer.visible) {{
                layerGroup.addTo(map);
            }}

            // Adiciona a legenda
            legendHtml.push(`
                <div class="legend-item">
                    <div class="legend-color" style="background: ${{layer.color}}"></div>
                    <span>${{layer.name}}</span>
                </div>
            `);
        }});

        // Controle de camadas
        L.control.layers(baseLayers, overlayLayers).addTo(map);

        // Atualiza legenda
        document.getElementById('legendItems').innerHTML = legendHtml.join('');

        // Atualiza lista de camadas no sidebar
        function updateLayersList() {{
            const container = document.getElementById('layersList');
            container.innerHTML = Object.entries(layersData).map(([id, layer]) => `
                <div class="layer-item" onclick="toggleLayer('${{id}}')">
                    <div class="layer-name">${{layer.name}}</div>
                    <div class="layer-count">
                        ${{layer.markers.length}} pontos, ${{layer.polylines.length}} linhas
                    </div>
                </div>
            `).join('');
        }}
        updateLayersList();

        // Funcoes auxiliares
        function createColoredIcon(color) {{
            return L.divIcon({{
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${{color}};
                    width: 24px;
                    height: 24px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24]
            }});
        }}

        function createPopupContent(marker) {{
            let html = `<div style="min-width: 150px;">`;
            html += `<strong>${{marker.label || marker.id}}</strong><br>`;
            html += `<small>Lat: ${{marker.lat.toFixed(6)}}<br>Lon: ${{marker.lon.toFixed(6)}}</small>`;

            if (marker.properties && Object.keys(marker.properties).length > 0) {{
                html += '<hr style="margin: 8px 0;">';
                Object.entries(marker.properties).forEach(([key, value]) => {{
                    html += `<small><b>${{key}}:</b> ${{value}}</small><br>`;
                }});
            }}

            html += '</div>';
            return html;
        }}

        function updateCoordsDisplay(lat, lon, label) {{
            document.getElementById('coordsDisplay').innerHTML = `
                <strong>${{label}}</strong><br>
                Lat: ${{lat.toFixed(8)}}<br>
                Lon: ${{lon.toFixed(8)}}
            `;
        }}

        function updateEditsUI() {{
            const section = document.getElementById('editsSection');
            const countEl = document.getElementById('editCount');
            const listEl = document.getElementById('editsList');

            countEl.textContent = state.edits.length;

            if (state.edits.length > 0) {{
                section.style.display = 'block';
                listEl.innerHTML = state.edits.map((edit, idx) => `
                    <div class="edit-item">
                        <strong>#${{idx + 1}}</strong> ${{edit.featureId}}<br>
                        <small>${{edit.type}}: [${{edit.oldCoords.map(c => c.toFixed(4)).join(', ')}}] -> [${{edit.newCoords.map(c => c.toFixed(4)).join(', ')}}]</small>
                    </div>
                `).join('');
            }} else {{
                section.style.display = 'none';
            }}
        }}

        function toggleLayer(layerId) {{
            const layer = overlayLayers[layersData[layerId].name];
            if (map.hasLayer(layer)) {{
                map.removeLayer(layer);
            }} else {{
                layer.addTo(map);
            }}
        }}

        function exportEdits() {{
            const data = {{
                exportDate: new Date().toISOString(),
                totalEdits: state.edits.length,
                edits: state.edits
            }};

            const blob = new Blob([JSON.stringify(data, null, 2)], {{ type: 'application/json' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `georef_edits_${{new Date().toISOString().slice(0, 10)}}.json`;
            a.click();
            URL.revokeObjectURL(url);

            alert(`${{state.edits.length}} alteracoes exportadas com sucesso!`);
        }}

        function resetEdits() {{
            if (state.edits.length === 0) return;

            if (confirm('Deseja descartar todas as alteracoes e recarregar a pagina?')) {{
                location.reload();
            }}
        }}

        function downloadGeoJSON() {{
            // Gera GeoJSON atualizado com as edicoes
            const features = [];

            Object.entries(layersData).forEach(([layerId, layer]) => {{
                // Marcadores
                layer.markers.forEach(marker => {{
                    const m = state.markers[marker.id];
                    const pos = m ? m.getLatLng() : {{ lat: marker.lat, lng: marker.lon }};

                    features.push({{
                        type: 'Feature',
                        id: marker.id,
                        geometry: {{
                            type: 'Point',
                            coordinates: [pos.lng, pos.lat]
                        }},
                        properties: {{
                            ...marker.properties,
                            layer_id: layerId,
                            label: marker.label
                        }}
                    }});
                }});

                // Polilinhas
                layer.polylines.forEach(polyline => {{
                    const line = state.polylines[polyline.id];
                    const coords = line ? line.getLatLngs().map(ll => [ll.lng, ll.lat]) : polyline.coordinates.map(c => [c[1], c[0]]);

                    features.push({{
                        type: 'Feature',
                        id: polyline.id,
                        geometry: {{
                            type: 'LineString',
                            coordinates: coords
                        }},
                        properties: {{
                            ...polyline.properties,
                            layer_id: layerId
                        }}
                    }});
                }});
            }});

            const geojson = {{
                type: 'FeatureCollection',
                features: features
            }};

            const blob = new Blob([JSON.stringify(geojson, null, 2)], {{ type: 'application/json' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `georef_updated_${{new Date().toISOString().slice(0, 10)}}.geojson`;
            a.click();
            URL.revokeObjectURL(url);
        }}

        // Ajusta view para mostrar todos os dados
        const allPoints = [];
        Object.values(layersData).forEach(layer => {{
            layer.markers.forEach(m => allPoints.push([m.lat, m.lon]));
            layer.polylines.forEach(p => p.coordinates.forEach(c => allPoints.push(c)));
        }});

        if (allPoints.length > 0) {{
            const bounds = L.latLngBounds(allPoints);
            map.fitBounds(bounds.pad(0.1));
        }}
    </script>
</body>
</html>'''


def update_feature_coordinates(
    feature_id: str,
    new_coordinates: List[Tuple[float, float]],
    edits_file: str
) -> bool:
    """
    Aplica atualizacoes de coordenadas a um arquivo de edicoes.

    Args:
        feature_id: ID da feature
        new_coordinates: Novas coordenadas
        edits_file: Caminho do arquivo de edicoes

    Returns:
        True se bem sucedido
    """
    try:
        with open(edits_file, 'r') as f:
            data = json.load(f)

        # Adiciona nova edicao
        data['edits'].append({
            'feature_id': feature_id,
            'new_coordinates': new_coordinates,
            'timestamp': datetime.now().isoformat()
        })

        with open(edits_file, 'w') as f:
            json.dump(data, f, indent=2)

        return True
    except Exception:
        return False

# Lovable Prompt — Fix Topografia, EPANET PRO & Perfil Longitudinal Modules

> Paste this prompt into Lovable to fix the issues described below.

---

## Context

This is a sanitation engineering platform (HydroNetwork) built with React + TypeScript + Leaflet.js for the frontend and FastAPI + Python for the backend. The interactive map uses Leaflet v1.9.4 with multiple base layers (OSM, Satellite, Topo, CartoDB). The project already has:

- **Topografia module** (`src/pages/TopografiaPage.tsx`) — imports CSV/TXT, renders points and segments on Leaflet map, converts UTM↔LatLon
- **DXF importer** (`src/gis/importers/dxf_advanced.py`) — scans DXF entities, categorizes layers, extracts geometry (points, lines, polylines, blocks, text)
- **DWG importer stub** (`src/gis/importers/dxf_dwg.py`) — partial, falls back to DXF
- **SHP exporter** (`src/gis/exporters/shp.py`) — exports 11 layers with strict DBF field mapping
- **GeoJSON exporter** (`hydro_network/io/gis_io.py`) — exports FeatureCollections for pipes and nodes
- **GeoPackage exporter** (`src/gis/exporters/geopackage.py`) — SQLite spatial format with SQL injection protection
- **EPANET wrapper** (`src/hydraulics/epanet_wrapper.py`) — generates INP file sections (JUNCTIONS, RESERVOIRS, PIPES, etc.)
- **Coordinate system** — auto-detects UTM vs LatLon, SIRGAS 2000 Zone 23S (EPSG:31983 ↔ EPSG:4326)
- **Leaflet map features** — draggable circle markers, polylines with slope color-coding, popups, tooltips, layer controls, scale control

Dependencies already in the project: `ezdxf`, `geopandas`, `shapely`, `pyproj`, `pyshp`, `fiona`, `pandas`, `numpy`.

---

## PART 1 — TOPOGRAFIA MODULE: Multi-Format File Import to Interactive Map

### 1.1 — DXF Import to Interactive Map

Extend the Topografia module to import `.dxf` files directly into the Leaflet interactive map. The backend already has `src/gis/importers/dxf_advanced.py` with a two-step workflow (scan → map layers → import). Implement the following:

**Backend (`api/main.py` or new endpoint):**
- `POST /topografia/import/dxf/scan` — receives a DXF file, calls `dxf_advanced.py`'s scan function, returns a `ScanReport` with all layers, entity counts, geometry types, and detected CRS.
- `POST /topografia/import/dxf/import` — receives the DXF file + a user-defined layer→category mapping (JSON), imports entities, converts coordinates to EPSG:4326 (WGS84), and returns GeoJSON FeatureCollections.

**Frontend (TopografiaPage.tsx):**
- Add a file upload button that accepts `.dxf` files.
- After upload, call the scan endpoint and show a **mapping dialog/modal** where the user sees all DXF layers listed and can assign each layer to a category: `Ponto Topográfico`, `Linha/Rede`, `Poço de Visita (PV)`, `Caixa`, `Curva de Nível`, `Texto/Rótulo`, or `Ignorar`.
- The user decides what becomes a point, line, or network element — **regardless of whether the file has elevation data or not**. If no elevation (Z=0 or missing), set `cota = 0` and let the user edit later.
- After mapping confirmation, call the import endpoint and render the results on the Leaflet map:
  - Points → `L.circleMarker` (same style as existing topographic points)
  - Lines/Polylines → `L.polyline` (same style as existing trechos/segments)
  - Text → `L.tooltip` or `L.marker` with label
- Merge imported data with any existing topographic data already on the map.

### 1.2 — DWG Import to Interactive Map

Since there's no native JavaScript/Python DWG parser that's fully open-source, implement the following approach:

**Backend:**
- `POST /topografia/import/dwg` — receives a `.dwg` file.
- Use the `ODA File Converter` (free for non-commercial) or `LibreCAD`'s `libdxfrw` to convert DWG → DXF server-side. Alternatively, use the Python library `dwg2dxf` or subprocess call to `teigha` / `ODAFileConverter`.
- After conversion, run the same DXF scan→import pipeline from 1.1.
- If conversion is not possible (tool not installed), return an error message asking the user to convert the file to DXF first.

**Frontend:**
- Same upload flow as DXF — user uploads `.dwg`, system converts to DXF internally, then shows the same layer mapping dialog.
- Same category assignment: user chooses what becomes point, line, network, etc.
- Elevation is optional — same handling as DXF.

### 1.3 — IFC Import to Interactive Map

IFC (Industry Foundation Classes) is a BIM format. Implement:

**Backend:**
- Add `ifcopenshell` to dependencies.
- `POST /topografia/import/ifc/scan` — receives an `.ifc` file, uses `ifcopenshell` to extract:
  - All `IfcBuildingElement` subtypes (pipes: `IfcFlowSegment`, `IfcPipeSegment`; fittings: `IfcPipeFitting`; manholes: custom property sets)
  - Geometry as 3D coordinates → project to 2D (take X, Y; Z becomes `cota` if available)
  - Property sets (diameter, material, length, etc.)
  - IFC entity types and counts
- Return a scan report similar to DXF but with IFC entity types.
- `POST /topografia/import/ifc/import` — receives IFC + user mapping, extracts geometry, converts to GeoJSON.

**Frontend:**
- Upload `.ifc` file → scan → show mapping dialog.
- User maps IFC entity types to platform categories: `Ponto`, `Tubulação/Rede`, `PV`, `Caixa`, `Reservatório`, `Estação Elevatória`, `Ignorar`.
- Render on Leaflet map.
- Elevation handling: if IFC has Z coordinates, use them as `cota`. If not, set `cota = 0`.

### 1.4 — SHP (Shapefile) Import to Interactive Map

**Backend:**
- `POST /topografia/import/shp` — receives `.shp` + `.shx` + `.dbf` + `.prj` files (multipart upload or zip).
- Use `geopandas.read_file()` to read the shapefile.
- Auto-detect CRS from `.prj` file; reproject to EPSG:4326 if needed.
- Return geometry as GeoJSON FeatureCollection with all attribute columns.

**Frontend:**
- Upload `.shp` (or `.zip` containing the shapefile components).
- Show a **field mapping dialog**: display all attribute columns from the shapefile and let the user map them to platform fields (`id`, `x`, `y`, `cota`, `diâmetro`, `material`, `tipo`).
- User chooses which geometry features become points, lines, or network elements.
- Render on Leaflet map using same styling as existing data.
- Elevation: if shapefile has a Z attribute or 3D geometry, use it. Otherwise, `cota = 0`.

### 1.5 — Import a Complete/Pre-Existing Network

Allow users to import a **complete, already-designed network** (not just raw topography) from DWG, DXF, IFC, or SHP files. This is different from topographic survey import — it imports an entire network with pipes, manholes, diameters, materials, slopes, etc.

**Backend:**
- `POST /topografia/import/network` — accepts any supported format (DXF, DWG, IFC, SHP) + a mapping configuration.
- Parse the file using the appropriate importer.
- Extract network elements: pipes (with diameter, material, length), nodes (manholes, junctions, with elevation), connections.
- Return structured data matching the platform's `Trecho` and `Ponto` models.

**Frontend:**
- In the Topografia module, add a section/button: **"Importar Rede Existente"** (Import Existing Network).
- Upload file → scan → enhanced mapping dialog that includes:
  - Layer/entity → element type mapping (same as above)
  - Field mapping for pipe attributes: which column/property = diameter, material, slope, length
  - Field mapping for node attributes: which column/property = elevation, type (PV, junction, etc.)
- After import, the full network appears on the map with all properties populated.
- User can edit any imported element after import.

---

## PART 2 — Customize How the Platform Interprets Points

### 2.1 — Point Classification & Interpretation Settings

Add a **"Configurar Pontos"** (Configure Points) panel/modal in the Topografia module:

- Let the user define **point types** with custom labels and colors:
  - `PV` (Poço de Visita / Manhole) — default icon: circle with "PV" label
  - `TL` (Terminal de Limpeza / Cleaning Terminal)
  - `TIL` (Terminal de Inspeção e Limpeza)
  - `CI` (Caixa de Inspeção)
  - `CR` (Caixa de Reunião)
  - `CP` (Caixa de Passagem)
  - `EE` (Estação Elevatória / Pumping Station)
  - `ETE` (Estação de Tratamento / Treatment Plant)
  - `Nó Simples` (Simple Junction)
  - Custom user-defined types
- Each point type gets: label, color, icon shape, default properties (e.g., depth range).
- On the map, points render with their assigned type icon/color.
- Users can click a point and change its type from a dropdown.
- Point type information is preserved in all exports (CSV, JSON, GeoJSON, SHP, DXF).

### 2.2 — Street and Sidewalk Interpolation

Implement interpolation for streets and sidewalks to determine correct pipe network points:

- When the user defines a street alignment (centerline) and sidewalk boundaries:
  - Auto-calculate pipe offset from street centerline (typically 1/3 of street width for each side)
  - Interpolate elevation along the street profile
  - Generate manhole positions at intersections, changes of direction, and maximum spacing intervals (per NBR 9649: max 80m for DN ≤ 200mm, max 100m for DN > 200mm)
- **Input:** Street centerline (drawn on map or imported), street width, sidewalk width
- **Output:** Interpolated points placed at correct positions with estimated elevations based on street slope
- Show interpolated points differently (dashed outline) until the user confirms them.

---

## PART 3 — Export Enhancements (QGIS Compatibility)

### 3.1 — GeoJSON Export with Depth

Enhance the existing GeoJSON export (`hydro_network/io/gis_io.py`) to include:

- **Depth** (`profundidade`) for each node — calculated as `cota_terreno - cota_do_tubo` (terrain elevation minus pipe invert elevation).
- **Depth at upstream end** (`profundidade_montante`) and **depth at downstream end** (`profundidade_jusante`) for each pipe segment.
- **Cover depth** (`recobrimento`) — minimum soil cover above the pipe.
- Include these in the GeoJSON `properties` object for each Feature.

### 3.2 — Shapefile Export with Depth

Extend the existing SHP exporter (`src/gis/exporters/shp.py`) to include:

- `PROF_MONT` (profundidade montante) — depth at upstream node
- `PROF_JUS` (profundidade jusante) — depth at downstream node
- `RECOBRIM` (recobrimento) — cover depth
- `PROF_PV` (profundidade do PV) — manhole depth
- Add these fields to the DBF schema and `field_dictionary.json`.

---

## PART 4 — EPANET PRO MODULE Fixes

### 4.1 — Fix File Export

The EPANET PRO module (`src/hydraulics/epanet_wrapper.py`) currently generates INP file content but **export/download is not working**. Fix:

- Ensure the `generate_inp()` method produces a complete, valid INP file with ALL required sections: `[TITLE]`, `[JUNCTIONS]`, `[RESERVOIRS]`, `[TANKS]`, `[PIPES]`, `[PUMPS]`, `[VALVES]`, `[DEMANDS]`, `[STATUS]`, `[PATTERNS]`, `[CURVES]`, `[ENERGY]`, `[TIMES]`, `[OPTIONS]`, `[REPORT]`, `[END]`.
- Add a download button in the frontend that calls the backend, receives the INP content, and triggers a file download (`network.inp`).
- Also add export options for:
  - `.inp` (EPANET native format) — primary
  - `.json` (structured network data)
  - `.csv` (tabular format — one file for nodes, one for pipes)

### 4.2 — Fix INP Import

Implement INP file import:

- `POST /epanet/import/inp` — parse an existing `.inp` file and extract:
  - Junctions (ID, elevation, demand, coordinates)
  - Reservoirs, Tanks
  - Pipes (start node, end node, length, diameter, roughness)
  - Pumps, Valves
  - Patterns, Curves
  - Coordinates section `[COORDINATES]` for node placement
- Render the imported network on the Leaflet map with nodes and pipes.

### 4.3 — Import Network from Topografia Map

Allow EPANET PRO to import the network directly from the Topografia module's map:

- Button: **"Importar da Topografia"** (Import from Topography)
- Takes all points and segments from the Topografia map
- Converts them to EPANET elements:
  - Points → Junctions (with elevation from `cota`)
  - Segments → Pipes (with length, using existing diameter and material)
  - User can then assign demands, patterns, and other hydraulic properties
- The network appears on the EPANET map with proper node placement at the correct geographic coordinates.

### 4.4 — Fix Node Placement on Map

Currently, nodes can be added in EPANET PRO but **they don't appear on the map** — the user doesn't know where they are spatially. Fix:

- Every node (Junction, Reservoir, Tank) **must have coordinates** (lat, lng).
- When adding a new node, the user should:
  - Option A: **Click on the map** to place the node at that location (use Leaflet's click event: `map.on('click', (e) => { const {lat, lng} = e.latlng; })`)
  - Option B: **Enter coordinates manually** (UTM or LatLon with auto-conversion)
  - Option C: **Snap to an existing topographic point** from imported data
- Display all nodes on the map as interactive markers with:
  - Different icons per type (Junction = blue circle, Reservoir = blue square, Tank = blue triangle)
  - Popup showing node properties (ID, elevation, demand, coordinates)
  - Draggable markers to reposition nodes
- Display all pipes as polylines connecting their start/end nodes.
- When a node is moved, pipes connected to it should update automatically.

---

## PART 5 — PERFIL LONGITUDINAL (Longitudinal Profile) Module Fix

### 5.1 — Fix Profile Visualization

The Longitudinal Profile module visualization is **not working**. Implement a proper profile view:

**Data Source:**
- Use the network data from Topografia (points with `cota` and segments with `cota_inicio`, `cota_fim`, `comprimento`, `declividade`).

**Visualization (Canvas or SVG chart):**
- X-axis: cumulative horizontal distance along the network path (estacas / stations)
- Y-axis: elevation (cota)
- Draw the following elements:
  1. **Terrain line** (linha do terreno) — connects terrain elevations at each point (green line)
  2. **Pipe invert line** (greide do coletor) — connects pipe invert elevations (red/blue line below terrain)
  3. **Manholes** (PVs) — vertical lines from terrain to pipe invert at each node, with:
     - PV number/ID at top
     - Terrain elevation label
     - Pipe invert elevation label
     - Depth value (difference between terrain and invert)
  4. **Pipe segments** between manholes showing:
     - Diameter (DN)
     - Slope (%)
     - Length (m)
     - Material
  5. **Ground cover** — shaded area between terrain and pipe
  6. **Scale bars** — horizontal (distance) and vertical (elevation) with appropriate scale

**Interactivity:**
- Hover over a segment to highlight it on both the profile and the main map
- Click a manhole to see full details
- Zoom and pan within the profile view
- Option to select which path/route to display the profile for (if the network has branches)
- Export profile as PDF or PNG image

**Layout:**
- Show the profile below the map or in a resizable split panel
- Standard engineering drawing style: white background, grid lines, proper axis labels
- Table below the profile showing: station (estaca), terrain elevation, invert elevation, depth, slope, diameter, length — for each segment

---

## PART 6 — General Integration Notes

1. **All file imports** (DXF, DWG, IFC, SHP) should follow the same UX pattern: Upload → Scan/Preview → User Mapping → Import → Render on Map.
2. **Elevation is always optional** — if the file doesn't have elevation data, use `cota = 0` and let the user edit. Never reject a file for missing elevation.
3. **Coordinate system auto-detection** — use the existing UTM↔LatLon conversion. Support EPSG:31983, EPSG:4326, and detect from file metadata when available.
4. **Data persistence** — imported data should be saved to Supabase so it persists across sessions.
5. **Error handling** — show clear, user-friendly error messages in Portuguese for any import/export failures.
6. **File size limits** — support files up to 50MB. Show progress bar for large file processing.
7. **Undo/Redo** — allow users to undo the last import operation.

"""
Exportadores do módulo RDO.

Este módulo fornece funcionalidades de exportação para:
- PDF (relatório formatado)
- JSON (dados estruturados)
- Excel (planilha)
- Shapefile (dados geoespaciais)
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional, BinaryIO
from pathlib import Path
import io

from .models import RDO, SegmentProgress, DashboardMetrics


class RDOExporter:
    """Classe base para exportadores de RDO."""

    def __init__(self, rdo: RDO):
        self.rdo = rdo

    def _get_header_data(self) -> Dict[str, Any]:
        """Retorna dados do cabeçalho do RDO."""
        return {
            "id": self.rdo.id,
            "project_name": self.rdo.project_name or "N/A",
            "obra_name": self.rdo.obra_name or "N/A",
            "date": self.rdo.date.isoformat() if self.rdo.date else "N/A",
            "status": self.rdo.status.value,
            "created_at": self.rdo.created_at.isoformat() if self.rdo.created_at else "N/A",
            "created_by": self.rdo.created_by or "N/A",
        }


class JSONExporter(RDOExporter):
    """Exportador para formato JSON."""

    def export(self, include_history: bool = False) -> str:
        """
        Exporta o RDO para JSON.

        Args:
            include_history: Se deve incluir o histórico de alterações

        Returns:
            String JSON formatada
        """
        data = self.rdo.model_dump()

        # Converte enums para strings
        data["status"] = self.rdo.status.value
        data["terrain_condition"] = self.rdo.terrain_condition.value if self.rdo.terrain_condition else None

        # Converte datas para ISO format
        data["date"] = self.rdo.date.isoformat() if self.rdo.date else None
        data["created_at"] = self.rdo.created_at.isoformat() if self.rdo.created_at else None
        data["updated_at"] = self.rdo.updated_at.isoformat() if self.rdo.updated_at else None
        data["approved_at"] = self.rdo.approved_at.isoformat() if self.rdo.approved_at else None

        # Processa serviços executados
        for service in data.get("executed_services", []):
            if "unit" in service and hasattr(service["unit"], "value"):
                service["unit"] = service["unit"].value

        # Processa progresso de segmentos
        for segment in data.get("segment_progress", []):
            if "system_type" in segment and hasattr(segment["system_type"], "value"):
                segment["system_type"] = segment["system_type"].value
            if "execution_date" in segment and segment["execution_date"]:
                segment["execution_date"] = segment["execution_date"].isoformat() if hasattr(segment["execution_date"], "isoformat") else str(segment["execution_date"])

        # Remove histórico se não solicitado
        if not include_history:
            data.pop("history", None)

        # Adiciona metadados de exportação
        data["_export_metadata"] = {
            "format": "json",
            "exported_at": datetime.now().isoformat(),
            "version": "1.0"
        }

        return json.dumps(data, indent=2, ensure_ascii=False, default=str)

    def export_to_file(self, filepath: str, include_history: bool = False) -> None:
        """Exporta o RDO para um arquivo JSON."""
        content = self.export(include_history)
        Path(filepath).write_text(content, encoding="utf-8")


class ExcelExporter(RDOExporter):
    """Exportador para formato Excel (XLSX)."""

    def export(self) -> Dict[str, List[List[Any]]]:
        """
        Exporta o RDO para formato de dados Excel.

        Returns:
            Dicionário com sheets e seus dados em formato de lista de listas
        """
        sheets = {}

        # Sheet 1: Informações Gerais
        sheets["Informações Gerais"] = [
            ["RELATÓRIO DIÁRIO DE OBRA (RDO)"],
            [],
            ["Campo", "Valor"],
            ["ID", self.rdo.id],
            ["Projeto", self.rdo.project_name or "N/A"],
            ["Obra", self.rdo.obra_name or "N/A"],
            ["Data", self.rdo.date.strftime("%d/%m/%Y") if self.rdo.date else "N/A"],
            ["Status", self.rdo.status.value],
            ["Condição do Terreno", self.rdo.terrain_condition.value if self.rdo.terrain_condition else "N/A"],
            [],
            ["Localização GPS"],
            ["Latitude", self.rdo.location.latitude if self.rdo.location else "N/A"],
            ["Longitude", self.rdo.location.longitude if self.rdo.location else "N/A"],
            [],
            ["Frentes de Serviço", ", ".join(self.rdo.work_front_names) if self.rdo.work_front_names else "N/A"],
            ["Locais de Obra", ", ".join(self.rdo.work_location_names) if self.rdo.work_location_names else "N/A"],
            [],
            ["Observações Gerais"],
            [self.rdo.general_notes or "Nenhuma observação"],
            [],
            ["Criado em", self.rdo.created_at.strftime("%d/%m/%Y %H:%M") if self.rdo.created_at else "N/A"],
            ["Criado por", self.rdo.created_by or "N/A"],
        ]

        # Sheet 2: Serviços Executados
        services_header = ["#", "Serviço", "Quantidade", "Unidade", "Equipamentos", "Responsável", "Observações"]
        services_data = [["SERVIÇOS EXECUTADOS"], [], services_header]

        for i, service in enumerate(self.rdo.executed_services, 1):
            services_data.append([
                i,
                service.service_name,
                service.quantity,
                service.unit.value if hasattr(service.unit, "value") else str(service.unit),
                ", ".join(service.equipment_used) if service.equipment_used else "N/A",
                service.responsible_worker_name or "N/A",
                service.notes or ""
            ])

        if not self.rdo.executed_services:
            services_data.append(["", "Nenhum serviço registrado", "", "", "", "", ""])

        sheets["Serviços Executados"] = services_data

        # Sheet 3: Progresso dos Trechos
        segments_header = ["#", "ID Trecho", "Nome", "Tipo", "Data Execução",
                          "Planejado (m)", "Executado (m)", "Progresso (%)", "Status"]
        segments_data = [["PROGRESSO DOS TRECHOS"], [], segments_header]

        for i, segment in enumerate(self.rdo.segment_progress, 1):
            segments_data.append([
                i,
                segment.segment_id,
                segment.segment_name or "N/A",
                segment.system_type.value if hasattr(segment.system_type, "value") else str(segment.system_type),
                segment.execution_date.strftime("%d/%m/%Y") if segment.execution_date else "N/A",
                segment.planned_length or 0,
                segment.executed_length,
                f"{segment.progress_percentage:.1f}%",
                segment.status
            ])

        if not self.rdo.segment_progress:
            segments_data.append(["", "Nenhum trecho registrado", "", "", "", "", "", "", ""])

        # Adiciona resumo
        progress = self.rdo.calculate_total_progress()
        segments_data.extend([
            [],
            ["RESUMO"],
            ["Total Planejado (m)", progress["total_planned"]],
            ["Total Executado (m)", progress["total_executed"]],
            ["Progresso Geral", f"{progress['percentage']:.1f}%"],
        ])

        sheets["Progresso Trechos"] = segments_data

        # Sheet 4: Visitas
        visits_header = ["#", "Visitante", "Tipo", "Organização", "Finalidade", "Chegada", "Saída", "Observações"]
        visits_data = [["VISITAS RECEBIDAS"], [], visits_header]

        for i, visit in enumerate(self.rdo.visits, 1):
            visits_data.append([
                i,
                visit.visitor_name,
                visit.visitor_type,
                visit.organization or "N/A",
                visit.purpose or "N/A",
                visit.arrival_time or "N/A",
                visit.departure_time or "N/A",
                visit.notes or ""
            ])

        if not self.rdo.visits:
            visits_data.append(["", "Nenhuma visita registrada", "", "", "", "", "", ""])

        sheets["Visitas"] = visits_data

        # Sheet 5: Ocorrências
        occurrences_header = ["#", "Tipo", "Descrição", "Severidade", "Serviços Afetados", "Ações Corretivas", "Data/Hora"]
        occurrences_data = [["OCORRÊNCIAS"], [], occurrences_header]

        for i, occ in enumerate(self.rdo.occurrences, 1):
            occurrences_data.append([
                i,
                occ.type,
                occ.description,
                occ.severity,
                ", ".join(occ.affected_services) if occ.affected_services else "N/A",
                occ.corrective_actions or "N/A",
                occ.timestamp.strftime("%d/%m/%Y %H:%M") if occ.timestamp else "N/A"
            ])

        if not self.rdo.occurrences:
            occurrences_data.append(["", "Nenhuma ocorrência registrada", "", "", "", "", ""])

        sheets["Ocorrências"] = occurrences_data

        return sheets

    def to_csv_dict(self) -> Dict[str, str]:
        """Converte os dados para formato CSV (uma string por sheet)."""
        sheets = self.export()
        csv_dict = {}

        for sheet_name, data in sheets.items():
            lines = []
            for row in data:
                # Escapa aspas e vírgulas
                cells = []
                for cell in row:
                    cell_str = str(cell) if cell is not None else ""
                    if "," in cell_str or '"' in cell_str or "\n" in cell_str:
                        cell_str = '"' + cell_str.replace('"', '""') + '"'
                    cells.append(cell_str)
                lines.append(",".join(cells))
            csv_dict[sheet_name] = "\n".join(lines)

        return csv_dict


class PDFExporter(RDOExporter):
    """
    Exportador para formato PDF.

    Gera HTML formatado que pode ser convertido para PDF.
    """

    def export_html(self) -> str:
        """
        Gera HTML formatado do RDO para conversão em PDF.

        Returns:
            String HTML completa
        """
        progress = self.rdo.calculate_total_progress()

        html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RDO - {self.rdo.date.strftime('%d/%m/%Y') if self.rdo.date else 'N/A'}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #333;
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #2196F3;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }}
        .header h1 {{
            color: #1976D2;
            font-size: 18pt;
            margin-bottom: 5px;
        }}
        .header .subtitle {{
            color: #666;
            font-size: 10pt;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }}
        .info-box {{
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
        }}
        .info-box label {{
            font-weight: bold;
            color: #1976D2;
            font-size: 9pt;
            display: block;
            margin-bottom: 3px;
        }}
        .info-box span {{
            font-size: 10pt;
        }}
        .section {{
            margin-bottom: 20px;
        }}
        .section h2 {{
            color: #1976D2;
            font-size: 12pt;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 9pt;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: left;
        }}
        th {{
            background: #1976D2;
            color: white;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background: #f9f9f9;
        }}
        .progress-bar {{
            background: #e0e0e0;
            border-radius: 10px;
            height: 20px;
            overflow: hidden;
            margin: 10px 0;
        }}
        .progress-fill {{
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10pt;
        }}
        .status-badge {{
            display: inline-block;
            padding: 3px 10px;
            border-radius: 15px;
            font-size: 9pt;
            font-weight: bold;
        }}
        .status-rascunho {{ background: #fff3e0; color: #e65100; }}
        .status-enviado {{ background: #e3f2fd; color: #1565c0; }}
        .status-aprovado {{ background: #e8f5e9; color: #2e7d32; }}
        .status-rejeitado {{ background: #ffebee; color: #c62828; }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }}
        .summary-card {{
            background: linear-gradient(135deg, #1976D2, #2196F3);
            color: white;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }}
        .summary-card .value {{
            font-size: 18pt;
            font-weight: bold;
        }}
        .summary-card .label {{
            font-size: 9pt;
            opacity: 0.9;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 9pt;
            color: #666;
            text-align: center;
        }}
        .notes-box {{
            background: #fffde7;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 10px 0;
        }}
        @media print {{
            body {{ padding: 0; }}
            .section {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>RELATÓRIO DIÁRIO DE OBRA</h1>
        <div class="subtitle">
            {self.rdo.project_name or 'Projeto não especificado'} |
            Data: {self.rdo.date.strftime('%d/%m/%Y') if self.rdo.date else 'N/A'}
        </div>
    </div>

    <div class="info-grid">
        <div class="info-box">
            <label>ID do RDO</label>
            <span>{self.rdo.id[:8]}...</span>
        </div>
        <div class="info-box">
            <label>Status</label>
            <span class="status-badge status-{self.rdo.status.value}">{self.rdo.status.value.upper()}</span>
        </div>
        <div class="info-box">
            <label>Obra</label>
            <span>{self.rdo.obra_name or 'N/A'}</span>
        </div>
        <div class="info-box">
            <label>Condição do Terreno</label>
            <span>{self.rdo.terrain_condition.value if self.rdo.terrain_condition else 'N/A'}</span>
        </div>
        <div class="info-box">
            <label>Frentes de Serviço</label>
            <span>{', '.join(self.rdo.work_front_names) if self.rdo.work_front_names else 'N/A'}</span>
        </div>
        <div class="info-box">
            <label>Locais de Obra</label>
            <span>{', '.join(self.rdo.work_location_names) if self.rdo.work_location_names else 'N/A'}</span>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="value">{len(self.rdo.executed_services)}</div>
            <div class="label">Serviços Executados</div>
        </div>
        <div class="summary-card">
            <div class="value">{len(self.rdo.segment_progress)}</div>
            <div class="label">Trechos Registrados</div>
        </div>
        <div class="summary-card">
            <div class="value">{progress['percentage']:.1f}%</div>
            <div class="label">Progresso Geral</div>
        </div>
    </div>

    <div class="progress-bar">
        <div class="progress-fill" style="width: {progress['percentage']}%">
            {progress['percentage']:.1f}%
        </div>
    </div>

    <div class="section">
        <h2>Serviços Executados</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Serviço</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                    <th>Equipamentos</th>
                    <th>Responsável</th>
                </tr>
            </thead>
            <tbody>
                {self._render_services_rows()}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Progresso dos Trechos</h2>
        <table>
            <thead>
                <tr>
                    <th>Trecho</th>
                    <th>Tipo</th>
                    <th>Data</th>
                    <th>Planejado (m)</th>
                    <th>Executado (m)</th>
                    <th>Progresso</th>
                </tr>
            </thead>
            <tbody>
                {self._render_segments_rows()}
            </tbody>
        </table>
    </div>

    {self._render_visits_section()}

    {self._render_occurrences_section()}

    {self._render_notes_section()}

    <div class="footer">
        <p>RDO gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}</p>
        <p>Criado por: {self.rdo.created_by or 'N/A'} | Versão: {self.rdo.version}</p>
    </div>
</body>
</html>
"""
        return html

    def _render_services_rows(self) -> str:
        """Renderiza linhas da tabela de serviços."""
        if not self.rdo.executed_services:
            return '<tr><td colspan="6" style="text-align: center;">Nenhum serviço registrado</td></tr>'

        rows = []
        for i, service in enumerate(self.rdo.executed_services, 1):
            unit = service.unit.value if hasattr(service.unit, "value") else str(service.unit)
            equipment = ", ".join(service.equipment_used) if service.equipment_used else "N/A"
            rows.append(f"""
                <tr>
                    <td>{i}</td>
                    <td>{service.service_name}</td>
                    <td>{service.quantity:.2f}</td>
                    <td>{unit}</td>
                    <td>{equipment}</td>
                    <td>{service.responsible_worker_name or 'N/A'}</td>
                </tr>
            """)
        return "".join(rows)

    def _render_segments_rows(self) -> str:
        """Renderiza linhas da tabela de trechos."""
        if not self.rdo.segment_progress:
            return '<tr><td colspan="6" style="text-align: center;">Nenhum trecho registrado</td></tr>'

        rows = []
        for segment in self.rdo.segment_progress:
            system = segment.system_type.value if hasattr(segment.system_type, "value") else str(segment.system_type)
            exec_date = segment.execution_date.strftime('%d/%m/%Y') if segment.execution_date else 'N/A'
            rows.append(f"""
                <tr>
                    <td>{segment.segment_name or segment.segment_id[:8]}</td>
                    <td>{system}</td>
                    <td>{exec_date}</td>
                    <td>{segment.planned_length or 0:.2f}</td>
                    <td>{segment.executed_length:.2f}</td>
                    <td>{segment.progress_percentage:.1f}%</td>
                </tr>
            """)
        return "".join(rows)

    def _render_visits_section(self) -> str:
        """Renderiza seção de visitas."""
        if not self.rdo.visits:
            return ""

        rows = []
        for visit in self.rdo.visits:
            rows.append(f"""
                <tr>
                    <td>{visit.visitor_name}</td>
                    <td>{visit.visitor_type}</td>
                    <td>{visit.organization or 'N/A'}</td>
                    <td>{visit.purpose or 'N/A'}</td>
                </tr>
            """)

        return f"""
        <div class="section">
            <h2>Visitas Recebidas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Visitante</th>
                        <th>Tipo</th>
                        <th>Organização</th>
                        <th>Finalidade</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
        </div>
        """

    def _render_occurrences_section(self) -> str:
        """Renderiza seção de ocorrências."""
        if not self.rdo.occurrences:
            return ""

        rows = []
        for occ in self.rdo.occurrences:
            rows.append(f"""
                <tr>
                    <td>{occ.type}</td>
                    <td>{occ.description}</td>
                    <td>{occ.severity}</td>
                    <td>{occ.corrective_actions or 'N/A'}</td>
                </tr>
            """)

        return f"""
        <div class="section">
            <h2>Ocorrências</h2>
            <table>
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th>Severidade</th>
                        <th>Ações Corretivas</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
        </div>
        """

    def _render_notes_section(self) -> str:
        """Renderiza seção de observações."""
        if not self.rdo.general_notes:
            return ""

        return f"""
        <div class="section">
            <h2>Observações Gerais</h2>
            <div class="notes-box">
                {self.rdo.general_notes}
            </div>
        </div>
        """


class ShapefileExporter(RDOExporter):
    """
    Exportador para formato Shapefile.

    Gera dados geoespaciais dos trechos do RDO.
    """

    def export_geojson(self) -> Dict[str, Any]:
        """
        Exporta os trechos do RDO como GeoJSON.

        Returns:
            Dicionário GeoJSON (FeatureCollection)
        """
        features = []

        for segment in self.rdo.segment_progress:
            # Determina geometria
            geometry = None
            if segment.start_coordinates and segment.end_coordinates:
                geometry = {
                    "type": "LineString",
                    "coordinates": [
                        [segment.start_coordinates.longitude, segment.start_coordinates.latitude],
                        [segment.end_coordinates.longitude, segment.end_coordinates.latitude]
                    ]
                }
            elif segment.geometry_wkt:
                # Placeholder - em produção usaria shapely para parse WKT
                geometry = {"type": "LineString", "coordinates": []}
            else:
                # Ponto se não tiver geometria linear
                if segment.start_coordinates:
                    geometry = {
                        "type": "Point",
                        "coordinates": [
                            segment.start_coordinates.longitude,
                            segment.start_coordinates.latitude
                        ]
                    }
                else:
                    continue  # Pula segmentos sem geometria

            # Propriedades do feature
            properties = {
                "rdo_id": self.rdo.id,
                "rdo_date": self.rdo.date.isoformat() if self.rdo.date else None,
                "project_id": self.rdo.project_id,
                "project_name": self.rdo.project_name,
                "segment_id": segment.segment_id,
                "segment_name": segment.segment_name,
                "system_type": segment.system_type.value if hasattr(segment.system_type, "value") else str(segment.system_type),
                "exec_date": segment.execution_date.isoformat() if segment.execution_date else None,
                "planned_m": segment.planned_length,
                "executed_m": segment.executed_length,
                "progress_pct": segment.progress_percentage,
                "status": segment.status
            }

            features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": properties
            })

        return {
            "type": "FeatureCollection",
            "name": f"RDO_{self.rdo.date.strftime('%Y%m%d') if self.rdo.date else 'unknown'}",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:EPSG::4326"}
            },
            "features": features,
            "metadata": {
                "rdo_id": self.rdo.id,
                "project": self.rdo.project_name,
                "date": self.rdo.date.isoformat() if self.rdo.date else None,
                "total_segments": len(features),
                "exported_at": datetime.now().isoformat()
            }
        }

    def export_shapefile_data(self) -> Dict[str, Any]:
        """
        Prepara dados para exportação como Shapefile.

        Retorna estrutura que pode ser usada com pyshp ou similar.

        Returns:
            Dicionário com fields, records e geometries
        """
        # Define campos do shapefile
        fields = [
            ("rdo_id", "C", 40),       # Character, 40 chars
            ("rdo_date", "D"),          # Date
            ("project_id", "C", 40),
            ("proj_name", "C", 100),
            ("seg_id", "C", 40),
            ("seg_name", "C", 100),
            ("sys_type", "C", 20),
            ("exec_date", "D"),
            ("planned_m", "N", 10, 2),  # Numeric, 10 digits, 2 decimal
            ("executed_m", "N", 10, 2),
            ("progress", "N", 5, 2),
            ("status", "C", 20),
        ]

        records = []
        geometries = []

        for segment in self.rdo.segment_progress:
            # Registro de atributos
            record = [
                self.rdo.id[:40],
                self.rdo.date if self.rdo.date else None,
                self.rdo.project_id[:40] if self.rdo.project_id else "",
                (self.rdo.project_name or "")[:100],
                segment.segment_id[:40],
                (segment.segment_name or "")[:100],
                (segment.system_type.value if hasattr(segment.system_type, "value") else str(segment.system_type))[:20],
                segment.execution_date if segment.execution_date else None,
                segment.planned_length or 0,
                segment.executed_length,
                segment.progress_percentage,
                (segment.status or "")[:20]
            ]
            records.append(record)

            # Geometria
            if segment.start_coordinates and segment.end_coordinates:
                geometries.append({
                    "type": "polyline",
                    "parts": [[
                        [segment.start_coordinates.longitude, segment.start_coordinates.latitude],
                        [segment.end_coordinates.longitude, segment.end_coordinates.latitude]
                    ]]
                })
            elif segment.start_coordinates:
                geometries.append({
                    "type": "point",
                    "coordinates": [
                        segment.start_coordinates.longitude,
                        segment.start_coordinates.latitude
                    ]
                })
            else:
                geometries.append({"type": "null"})

        return {
            "fields": fields,
            "records": records,
            "geometries": geometries,
            "geometry_type": "POLYLINE",
            "crs": "EPSG:4326"
        }


class BatchExporter:
    """Exportador em lote para múltiplos RDOs."""

    def __init__(self, rdos: List[RDO]):
        self.rdos = rdos

    def export_all_json(self) -> str:
        """Exporta todos os RDOs como um array JSON."""
        all_data = []
        for rdo in self.rdos:
            exporter = JSONExporter(rdo)
            data = json.loads(exporter.export())
            all_data.append(data)

        return json.dumps({
            "type": "rdo_collection",
            "count": len(all_data),
            "exported_at": datetime.now().isoformat(),
            "rdos": all_data
        }, indent=2, ensure_ascii=False)

    def export_combined_geojson(self) -> Dict[str, Any]:
        """Exporta todos os trechos de todos os RDOs como GeoJSON único."""
        all_features = []

        for rdo in self.rdos:
            exporter = ShapefileExporter(rdo)
            geojson = exporter.export_geojson()
            all_features.extend(geojson["features"])

        return {
            "type": "FeatureCollection",
            "name": "RDOs_Combined",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:EPSG::4326"}
            },
            "features": all_features,
            "metadata": {
                "total_rdos": len(self.rdos),
                "total_segments": len(all_features),
                "exported_at": datetime.now().isoformat()
            }
        }

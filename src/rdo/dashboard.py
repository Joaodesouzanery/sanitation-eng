"""
Dashboard do módulo RDO.

Este módulo fornece cálculos e agregações para o dashboard de RDOs,
incluindo métricas de progresso, comparativos planejado vs executado,
e dados para visualização em gráficos.
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .models import (
    RDO,
    RDOStatus,
    DashboardMetrics,
    SystemType,
    SegmentProgress,
)


class RDODashboard:
    """
    Classe para cálculo de métricas e geração de dados do dashboard.

    Fornece:
    - Métricas gerais de RDOs
    - Progresso por projeto/sistema
    - Timeline de execução
    - Dados para gráficos
    """

    def __init__(self, rdos: List[RDO], planned_segments: Optional[Dict[str, Dict[str, Any]]] = None):
        """
        Inicializa o dashboard.

        Args:
            rdos: Lista de RDOs para análise
            planned_segments: Dicionário com dados de trechos planejados
        """
        self.rdos = rdos
        self.planned_segments = planned_segments or {}
        self._cache: Dict[str, Any] = {}

    def calculate_metrics(self) -> DashboardMetrics:
        """
        Calcula todas as métricas do dashboard.

        Returns:
            Objeto DashboardMetrics com todas as métricas calculadas
        """
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        metrics = DashboardMetrics(
            total_rdos=len(self.rdos),
            rdos_today=sum(1 for r in self.rdos if r.date == today),
            rdos_this_week=sum(1 for r in self.rdos if r.date >= week_start),
            rdos_this_month=sum(1 for r in self.rdos if r.date >= month_start),
        )

        # RDOs por status
        for status in RDOStatus:
            count = sum(1 for r in self.rdos if r.status == status)
            metrics.rdos_by_status[status.value] = count

        # Calcula progresso geral
        progress_data = self._calculate_overall_progress()
        metrics.total_planned_length = progress_data["total_planned"]
        metrics.total_executed_length = progress_data["total_executed"]
        metrics.overall_progress_percentage = progress_data["percentage"]

        # Progresso por sistema
        metrics.progress_by_system = self._calculate_progress_by_system()

        # Progresso por projeto
        metrics.progress_by_project = self._calculate_progress_by_project()

        # Top serviços
        metrics.top_services = self._get_top_services(limit=10)

        # Timeline de execução
        metrics.execution_timeline = self._generate_execution_timeline()

        # Ocorrências
        occ_data = self._analyze_occurrences()
        metrics.total_occurrences = occ_data["total"]
        metrics.occurrences_by_severity = occ_data["by_severity"]

        return metrics

    def _calculate_overall_progress(self) -> Dict[str, float]:
        """Calcula o progresso geral considerando todos os RDOs."""
        total_executed = 0.0
        total_planned = 0.0

        # Agrupa execução por trecho para evitar duplicação
        segment_executed: Dict[str, float] = defaultdict(float)
        segment_planned: Dict[str, float] = {}

        for rdo in self.rdos:
            for segment in rdo.segment_progress:
                segment_executed[segment.segment_id] += segment.executed_length
                if segment.planned_length:
                    segment_planned[segment.segment_id] = max(
                        segment_planned.get(segment.segment_id, 0),
                        segment.planned_length
                    )

        # Adiciona trechos planejados sem execução
        for seg_id, planned_data in self.planned_segments.items():
            if seg_id not in segment_planned:
                segment_planned[seg_id] = planned_data.get("planned_length", 0)

        total_executed = sum(segment_executed.values())
        total_planned = sum(segment_planned.values())

        percentage = 0.0
        if total_planned > 0:
            percentage = min(100.0, (total_executed / total_planned) * 100)

        return {
            "total_planned": round(total_planned, 2),
            "total_executed": round(total_executed, 2),
            "percentage": round(percentage, 2)
        }

    def _calculate_progress_by_system(self) -> Dict[str, Dict[str, float]]:
        """Calcula progresso separado por tipo de sistema (água/esgoto)."""
        by_system: Dict[str, Dict[str, float]] = {}

        for system_type in SystemType:
            executed = 0.0
            planned = 0.0

            segment_executed: Dict[str, float] = defaultdict(float)
            segment_planned: Dict[str, float] = {}

            for rdo in self.rdos:
                for segment in rdo.segment_progress:
                    if segment.system_type == system_type:
                        segment_executed[segment.segment_id] += segment.executed_length
                        if segment.planned_length:
                            segment_planned[segment.segment_id] = max(
                                segment_planned.get(segment.segment_id, 0),
                                segment.planned_length
                            )

            # Adiciona planejados
            for seg_id, data in self.planned_segments.items():
                if data.get("system_type") == system_type.value:
                    if seg_id not in segment_planned:
                        segment_planned[seg_id] = data.get("planned_length", 0)

            executed = sum(segment_executed.values())
            planned = sum(segment_planned.values())

            percentage = 0.0
            if planned > 0:
                percentage = min(100.0, (executed / planned) * 100)

            by_system[system_type.value] = {
                "planned": round(planned, 2),
                "executed": round(executed, 2),
                "percentage": round(percentage, 2),
                "remaining": round(max(0, planned - executed), 2)
            }

        return by_system

    def _calculate_progress_by_project(self) -> Dict[str, Dict[str, float]]:
        """Calcula progresso por projeto."""
        by_project: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"planned": 0.0, "executed": 0.0}
        )

        # Agrupa por projeto
        segment_by_project: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(
            lambda: {"executed": defaultdict(float), "planned": {}}
        )

        for rdo in self.rdos:
            project_id = rdo.project_id
            project_name = rdo.project_name or project_id

            for segment in rdo.segment_progress:
                segment_by_project[project_name]["executed"][segment.segment_id] += segment.executed_length
                if segment.planned_length:
                    segment_by_project[project_name]["planned"][segment.segment_id] = max(
                        segment_by_project[project_name]["planned"].get(segment.segment_id, 0),
                        segment.planned_length
                    )

        # Calcula totais por projeto
        for project_name, data in segment_by_project.items():
            executed = sum(data["executed"].values())
            planned = sum(data["planned"].values())

            percentage = 0.0
            if planned > 0:
                percentage = min(100.0, (executed / planned) * 100)

            by_project[project_name] = {
                "planned": round(planned, 2),
                "executed": round(executed, 2),
                "percentage": round(percentage, 2),
                "remaining": round(max(0, planned - executed), 2),
                "rdos_count": sum(1 for r in self.rdos if r.project_name == project_name or r.project_id == project_name)
            }

        return dict(by_project)

    def _get_top_services(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retorna os serviços mais executados."""
        service_totals: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"quantity": 0.0, "unit": "", "count": 0}
        )

        for rdo in self.rdos:
            for service in rdo.executed_services:
                key = service.service_name
                unit = service.unit.value if hasattr(service.unit, "value") else str(service.unit)
                service_totals[key]["quantity"] += service.quantity
                service_totals[key]["unit"] = unit
                service_totals[key]["count"] += 1

        # Ordena por quantidade
        sorted_services = sorted(
            service_totals.items(),
            key=lambda x: x[1]["quantity"],
            reverse=True
        )[:limit]

        return [
            {
                "name": name,
                "total_quantity": round(data["quantity"], 2),
                "unit": data["unit"],
                "occurrences": data["count"]
            }
            for name, data in sorted_services
        ]

    def _generate_execution_timeline(self, days: int = 30) -> List[Dict[str, Any]]:
        """Gera timeline de execução dos últimos N dias."""
        today = date.today()
        start_date = today - timedelta(days=days - 1)

        # Inicializa todos os dias com zero
        daily_data: Dict[date, Dict[str, float]] = {}
        current = start_date
        while current <= today:
            daily_data[current] = {
                "executed": 0.0,
                "rdos_count": 0,
                "services_count": 0
            }
            current += timedelta(days=1)

        # Agrega dados dos RDOs
        for rdo in self.rdos:
            if start_date <= rdo.date <= today:
                if rdo.date in daily_data:
                    daily_data[rdo.date]["rdos_count"] += 1
                    daily_data[rdo.date]["services_count"] += len(rdo.executed_services)

                    for segment in rdo.segment_progress:
                        daily_data[rdo.date]["executed"] += segment.executed_length

        # Calcula acumulado
        accumulated = 0.0
        timeline = []

        for day in sorted(daily_data.keys()):
            data = daily_data[day]
            accumulated += data["executed"]

            timeline.append({
                "date": day.isoformat(),
                "date_formatted": day.strftime("%d/%m"),
                "daily_executed": round(data["executed"], 2),
                "accumulated_executed": round(accumulated, 2),
                "rdos_count": data["rdos_count"],
                "services_count": data["services_count"]
            })

        return timeline

    def _analyze_occurrences(self) -> Dict[str, Any]:
        """Analisa ocorrências registradas nos RDOs."""
        total = 0
        by_severity: Dict[str, int] = defaultdict(int)
        by_type: Dict[str, int] = defaultdict(int)

        for rdo in self.rdos:
            for occ in rdo.occurrences:
                total += 1
                by_severity[occ.severity] += 1
                by_type[occ.type] += 1

        return {
            "total": total,
            "by_severity": dict(by_severity),
            "by_type": dict(by_type)
        }

    def get_segment_details(self) -> List[Dict[str, Any]]:
        """
        Retorna detalhes de todos os trechos com status de execução.

        Returns:
            Lista de trechos com informações de planejado, executado e status
        """
        # Agrupa execução por trecho
        segment_data: Dict[str, Dict[str, Any]] = {}

        # Processa execuções dos RDOs
        for rdo in self.rdos:
            for segment in rdo.segment_progress:
                seg_id = segment.segment_id

                if seg_id not in segment_data:
                    segment_data[seg_id] = {
                        "segment_id": seg_id,
                        "segment_name": segment.segment_name,
                        "system_type": segment.system_type.value if hasattr(segment.system_type, "value") else str(segment.system_type),
                        "project_id": segment.project_id,
                        "planned_length": segment.planned_length or 0,
                        "executed_length": 0,
                        "execution_dates": [],
                        "rdo_ids": [],
                        "start_coords": None,
                        "end_coords": None,
                    }

                segment_data[seg_id]["executed_length"] += segment.executed_length
                segment_data[seg_id]["execution_dates"].append(segment.execution_date.isoformat() if segment.execution_date else None)
                segment_data[seg_id]["rdo_ids"].append(rdo.id)

                # Atualiza planejado se maior
                if segment.planned_length:
                    segment_data[seg_id]["planned_length"] = max(
                        segment_data[seg_id]["planned_length"],
                        segment.planned_length
                    )

                # Armazena coordenadas
                if segment.start_coordinates:
                    segment_data[seg_id]["start_coords"] = {
                        "lat": segment.start_coordinates.latitude,
                        "lng": segment.start_coordinates.longitude
                    }
                if segment.end_coordinates:
                    segment_data[seg_id]["end_coords"] = {
                        "lat": segment.end_coordinates.latitude,
                        "lng": segment.end_coordinates.longitude
                    }

        # Adiciona trechos planejados sem execução
        for seg_id, planned_data in self.planned_segments.items():
            if seg_id not in segment_data:
                segment_data[seg_id] = {
                    "segment_id": seg_id,
                    "segment_name": planned_data.get("name"),
                    "system_type": planned_data.get("system_type", "unknown"),
                    "project_id": planned_data.get("project_id"),
                    "planned_length": planned_data.get("planned_length", 0),
                    "executed_length": 0,
                    "execution_dates": [],
                    "rdo_ids": [],
                    "start_coords": planned_data.get("start_coords"),
                    "end_coords": planned_data.get("end_coords"),
                }

        # Calcula progresso e status para cada trecho
        result = []
        for seg_id, data in segment_data.items():
            planned = data["planned_length"]
            executed = data["executed_length"]

            progress = 0.0
            if planned > 0:
                progress = min(100.0, (executed / planned) * 100)

            # Determina status
            if progress >= 100:
                status = "concluido"
                color = "#28a745"
            elif progress >= 75:
                status = "quase_concluido"
                color = "#8bc34a"
            elif progress >= 50:
                status = "em_andamento"
                color = "#ffc107"
            elif progress > 0:
                status = "iniciado"
                color = "#fd7e14"
            else:
                status = "nao_iniciado"
                color = "#dc3545"

            result.append({
                **data,
                "progress_percentage": round(progress, 2),
                "remaining_length": round(max(0, planned - executed), 2),
                "status": status,
                "color": color,
                "first_execution": min(data["execution_dates"]) if data["execution_dates"] else None,
                "last_execution": max(data["execution_dates"]) if data["execution_dates"] else None,
            })

        # Ordena por progresso decrescente
        result.sort(key=lambda x: x["progress_percentage"], reverse=True)

        return result

    def get_chart_data(self) -> Dict[str, Any]:
        """
        Retorna dados formatados para gráficos do dashboard.

        Returns:
            Dicionário com dados para diversos tipos de gráficos
        """
        metrics = self.calculate_metrics()
        segments = self.get_segment_details()

        # Dados para gráfico de pizza - Status dos RDOs
        status_chart = {
            "labels": list(metrics.rdos_by_status.keys()),
            "values": list(metrics.rdos_by_status.values()),
            "colors": ["#ffc107", "#2196f3", "#28a745", "#dc3545"]
        }

        # Dados para gráfico de barras - Progresso por sistema
        system_chart = {
            "labels": [s.replace("_", " ").title() for s in metrics.progress_by_system.keys()],
            "planned": [d["planned"] for d in metrics.progress_by_system.values()],
            "executed": [d["executed"] for d in metrics.progress_by_system.values()],
            "colors": {
                "planned": "#e0e0e0",
                "executed": "#2196f3"
            }
        }

        # Dados para gráfico de linha - Timeline
        timeline_chart = {
            "labels": [t["date_formatted"] for t in metrics.execution_timeline],
            "daily": [t["daily_executed"] for t in metrics.execution_timeline],
            "accumulated": [t["accumulated_executed"] for t in metrics.execution_timeline]
        }

        # Dados para gráfico de rosca - Progresso geral
        progress_chart = {
            "completed": metrics.overall_progress_percentage,
            "remaining": 100 - metrics.overall_progress_percentage,
            "total_planned": metrics.total_planned_length,
            "total_executed": metrics.total_executed_length
        }

        # Dados para gráfico de barras horizontais - Top serviços
        services_chart = {
            "labels": [s["name"][:30] + "..." if len(s["name"]) > 30 else s["name"]
                      for s in metrics.top_services],
            "values": [s["total_quantity"] for s in metrics.top_services],
            "units": [s["unit"] for s in metrics.top_services]
        }

        # Dados para gráfico de barras - Status dos trechos
        status_counts = defaultdict(int)
        for seg in segments:
            status_counts[seg["status"]] += 1

        segment_status_chart = {
            "labels": ["Concluído", "Quase Concluído", "Em Andamento", "Iniciado", "Não Iniciado"],
            "values": [
                status_counts.get("concluido", 0),
                status_counts.get("quase_concluido", 0),
                status_counts.get("em_andamento", 0),
                status_counts.get("iniciado", 0),
                status_counts.get("nao_iniciado", 0)
            ],
            "colors": ["#28a745", "#8bc34a", "#ffc107", "#fd7e14", "#dc3545"]
        }

        return {
            "status_chart": status_chart,
            "system_chart": system_chart,
            "timeline_chart": timeline_chart,
            "progress_chart": progress_chart,
            "services_chart": services_chart,
            "segment_status_chart": segment_status_chart,
            "summary": {
                "total_rdos": metrics.total_rdos,
                "total_planned": metrics.total_planned_length,
                "total_executed": metrics.total_executed_length,
                "overall_progress": metrics.overall_progress_percentage,
                "total_segments": len(segments),
                "completed_segments": status_counts.get("concluido", 0),
                "total_occurrences": metrics.total_occurrences
            }
        }

    def get_map_data(self) -> Dict[str, Any]:
        """
        Retorna dados formatados para o mapa interativo.

        Returns:
            GeoJSON FeatureCollection com trechos coloridos por progresso
        """
        segments = self.get_segment_details()
        features = []

        for segment in segments:
            # Verifica se tem coordenadas
            if not segment["start_coords"] and not segment["end_coords"]:
                continue

            # Cria geometria
            if segment["start_coords"] and segment["end_coords"]:
                geometry = {
                    "type": "LineString",
                    "coordinates": [
                        [segment["start_coords"]["lng"], segment["start_coords"]["lat"]],
                        [segment["end_coords"]["lng"], segment["end_coords"]["lat"]]
                    ]
                }
            elif segment["start_coords"]:
                geometry = {
                    "type": "Point",
                    "coordinates": [segment["start_coords"]["lng"], segment["start_coords"]["lat"]]
                }
            else:
                continue

            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "segment_id": segment["segment_id"],
                    "segment_name": segment["segment_name"],
                    "system_type": segment["system_type"],
                    "planned_length": segment["planned_length"],
                    "executed_length": segment["executed_length"],
                    "progress_percentage": segment["progress_percentage"],
                    "remaining_length": segment["remaining_length"],
                    "status": segment["status"],
                    "color": segment["color"],
                    "first_execution": segment["first_execution"],
                    "last_execution": segment["last_execution"],
                }
            }
            features.append(feature)

        # Calcula bounds do mapa
        bounds = self._calculate_bounds(features)

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "total_features": len(features),
                "bounds": bounds,
                "generated_at": datetime.now().isoformat()
            }
        }

    def _calculate_bounds(self, features: List[Dict]) -> Optional[Dict[str, float]]:
        """Calcula os limites geográficos dos features."""
        if not features:
            return None

        min_lat = float('inf')
        max_lat = float('-inf')
        min_lng = float('inf')
        max_lng = float('-inf')

        for feature in features:
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [])

            if geom.get("type") == "Point":
                coords = [coords]
            elif geom.get("type") == "LineString":
                pass  # já é lista de coords

            for coord in coords:
                if len(coord) >= 2:
                    lng, lat = coord[0], coord[1]
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)
                    min_lng = min(min_lng, lng)
                    max_lng = max(max_lng, lng)

        if min_lat == float('inf'):
            return None

        return {
            "south": min_lat,
            "north": max_lat,
            "west": min_lng,
            "east": max_lng,
            "center": {
                "lat": (min_lat + max_lat) / 2,
                "lng": (min_lng + max_lng) / 2
            }
        }

    def get_comparison_report(
        self,
        project_id: Optional[str] = None,
        system_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera relatório comparativo entre planejado e executado.

        Args:
            project_id: Filtrar por projeto específico
            system_type: Filtrar por tipo de sistema

        Returns:
            Relatório com análise detalhada
        """
        segments = self.get_segment_details()

        # Aplica filtros
        if project_id:
            segments = [s for s in segments if s["project_id"] == project_id]
        if system_type:
            segments = [s for s in segments if s["system_type"] == system_type]

        if not segments:
            return {
                "status": "no_data",
                "message": "Nenhum trecho encontrado com os filtros aplicados"
            }

        # Cálculos gerais
        total_planned = sum(s["planned_length"] for s in segments)
        total_executed = sum(s["executed_length"] for s in segments)
        total_remaining = sum(s["remaining_length"] for s in segments)

        overall_progress = 0.0
        if total_planned > 0:
            overall_progress = (total_executed / total_planned) * 100

        # Análise de desvios
        ahead_of_schedule = [s for s in segments if s["progress_percentage"] >= 100]
        on_track = [s for s in segments if 80 <= s["progress_percentage"] < 100]
        slightly_delayed = [s for s in segments if 50 <= s["progress_percentage"] < 80]
        delayed = [s for s in segments if 0 < s["progress_percentage"] < 50]
        not_started = [s for s in segments if s["progress_percentage"] == 0]

        return {
            "status": "success",
            "filters": {
                "project_id": project_id,
                "system_type": system_type
            },
            "totals": {
                "total_segments": len(segments),
                "total_planned_length": round(total_planned, 2),
                "total_executed_length": round(total_executed, 2),
                "total_remaining_length": round(total_remaining, 2),
                "overall_progress_percentage": round(overall_progress, 2)
            },
            "analysis": {
                "completed": {
                    "count": len(ahead_of_schedule),
                    "percentage": round(len(ahead_of_schedule) / len(segments) * 100, 1) if segments else 0,
                    "segments": [s["segment_name"] or s["segment_id"] for s in ahead_of_schedule]
                },
                "on_track": {
                    "count": len(on_track),
                    "percentage": round(len(on_track) / len(segments) * 100, 1) if segments else 0,
                    "segments": [s["segment_name"] or s["segment_id"] for s in on_track]
                },
                "slightly_delayed": {
                    "count": len(slightly_delayed),
                    "percentage": round(len(slightly_delayed) / len(segments) * 100, 1) if segments else 0,
                    "segments": [s["segment_name"] or s["segment_id"] for s in slightly_delayed]
                },
                "delayed": {
                    "count": len(delayed),
                    "percentage": round(len(delayed) / len(segments) * 100, 1) if segments else 0,
                    "segments": [s["segment_name"] or s["segment_id"] for s in delayed]
                },
                "not_started": {
                    "count": len(not_started),
                    "percentage": round(len(not_started) / len(segments) * 100, 1) if segments else 0,
                    "segments": [s["segment_name"] or s["segment_id"] for s in not_started]
                }
            },
            "segments_detail": segments,
            "generated_at": datetime.now().isoformat()
        }

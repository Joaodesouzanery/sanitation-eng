"""
Findings Module - Exportação e gestão de achados de revisão por pares

Gera relatórios estruturados e camada SHP peer_review_findings.shp
"""

from typing import List, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json
import csv
from pathlib import Path


class Severity(Enum):
    """Severidade dos achados"""
    OK = "OK"
    INFO = "INFO"
    ALERT = "ALERT"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class FindingStatus(Enum):
    """Status do achado no workflow"""
    OPEN = "ABERTO"
    REVIEWED = "REVISADO"
    ADJUDICATED = "ADJUDICADO"
    RESOLVED = "RESOLVIDO"
    DEFERRED = "ADIADO"


@dataclass
class Finding:
    """
    Achado de revisão por pares.

    Representa uma não-conformidade ou ponto de atenção
    identificado durante o processo de revisão.
    """
    id: str
    rule_id: str
    element_id: str
    element_type: str  # NODE, LINK, SUBCATCHMENT
    severity: Severity
    status: FindingStatus = FindingStatus.OPEN

    # Localização
    x: Optional[float] = None
    y: Optional[float] = None
    geometry_type: str = "POINT"  # POINT ou LINESTRING

    # Descrição
    title: str = ""
    message: str = ""
    recommendation: str = ""

    # Referência normativa
    norm_id: Optional[str] = None
    clause_id: Optional[str] = None
    topic: Optional[str] = None

    # Evidências
    evidence_fields: List[str] = field(default_factory=list)
    evidence_values: Dict[str, any] = field(default_factory=dict)

    # Workflow
    reviewer_a: Optional[str] = None
    reviewer_b: Optional[str] = None
    adjudicator: Optional[str] = None
    resolution_notes: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class FindingsReport:
    """
    Relatório de achados de revisão.

    Consolida todos os achados e exporta em múltiplos formatos.
    """

    def __init__(self, project_id: str = ""):
        self.project_id = project_id
        self.findings: List[Finding] = []
        self.metadata = {
            "created": datetime.utcnow().isoformat(),
            "generator": "HydroNetwork Peer Review Engine"
        }

    def add_finding(self, finding: Finding):
        """Adiciona achado ao relatório"""
        self.findings.append(finding)

    def get_summary(self) -> Dict:
        """Retorna resumo estatístico"""
        by_severity = {}
        by_status = {}
        by_norm = {}

        for f in self.findings:
            # Por severidade
            sev = f.severity.value
            by_severity[sev] = by_severity.get(sev, 0) + 1

            # Por status
            stat = f.status.value
            by_status[stat] = by_status.get(stat, 0) + 1

            # Por norma
            if f.norm_id:
                by_norm[f.norm_id] = by_norm.get(f.norm_id, 0) + 1

        return {
            "total": len(self.findings),
            "by_severity": by_severity,
            "by_status": by_status,
            "by_norm": by_norm,
            "critical_count": by_severity.get("CRITICAL", 0) + by_severity.get("ERROR", 0),
            "open_count": by_status.get("ABERTO", 0)
        }

    def export_csv(self, filepath: str):
        """Exporta para CSV"""
        fieldnames = [
            'id', 'rule_id', 'element_id', 'element_type',
            'severity', 'status', 'title', 'message', 'recommendation',
            'norm_id', 'clause_id', 'topic', 'x', 'y',
            'reviewer_a', 'reviewer_b', 'adjudicator',
            'created_at', 'resolved_at'
        ]

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for finding in self.findings:
                writer.writerow({
                    'id': finding.id,
                    'rule_id': finding.rule_id,
                    'element_id': finding.element_id,
                    'element_type': finding.element_type,
                    'severity': finding.severity.value,
                    'status': finding.status.value,
                    'title': finding.title,
                    'message': finding.message,
                    'recommendation': finding.recommendation,
                    'norm_id': finding.norm_id or '',
                    'clause_id': finding.clause_id or '',
                    'topic': finding.topic or '',
                    'x': finding.x or '',
                    'y': finding.y or '',
                    'reviewer_a': finding.reviewer_a or '',
                    'reviewer_b': finding.reviewer_b or '',
                    'adjudicator': finding.adjudicator or '',
                    'created_at': finding.created_at.isoformat(),
                    'resolved_at': finding.resolved_at.isoformat() if finding.resolved_at else ''
                })

    def export_json(self, filepath: str):
        """Exporta para JSON estruturado"""
        data = {
            "metadata": self.metadata,
            "project_id": self.project_id,
            "summary": self.get_summary(),
            "findings": [
                {
                    "id": f.id,
                    "rule_id": f.rule_id,
                    "element_id": f.element_id,
                    "element_type": f.element_type,
                    "severity": f.severity.value,
                    "status": f.status.value,
                    "location": {"x": f.x, "y": f.y} if f.x and f.y else None,
                    "title": f.title,
                    "message": f.message,
                    "recommendation": f.recommendation,
                    "norm_ref": {
                        "norm_id": f.norm_id,
                        "clause_id": f.clause_id,
                        "topic": f.topic
                    } if f.norm_id else None,
                    "evidence": f.evidence_values,
                    "workflow": {
                        "reviewer_a": f.reviewer_a,
                        "reviewer_b": f.reviewer_b,
                        "adjudicator": f.adjudicator,
                        "resolution_notes": f.resolution_notes
                    },
                    "timestamps": {
                        "created": f.created_at.isoformat(),
                        "reviewed": f.reviewed_at.isoformat() if f.reviewed_at else None,
                        "resolved": f.resolved_at.isoformat() if f.resolved_at else None
                    }
                }
                for f in self.findings
            ]
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def export_geojson(self, filepath: str):
        """Exporta para GeoJSON (para visualização em mapa)"""
        features = []

        for finding in self.findings:
            if finding.x is not None and finding.y is not None:
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": finding.geometry_type,
                        "coordinates": [finding.x, finding.y] if finding.geometry_type == "Point" else [[finding.x, finding.y]]
                    },
                    "properties": {
                        "id": finding.id,
                        "rule_id": finding.rule_id,
                        "element_id": finding.element_id,
                        "severity": finding.severity.value,
                        "status": finding.status.value,
                        "title": finding.title,
                        "message": finding.message,
                        "norm_id": finding.norm_id,
                        "clause_id": finding.clause_id
                    }
                }
                features.append(feature)

        geojson = {
            "type": "FeatureCollection",
            "name": "peer_review_findings",
            "features": features
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False)

    def export_shapefile_csv(self, filepath: str):
        """
        Exporta para CSV com geometria WKT (compatível com QGIS).

        Este formato pode ser importado diretamente no QGIS como
        camada de texto delimitado com geometria WKT.
        """
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Cabeçalho com WKT
            writer.writerow([
                'WKT', 'FND_ID', 'RULE_ID', 'ELEM_ID', 'ELEM_TYPE',
                'SEVERITY', 'STATUS', 'TITLE', 'MESSAGE', 'NORM_ID',
                'CLAUSE_ID', 'TOPIC', 'REC'
            ])

            for finding in self.findings:
                if finding.x is not None and finding.y is not None:
                    wkt = f"POINT({finding.x} {finding.y})"
                else:
                    wkt = "POINT(0 0)"

                writer.writerow([
                    wkt,
                    finding.id[:10],  # Limite DBF
                    finding.rule_id[:10],
                    finding.element_id[:10],
                    finding.element_type[:10],
                    finding.severity.value[:10],
                    finding.status.value[:10],
                    finding.title[:50],
                    finding.message[:100],
                    (finding.norm_id or "")[:10],
                    (finding.clause_id or "")[:10],
                    (finding.topic or "")[:10],
                    finding.recommendation[:100]
                ])

        # Gera arquivo de esquema
        schema_path = filepath.replace('.csv', '_schema.csv')
        with open(schema_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['nome_shp', 'nome_completo', 'tipo', 'descricao'])
            writer.writerow(['FND_ID', 'finding_id', 'TEXT', 'ID do achado'])
            writer.writerow(['RULE_ID', 'rule_id', 'TEXT', 'ID da regra'])
            writer.writerow(['ELEM_ID', 'element_id', 'TEXT', 'ID do elemento'])
            writer.writerow(['ELEM_TYPE', 'element_type', 'TEXT', 'Tipo do elemento'])
            writer.writerow(['SEVERITY', 'severity', 'TEXT', 'Severidade'])
            writer.writerow(['STATUS', 'status', 'TEXT', 'Status'])
            writer.writerow(['TITLE', 'title', 'TEXT', 'Título'])
            writer.writerow(['MESSAGE', 'message', 'TEXT', 'Mensagem'])
            writer.writerow(['NORM_ID', 'norm_id', 'TEXT', 'ID da norma'])
            writer.writerow(['CLAUSE_ID', 'clause_id', 'TEXT', 'ID da cláusula'])
            writer.writerow(['TOPIC', 'topic', 'TEXT', 'Tópico'])
            writer.writerow(['REC', 'recommendation', 'TEXT', 'Recomendação'])


def create_finding(rule_id: str, element_id: str, element_type: str,
                  severity: Severity, message: str, **kwargs) -> Finding:
    """
    Função de conveniência para criar achado.

    Args:
        rule_id: ID da regra
        element_id: ID do elemento
        element_type: Tipo do elemento
        severity: Severidade
        message: Mensagem descritiva
        **kwargs: Parâmetros adicionais

    Returns:
        Finding configurado
    """
    finding_id = f"FND-{rule_id}-{element_id[:8]}-{datetime.utcnow().strftime('%H%M%S')}"

    return Finding(
        id=finding_id,
        rule_id=rule_id,
        element_id=element_id,
        element_type=element_type,
        severity=severity,
        message=message,
        **kwargs
    )

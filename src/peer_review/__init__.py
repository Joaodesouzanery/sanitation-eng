"""
Peer Review - Motor de Revisão por Pares com Normas Brasileiras

Implementa workflow completo de revisão:
1. Regras baseadas em normas (ABNT NBR 15920, 9649, 15527, 12262)
2. Revisores A e B independentes
3. Adjudicador para resolver discrepâncias
4. Exportação de achados em múltiplos formatos
"""

from .engine import (
    PeerReviewEngine,
    Rule,
    RuleSet,
    Finding,
    ReviewSession,
    DiscrepancyReport
)

from .findings import (
    Severity,
    FindingStatus,
    Finding as FindingExport,
    FindingsReport,
    create_finding
)

__all__ = [
    # Engine
    "PeerReviewEngine",
    "Rule",
    "RuleSet",
    "Finding",
    "ReviewSession",
    "DiscrepancyReport",
    # Findings export
    "Severity",
    "FindingStatus",
    "FindingExport",
    "FindingsReport",
    "create_finding",
]

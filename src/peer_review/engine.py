"""
Engine de Revisão por Pares - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Implementa:
- Rule Engine com regras baseadas em normas brasileiras
- Workflow de revisão por pares (A + B → adjudicação)
- Geração de findings.shp
- Auditoria completa do processo

IMPORTANTE: Não copie textos normativos!
Apenas referências estruturadas (norm_id, clause_id, topic)

Exemplo:
    >>> from src.peer_review.engine import PeerReviewEngine
    >>> engine = PeerReviewEngine(project)
    >>> findings = engine.run_review("revisor_a@empresa.com")
    >>> engine.export_findings("/output/findings.shp")
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Dict, Any, Optional, Callable, Set
from uuid import UUID, uuid4
import json
import csv
import logging

logger = logging.getLogger(__name__)


class Severity(str, Enum):
    """Severidade de findings"""
    OK = "OK"
    INFO = "INFO"
    ALERT = "ALERT"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ReviewStatus(str, Enum):
    """Status do processo de revisão"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    REVIEW_A_COMPLETE = "review_a_complete"
    REVIEW_B_COMPLETE = "review_b_complete"
    NEEDS_ADJUDICATION = "needs_adjudication"
    ADJUDICATED = "adjudicated"
    CLOSED = "closed"


@dataclass
class NormRef:
    """
    Referência normativa estruturada

    IMPORTANTE: Apenas metadados, NUNCA textos completos
    """
    norm_id: str  # Ex: "ABNT_NBR_15920"
    clause_id: Optional[str] = None  # Ex: "5.3.2"
    topic: str = ""  # Ex: "min_diameter_50mm"
    year: Optional[int] = None


@dataclass
class Finding:
    """
    Resultado de uma verificação

    Representa uma não-conformidade ou observação
    encontrada durante a revisão.
    """
    id: UUID = field(default_factory=uuid4)
    element_id: UUID = None
    element_type: str = ""
    rule_id: str = ""
    severity: Severity = Severity.INFO
    norm_refs: List[NormRef] = field(default_factory=list)
    message: str = ""
    recommendation: str = ""
    evidence: Dict[str, Any] = field(default_factory=dict)
    reviewer_id: str = ""
    review_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "open"  # open, acknowledged, resolved, wont_fix
    comments: List[str] = field(default_factory=list)

    # Coordenadas para exportação SHP
    x: Optional[float] = None
    y: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "element_id": str(self.element_id) if self.element_id else None,
            "element_type": self.element_type,
            "rule_id": self.rule_id,
            "severity": self.severity.value,
            "norm_refs": [
                {"norm_id": n.norm_id, "clause_id": n.clause_id, "topic": n.topic}
                for n in self.norm_refs
            ],
            "message": self.message,
            "recommendation": self.recommendation,
            "evidence": self.evidence,
            "reviewer_id": self.reviewer_id,
            "review_timestamp": self.review_timestamp.isoformat(),
            "status": self.status,
            "x": self.x,
            "y": self.y
        }


@dataclass
class Rule:
    """
    Regra de verificação

    Define uma verificação a ser aplicada aos elementos do projeto.
    A função eval_func recebe o elemento e retorna (passed, evidence).
    """
    id: str
    title: str
    description: str
    severity: Severity
    applies_to: List[str]  # Lista de ElementType
    system_filter: Optional[str] = None  # SystemType
    norm_refs: List[NormRef] = field(default_factory=list)
    evidence_fields: List[str] = field(default_factory=list)
    eval_func: Callable = None  # Função de avaliação
    recommendation: str = ""
    active: bool = True


class RuleSet:
    """
    Conjunto de regras para um sistema

    Agrupa regras relacionadas a um mesmo sistema (água, esgoto, drenagem)
    """

    def __init__(self, name: str, system_type: str):
        self.name = name
        self.system_type = system_type
        self.rules: Dict[str, Rule] = {}

    def add_rule(self, rule: Rule) -> None:
        """Adiciona regra ao conjunto"""
        self.rules[rule.id] = rule
        logger.debug(f"Regra adicionada: {rule.id}")

    def get_rules(self, element_type: str = None) -> List[Rule]:
        """Retorna regras filtradas por tipo de elemento"""
        rules = list(self.rules.values())
        if element_type:
            rules = [r for r in rules if element_type in r.applies_to]
        return [r for r in rules if r.active]


class ReviewSession:
    """
    Sessão de revisão

    Registra uma sessão de revisão completa com findings e status.
    """

    def __init__(self, reviewer_id: str, project_id: UUID):
        self.id = uuid4()
        self.reviewer_id = reviewer_id
        self.project_id = project_id
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None
        self.findings: List[Finding] = []
        self.elements_reviewed: Set[UUID] = set()
        self.status = ReviewStatus.IN_PROGRESS

    def add_finding(self, finding: Finding) -> None:
        """Adiciona finding à sessão"""
        finding.reviewer_id = self.reviewer_id
        self.findings.append(finding)

    def complete(self) -> None:
        """Marca sessão como completa"""
        self.completed_at = datetime.now(timezone.utc)
        self.status = ReviewStatus.REVIEW_A_COMPLETE

    def get_summary(self) -> Dict[str, Any]:
        """Retorna resumo da sessão"""
        severity_counts = {}
        for finding in self.findings:
            sev = finding.severity.value
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        return {
            "session_id": str(self.id),
            "reviewer_id": self.reviewer_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "total_findings": len(self.findings),
            "elements_reviewed": len(self.elements_reviewed),
            "severity_counts": severity_counts,
            "status": self.status.value
        }


class PeerReviewEngine:
    """
    Engine principal de revisão por pares

    Gerencia o workflow completo:
    1. Revisor A executa checklist
    2. Revisor B executa checklist independentemente
    3. Sistema compara discrepâncias
    4. Adjudicação por engenheiro sênior

    Exemplo:
        >>> engine = PeerReviewEngine(project)
        >>> engine.load_rulesets()
        >>> session_a = engine.start_review("revisor_a@empresa.com")
        >>> engine.run_rules(session_a)
        >>> engine.complete_review(session_a)
    """

    def __init__(self, project):
        """
        Inicializa engine

        Args:
            project: Instância de ProjectDataModel
        """
        self.project = project
        self.rulesets: Dict[str, RuleSet] = {}
        self.sessions: Dict[UUID, ReviewSession] = {}
        self.adjudications: List[Dict[str, Any]] = []

        self._init_default_rulesets()

    def _init_default_rulesets(self) -> None:
        """Inicializa conjuntos de regras padrão"""

        # Regras para água (NBR 15920)
        water_rules = RuleSet("Água - NBR 15920", "water")

        water_rules.add_rule(Rule(
            id="WAT-001",
            title="Diâmetro mínimo",
            description="Verifica se o diâmetro atende ao mínimo normativo",
            severity=Severity.ERROR,
            applies_to=["pipe"],
            system_filter="water",
            norm_refs=[NormRef(norm_id="ABNT_NBR_15920", topic="min_diameter_50mm")],
            evidence_fields=["diameter"],
            recommendation="Ajustar diâmetro para mínimo de 50mm",
            eval_func=lambda elem: (
                getattr(elem, 'diameter', 0) >= 50,
                {"diameter": getattr(elem, 'diameter', None)}
            )
        ))

        water_rules.add_rule(Rule(
            id="WAT-002",
            title="Velocidade máxima",
            description="Verifica se velocidade está abaixo do máximo",
            severity=Severity.ALERT,
            applies_to=["pipe"],
            system_filter="water",
            norm_refs=[NormRef(norm_id="ABNT_NBR_15920", topic="max_velocity_3m/s")],
            evidence_fields=["velocity"],
            recommendation="Reduzir velocidade aumentando diâmetro ou reduzindo vazão",
            eval_func=lambda elem: (
                getattr(elem, 'velocity', 0) <= 3.0 or getattr(elem, 'velocity', None) is None,
                {"velocity": getattr(elem, 'velocity', None)}
            )
        ))

        water_rules.add_rule(Rule(
            id="WAT-003",
            title="Cobertura mínima",
            description="Verifica cobertura mínima sobre a tubulação",
            severity=Severity.WARNING,
            applies_to=["pipe"],
            system_filter="water",
            norm_refs=[NormRef(norm_id="ABNT_NBR_15920", topic="min_cover_0.6m")],
            evidence_fields=["upstream_cover", "downstream_cover"],
            recommendation="Ajustar profundidade para mínimo 0.6m de cobertura",
            eval_func=lambda elem: (
                (getattr(elem, 'upstream_cover', 1) >= 0.6 or getattr(elem, 'upstream_cover', None) is None) and
                (getattr(elem, 'downstream_cover', 1) >= 0.6 or getattr(elem, 'downstream_cover', None) is None),
                {
                    "upstream_cover": getattr(elem, 'upstream_cover', None),
                    "downstream_cover": getattr(elem, 'downstream_cover', None)
                }
            )
        ))

        self.rulesets["water"] = water_rules

        # Regras para esgoto (NBR 9649)
        sewer_rules = RuleSet("Esgoto - NBR 9649", "sewer")

        sewer_rules.add_rule(Rule(
            id="SEW-001",
            title="Diâmetro mínimo",
            description="Verifica diâmetro mínimo para esgoto",
            severity=Severity.ERROR,
            applies_to=["pipe", "conduit"],
            system_filter="sewer",
            norm_refs=[NormRef(norm_id="ABNT_NBR_9649", topic="min_diameter_100mm")],
            evidence_fields=["diameter"],
            recommendation="Ajustar diâmetro para mínimo de 100mm",
            eval_func=lambda elem: (
                getattr(elem, 'diameter', 0) >= 100,
                {"diameter": getattr(elem, 'diameter', None)}
            )
        ))

        sewer_rules.add_rule(Rule(
            id="SEW-002",
            title="Declividade mínima",
            description="Verifica declividade mínima para DN150",
            severity=Severity.ERROR,
            applies_to=["pipe", "conduit"],
            system_filter="sewer",
            norm_refs=[NormRef(norm_id="ABNT_NBR_9649", topic="min_slope_0.5pct_d150")],
            evidence_fields=["slope", "diameter"],
            recommendation="Ajustar declividade para mínimo 0.5% (DN150)",
            eval_func=lambda elem: (
                getattr(elem, 'slope', 0) >= 0.005 or getattr(elem, 'diameter', 0) > 150,
                {
                    "slope": getattr(elem, 'slope', None),
                    "diameter": getattr(elem, 'diameter', None)
                }
            )
        ))

        sewer_rules.add_rule(Rule(
            id="SEW-003",
            title="Distância máxima entre PVs",
            description="Verifica distância máxima de 100m entre PVs",
            severity=Severity.ALERT,
            applies_to=["pipe", "conduit"],
            system_filter="sewer",
            norm_refs=[NormRef(norm_id="ABNT_NBR_9649", topic="max_distance_100m_PV")],
            evidence_fields=["length"],
            recommendation="Inserir PV intermediário se comprimento > 100m",
            eval_func=lambda elem: (
                getattr(elem, 'length', 0) <= 100,
                {"length": getattr(elem, 'length', None)}
            )
        ))

        self.rulesets["sewer"] = sewer_rules

        # Regras para drenagem (NBR 15527)
        drainage_rules = RuleSet("Drenagem - NBR 15527", "drainage")

        drainage_rules.add_rule(Rule(
            id="DRN-001",
            title="Velocidade máxima",
            description="Verifica velocidade máxima em condutos de drenagem",
            severity=Severity.ALERT,
            applies_to=["conduit"],
            system_filter="drainage",
            norm_refs=[NormRef(norm_id="ABNT_NBR_15527", topic="max_velocity_5m/s")],
            evidence_fields=["velocity"],
            recommendation="Reduzir velocidade ou prever dissipador",
            eval_func=lambda elem: (
                getattr(elem, 'velocity', 0) <= 5.0 or getattr(elem, 'velocity', None) is None,
                {"velocity": getattr(elem, 'velocity', None)}
            )
        ))

        self.rulesets["drainage"] = drainage_rules

        logger.info(f"Rulesets inicializados: {list(self.rulesets.keys())}")

    def start_review(self, reviewer_id: str) -> ReviewSession:
        """
        Inicia nova sessão de revisão

        Args:
            reviewer_id: ID/email do revisor

        Returns:
            ReviewSession iniciada
        """
        session = ReviewSession(
            reviewer_id=reviewer_id,
            project_id=self.project.id
        )
        self.sessions[session.id] = session
        logger.info(f"Sessão de revisão iniciada: {session.id} por {reviewer_id}")
        return session

    def run_rules(
        self,
        session: ReviewSession,
        system_filter: str = None
    ) -> List[Finding]:
        """
        Executa regras nos elementos do projeto

        Args:
            session: Sessão de revisão ativa
            system_filter: Filtrar por sistema (water, sewer, drainage)

        Returns:
            Lista de findings gerados
        """
        findings = []

        # Determinar quais rulesets usar
        if system_filter:
            rulesets_to_use = [self.rulesets.get(system_filter)]
        else:
            rulesets_to_use = list(self.rulesets.values())

        rulesets_to_use = [rs for rs in rulesets_to_use if rs]

        # Verificar links
        for link in self.project.links.values():
            session.elements_reviewed.add(link.id)

            for ruleset in rulesets_to_use:
                if ruleset.system_type and ruleset.system_type != link.system_type.value:
                    continue

                for rule in ruleset.get_rules(link.element_type.value):
                    if rule.eval_func:
                        try:
                            passed, evidence = rule.eval_func(link)

                            if not passed:
                                # Obter coordenadas para SHP
                                from_node = self.project.get_node(link.from_node_id)
                                x = from_node.coordinates.x if from_node else None
                                y = from_node.coordinates.y if from_node else None

                                finding = Finding(
                                    element_id=link.id,
                                    element_type=link.element_type.value,
                                    rule_id=rule.id,
                                    severity=rule.severity,
                                    norm_refs=rule.norm_refs,
                                    message=f"{rule.title}: {rule.description}",
                                    recommendation=rule.recommendation,
                                    evidence=evidence,
                                    x=x,
                                    y=y
                                )
                                session.add_finding(finding)
                                findings.append(finding)
                        except Exception as e:
                            logger.error(f"Erro ao avaliar regra {rule.id}: {e}")

        # Verificar nós
        for node in self.project.nodes.values():
            session.elements_reviewed.add(node.id)

            for ruleset in rulesets_to_use:
                if ruleset.system_type and ruleset.system_type != node.system_type.value:
                    continue

                for rule in ruleset.get_rules(node.element_type.value):
                    if rule.eval_func:
                        try:
                            passed, evidence = rule.eval_func(node)

                            if not passed:
                                finding = Finding(
                                    element_id=node.id,
                                    element_type=node.element_type.value,
                                    rule_id=rule.id,
                                    severity=rule.severity,
                                    norm_refs=rule.norm_refs,
                                    message=f"{rule.title}: {rule.description}",
                                    recommendation=rule.recommendation,
                                    evidence=evidence,
                                    x=node.coordinates.x,
                                    y=node.coordinates.y
                                )
                                session.add_finding(finding)
                                findings.append(finding)
                        except Exception as e:
                            logger.error(f"Erro ao avaliar regra {rule.id}: {e}")

        logger.info(f"Revisão executada: {len(findings)} findings em {len(session.elements_reviewed)} elementos")
        return findings

    def complete_review(self, session: ReviewSession) -> Dict[str, Any]:
        """
        Finaliza sessão de revisão

        Returns:
            Resumo da sessão
        """
        session.complete()
        return session.get_summary()

    def compare_reviews(
        self,
        session_a: ReviewSession,
        session_b: ReviewSession
    ) -> List[Dict[str, Any]]:
        """
        Compara duas sessões de revisão

        Identifica discrepâncias entre revisores A e B
        que precisam de adjudicação.

        Returns:
            Lista de discrepâncias
        """
        discrepancies = []

        # Agrupar findings por elemento
        findings_a = {str(f.element_id): f for f in session_a.findings}
        findings_b = {str(f.element_id): f for f in session_b.findings}

        all_elements = set(findings_a.keys()) | set(findings_b.keys())

        for elem_id in all_elements:
            f_a = findings_a.get(elem_id)
            f_b = findings_b.get(elem_id)

            # Verificar discrepâncias de severidade
            if f_a and f_b:
                if f_a.severity != f_b.severity:
                    discrepancies.append({
                        "element_id": elem_id,
                        "type": "severity_mismatch",
                        "reviewer_a": {
                            "severity": f_a.severity.value,
                            "rule_id": f_a.rule_id
                        },
                        "reviewer_b": {
                            "severity": f_b.severity.value,
                            "rule_id": f_b.rule_id
                        },
                        "needs_adjudication": True
                    })
            elif f_a and not f_b:
                discrepancies.append({
                    "element_id": elem_id,
                    "type": "finding_only_a",
                    "reviewer_a": {
                        "severity": f_a.severity.value,
                        "rule_id": f_a.rule_id
                    },
                    "needs_adjudication": f_a.severity in [Severity.ERROR, Severity.CRITICAL]
                })
            elif f_b and not f_a:
                discrepancies.append({
                    "element_id": elem_id,
                    "type": "finding_only_b",
                    "reviewer_b": {
                        "severity": f_b.severity.value,
                        "rule_id": f_b.rule_id
                    },
                    "needs_adjudication": f_b.severity in [Severity.ERROR, Severity.CRITICAL]
                })

        logger.info(f"Comparação: {len(discrepancies)} discrepâncias encontradas")
        return discrepancies

    def adjudicate(
        self,
        discrepancy: Dict[str, Any],
        adjudicator_id: str,
        decision: str,
        comments: str
    ) -> Dict[str, Any]:
        """
        Registra adjudicação de discrepância

        Args:
            discrepancy: Discrepância a adjudicar
            adjudicator_id: ID do engenheiro sênior
            decision: Decisão tomada
            comments: Comentários justificativos

        Returns:
            Registro de adjudicação
        """
        adjudication = {
            "id": str(uuid4()),
            "element_id": discrepancy["element_id"],
            "discrepancy_type": discrepancy["type"],
            "adjudicator_id": adjudicator_id,
            "decision": decision,
            "comments": comments,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        self.adjudications.append(adjudication)
        logger.info(f"Adjudicação registrada: {adjudication['id']}")

        return adjudication

    def export_findings_csv(self, filepath: str, session: ReviewSession) -> str:
        """
        Exporta findings para CSV

        Args:
            filepath: Caminho do arquivo de saída
            session: Sessão de revisão

        Returns:
            Caminho do arquivo gerado
        """
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f, delimiter=';')

            # Cabeçalho
            writer.writerow([
                "element_id",
                "element_type",
                "rule_id",
                "severity",
                "norm_ref",
                "message",
                "recommendation",
                "evidence",
                "reviewer_id",
                "timestamp",
                "x",
                "y"
            ])

            # Dados
            for finding in session.findings:
                norm_refs = ", ".join([n.norm_id for n in finding.norm_refs])
                writer.writerow([
                    str(finding.element_id),
                    finding.element_type,
                    finding.rule_id,
                    finding.severity.value,
                    norm_refs,
                    finding.message,
                    finding.recommendation,
                    json.dumps(finding.evidence),
                    finding.reviewer_id,
                    finding.review_timestamp.isoformat(),
                    finding.x,
                    finding.y
                ])

        logger.info(f"Findings exportados para CSV: {filepath}")
        return filepath

    def export_findings_json(self, filepath: str, session: ReviewSession) -> str:
        """Exporta findings para JSON"""
        data = {
            "session": session.get_summary(),
            "findings": [f.to_dict() for f in session.findings]
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Findings exportados para JSON: {filepath}")
        return filepath


if __name__ == "__main__":
    print("Peer Review Engine - HydroNetwork")
    print("Use PeerReviewEngine(project) para iniciar.")

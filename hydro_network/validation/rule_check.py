"""
Módulo de verificação normativa (rule-check).

Carrega regras de um arquivo YAML/JSON e verifica:
- Limites de pressão, velocidade, y/D, declividade, cobertura
- Gera lista de violações por trecho/nó
- Define severidade (WARN/ERROR)
- Sugere recomendações automáticas
- Gera relatório de revisão
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import json
import datetime


class Severity(Enum):
    """Severidade da violação."""
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


@dataclass
class Violation:
    """Representa uma violação de regra."""
    element_id: str
    element_type: str  # 'link' or 'node'
    network_type: str  # 'sewer', 'water', 'drainage'
    rule_id: str
    rule_name: str
    severity: Severity
    message: str
    actual_value: Any
    limit_value: Any
    recommendation: str = ""


@dataclass
class RuleDefinition:
    """Definição de uma regra de verificação."""
    id: str
    name: str
    description: str
    network_types: List[str]  # ['sewer', 'water', 'drainage']
    element_type: str  # 'link' or 'node'
    field: str
    operator: str  # 'min', 'max', 'range', 'equals'
    value: Any
    value_max: Any = None  # Para operador 'range'
    severity: Severity = Severity.WARN
    recommendation_template: str = ""


# Regras padrão
DEFAULT_RULES = {
    "rules": [
        # Esgoto - Links
        {
            "id": "SEW_V_MIN",
            "name": "Velocidade mínima esgoto",
            "description": "Velocidade mínima para autolimpeza",
            "network_types": ["sewer"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "min",
            "value": 0.6,
            "severity": "WARN",
            "recommendation_template": "Aumentar declividade ou reduzir diâmetro"
        },
        {
            "id": "SEW_V_MAX",
            "name": "Velocidade máxima esgoto",
            "description": "Velocidade máxima para evitar erosão",
            "network_types": ["sewer"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "max",
            "value": 5.0,
            "severity": "WARN",
            "recommendation_template": "Reduzir declividade, aumentar diâmetro ou usar degraus"
        },
        {
            "id": "SEW_YD_MAX",
            "name": "Lâmina máxima esgoto",
            "description": "Relação y/D máxima para ventilação",
            "network_types": ["sewer"],
            "element_type": "link",
            "field": "YD_RATIO",
            "operator": "max",
            "value": 0.75,
            "severity": "ERROR",
            "recommendation_template": "Aumentar diâmetro do trecho"
        },
        {
            "id": "SEW_S_MIN",
            "name": "Declividade mínima esgoto",
            "description": "Declividade mínima recomendada",
            "network_types": ["sewer"],
            "element_type": "link",
            "field": "SLOPE",
            "operator": "min",
            "value": 0.005,
            "severity": "WARN",
            "recommendation_template": "Revisar perfil ou considerar elevatória"
        },
        {
            "id": "SEW_COV_MIN",
            "name": "Cobertura mínima esgoto",
            "description": "Cobertura mínima sobre a tubulação",
            "network_types": ["sewer"],
            "element_type": "link",
            "field": "COV_DN_M",
            "operator": "min",
            "value": 0.90,
            "severity": "ERROR",
            "recommendation_template": "Aprofundar rede ou proteger com laje"
        },
        # Água - Links
        {
            "id": "WAT_V_MIN",
            "name": "Velocidade mínima água",
            "description": "Velocidade mínima para qualidade",
            "network_types": ["water"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "min",
            "value": 0.5,
            "severity": "INFO",
            "recommendation_template": "Considerar descarga de rede"
        },
        {
            "id": "WAT_V_MAX",
            "name": "Velocidade máxima água",
            "description": "Velocidade máxima para limitar perdas",
            "network_types": ["water"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "max",
            "value": 3.5,
            "severity": "WARN",
            "recommendation_template": "Aumentar diâmetro do trecho"
        },
        {
            "id": "WAT_HLOSS",
            "name": "Perda de carga unitária",
            "description": "Perda de carga máxima por km",
            "network_types": ["water"],
            "element_type": "link",
            "field": "HLOSS_M",
            "operator": "max",
            "value": 15,  # m/km
            "severity": "WARN",
            "recommendation_template": "Aumentar diâmetro do trecho"
        },
        # Água - Nós
        {
            "id": "WAT_P_MIN",
            "name": "Pressão mínima água",
            "description": "Pressão mínima dinâmica",
            "network_types": ["water"],
            "element_type": "node",
            "field": "PRESS_M",
            "operator": "min",
            "value": 10,
            "severity": "ERROR",
            "recommendation_template": "Instalar booster ou elevar reservatório"
        },
        {
            "id": "WAT_P_MAX",
            "name": "Pressão máxima água",
            "description": "Pressão máxima estática",
            "network_types": ["water"],
            "element_type": "node",
            "field": "PRESS_M",
            "operator": "max",
            "value": 50,
            "severity": "WARN",
            "recommendation_template": "Instalar VRP ou setorizar rede"
        },
        # Drenagem - Links
        {
            "id": "DRN_V_MIN",
            "name": "Velocidade mínima drenagem",
            "description": "Velocidade mínima para autolimpeza",
            "network_types": ["drainage"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "min",
            "value": 0.75,
            "severity": "WARN",
            "recommendation_template": "Aumentar declividade"
        },
        {
            "id": "DRN_V_MAX",
            "name": "Velocidade máxima drenagem",
            "description": "Velocidade máxima para evitar erosão",
            "network_types": ["drainage"],
            "element_type": "link",
            "field": "V_MS",
            "operator": "max",
            "value": 5.0,
            "severity": "WARN",
            "recommendation_template": "Usar dissipador de energia"
        },
        {
            "id": "DRN_YD_MAX",
            "name": "Lâmina máxima drenagem",
            "description": "Relação y/D máxima",
            "network_types": ["drainage"],
            "element_type": "link",
            "field": "YD_RATIO",
            "operator": "max",
            "value": 0.85,
            "severity": "ERROR",
            "recommendation_template": "Aumentar diâmetro ou dividir bacia"
        },
    ]
}


class RuleChecker:
    """Verificador de regras normativas."""

    def __init__(self, rules_config: Dict = None):
        """
        Inicializa com configuração de regras.

        Args:
            rules_config: Dicionário de regras (default: regras padrão)
        """
        if rules_config is None:
            rules_config = DEFAULT_RULES

        self.rules: List[RuleDefinition] = []
        self._load_rules(rules_config)
        self.violations: List[Violation] = []

    def _load_rules(self, config: Dict) -> None:
        """Carrega regras do dicionário de configuração."""
        for rule_dict in config.get('rules', []):
            severity = Severity[rule_dict.get('severity', 'WARN')]

            rule = RuleDefinition(
                id=rule_dict['id'],
                name=rule_dict['name'],
                description=rule_dict.get('description', ''),
                network_types=rule_dict['network_types'],
                element_type=rule_dict['element_type'],
                field=rule_dict['field'],
                operator=rule_dict['operator'],
                value=rule_dict['value'],
                value_max=rule_dict.get('value_max'),
                severity=severity,
                recommendation_template=rule_dict.get('recommendation_template', ''),
            )
            self.rules.append(rule)

    def check_element(
        self,
        element_id: str,
        element_type: str,
        network_type: str,
        data: Dict[str, Any],
    ) -> List[Violation]:
        """
        Verifica um elemento contra todas as regras aplicáveis.

        Args:
            element_id: ID do elemento
            element_type: 'link' ou 'node'
            network_type: 'sewer', 'water', 'drainage'
            data: Dados do elemento

        Returns:
            Lista de violações encontradas
        """
        element_violations = []

        for rule in self.rules:
            # Verificar se a regra se aplica
            if network_type not in rule.network_types:
                continue
            if rule.element_type != element_type:
                continue
            if rule.field not in data:
                continue

            actual_value = data[rule.field]
            if actual_value is None:
                continue

            # Verificar violação
            violated = False
            message = ""

            if rule.operator == 'min':
                if actual_value < rule.value:
                    violated = True
                    message = f"{rule.field}={actual_value} < mínimo {rule.value}"

            elif rule.operator == 'max':
                if actual_value > rule.value:
                    violated = True
                    message = f"{rule.field}={actual_value} > máximo {rule.value}"

            elif rule.operator == 'range':
                if actual_value < rule.value or actual_value > rule.value_max:
                    violated = True
                    message = f"{rule.field}={actual_value} fora do intervalo [{rule.value}, {rule.value_max}]"

            elif rule.operator == 'equals':
                if actual_value != rule.value:
                    violated = True
                    message = f"{rule.field}={actual_value} ≠ {rule.value}"

            if violated:
                violation = Violation(
                    element_id=element_id,
                    element_type=element_type,
                    network_type=network_type,
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=message,
                    actual_value=actual_value,
                    limit_value=rule.value,
                    recommendation=rule.recommendation_template,
                )
                element_violations.append(violation)
                self.violations.append(violation)

        return element_violations

    def check_network(
        self,
        network_type: str,
        links_data: Dict[str, Dict[str, Any]],
        nodes_data: Dict[str, Dict[str, Any]] = None,
    ) -> List[Violation]:
        """
        Verifica toda uma rede.

        Args:
            network_type: Tipo de rede
            links_data: Dados dos links
            nodes_data: Dados dos nós

        Returns:
            Lista de todas as violações
        """
        all_violations = []

        # Verificar links
        for link_id, data in links_data.items():
            violations = self.check_element(link_id, 'link', network_type, data)
            all_violations.extend(violations)

        # Verificar nós
        if nodes_data:
            for node_id, data in nodes_data.items():
                violations = self.check_element(node_id, 'node', network_type, data)
                all_violations.extend(violations)

        return all_violations

    def get_summary(self) -> Dict[str, Any]:
        """Retorna resumo das violações."""
        summary = {
            'total_violations': len(self.violations),
            'by_severity': {
                'ERROR': 0,
                'WARN': 0,
                'INFO': 0,
            },
            'by_network': {},
            'by_rule': {},
        }

        for v in self.violations:
            summary['by_severity'][v.severity.value] += 1

            if v.network_type not in summary['by_network']:
                summary['by_network'][v.network_type] = 0
            summary['by_network'][v.network_type] += 1

            if v.rule_id not in summary['by_rule']:
                summary['by_rule'][v.rule_id] = {'name': v.rule_name, 'count': 0}
            summary['by_rule'][v.rule_id]['count'] += 1

        return summary

    def generate_report_markdown(
        self,
        output_path: Union[str, Path],
        project_name: str = "Projeto de Saneamento",
        author: str = "HydroNetwork",
        version: str = "1.0",
    ) -> Path:
        """
        Gera relatório de revisão em Markdown.

        Args:
            output_path: Caminho do arquivo
            project_name: Nome do projeto
            author: Autor do projeto
            version: Versão

        Returns:
            Path do arquivo criado
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        summary = self.get_summary()
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        lines = [
            f"# Relatório de Verificação Normativa",
            f"",
            f"## Informações do Projeto",
            f"",
            f"| Campo | Valor |",
            f"|-------|-------|",
            f"| Projeto | {project_name} |",
            f"| Autor | {author} |",
            f"| Versão | {version} |",
            f"| Data | {timestamp} |",
            f"",
            f"## Resumo de Violações",
            f"",
            f"| Severidade | Quantidade |",
            f"|------------|------------|",
            f"| ERROR | {summary['by_severity']['ERROR']} |",
            f"| WARN | {summary['by_severity']['WARN']} |",
            f"| INFO | {summary['by_severity']['INFO']} |",
            f"| **Total** | **{summary['total_violations']}** |",
            f"",
        ]

        if summary['by_network']:
            lines.extend([
                f"## Por Tipo de Rede",
                f"",
                f"| Rede | Violações |",
                f"|------|-----------|",
            ])
            for net, count in summary['by_network'].items():
                lines.append(f"| {net} | {count} |")
            lines.append("")

        if self.violations:
            lines.extend([
                f"## Detalhamento das Violações",
                f"",
            ])

            # Agrupar por severidade
            for severity in [Severity.ERROR, Severity.WARN, Severity.INFO]:
                sev_violations = [v for v in self.violations if v.severity == severity]
                if not sev_violations:
                    continue

                lines.extend([
                    f"### {severity.value}",
                    f"",
                ])

                for v in sev_violations:
                    lines.extend([
                        f"#### {v.element_type.upper()} {v.element_id}",
                        f"",
                        f"- **Regra**: {v.rule_name} ({v.rule_id})",
                        f"- **Rede**: {v.network_type}",
                        f"- **Violação**: {v.message}",
                        f"- **Recomendação**: {v.recommendation}",
                        f"",
                    ])

        lines.extend([
            f"---",
            f"",
            f"*Relatório gerado automaticamente por HydroNetwork*",
        ])

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return output_path

    def generate_report_csv(self, output_path: Union[str, Path]) -> Path:
        """Gera relatório em CSV."""
        import csv

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'element_id', 'element_type', 'network_type',
                'rule_id', 'rule_name', 'severity',
                'message', 'actual_value', 'limit_value', 'recommendation'
            ])

            for v in self.violations:
                writer.writerow([
                    v.element_id, v.element_type, v.network_type,
                    v.rule_id, v.rule_name, v.severity.value,
                    v.message, v.actual_value, v.limit_value, v.recommendation
                ])

        return output_path


def load_rules_from_file(filepath: Union[str, Path]) -> Dict:
    """
    Carrega regras de arquivo YAML ou JSON.

    Args:
        filepath: Caminho do arquivo

    Returns:
        Dicionário de configuração de regras
    """
    filepath = Path(filepath)

    if filepath.suffix.lower() in ('.yaml', '.yml'):
        try:
            import yaml
            with open(filepath, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except ImportError:
            raise ImportError("PyYAML necessário para ler arquivos YAML")
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

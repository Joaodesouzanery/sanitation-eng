"""
Módulo de topologia e validação de redes.

Funções para:
- Validar conectividade da rede
- Ordenação topológica (montante → jusante)
- Verificar CRS e geometria
- Calcular comprimentos reais
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict, deque
import math


@dataclass
class Node:
    """Representa um nó da rede."""
    id: str
    x: float
    y: float
    z: float = 0.0  # Cota do terreno
    properties: Dict[str, Any] = field(default_factory=dict)

    def distance_to(self, other: 'Node') -> float:
        """Calcula distância 2D até outro nó."""
        dx = other.x - self.x
        dy = other.y - self.y
        return math.sqrt(dx * dx + dy * dy)

    def distance_3d_to(self, other: 'Node') -> float:
        """Calcula distância 3D até outro nó."""
        dx = other.x - self.x
        dy = other.y - self.y
        dz = other.z - self.z
        return math.sqrt(dx * dx + dy * dy + dz * dz)


@dataclass
class Link:
    """Representa um trecho/link da rede."""
    id: str
    from_node: str
    to_node: str
    length: float = 0.0
    properties: Dict[str, Any] = field(default_factory=dict)

    # Resultados calculados
    results: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NetworkTopology:
    """Estrutura de topologia da rede."""
    nodes: Dict[str, Node]
    links: Dict[str, Link]

    # Índices de adjacência
    downstream: Dict[str, List[str]] = field(default_factory=dict)  # nó → links que saem
    upstream: Dict[str, List[str]] = field(default_factory=dict)  # nó → links que chegam

    # Ordem topológica
    topological_order: List[str] = field(default_factory=list)  # IDs dos links ordenados

    # Validação
    is_valid: bool = False
    validation_errors: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)


class TopologyBuilder:
    """Construtor e validador de topologia de rede."""

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.links: Dict[str, Link] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_node(self, node: Node) -> None:
        """Adiciona um nó à rede."""
        if node.id in self.nodes:
            self.warnings.append(f"Nó duplicado: {node.id}")
        self.nodes[node.id] = node

    def add_link(self, link: Link) -> None:
        """Adiciona um link à rede."""
        if link.id in self.links:
            self.warnings.append(f"Link duplicado: {link.id}")
        self.links[link.id] = link

    def validate_connectivity(self) -> bool:
        """Valida conectividade: todos os links devem ter nós válidos."""
        valid = True

        for link_id, link in self.links.items():
            if link.from_node not in self.nodes:
                self.errors.append(
                    f"Link {link_id}: nó de origem '{link.from_node}' não encontrado"
                )
                valid = False

            if link.to_node not in self.nodes:
                self.errors.append(
                    f"Link {link_id}: nó de destino '{link.to_node}' não encontrado"
                )
                valid = False

            if link.from_node == link.to_node:
                self.errors.append(
                    f"Link {link_id}: nó de origem igual ao destino"
                )
                valid = False

        return valid

    def calculate_lengths(self) -> None:
        """Calcula comprimentos dos links baseado nas coordenadas dos nós."""
        for link_id, link in self.links.items():
            if link.from_node in self.nodes and link.to_node in self.nodes:
                from_node = self.nodes[link.from_node]
                to_node = self.nodes[link.to_node]
                calculated_length = from_node.distance_to(to_node)

                if link.length <= 0:
                    link.length = calculated_length
                else:
                    # Verificar discrepância
                    diff = abs(link.length - calculated_length)
                    if diff > 1.0:  # Mais de 1m de diferença
                        self.warnings.append(
                            f"Link {link_id}: comprimento informado ({link.length:.2f}m) "
                            f"difere do calculado ({calculated_length:.2f}m)"
                        )

    def build_adjacency(self) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """Constrói índices de adjacência."""
        downstream: Dict[str, List[str]] = defaultdict(list)
        upstream: Dict[str, List[str]] = defaultdict(list)

        for link_id, link in self.links.items():
            downstream[link.from_node].append(link_id)
            upstream[link.to_node].append(link_id)

        return dict(downstream), dict(upstream)

    def find_sources(self, upstream: Dict[str, List[str]]) -> Set[str]:
        """Encontra nós de cabeceira (sem links chegando)."""
        all_nodes = set(self.nodes.keys())
        nodes_with_upstream = set(upstream.keys())
        return all_nodes - nodes_with_upstream

    def find_outlets(self, downstream: Dict[str, List[str]]) -> Set[str]:
        """Encontra nós de exutório (sem links saindo)."""
        all_nodes = set(self.nodes.keys())
        nodes_with_downstream = set(downstream.keys())
        return all_nodes - nodes_with_downstream

    def topological_sort(self) -> List[str]:
        """
        Ordenação topológica dos links (montante → jusante).
        Usa algoritmo de Kahn.
        """
        downstream, upstream = self.build_adjacency()

        # Calcular grau de entrada para cada nó
        in_degree: Dict[str, int] = defaultdict(int)
        for node_id in self.nodes:
            in_degree[node_id] = len(upstream.get(node_id, []))

        # Fila com nós de grau 0 (cabeceiras)
        queue = deque([n for n in self.nodes if in_degree[n] == 0])
        sorted_links: List[str] = []
        processed_nodes: Set[str] = set()

        while queue:
            node_id = queue.popleft()
            processed_nodes.add(node_id)

            # Processar todos os links que saem deste nó
            for link_id in downstream.get(node_id, []):
                link = self.links[link_id]
                sorted_links.append(link_id)

                # Decrementar grau do nó de destino
                to_node = link.to_node
                in_degree[to_node] -= 1

                if in_degree[to_node] == 0:
                    queue.append(to_node)

        # Verificar se todos os links foram processados
        if len(sorted_links) != len(self.links):
            self.errors.append(
                "Ciclo detectado na rede ou rede desconectada. "
                f"Processados {len(sorted_links)} de {len(self.links)} links."
            )

        return sorted_links

    def detect_isolated_nodes(self, downstream: Dict, upstream: Dict) -> List[str]:
        """Detecta nós isolados (sem conexão com nenhum link)."""
        connected = set(downstream.keys()) | set(upstream.keys())
        all_nodes = set(self.nodes.keys())
        isolated = all_nodes - connected

        if isolated:
            self.warnings.append(f"Nós isolados encontrados: {isolated}")

        return list(isolated)

    def build(self) -> NetworkTopology:
        """Constrói e valida a topologia completa."""
        self.errors = []
        self.warnings = []

        # Validar conectividade
        connectivity_ok = self.validate_connectivity()

        # Calcular comprimentos
        self.calculate_lengths()

        # Construir adjacência
        downstream, upstream = self.build_adjacency()

        # Detectar nós isolados
        self.detect_isolated_nodes(downstream, upstream)

        # Ordenação topológica
        topo_order = []
        if connectivity_ok:
            topo_order = self.topological_sort()

        # Criar estrutura final
        topology = NetworkTopology(
            nodes=self.nodes,
            links=self.links,
            downstream=downstream,
            upstream=upstream,
            topological_order=topo_order,
            is_valid=len(self.errors) == 0,
            validation_errors=self.errors,
            validation_warnings=self.warnings,
        )

        return topology


def accumulate_upstream(
    topology: NetworkTopology,
    link_id: str,
    value_getter: callable,
    include_self: bool = True,
) -> float:
    """
    Acumula valores de montante para um link.

    Args:
        topology: Topologia da rede
        link_id: ID do link
        value_getter: Função que retorna o valor de um link
        include_self: Se deve incluir o valor do próprio link

    Returns:
        Soma dos valores a montante
    """
    visited: Set[str] = set()
    total = 0.0

    def accumulate(lid: str) -> float:
        if lid in visited:
            return 0.0
        visited.add(lid)

        link = topology.links[lid]
        from_node = link.from_node

        # Valor do próprio link
        link_value = value_getter(link)

        # Acumular de links a montante
        upstream_total = 0.0
        for upstream_link_id in topology.upstream.get(from_node, []):
            upstream_total += accumulate(upstream_link_id)

        return link_value + upstream_total

    if include_self:
        total = accumulate(link_id)
    else:
        # Apenas montante, sem o próprio link
        link = topology.links[link_id]
        for upstream_link_id in topology.upstream.get(link.from_node, []):
            total += accumulate(upstream_link_id)

    return total


def get_upstream_links(topology: NetworkTopology, link_id: str) -> List[str]:
    """Retorna lista de todos os links a montante de um link."""
    visited: Set[str] = set()
    result: List[str] = []

    def traverse(lid: str):
        if lid in visited:
            return
        visited.add(lid)

        link = topology.links[lid]
        for upstream_id in topology.upstream.get(link.from_node, []):
            result.append(upstream_id)
            traverse(upstream_id)

    traverse(link_id)
    return result


def get_downstream_links(topology: NetworkTopology, link_id: str) -> List[str]:
    """Retorna lista de todos os links a jusante de um link."""
    visited: Set[str] = set()
    result: List[str] = []

    def traverse(lid: str):
        if lid in visited:
            return
        visited.add(lid)

        link = topology.links[lid]
        for downstream_id in topology.downstream.get(link.to_node, []):
            result.append(downstream_id)
            traverse(downstream_id)

    traverse(link_id)
    return result

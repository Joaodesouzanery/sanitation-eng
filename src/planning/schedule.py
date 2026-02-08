"""
Schedule Module - Cronograma de execução com regra de fechamento no mesmo dia

REGRA FUNDAMENTAL (Same-Day Completion):
Em obras de saneamento, NÃO se pode deixar vala aberta de um dia para outro.
Todas as atividades de um segmento devem ser concluídas no mesmo dia:
    Escavação → Nivelamento → Assentamento → Escoramento → Reaterro → Base

O cronograma é calculado por METRO DE REDE, não por atividade separada.
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
import json


class ActivityType(Enum):
    """Tipos de atividades do ciclo de execução"""
    ESCAVACAO = "Escavação"
    NIVELAMENTO = "Nivelamento"
    ASSENTAMENTO = "Assentamento"
    ESCORAMENTO = "Escoramento"
    BOMBEAMENTO = "Bombeamento"
    REATERRO = "Reaterro"
    BASE = "Base/Berço"
    TESTE = "Teste Hidrostático"
    PAVIMENTACAO = "Pavimentação"


@dataclass
class TeamConfig:
    """Configuração de equipe de execução"""
    encarregado: int = 1
    oficiais: int = 2
    ajudantes: int = 4
    operador_maquinas: int = 1
    has_retroescavadeira: bool = True
    has_compactador: bool = True
    has_caminhao: bool = False
    has_bomba: bool = False

    def total_workers(self) -> int:
        return self.encarregado + self.oficiais + self.ajudantes + self.operador_maquinas

    def daily_labor_cost(self, avg_cost_per_worker: float = 180.0) -> float:
        return self.total_workers() * avg_cost_per_worker

    def daily_equipment_cost(self) -> float:
        cost = 0.0
        if self.has_retroescavadeira:
            cost += 450.0
        if self.has_compactador:
            cost += 120.0
        if self.has_caminhao:
            cost += 350.0
        if self.has_bomba:
            cost += 200.0
        return cost


@dataclass
class DailySegment:
    """
    Segmento diário de execução.

    Representa os metros que serão executados em um único dia,
    com TODAS as atividades do ciclo completo.
    """
    segment_id: str
    trecho_id: str
    day: int
    date: Optional[date] = None
    meters: float = 0.0
    team: int = 1

    # Atividades do ciclo (todas no mesmo dia)
    activities: List[str] = field(default_factory=list)

    # Quantidades calculadas para este segmento
    vol_escavacao: float = 0.0
    vol_reaterro: float = 0.0
    area_escoramento: float = 0.0
    comprimento_tubo: float = 0.0

    # Custos do segmento
    custo_mao_obra: float = 0.0
    custo_equipamentos: float = 0.0
    custo_materiais: float = 0.0
    custo_total: float = 0.0

    # Parâmetros do trecho
    profundidade: float = 1.5
    diametro: int = 150


@dataclass
class TrechoSchedule:
    """Cronograma completo de um trecho"""
    trecho_id: str
    comprimento_total: float
    profundidade_media: float
    diametro: int
    num_dias: int
    segments: List[DailySegment] = field(default_factory=list)

    # Datas
    start_day: int = 1
    end_day: int = 1
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    # Totais
    custo_total: float = 0.0


class SameDayScheduler:
    """
    Gerador de cronograma com regra de fechamento no mesmo dia.

    O algoritmo calcula quantos metros podem ser executados por dia
    considerando profundidade, diâmetro, equipe e equipamentos.
    Cada dia de trabalho inclui o ciclo COMPLETO de atividades.
    """

    def __init__(self, team_config: Optional[TeamConfig] = None):
        """
        Inicializa o scheduler.

        Args:
            team_config: Configuração da equipe (usa padrão se None)
        """
        self.team_config = team_config or TeamConfig()
        self.holidays: List[date] = []
        self.work_days_per_week: int = 5  # Seg-Sex

    def calculate_daily_meters(self, profundidade: float, diametro: int) -> float:
        """
        Calcula metros/dia que uma equipe consegue executar o ciclo completo.

        IMPORTANTE: Este é o valor LÍQUIDO considerando que TODAS as atividades
        (escavação, assentamento, reaterro, etc.) devem ser feitas no mesmo dia.

        Args:
            profundidade: Profundidade média da vala (m)
            diametro: Diâmetro do tubo (mm)

        Returns:
            Metros por dia de produtividade
        """
        # Base: 12 metros/dia em condições normais (prof < 1.5m, DN150)
        base_metros = 12.0

        # Ajuste por profundidade (quanto mais fundo, mais lento)
        if profundidade > 3.0:
            base_metros *= 0.5  # Muito profundo - escoramento pesado
        elif profundidade > 2.5:
            base_metros *= 0.6
        elif profundidade > 2.0:
            base_metros *= 0.7
        elif profundidade > 1.5:
            base_metros *= 0.85

        # Ajuste por diâmetro (tubos maiores = mais lento)
        if diametro > 400:
            base_metros *= 0.6
        elif diametro > 300:
            base_metros *= 0.75
        elif diametro > 200:
            base_metros *= 0.9

        # Ajuste por equipamentos
        if not self.team_config.has_retroescavadeira:
            base_metros *= 0.4  # Escavação manual é muito lenta
        if not self.team_config.has_compactador:
            base_metros *= 0.8

        if self.team_config.has_bomba:
            base_metros *= 1.1  # Rebaixamento ajuda

        # Ajuste por tamanho da equipe
        if self.team_config.oficiais >= 3 and self.team_config.ajudantes >= 6:
            base_metros *= 1.2
        elif self.team_config.oficiais < 2 or self.team_config.ajudantes < 3:
            base_metros *= 0.7

        return max(3.0, round(base_metros, 1))  # Mínimo 3 metros/dia

    def generate_trecho_schedule(self, trecho_id: str, comprimento: float,
                                profundidade: float, diametro: int,
                                start_day: int = 1, team: int = 1) -> TrechoSchedule:
        """
        Gera cronograma para um trecho específico.

        Args:
            trecho_id: ID do trecho
            comprimento: Comprimento total (m)
            profundidade: Profundidade média (m)
            diametro: Diâmetro do tubo (mm)
            start_day: Dia de início
            team: Número da equipe

        Returns:
            TrechoSchedule com segmentos diários
        """
        # Calcula produtividade diária
        metros_dia = self.calculate_daily_meters(profundidade, diametro)

        # Calcula número de dias necessários
        num_dias = max(1, int((comprimento / metros_dia) + 0.99))  # Arredonda para cima

        # Largura da vala baseada no diâmetro
        largura_vala = max(0.6, diametro / 1000 + 0.4)

        schedule = TrechoSchedule(
            trecho_id=trecho_id,
            comprimento_total=comprimento,
            profundidade_media=profundidade,
            diametro=diametro,
            num_dias=num_dias,
            start_day=start_day,
            end_day=start_day + num_dias - 1
        )

        metros_restantes = comprimento

        for dia in range(num_dias):
            day_number = start_day + dia

            # Metros deste dia
            metros_hoje = min(metros_dia, metros_restantes)
            metros_restantes -= metros_hoje

            # Calcula quantidades proporcionais
            vol_esc = metros_hoje * largura_vala * profundidade
            vol_reat = vol_esc * 0.7  # 30% vai para bota-fora
            area_esc = metros_hoje * profundidade * 2  # Dois lados da vala

            segment = DailySegment(
                segment_id=f"{trecho_id}.D{dia + 1}",
                trecho_id=trecho_id,
                day=day_number,
                meters=metros_hoje,
                team=team,
                activities=[
                    ActivityType.ESCAVACAO.value,
                    ActivityType.NIVELAMENTO.value,
                    ActivityType.ASSENTAMENTO.value,
                    ActivityType.ESCORAMENTO.value if profundidade > 1.25 else None,
                    ActivityType.BOMBEAMENTO.value if self.team_config.has_bomba else None,
                    ActivityType.REATERRO.value,
                    ActivityType.BASE.value
                ],
                vol_escavacao=vol_esc,
                vol_reaterro=vol_reat,
                area_escoramento=area_esc if profundidade > 1.25 else 0,
                comprimento_tubo=metros_hoje,
                profundidade=profundidade,
                diametro=diametro
            )

            # Remove None da lista de atividades
            segment.activities = [a for a in segment.activities if a]

            # Calcula custos do segmento
            segment.custo_mao_obra = self.team_config.daily_labor_cost()
            segment.custo_equipamentos = self.team_config.daily_equipment_cost()
            segment.custo_total = segment.custo_mao_obra + segment.custo_equipamentos

            schedule.segments.append(segment)
            schedule.custo_total += segment.custo_total

        return schedule

    def generate_full_schedule(self, trechos: List[Dict], num_teams: int = 2,
                              start_date: Optional[date] = None) -> Dict:
        """
        Gera cronograma completo para todos os trechos.

        Args:
            trechos: Lista de trechos com id, comprimento, profundidade, diametro
            num_teams: Número de equipes disponíveis
            start_date: Data de início (usa hoje se None)

        Returns:
            Dict com cronograma completo, curva S, histograma
        """
        if start_date is None:
            start_date = date.today()

        # Rastreia quando cada equipe estará livre
        team_availability = [0] * num_teams  # Dia em que cada equipe fica livre

        trecho_schedules: List[TrechoSchedule] = []
        all_segments: List[DailySegment] = []

        for trecho in trechos:
            # Encontra equipe mais disponível
            team_idx = team_availability.index(min(team_availability))
            start_day = team_availability[team_idx] + 1

            schedule = self.generate_trecho_schedule(
                trecho_id=trecho.get("id", trecho.get("trecho_id", "")),
                comprimento=trecho.get("comprimento", trecho.get("length", 50)),
                profundidade=trecho.get("profundidade", 1.5),
                diametro=trecho.get("diametro", trecho.get("DN", 150)),
                start_day=start_day,
                team=team_idx + 1
            )

            # Atualiza disponibilidade da equipe
            team_availability[team_idx] = schedule.end_day

            # Adiciona teste hidrostático após conclusão do trecho
            test_segment = DailySegment(
                segment_id=f"{schedule.trecho_id}.TESTE",
                trecho_id=schedule.trecho_id,
                day=schedule.end_day + 1,
                meters=0,
                team=0,  # Equipe de teste separada
                activities=[ActivityType.TESTE.value],
                custo_total=500  # Custo fixo de teste
            )
            schedule.segments.append(test_segment)

            trecho_schedules.append(schedule)
            all_segments.extend(schedule.segments)

        # Calcula total de dias
        total_days = max(seg.day for seg in all_segments) if all_segments else 0

        # Gera curva S
        curve_s = self._generate_curve_s(all_segments, total_days)

        # Gera histograma de recursos
        histogram = self._generate_histogram(all_segments, total_days, num_teams)

        # Calcula datas reais
        calendar = self._generate_calendar(start_date, total_days)

        return {
            "start_date": start_date.isoformat(),
            "end_date": calendar[-1].isoformat() if calendar else start_date.isoformat(),
            "total_days": total_days,
            "num_teams": num_teams,
            "trechos": [self._trecho_to_dict(ts) for ts in trecho_schedules],
            "all_segments": [self._segment_to_dict(seg) for seg in all_segments],
            "curve_s": curve_s,
            "histogram": histogram,
            "calendar": [d.isoformat() for d in calendar],
            "summary": {
                "total_metros": sum(ts.comprimento_total for ts in trecho_schedules),
                "total_trechos": len(trecho_schedules),
                "custo_total": sum(ts.custo_total for ts in trecho_schedules),
                "media_metros_dia": sum(ts.comprimento_total for ts in trecho_schedules) / total_days if total_days > 0 else 0
            }
        }

    def _generate_curve_s(self, segments: List[DailySegment], total_days: int) -> Dict:
        """Gera curva S (físico e financeiro acumulados)"""
        total_metros = sum(seg.meters for seg in segments)
        total_custo = sum(seg.custo_total for seg in segments)

        physical = []
        financial = []
        cum_metros = 0
        cum_custo = 0

        for day in range(1, total_days + 1):
            day_segments = [s for s in segments if s.day == day]
            cum_metros += sum(s.meters for s in day_segments)
            cum_custo += sum(s.custo_total for s in day_segments)

            physical.append({
                "day": day,
                "value": (cum_metros / total_metros * 100) if total_metros > 0 else 0
            })
            financial.append({
                "day": day,
                "value": (cum_custo / total_custo * 100) if total_custo > 0 else 0
            })

        return {
            "physical": physical,
            "financial": financial
        }

    def _generate_histogram(self, segments: List[DailySegment],
                           total_days: int, num_teams: int) -> Dict:
        """Gera histograma de recursos por dia"""
        workers_per_day = []
        equipment_per_day = []

        for day in range(1, total_days + 1):
            day_segments = [s for s in segments if s.day == day and s.team > 0]
            teams_working = len(set(s.team for s in day_segments))

            workers = teams_working * self.team_config.total_workers()
            equipment = teams_working  # Conjuntos de equipamento

            workers_per_day.append({"day": day, "value": workers})
            equipment_per_day.append({"day": day, "value": equipment})

        return {
            "workers": workers_per_day,
            "equipment": equipment_per_day,
            "max_workers": max(w["value"] for w in workers_per_day) if workers_per_day else 0,
            "avg_workers": sum(w["value"] for w in workers_per_day) / len(workers_per_day) if workers_per_day else 0
        }

    def _generate_calendar(self, start_date: date, total_days: int) -> List[date]:
        """Gera calendário considerando fins de semana e feriados"""
        calendar = []
        current_date = start_date
        work_days_added = 0

        while work_days_added < total_days:
            # Verifica se é dia útil
            if current_date.weekday() < self.work_days_per_week and current_date not in self.holidays:
                calendar.append(current_date)
                work_days_added += 1
            current_date += timedelta(days=1)

        return calendar

    def _trecho_to_dict(self, ts: TrechoSchedule) -> Dict:
        return {
            "trecho_id": ts.trecho_id,
            "comprimento_total": ts.comprimento_total,
            "profundidade_media": ts.profundidade_media,
            "diametro": ts.diametro,
            "num_dias": ts.num_dias,
            "start_day": ts.start_day,
            "end_day": ts.end_day,
            "custo_total": ts.custo_total,
            "segments": [self._segment_to_dict(s) for s in ts.segments]
        }

    def _segment_to_dict(self, seg: DailySegment) -> Dict:
        return {
            "segment_id": seg.segment_id,
            "trecho_id": seg.trecho_id,
            "day": seg.day,
            "meters": seg.meters,
            "team": seg.team,
            "activities": seg.activities,
            "vol_escavacao": seg.vol_escavacao,
            "vol_reaterro": seg.vol_reaterro,
            "custo_total": seg.custo_total
        }


def generate_schedule(trechos: List[Dict], num_teams: int = 2,
                     team_config: Optional[TeamConfig] = None,
                     start_date: Optional[date] = None) -> Dict:
    """
    Função de conveniência para gerar cronograma.

    Args:
        trechos: Lista de trechos
        num_teams: Número de equipes
        team_config: Configuração da equipe
        start_date: Data de início

    Returns:
        Cronograma completo
    """
    scheduler = SameDayScheduler(team_config)
    return scheduler.generate_full_schedule(trechos, num_teams, start_date)

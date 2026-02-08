"""
Bridge ProjectLibre - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Integração com ProjectLibre via formato MSPDI (MS Project XML)

Funcionalidades:
- Exportar projeto para MSPDI XML
- Importar cronograma do ProjectLibre
- Preservar mapeamento element_id → Text1
- Round-trip seguro sem perda de dados

IMPORTANTE:
- NUNCA sobrescreva atributos hidráulicos ao importar
- Apenas atualize campos de cronograma

Exemplo:
    >>> from src.integrations.projectlibre.bridge import ProjectLibreBridge
    >>> bridge = ProjectLibreBridge(project)
    >>> bridge.export_mspdi("/output/projeto.xml")
    >>> bridge.launch_projectlibre("/output/projeto.xml")
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from uuid import UUID
import subprocess
import os
import logging

logger = logging.getLogger(__name__)


class ProjectLibreBridge:
    """
    Bridge para integração com ProjectLibre

    Suporta exportação e importação de cronogramas via MSPDI XML,
    mantendo compatibilidade com MS Project e ProjectLibre.

    Exemplo:
        >>> bridge = ProjectLibreBridge(project, planning_data)
        >>> bridge.export_mspdi("/output/projeto.xml")
        >>> # Editar no ProjectLibre
        >>> bridge.import_mspdi("/output/projeto_editado.xml")
    """

    # Namespace MSPDI
    NS = "http://schemas.microsoft.com/project"

    def __init__(self, project, planning_data: Dict[str, Any] = None):
        """
        Inicializa bridge

        Args:
            project: Instância de ProjectDataModel
            planning_data: Dados de planejamento (cronograma, recursos)
        """
        self.project = project
        self.planning_data = planning_data or {}
        self.task_mapping: Dict[str, UUID] = {}  # UID → element_id

    def _create_element(self, parent: ET.Element, tag: str, text: str = None) -> ET.Element:
        """Cria elemento XML com namespace"""
        elem = ET.SubElement(parent, f"{{{self.NS}}}{tag}")
        if text is not None:
            elem.text = str(text)
        return elem

    def _format_datetime(self, dt: datetime) -> str:
        """Formata datetime para MSPDI"""
        if dt is None:
            dt = datetime.now()
        return dt.strftime("%Y-%m-%dT%H:%M:%S")

    def _format_duration(self, days: int) -> str:
        """Formata duração para MSPDI (formato ISO 8601)"""
        return f"PT{days * 8}H0M0S"  # Assume 8h/dia

    def export_mspdi(
        self,
        filepath: str,
        include_resources: bool = True,
        include_calendars: bool = True
    ) -> str:
        """
        Exporta projeto para formato MSPDI (MS Project XML)

        O campo Text1 é usado para armazenar element_id,
        permitindo round-trip seguro.

        Args:
            filepath: Caminho do arquivo XML de saída
            include_resources: Incluir recursos
            include_calendars: Incluir calendários

        Returns:
            Caminho do arquivo gerado
        """
        # Criar elemento raiz
        root = ET.Element(f"{{{self.NS}}}Project")
        root.set("xmlns", self.NS)

        # Metadados do projeto
        self._create_element(root, "Name", self.project.name)
        self._create_element(root, "Title", self.project.name)
        self._create_element(root, "Author", self.project.created_by or "HydroNetwork")
        self._create_element(root, "CreationDate", self._format_datetime(self.project.created_at))
        self._create_element(root, "LastSaved", self._format_datetime(datetime.now(timezone.utc)))

        # Configurações de calendário
        self._create_element(root, "CalendarUID", "1")
        self._create_element(root, "DefaultStartTime", "08:00:00")
        self._create_element(root, "DefaultFinishTime", "17:00:00")
        self._create_element(root, "MinutesPerDay", "480")  # 8 horas
        self._create_element(root, "MinutesPerWeek", "2400")  # 40 horas
        self._create_element(root, "DaysPerMonth", "20")

        # Calendários
        if include_calendars:
            self._export_calendars(root)

        # Recursos
        if include_resources:
            self._export_resources(root)

        # Tarefas
        self._export_tasks(root)

        # Atribuições
        self._export_assignments(root)

        # Formatar e salvar
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        formatted_xml = dom.toprettyxml(indent="  ", encoding="UTF-8")

        with open(filepath, 'wb') as f:
            f.write(formatted_xml)

        logger.info(f"MSPDI exportado: {filepath}")
        return filepath

    def _export_calendars(self, root: ET.Element) -> None:
        """Exporta calendários"""
        calendars = self._create_element(root, "Calendars")

        # Calendário padrão
        cal = self._create_element(calendars, "Calendar")
        self._create_element(cal, "UID", "1")
        self._create_element(cal, "Name", "Padrão")
        self._create_element(cal, "IsBaseCalendar", "true")

        # Dias da semana
        week_days = self._create_element(cal, "WeekDays")

        # Segunda a Sexta - trabalho
        for day_num in range(2, 7):  # 2=seg, 6=sex
            wd = self._create_element(week_days, "WeekDay")
            self._create_element(wd, "DayType", str(day_num))
            self._create_element(wd, "DayWorking", "true")

            working_times = self._create_element(wd, "WorkingTimes")
            wt = self._create_element(working_times, "WorkingTime")
            self._create_element(wt, "FromTime", "08:00:00")
            self._create_element(wt, "ToTime", "12:00:00")
            wt2 = self._create_element(working_times, "WorkingTime")
            self._create_element(wt2, "FromTime", "13:00:00")
            self._create_element(wt2, "ToTime", "17:00:00")

        # Sábado e Domingo - não trabalha
        for day_num in [1, 7]:  # 1=dom, 7=sab
            wd = self._create_element(week_days, "WeekDay")
            self._create_element(wd, "DayType", str(day_num))
            self._create_element(wd, "DayWorking", "false")

    def _export_resources(self, root: ET.Element) -> None:
        """Exporta recursos"""
        resources = self._create_element(root, "Resources")

        # Recursos do planejamento
        planning_resources = self.planning_data.get("resources", [])

        for idx, res in enumerate(planning_resources, start=1):
            resource = self._create_element(resources, "Resource")
            self._create_element(resource, "UID", str(idx))
            self._create_element(resource, "ID", str(idx))
            self._create_element(resource, "Name", res.get("name", f"Recurso {idx}"))
            self._create_element(resource, "Type", "1")  # 1=Trabalho
            self._create_element(resource, "MaxUnits", str(res.get("quantity", 1)))

            if "cost_per_day" in res:
                self._create_element(resource, "StandardRate", str(res["cost_per_day"]))
                self._create_element(resource, "StandardRateFormat", "5")  # Por dia

    def _export_tasks(self, root: ET.Element) -> None:
        """Exporta tarefas"""
        tasks = self._create_element(root, "Tasks")

        # Tarefa resumo do projeto (UID=0)
        summary = self._create_element(tasks, "Task")
        self._create_element(summary, "UID", "0")
        self._create_element(summary, "ID", "0")
        self._create_element(summary, "Name", self.project.name)
        self._create_element(summary, "Summary", "true")
        self._create_element(summary, "OutlineLevel", "0")

        # Obter tarefas do planejamento
        schedule = self.planning_data.get("schedule", [])

        # Se não há cronograma, criar tarefas a partir dos elementos
        if not schedule:
            self._create_tasks_from_elements(tasks)
        else:
            self._create_tasks_from_schedule(tasks, schedule)

    def _create_tasks_from_schedule(self, tasks: ET.Element, schedule: List[Dict]) -> None:
        """Cria tarefas a partir do cronograma"""
        # Agrupar por trecho
        trechos = {}
        for item in schedule:
            trecho_id = item.get("trecho_id", "Geral")
            if trecho_id not in trechos:
                trechos[trecho_id] = []
            trechos[trecho_id].append(item)

        uid = 1
        task_id = 1

        for trecho_id, activities in trechos.items():
            # Tarefa de resumo do trecho
            trecho_task = self._create_element(tasks, "Task")
            self._create_element(trecho_task, "UID", str(uid))
            self._create_element(trecho_task, "ID", str(task_id))
            self._create_element(trecho_task, "Name", f"Trecho {trecho_id}")
            self._create_element(trecho_task, "Summary", "true")
            self._create_element(trecho_task, "OutlineLevel", "1")
            self._create_element(trecho_task, "WBS", f"{task_id}")

            # Armazenar element_id no Text1 para round-trip
            ext_attrs = self._create_element(trecho_task, "ExtendedAttribute")
            self._create_element(ext_attrs, "FieldID", "188743731")  # Text1
            self._create_element(ext_attrs, "Value", trecho_id)

            uid += 1
            task_id += 1
            parent_uid = uid - 1

            # Atividades do trecho
            for activity in activities:
                act_task = self._create_element(tasks, "Task")
                self._create_element(act_task, "UID", str(uid))
                self._create_element(act_task, "ID", str(task_id))
                self._create_element(act_task, "Name", activity.get("activity", "Atividade"))
                self._create_element(act_task, "OutlineLevel", "2")
                self._create_element(act_task, "WBS", f"{task_id - 1}.{task_id}")

                # Datas
                start_date = activity.get("start_date")
                duration = activity.get("duration", 1)

                if start_date:
                    if isinstance(start_date, str):
                        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                    else:
                        start_dt = start_date
                    self._create_element(act_task, "Start", self._format_datetime(start_dt))

                    end_dt = start_dt + timedelta(days=duration)
                    self._create_element(act_task, "Finish", self._format_datetime(end_dt))

                self._create_element(act_task, "Duration", self._format_duration(duration))
                self._create_element(act_task, "DurationFormat", "7")  # Dias

                # Progresso
                progress = activity.get("progress", 0)
                self._create_element(act_task, "PercentComplete", str(progress))
                self._create_element(act_task, "PercentWorkComplete", str(progress))

                # Custo
                if "cost" in activity:
                    self._create_element(act_task, "Cost", str(activity["cost"]))

                uid += 1
                task_id += 1

    def _create_tasks_from_elements(self, tasks: ET.Element) -> None:
        """Cria tarefas a partir dos elementos do projeto"""
        uid = 1
        task_id = 1

        # Criar tarefas para links com WBS
        for link in self.project.links.values():
            if link.wbs_id or link.planned_start:
                task = self._create_element(tasks, "Task")
                self._create_element(task, "UID", str(uid))
                self._create_element(task, "ID", str(task_id))
                self._create_element(task, "Name", link.name or link.external_id or f"Trecho {task_id}")
                self._create_element(task, "OutlineLevel", "1")
                self._create_element(task, "WBS", link.wbs_id or str(task_id))

                if link.planned_start:
                    self._create_element(task, "Start", self._format_datetime(link.planned_start))
                if link.planned_end:
                    self._create_element(task, "Finish", self._format_datetime(link.planned_end))

                self._create_element(task, "PercentComplete", str(int(link.progress_percent)))

                # Armazenar element_id para round-trip
                ext_attrs = self._create_element(task, "ExtendedAttribute")
                self._create_element(ext_attrs, "FieldID", "188743731")  # Text1
                self._create_element(ext_attrs, "Value", str(link.id))

                self.task_mapping[str(uid)] = link.id

                uid += 1
                task_id += 1

    def _export_assignments(self, root: ET.Element) -> None:
        """Exporta atribuições de recursos"""
        assignments = self._create_element(root, "Assignments")
        # Atribuições podem ser adicionadas conforme necessário

    def import_mspdi(
        self,
        filepath: str,
        user_id: str,
        update_schedule_only: bool = True
    ) -> Dict[str, Any]:
        """
        Importa cronograma de arquivo MSPDI

        IMPORTANTE: Apenas atualiza campos de cronograma!
        NUNCA sobrescreve atributos hidráulicos/projeto.

        Args:
            filepath: Caminho do arquivo XML
            user_id: ID do usuário para auditoria
            update_schedule_only: Se True, apenas atualiza cronograma

        Returns:
            Relatório de importação
        """
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Namespace
        ns = {"ms": self.NS}

        imported_count = 0
        updated_elements = []
        warnings = []

        # Processar tarefas
        for task in root.findall(".//ms:Task", ns):
            uid = task.find("ms:UID", ns)
            if uid is None:
                continue

            uid_val = uid.text

            # Buscar element_id no Text1
            element_id = None
            for ext_attr in task.findall("ms:ExtendedAttribute", ns):
                field_id = ext_attr.find("ms:FieldID", ns)
                if field_id is not None and field_id.text == "188743731":  # Text1
                    value = ext_attr.find("ms:Value", ns)
                    if value is not None:
                        element_id = value.text
                        break

            if not element_id:
                # Tentar pelo mapeamento
                element_id = self.task_mapping.get(uid_val)

            if not element_id:
                continue

            # Buscar elemento no projeto
            try:
                elem_uuid = UUID(element_id)
                element = self.project.get_link(elem_uuid)
            except (ValueError, TypeError):
                # Pode ser um external_id
                element = None
                for link in self.project.links.values():
                    if link.external_id == element_id:
                        element = link
                        break

            if not element:
                warnings.append(f"Elemento não encontrado: {element_id}")
                continue

            # Atualizar campos de cronograma
            changes = {}

            # Datas
            start_elem = task.find("ms:Start", ns)
            if start_elem is not None and start_elem.text:
                new_start = datetime.fromisoformat(start_elem.text.replace("Z", "+00:00"))
                if element.planned_start != new_start:
                    changes["planned_start"] = (element.planned_start, new_start)
                    element.update_field("planned_start", new_start, user_id, "Importado do ProjectLibre")

            finish_elem = task.find("ms:Finish", ns)
            if finish_elem is not None and finish_elem.text:
                new_end = datetime.fromisoformat(finish_elem.text.replace("Z", "+00:00"))
                if element.planned_end != new_end:
                    changes["planned_end"] = (element.planned_end, new_end)
                    element.update_field("planned_end", new_end, user_id, "Importado do ProjectLibre")

            # Progresso
            percent_elem = task.find("ms:PercentComplete", ns)
            if percent_elem is not None and percent_elem.text:
                new_progress = float(percent_elem.text)
                if element.progress_percent != new_progress:
                    changes["progress_percent"] = (element.progress_percent, new_progress)
                    element.update_field("progress_percent", new_progress, user_id, "Importado do ProjectLibre")

            if changes:
                imported_count += 1
                updated_elements.append({
                    "element_id": element_id,
                    "changes": changes
                })

        logger.info(f"MSPDI importado: {imported_count} elementos atualizados")

        return {
            "success": True,
            "imported_count": imported_count,
            "updated_elements": updated_elements,
            "warnings": warnings
        }

    def launch_projectlibre(self, filepath: str) -> bool:
        """
        Abre arquivo no ProjectLibre

        Args:
            filepath: Caminho do arquivo XML

        Returns:
            True se abriu com sucesso
        """
        filepath = Path(filepath).absolute()

        if not filepath.exists():
            logger.error(f"Arquivo não encontrado: {filepath}")
            return False

        # Tentar localizar ProjectLibre
        possible_paths = [
            # Linux
            "/usr/bin/projectlibre",
            "/usr/local/bin/projectlibre",
            os.path.expanduser("~/ProjectLibre/projectlibre"),
            # Windows
            r"C:\Program Files\ProjectLibre\projectlibre.exe",
            r"C:\Program Files (x86)\ProjectLibre\projectlibre.exe",
            # Submódulo local
            str(Path(__file__).parent.parent.parent.parent / "vendor" / "projectlibre" / "projectlibre")
        ]

        projectlibre_path = None
        for path in possible_paths:
            if os.path.exists(path):
                projectlibre_path = path
                break

        if not projectlibre_path:
            logger.warning("ProjectLibre não encontrado. Instale em: https://www.projectlibre.com/")
            return False

        try:
            subprocess.Popen([projectlibre_path, str(filepath)])
            logger.info(f"ProjectLibre aberto com: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Erro ao abrir ProjectLibre: {e}")
            return False


def export_to_projectlibre(project, planning_data: Dict, output_path: str) -> str:
    """
    Função helper para exportar projeto para ProjectLibre

    Exemplo:
        >>> filepath = export_to_projectlibre(project, planning_data, "/output")
    """
    bridge = ProjectLibreBridge(project, planning_data)
    filepath = Path(output_path) / f"{project.name.replace(' ', '_')}.xml"
    return bridge.export_mspdi(str(filepath))


if __name__ == "__main__":
    print("ProjectLibre Bridge - HydroNetwork")
    print("Use ProjectLibreBridge(project, planning_data) para começar.")

/**
 * Import Validator - Validações Automáticas Pós-Importação
 *
 * REGRA: Validação antes de salvar - alertar, NUNCA corrigir automaticamente
 */

import { NetworkModel, NetworkNode, NetworkEdge } from '../network/NetworkModel';
import { ProjectCRS } from '../spatial/ProjectCRS';
import { UTMValidator } from '../import/UTMValidator';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ValidationReport {
  timestamp: Date;
  isValid: boolean;
  totalIssues: number;
  criticalIssues: number;

  duplicateNodes: {
    count: number;
    items: Array<{
      node1: string;
      node2: string;
      distance: number;
    }>;
  };

  disconnectedEdges: {
    count: number;
    items: string[];
  };

  invalidGeometries: {
    count: number;
    items: Array<{
      id: string;
      reason: string;
    }>;
  };

  crsInconsistencies: {
    count: number;
    items: Array<{
      id: string;
      expectedSrid: number;
      foundSrid: number;
    }>;
  };

  negativeZ: {
    count: number;
    items: string[];
  };

  lengthDiscrepancies: {
    count: number;
    items: Array<{
      id: string;
      calculated: number;
      stored: number;
      difference: number;
      percentDiff: number;
    }>;
  };

  zeroLength: {
    count: number;
    items: string[];
  };

  isolatedNodes: {
    count: number;
    items: string[];
  };

  coordinateWarnings: {
    count: number;
    items: Array<{
      id: string;
      type: 'node' | 'edge';
      message: string;
    }>;
  };

  missingAttributes: {
    count: number;
    items: Array<{
      id: string;
      missingFields: string[];
    }>;
  };
}

export interface ValidationOptions {
  checkDuplicateNodes: boolean;
  duplicateNodeTolerance: number;
  checkDisconnectedEdges: boolean;
  checkInvalidGeometries: boolean;
  checkCRSConsistency: boolean;
  checkNegativeZ: boolean;
  checkLengthDiscrepancies: boolean;
  lengthDiscrepancyTolerance: number;  // Percentual
  checkZeroLength: boolean;
  checkIsolatedNodes: boolean;
  checkCoordinates: boolean;
  checkMissingAttributes: boolean;
  requiredAttributes: string[];
}

// ============================================================================
// IMPORT VALIDATOR CLASS
// ============================================================================

class ImportValidatorImpl {
  private defaultOptions: ValidationOptions = {
    checkDuplicateNodes: true,
    duplicateNodeTolerance: 0.01,
    checkDisconnectedEdges: true,
    checkInvalidGeometries: true,
    checkCRSConsistency: true,
    checkNegativeZ: true,
    checkLengthDiscrepancies: true,
    lengthDiscrepancyTolerance: 5,  // 5%
    checkZeroLength: true,
    checkIsolatedNodes: true,
    checkCoordinates: true,
    checkMissingAttributes: false,
    requiredAttributes: []
  };

  // --------------------------------------------------------------------------
  // Main Validation
  // --------------------------------------------------------------------------

  validate(options?: Partial<ValidationOptions>): ValidationReport {
    const opts = { ...this.defaultOptions, ...options };
    const nodes = NetworkModel.getAllNodes();
    const edges = NetworkModel.getAllEdges();

    const report: ValidationReport = {
      timestamp: new Date(),
      isValid: true,
      totalIssues: 0,
      criticalIssues: 0,
      duplicateNodes: { count: 0, items: [] },
      disconnectedEdges: { count: 0, items: [] },
      invalidGeometries: { count: 0, items: [] },
      crsInconsistencies: { count: 0, items: [] },
      negativeZ: { count: 0, items: [] },
      lengthDiscrepancies: { count: 0, items: [] },
      zeroLength: { count: 0, items: [] },
      isolatedNodes: { count: 0, items: [] },
      coordinateWarnings: { count: 0, items: [] },
      missingAttributes: { count: 0, items: [] }
    };

    // Execute validations
    if (opts.checkDuplicateNodes) {
      this.checkDuplicateNodes(nodes, opts.duplicateNodeTolerance, report);
    }

    if (opts.checkDisconnectedEdges) {
      this.checkDisconnectedEdges(edges, nodes, report);
    }

    if (opts.checkInvalidGeometries) {
      this.checkInvalidGeometries(edges, report);
    }

    if (opts.checkNegativeZ) {
      this.checkNegativeZ(nodes, report);
    }

    if (opts.checkLengthDiscrepancies) {
      this.checkLengthDiscrepancies(edges, opts.lengthDiscrepancyTolerance, report);
    }

    if (opts.checkZeroLength) {
      this.checkZeroLength(edges, report);
    }

    if (opts.checkIsolatedNodes) {
      this.checkIsolatedNodes(nodes, report);
    }

    if (opts.checkCoordinates) {
      this.checkCoordinates(nodes, edges, report);
    }

    if (opts.checkMissingAttributes && opts.requiredAttributes.length > 0) {
      this.checkMissingAttributes(nodes, edges, opts.requiredAttributes, report);
    }

    // Calculate totals
    report.totalIssues =
      report.duplicateNodes.count +
      report.disconnectedEdges.count +
      report.invalidGeometries.count +
      report.crsInconsistencies.count +
      report.negativeZ.count +
      report.lengthDiscrepancies.count +
      report.zeroLength.count +
      report.isolatedNodes.count +
      report.coordinateWarnings.count +
      report.missingAttributes.count;

    report.criticalIssues =
      report.disconnectedEdges.count +
      report.invalidGeometries.count +
      report.coordinateWarnings.count;

    report.isValid = report.criticalIssues === 0;

    return report;
  }

  // --------------------------------------------------------------------------
  // Individual Checks
  // --------------------------------------------------------------------------

  private checkDuplicateNodes(
    nodes: NetworkNode[],
    tolerance: number,
    report: ValidationReport
  ): void {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = this.calculateDistance(nodes[i], nodes[j]);

        if (distance <= tolerance) {
          report.duplicateNodes.items.push({
            node1: nodes[i].id,
            node2: nodes[j].id,
            distance
          });
        }
      }
    }

    report.duplicateNodes.count = report.duplicateNodes.items.length;
  }

  private checkDisconnectedEdges(
    edges: NetworkEdge[],
    nodes: NetworkNode[],
    report: ValidationReport
  ): void {
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const edge of edges) {
      if (!nodeIds.has(edge.startNodeId) || !nodeIds.has(edge.endNodeId)) {
        report.disconnectedEdges.items.push(edge.id);
      }
    }

    report.disconnectedEdges.count = report.disconnectedEdges.items.length;
  }

  private checkInvalidGeometries(
    edges: NetworkEdge[],
    report: ValidationReport
  ): void {
    for (const edge of edges) {
      if (!edge.geometry?.coordinates) {
        report.invalidGeometries.items.push({
          id: edge.id,
          reason: 'Geometria ausente'
        });
        continue;
      }

      const coords = edge.geometry.coordinates;

      if (coords.length < 2) {
        report.invalidGeometries.items.push({
          id: edge.id,
          reason: 'Menos de 2 vértices'
        });
        continue;
      }

      // Check for invalid coordinates
      for (let i = 0; i < coords.length; i++) {
        if (
          isNaN(coords[i][0]) ||
          isNaN(coords[i][1]) ||
          !isFinite(coords[i][0]) ||
          !isFinite(coords[i][1])
        ) {
          report.invalidGeometries.items.push({
            id: edge.id,
            reason: `Coordenada inválida no vértice ${i}`
          });
          break;
        }
      }
    }

    report.invalidGeometries.count = report.invalidGeometries.items.length;
  }

  private checkNegativeZ(
    nodes: NetworkNode[],
    report: ValidationReport
  ): void {
    for (const node of nodes) {
      if (node.z < 0) {
        report.negativeZ.items.push(node.id);
      }
    }

    report.negativeZ.count = report.negativeZ.items.length;
  }

  private checkLengthDiscrepancies(
    edges: NetworkEdge[],
    tolerancePercent: number,
    report: ValidationReport
  ): void {
    for (const edge of edges) {
      if (!edge.geometry?.coordinates || edge.geometry.coordinates.length < 2) {
        continue;
      }

      const calculated = NetworkModel.calculateEdgeLength(edge);

      if (edge.length > 0 && calculated > 0) {
        const difference = Math.abs(calculated - edge.length);
        const percentDiff = (difference / edge.length) * 100;

        if (percentDiff > tolerancePercent) {
          report.lengthDiscrepancies.items.push({
            id: edge.id,
            calculated,
            stored: edge.length,
            difference,
            percentDiff
          });
        }
      }
    }

    report.lengthDiscrepancies.count = report.lengthDiscrepancies.items.length;
  }

  private checkZeroLength(
    edges: NetworkEdge[],
    report: ValidationReport
  ): void {
    for (const edge of edges) {
      if (edge.length === 0 || edge.length < 0.001) {
        report.zeroLength.items.push(edge.id);
      }
    }

    report.zeroLength.count = report.zeroLength.items.length;
  }

  private checkIsolatedNodes(
    nodes: NetworkNode[],
    report: ValidationReport
  ): void {
    for (const node of nodes) {
      if (node.connectedEdges.length === 0) {
        report.isolatedNodes.items.push(node.id);
      }
    }

    report.isolatedNodes.count = report.isolatedNodes.items.length;
  }

  private checkCoordinates(
    nodes: NetworkNode[],
    edges: NetworkEdge[],
    report: ValidationReport
  ): void {
    // Check node coordinates
    for (const node of nodes) {
      const validation = UTMValidator.validateCoordinates(node.x, node.y, node.z);

      if (!validation.valid) {
        validation.warnings.forEach(warning => {
          report.coordinateWarnings.items.push({
            id: node.id,
            type: 'node',
            message: warning
          });
        });
      }
    }

    // Check edge vertex coordinates
    for (const edge of edges) {
      if (!edge.geometry?.coordinates) continue;

      for (let i = 0; i < edge.geometry.coordinates.length; i++) {
        const coord = edge.geometry.coordinates[i];
        const validation = UTMValidator.validateCoordinates(coord[0], coord[1], coord[2]);

        if (validation.possibleNumericFormatError) {
          report.coordinateWarnings.items.push({
            id: edge.id,
            type: 'edge',
            message: `Vértice ${i}: possível erro de formato numérico`
          });
          break;  // Não repetir para cada vértice
        }
      }
    }

    report.coordinateWarnings.count = report.coordinateWarnings.items.length;
  }

  private checkMissingAttributes(
    nodes: NetworkNode[],
    edges: NetworkEdge[],
    requiredAttributes: string[],
    report: ValidationReport
  ): void {
    // Check nodes
    for (const node of nodes) {
      const missing: string[] = [];

      for (const attr of requiredAttributes) {
        if (!(attr in node) && !(attr in (node.attributes || {}))) {
          missing.push(attr);
        }
      }

      if (missing.length > 0) {
        report.missingAttributes.items.push({
          id: node.id,
          missingFields: missing
        });
      }
    }

    // Check edges
    for (const edge of edges) {
      const missing: string[] = [];

      for (const attr of requiredAttributes) {
        if (!(attr in edge) && !(attr in (edge.attributes || {}))) {
          missing.push(attr);
        }
      }

      if (missing.length > 0) {
        report.missingAttributes.items.push({
          id: edge.id,
          missingFields: missing
        });
      }
    }

    report.missingAttributes.count = report.missingAttributes.items.length;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private calculateDistance(node1: NetworkNode, node2: NetworkNode): number {
    return Math.sqrt(
      Math.pow(node1.x - node2.x, 2) +
      Math.pow(node1.y - node2.y, 2)
    );
  }

  // --------------------------------------------------------------------------
  // Report Formatting
  // --------------------------------------------------------------------------

  formatReport(report: ValidationReport): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('              RELATÓRIO DE VALIDAÇÃO PÓS-IMPORTAÇÃO');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`Data: ${report.timestamp.toLocaleString()}`);
    lines.push(`Status: ${report.isValid ? '✓ VÁLIDO' : '✗ COM PROBLEMAS'}`);
    lines.push(`Total de problemas: ${report.totalIssues}`);
    lines.push(`Problemas críticos: ${report.criticalIssues}`);
    lines.push('');

    if (report.duplicateNodes.count > 0) {
      lines.push(`⚠️ Nós duplicados: ${report.duplicateNodes.count}`);
      report.duplicateNodes.items.slice(0, 5).forEach(item => {
        lines.push(`   - ${item.node1} ↔ ${item.node2} (dist: ${item.distance.toFixed(4)}m)`);
      });
      if (report.duplicateNodes.count > 5) {
        lines.push(`   ... e mais ${report.duplicateNodes.count - 5}`);
      }
      lines.push('');
    }

    if (report.disconnectedEdges.count > 0) {
      lines.push(`❌ Trechos desconectados: ${report.disconnectedEdges.count}`);
      report.disconnectedEdges.items.slice(0, 5).forEach(id => {
        lines.push(`   - ${id}`);
      });
      lines.push('');
    }

    if (report.invalidGeometries.count > 0) {
      lines.push(`❌ Geometrias inválidas: ${report.invalidGeometries.count}`);
      report.invalidGeometries.items.slice(0, 5).forEach(item => {
        lines.push(`   - ${item.id}: ${item.reason}`);
      });
      lines.push('');
    }

    if (report.zeroLength.count > 0) {
      lines.push(`⚠️ Trechos com comprimento zero: ${report.zeroLength.count}`);
      lines.push('');
    }

    if (report.isolatedNodes.count > 0) {
      lines.push(`ℹ️ Nós isolados: ${report.isolatedNodes.count}`);
      lines.push('');
    }

    if (report.coordinateWarnings.count > 0) {
      lines.push(`⚠️ Avisos de coordenadas: ${report.coordinateWarnings.count}`);
      report.coordinateWarnings.items.slice(0, 3).forEach(item => {
        lines.push(`   - ${item.type} ${item.id}: ${item.message}`);
      });
      lines.push('');
    }

    if (report.lengthDiscrepancies.count > 0) {
      lines.push(`ℹ️ Discrepâncias de comprimento: ${report.lengthDiscrepancies.count}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  generateHTML(report: ValidationReport): string {
    return `
      <div class="validation-report">
        <h2>Relatório de Validação</h2>
        <p class="status ${report.isValid ? 'valid' : 'invalid'}">
          ${report.isValid ? '✓ Válido' : '✗ Com Problemas'}
        </p>
        <p>Total de problemas: ${report.totalIssues}</p>
        <p>Problemas críticos: ${report.criticalIssues}</p>

        ${report.duplicateNodes.count > 0 ? `
          <div class="issue-group warning">
            <h3>⚠️ Nós Duplicados (${report.duplicateNodes.count})</h3>
            <ul>
              ${report.duplicateNodes.items.slice(0, 10).map(item =>
                `<li>${item.node1} ↔ ${item.node2} (${item.distance.toFixed(4)}m)</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}

        ${report.disconnectedEdges.count > 0 ? `
          <div class="issue-group error">
            <h3>❌ Trechos Desconectados (${report.disconnectedEdges.count})</h3>
            <ul>
              ${report.disconnectedEdges.items.slice(0, 10).map(id =>
                `<li>${id}</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}

        ${report.coordinateWarnings.count > 0 ? `
          <div class="issue-group warning">
            <h3>⚠️ Avisos de Coordenadas (${report.coordinateWarnings.count})</h3>
            <ul>
              ${report.coordinateWarnings.items.slice(0, 10).map(item =>
                `<li>${item.type} ${item.id}: ${item.message}</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Singleton instance
export const ImportValidator = new ImportValidatorImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function validateImport(options?: Partial<ValidationOptions>): ValidationReport {
  return ImportValidator.validate(options);
}

export function formatValidationReport(report: ValidationReport): string {
  return ImportValidator.formatReport(report);
}

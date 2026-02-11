/**
 * Peer Review Engine - Motor de Revisao por Pares
 *
 * Implementa:
 * - Rule Engine com regras baseadas em normas brasileiras
 * - Workflow de revisao por pares (A + B -> adjudicacao)
 * - Geracao de findings
 * - Auditoria completa do processo
 *
 * IMPORTANTE: Nao copie textos normativos!
 * Apenas referencias estruturadas (normId, clauseId, topic)
 */

export enum Severity {
  OK = 'OK',
  INFO = 'INFO',
  ALERT = 'ALERT',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum ReviewStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW_A_COMPLETE = 'review_a_complete',
  REVIEW_B_COMPLETE = 'review_b_complete',
  NEEDS_ADJUDICATION = 'needs_adjudication',
  ADJUDICATED = 'adjudicated',
  CLOSED = 'closed'
}

export interface NormRef {
  normId: string;  // Ex: "ABNT_NBR_15920"
  clauseId?: string;  // Ex: "5.3.2"
  topic: string;  // Ex: "min_diameter_50mm"
  year?: number;
}

export interface Finding {
  id: string;
  elementId?: string;
  elementType: string;
  ruleId: string;
  severity: Severity;
  normRefs: NormRef[];
  message: string;
  recommendation: string;
  evidence: Record<string, unknown>;
  reviewerId: string;
  reviewTimestamp: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'wont_fix';
  comments: string[];
  x?: number;
  y?: number;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  appliesTo: string[];  // Lista de ElementType
  systemFilter?: string;  // SystemType
  normRefs: NormRef[];
  evidenceFields: string[];
  recommendation: string;
  active: boolean;
  evalFunc: (element: Record<string, unknown>) => { passed: boolean; evidence: Record<string, unknown> };
}

export interface RuleSet {
  name: string;
  systemType: string;
  rules: Map<string, Rule>;
}

export interface ReviewSession {
  id: string;
  reviewerId: string;
  projectId: string;
  startedAt: string;
  completedAt?: string;
  findings: Finding[];
  elementsReviewed: Set<string>;
  status: ReviewStatus;
}

export interface Discrepancy {
  elementId: string;
  type: 'severity_mismatch' | 'finding_only_a' | 'finding_only_b';
  reviewerA?: { severity: string; ruleId: string };
  reviewerB?: { severity: string; ruleId: string };
  needsAdjudication: boolean;
}

export interface Adjudication {
  id: string;
  elementId: string;
  discrepancyType: string;
  adjudicatorId: string;
  decision: string;
  comments: string;
  timestamp: string;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function createRule(
  id: string,
  title: string,
  description: string,
  severity: Severity,
  appliesTo: string[],
  normRefs: NormRef[],
  recommendation: string,
  evalFunc: (element: Record<string, unknown>) => { passed: boolean; evidence: Record<string, unknown> },
  options?: { systemFilter?: string; evidenceFields?: string[] }
): Rule {
  return {
    id,
    title,
    description,
    severity,
    appliesTo,
    systemFilter: options?.systemFilter,
    normRefs,
    evidenceFields: options?.evidenceFields || [],
    recommendation,
    active: true,
    evalFunc
  };
}

// Regras padrao para agua (NBR 15920)
function createWaterRules(): RuleSet {
  const rules = new Map<string, Rule>();

  rules.set('WAT-001', createRule(
    'WAT-001',
    'Diametro minimo',
    'Verifica se o diametro atende ao minimo normativo',
    Severity.ERROR,
    ['pipe'],
    [{ normId: 'ABNT_NBR_15920', topic: 'min_diameter_50mm' }],
    'Ajustar diametro para minimo de 50mm',
    (elem) => ({
      passed: (elem.diameter as number || 0) >= 50,
      evidence: { diameter: elem.diameter }
    }),
    { systemFilter: 'water', evidenceFields: ['diameter'] }
  ));

  rules.set('WAT-002', createRule(
    'WAT-002',
    'Velocidade maxima',
    'Verifica se velocidade esta abaixo do maximo',
    Severity.ALERT,
    ['pipe'],
    [{ normId: 'ABNT_NBR_15920', topic: 'max_velocity_3m/s' }],
    'Reduzir velocidade aumentando diametro ou reduzindo vazao',
    (elem) => ({
      passed: (elem.velocity as number || 0) <= 3.0 || elem.velocity === undefined,
      evidence: { velocity: elem.velocity }
    }),
    { systemFilter: 'water', evidenceFields: ['velocity'] }
  ));

  rules.set('WAT-003', createRule(
    'WAT-003',
    'Cobertura minima',
    'Verifica cobertura minima sobre a tubulacao',
    Severity.WARNING,
    ['pipe'],
    [{ normId: 'ABNT_NBR_15920', topic: 'min_cover_0.6m' }],
    'Ajustar profundidade para minimo 0.6m de cobertura',
    (elem) => {
      const upstreamOk = (elem.upstreamCover as number || 1) >= 0.6 || elem.upstreamCover === undefined;
      const downstreamOk = (elem.downstreamCover as number || 1) >= 0.6 || elem.downstreamCover === undefined;
      return {
        passed: upstreamOk && downstreamOk,
        evidence: { upstreamCover: elem.upstreamCover, downstreamCover: elem.downstreamCover }
      };
    },
    { systemFilter: 'water', evidenceFields: ['upstreamCover', 'downstreamCover'] }
  ));

  return {
    name: 'Agua - NBR 15920',
    systemType: 'water',
    rules
  };
}

// Regras padrao para esgoto (NBR 9649)
function createSewerRules(): RuleSet {
  const rules = new Map<string, Rule>();

  rules.set('SEW-001', createRule(
    'SEW-001',
    'Diametro minimo',
    'Verifica diametro minimo para esgoto',
    Severity.ERROR,
    ['pipe', 'conduit'],
    [{ normId: 'ABNT_NBR_9649', topic: 'min_diameter_100mm' }],
    'Ajustar diametro para minimo de 100mm',
    (elem) => ({
      passed: (elem.diameter as number || 0) >= 100,
      evidence: { diameter: elem.diameter }
    }),
    { systemFilter: 'sewer', evidenceFields: ['diameter'] }
  ));

  rules.set('SEW-002', createRule(
    'SEW-002',
    'Declividade minima',
    'Verifica declividade minima para DN150',
    Severity.ERROR,
    ['pipe', 'conduit'],
    [{ normId: 'ABNT_NBR_9649', topic: 'min_slope_0.5pct_d150' }],
    'Ajustar declividade para minimo 0.5% (DN150)',
    (elem) => ({
      passed: (elem.slope as number || 0) >= 0.005 || (elem.diameter as number || 0) > 150,
      evidence: { slope: elem.slope, diameter: elem.diameter }
    }),
    { systemFilter: 'sewer', evidenceFields: ['slope', 'diameter'] }
  ));

  rules.set('SEW-003', createRule(
    'SEW-003',
    'Distancia maxima entre PVs',
    'Verifica distancia maxima de 100m entre PVs',
    Severity.ALERT,
    ['pipe', 'conduit'],
    [{ normId: 'ABNT_NBR_9649', topic: 'max_distance_100m_PV' }],
    'Inserir PV intermediario se comprimento > 100m',
    (elem) => ({
      passed: (elem.length as number || 0) <= 100,
      evidence: { length: elem.length }
    }),
    { systemFilter: 'sewer', evidenceFields: ['length'] }
  ));

  rules.set('SEW-004', createRule(
    'SEW-004',
    'Tensao trativa minima',
    'Verifica tensao trativa minima de 1 Pa',
    Severity.WARNING,
    ['pipe', 'conduit'],
    [{ normId: 'ABNT_NBR_9649', topic: 'min_tractive_tension_1Pa' }],
    'Aumentar declividade para atingir tensao trativa minima',
    (elem) => ({
      passed: (elem.tractiveForce as number || 1) >= 1.0 || elem.tractiveForce === undefined,
      evidence: { tractiveForce: elem.tractiveForce }
    }),
    { systemFilter: 'sewer', evidenceFields: ['tractiveForce'] }
  ));

  return {
    name: 'Esgoto - NBR 9649',
    systemType: 'sewer',
    rules
  };
}

// Regras padrao para drenagem (NBR 15527)
function createDrainageRules(): RuleSet {
  const rules = new Map<string, Rule>();

  rules.set('DRN-001', createRule(
    'DRN-001',
    'Velocidade maxima',
    'Verifica velocidade maxima em condutos de drenagem',
    Severity.ALERT,
    ['conduit'],
    [{ normId: 'ABNT_NBR_15527', topic: 'max_velocity_5m/s' }],
    'Reduzir velocidade ou prever dissipador',
    (elem) => ({
      passed: (elem.velocity as number || 0) <= 5.0 || elem.velocity === undefined,
      evidence: { velocity: elem.velocity }
    }),
    { systemFilter: 'drainage', evidenceFields: ['velocity'] }
  ));

  rules.set('DRN-002', createRule(
    'DRN-002',
    'Velocidade minima',
    'Verifica velocidade minima para autolimpeza',
    Severity.WARNING,
    ['conduit'],
    [{ normId: 'ABNT_NBR_15527', topic: 'min_velocity_0.6m/s' }],
    'Aumentar declividade para velocidade minima de autolimpeza',
    (elem) => ({
      passed: (elem.velocity as number || 1) >= 0.6 || elem.velocity === undefined,
      evidence: { velocity: elem.velocity }
    }),
    { systemFilter: 'drainage', evidenceFields: ['velocity'] }
  ));

  return {
    name: 'Drenagem - NBR 15527',
    systemType: 'drainage',
    rules
  };
}

export class PeerReviewEngine {
  private rulesets: Map<string, RuleSet> = new Map();
  private sessions: Map<string, ReviewSession> = new Map();
  private adjudications: Adjudication[] = [];

  constructor() {
    this.initDefaultRulesets();
  }

  private initDefaultRulesets(): void {
    this.rulesets.set('water', createWaterRules());
    this.rulesets.set('sewer', createSewerRules());
    this.rulesets.set('drainage', createDrainageRules());
  }

  getRulesets(): string[] {
    return Array.from(this.rulesets.keys());
  }

  getRuleset(systemType: string): RuleSet | undefined {
    return this.rulesets.get(systemType);
  }

  getRules(systemType?: string, elementType?: string): Rule[] {
    const rules: Rule[] = [];

    const rulesetsToUse = systemType
      ? [this.rulesets.get(systemType)].filter(Boolean) as RuleSet[]
      : Array.from(this.rulesets.values());

    for (const ruleset of rulesetsToUse) {
      for (const rule of ruleset.rules.values()) {
        if (!rule.active) continue;
        if (elementType && !rule.appliesTo.includes(elementType)) continue;
        rules.push(rule);
      }
    }

    return rules;
  }

  addCustomRule(systemType: string, rule: Rule): void {
    const ruleset = this.rulesets.get(systemType);
    if (ruleset) {
      ruleset.rules.set(rule.id, rule);
    }
  }

  startReview(reviewerId: string, projectId: string): ReviewSession {
    const session: ReviewSession = {
      id: generateId(),
      reviewerId,
      projectId,
      startedAt: new Date().toISOString(),
      findings: [],
      elementsReviewed: new Set(),
      status: ReviewStatus.IN_PROGRESS
    };

    this.sessions.set(session.id, session);
    return session;
  }

  runRules(
    session: ReviewSession,
    elements: Array<{ id: string; type: string; systemType: string; data: Record<string, unknown> }>,
    systemFilter?: string
  ): Finding[] {
    const findings: Finding[] = [];

    const rulesetsToUse = systemFilter
      ? [this.rulesets.get(systemFilter)].filter(Boolean) as RuleSet[]
      : Array.from(this.rulesets.values());

    for (const element of elements) {
      session.elementsReviewed.add(element.id);

      for (const ruleset of rulesetsToUse) {
        if (ruleset.systemType !== element.systemType) continue;

        for (const rule of ruleset.rules.values()) {
          if (!rule.active) continue;
          if (!rule.appliesTo.includes(element.type)) continue;

          try {
            const result = rule.evalFunc(element.data);

            if (!result.passed) {
              const finding: Finding = {
                id: generateId(),
                elementId: element.id,
                elementType: element.type,
                ruleId: rule.id,
                severity: rule.severity,
                normRefs: rule.normRefs,
                message: `${rule.title}: ${rule.description}`,
                recommendation: rule.recommendation,
                evidence: result.evidence,
                reviewerId: session.reviewerId,
                reviewTimestamp: new Date().toISOString(),
                status: 'open',
                comments: [],
                x: element.data.x as number | undefined,
                y: element.data.y as number | undefined
              };

              session.findings.push(finding);
              findings.push(finding);
            }
          } catch (error) {
            console.error(`Error evaluating rule ${rule.id}:`, error);
          }
        }
      }
    }

    return findings;
  }

  completeReview(session: ReviewSession): {
    sessionId: string;
    reviewerId: string;
    startedAt: string;
    completedAt: string;
    totalFindings: number;
    elementsReviewed: number;
    severityCounts: Record<string, number>;
    status: string;
  } {
    session.completedAt = new Date().toISOString();
    session.status = ReviewStatus.REVIEW_A_COMPLETE;

    const severityCounts: Record<string, number> = {};
    for (const finding of session.findings) {
      severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
    }

    return {
      sessionId: session.id,
      reviewerId: session.reviewerId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      totalFindings: session.findings.length,
      elementsReviewed: session.elementsReviewed.size,
      severityCounts,
      status: session.status
    };
  }

  compareReviews(sessionA: ReviewSession, sessionB: ReviewSession): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    const findingsA = new Map<string, Finding>();
    const findingsB = new Map<string, Finding>();

    for (const f of sessionA.findings) {
      if (f.elementId) findingsA.set(f.elementId, f);
    }
    for (const f of sessionB.findings) {
      if (f.elementId) findingsB.set(f.elementId, f);
    }

    const allElements = new Set([...findingsA.keys(), ...findingsB.keys()]);

    for (const elemId of allElements) {
      const fA = findingsA.get(elemId);
      const fB = findingsB.get(elemId);

      if (fA && fB) {
        if (fA.severity !== fB.severity) {
          discrepancies.push({
            elementId: elemId,
            type: 'severity_mismatch',
            reviewerA: { severity: fA.severity, ruleId: fA.ruleId },
            reviewerB: { severity: fB.severity, ruleId: fB.ruleId },
            needsAdjudication: true
          });
        }
      } else if (fA && !fB) {
        discrepancies.push({
          elementId: elemId,
          type: 'finding_only_a',
          reviewerA: { severity: fA.severity, ruleId: fA.ruleId },
          needsAdjudication: fA.severity === Severity.ERROR || fA.severity === Severity.CRITICAL
        });
      } else if (fB && !fA) {
        discrepancies.push({
          elementId: elemId,
          type: 'finding_only_b',
          reviewerB: { severity: fB.severity, ruleId: fB.ruleId },
          needsAdjudication: fB.severity === Severity.ERROR || fB.severity === Severity.CRITICAL
        });
      }
    }

    return discrepancies;
  }

  adjudicate(
    discrepancy: Discrepancy,
    adjudicatorId: string,
    decision: string,
    comments: string
  ): Adjudication {
    const adjudication: Adjudication = {
      id: generateId(),
      elementId: discrepancy.elementId,
      discrepancyType: discrepancy.type,
      adjudicatorId,
      decision,
      comments,
      timestamp: new Date().toISOString()
    };

    this.adjudications.push(adjudication);
    return adjudication;
  }

  getSession(sessionId: string): ReviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ReviewSession[] {
    return Array.from(this.sessions.values());
  }

  getAdjudications(): Adjudication[] {
    return this.adjudications;
  }

  exportFindingsCSV(session: ReviewSession): string {
    const headers = [
      'element_id',
      'element_type',
      'rule_id',
      'severity',
      'norm_ref',
      'message',
      'recommendation',
      'evidence',
      'reviewer_id',
      'timestamp',
      'x',
      'y'
    ];

    const rows = session.findings.map(f => [
      f.elementId || '',
      f.elementType,
      f.ruleId,
      f.severity,
      f.normRefs.map(n => n.normId).join(', '),
      f.message,
      f.recommendation,
      JSON.stringify(f.evidence),
      f.reviewerId,
      f.reviewTimestamp,
      f.x?.toString() || '',
      f.y?.toString() || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    return csvContent;
  }

  exportFindingsJSON(session: ReviewSession): string {
    const severityCounts: Record<string, number> = {};
    for (const finding of session.findings) {
      severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
    }

    const data = {
      session: {
        sessionId: session.id,
        reviewerId: session.reviewerId,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        totalFindings: session.findings.length,
        elementsReviewed: session.elementsReviewed.size,
        severityCounts,
        status: session.status
      },
      findings: session.findings.map(f => ({
        id: f.id,
        elementId: f.elementId,
        elementType: f.elementType,
        ruleId: f.ruleId,
        severity: f.severity,
        normRefs: f.normRefs.map(n => ({ normId: n.normId, clauseId: n.clauseId, topic: n.topic })),
        message: f.message,
        recommendation: f.recommendation,
        evidence: f.evidence,
        reviewerId: f.reviewerId,
        reviewTimestamp: f.reviewTimestamp,
        status: f.status,
        x: f.x,
        y: f.y
      }))
    };

    return JSON.stringify(data, null, 2);
  }
}

// Singleton instance
let engineInstance: PeerReviewEngine | null = null;

export function getPeerReviewEngine(): PeerReviewEngine {
  if (!engineInstance) {
    engineInstance = new PeerReviewEngine();
  }
  return engineInstance;
}

// Helper function to get available rules for display
export function getAvailableRules(): Array<{
  id: string;
  title: string;
  description: string;
  severity: string;
  systemType: string;
  normRefs: string[];
}> {
  const engine = getPeerReviewEngine();
  const result: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    systemType: string;
    normRefs: string[];
  }> = [];

  for (const systemType of engine.getRulesets()) {
    const ruleset = engine.getRuleset(systemType);
    if (!ruleset) continue;

    for (const rule of ruleset.rules.values()) {
      result.push({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        systemType: ruleset.systemType,
        normRefs: rule.normRefs.map(n => n.normId)
      });
    }
  }

  return result;
}

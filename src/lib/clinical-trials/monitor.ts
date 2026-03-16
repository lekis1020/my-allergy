export const TRIAL_MONITOR_AREAS = [
  { id: "asthma", label: "Asthma", query: "asthma" },
  { id: "food_allergy", label: "Food Allergy", query: "food allergy" },
  { id: "atopic_dermatitis", label: "Atopic Dermatitis", query: "atopic dermatitis" },
  { id: "rhinitis", label: "Allergic Rhinitis", query: "allergic rhinitis" },
  { id: "urticaria", label: "Urticaria", query: "urticaria" },
  { id: "immunodeficiency", label: "Immunodeficiency", query: "immunodeficiency" },
] as const;

export const ONGOING_STATUSES = [
  "RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "ENROLLING_BY_INVITATION",
  "NOT_YET_RECRUITING",
] as const;

const AREA_LABELS = new Map<string, string>(
  TRIAL_MONITOR_AREAS.map((area) => [area.id, area.label]),
);

export interface ClinicalTrialAreaSummary {
  id: string;
  label: string;
  query: string;
  totalCount: number;
}

export interface ClinicalTrialStudySummary {
  nctId: string;
  title: string;
  sponsor: string | null;
  status: string;
  statusLabel: string;
  phaseLabel: string;
  studyType: string | null;
  conditions: string[];
  interventions: string[];
  focusAreaIds: string[];
  focusAreaLabels: string[];
  startDate: string | null;
  targetDate: string | null;
  targetDateLabel: string;
  lastUpdated: string | null;
  progressPercent: number | null;
  progressLabel: string;
  pipelineScore: number;
  relatedQuery: string;
  url: string;
}

export interface ClinicalTrialMonitorResponse {
  source: "clinicaltrials.gov";
  trackedAt: string;
  monitoredStatuses: string[];
  areas: ClinicalTrialAreaSummary[];
  studies: ClinicalTrialStudySummary[];
  partial: boolean;
  missingAreas: string[];
}

interface ClinicalTrialsGovResponse {
  totalCount?: number;
  studies?: ClinicalTrialsGovStudy[];
}

interface ClinicalTrialsGovStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    armsInterventionsModule?: ClinicalTrialsGovArmsInterventionsModule;
    conditionsModule?: {
      conditions?: string[];
    };
    designModule?: {
      studyType?: string;
      phases?: string[];
    };
  };
}

interface ClinicalTrialsGovArmsInterventionsModule {
  interventions?: Array<{
    type?: string;
    name?: string;
  }>;
  armGroups?: Array<{
    interventionNames?: string[];
  }>;
}

export interface ParsedAreaResult {
  area: ClinicalTrialAreaSummary;
  studies: ClinicalTrialStudySummary[];
}

export function buildClinicalTrialsGovUrl(query: string): string {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.cond", query);
  url.searchParams.set("filter.overallStatus", ONGOING_STATUSES.join(","));
  url.searchParams.set("countTotal", "true");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("format", "json");
  return url.toString();
}

export function parseClinicalTrialsGovResponse(
  area: (typeof TRIAL_MONITOR_AREAS)[number],
  payload: ClinicalTrialsGovResponse,
): ParsedAreaResult {
  const studies = (payload.studies ?? [])
    .map((study) => parseStudy(study, area.id))
    .filter((study): study is ClinicalTrialStudySummary => study !== null);

  return {
    area: {
      id: area.id,
      label: area.label,
      query: area.query,
      totalCount: typeof payload.totalCount === "number" ? payload.totalCount : studies.length,
    },
    studies,
  };
}

export function mergeAreaStudies(results: ParsedAreaResult[]): ClinicalTrialStudySummary[] {
  const merged = new Map<string, ClinicalTrialStudySummary>();

  for (const result of results) {
    for (const study of result.studies) {
      const existing = merged.get(study.nctId);
      if (!existing) {
        merged.set(study.nctId, study);
        continue;
      }

      const focusAreaIds = Array.from(new Set([...existing.focusAreaIds, ...study.focusAreaIds]));
      const focusAreaLabels = focusAreaIds
        .map((id) => AREA_LABELS.get(id))
        .filter((label): label is string => Boolean(label));
      const conditions = Array.from(new Set([...existing.conditions, ...study.conditions])).slice(0, 4);
      const interventions = Array.from(
        new Set([...existing.interventions, ...study.interventions]),
      ).slice(0, 4);

      merged.set(study.nctId, {
        ...existing,
        focusAreaIds,
        focusAreaLabels,
        conditions,
        interventions,
        pipelineScore: Math.max(existing.pipelineScore, study.pipelineScore),
        relatedQuery: buildRelatedPapersQuery({
          interventions,
          conditions,
          focusAreaLabels,
        }),
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => {
      if (a.pipelineScore !== b.pipelineScore) return b.pipelineScore - a.pipelineScore;
      const aTime = a.lastUpdated ? Date.parse(a.lastUpdated) : 0;
      const bTime = b.lastUpdated ? Date.parse(b.lastUpdated) : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 6);
}

export function normalizeClinicalTrialDate(date?: string | null): string | null {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`;
  if (/^\d{4}$/.test(date)) return `${date}-01-01`;
  return null;
}

export function calculateTrialProgress(
  startDate?: string | null,
  targetDate?: string | null,
  now: Date = new Date(),
): number | null {
  const normalizedStart = normalizeClinicalTrialDate(startDate);
  const normalizedTarget = normalizeClinicalTrialDate(targetDate);
  if (!normalizedStart || !normalizedTarget) return null;

  const start = Date.parse(normalizedStart);
  const target = Date.parse(normalizedTarget);
  const current = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(target) || target <= start) return null;

  const raw = ((current - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) return "Status pending";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPhaseLabel(
  phases?: string[] | null,
  studyType?: string | null,
): string {
  if (phases && phases.length > 0) {
    return phases
      .map((phase) => {
        if (phase === "EARLY_PHASE1") return "Early Phase 1";
        return phase.replace(/^PHASE/, "Phase ");
      })
      .join(" / ");
  }

  if (studyType === "OBSERVATIONAL") return "Observational";
  if (studyType === "INTERVENTIONAL") return "Interventional";
  return "Study";
}

export function buildRelatedPapersQuery(input: {
  interventions?: string[] | null;
  conditions?: string[] | null;
  focusAreaLabels?: string[] | null;
}): string {
  const uniqueTerms = Array.from(
    new Set([
      ...(input.interventions ?? []),
      ...(input.conditions ?? []),
      ...(input.focusAreaLabels ?? []),
    ]),
  )
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (uniqueTerms.length === 0) return "allergy immunology";

  return uniqueTerms
    .map((term) => {
      const normalized = term.replace(/"/g, "").trim();
      return /\s/.test(normalized) ? `"${normalized}"` : normalized;
    })
    .join(" or ");
}

function parseStudy(
  study: ClinicalTrialsGovStudy,
  areaId: string,
): ClinicalTrialStudySummary | null {
  const identification = study.protocolSection?.identificationModule;
  const statusModule = study.protocolSection?.statusModule;
  const designModule = study.protocolSection?.designModule;
  const nctId = identification?.nctId;
  const title = identification?.briefTitle?.trim();

  if (!nctId || !title) return null;

  const sponsor = study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim() || null;
  const status = statusModule?.overallStatus || "UNKNOWN";
  const startDate = normalizeClinicalTrialDate(statusModule?.startDateStruct?.date);
  const primaryCompletionDate = normalizeClinicalTrialDate(
    statusModule?.primaryCompletionDateStruct?.date,
  );
  const completionDate = normalizeClinicalTrialDate(statusModule?.completionDateStruct?.date);
  const targetDate = primaryCompletionDate || completionDate;
  const studyType = designModule?.studyType || null;
  const interventions = extractInterventions(study.protocolSection?.armsInterventionsModule);
  const conditions = (study.protocolSection?.conditionsModule?.conditions ?? [])
    .filter((condition): condition is string => Boolean(condition))
    .slice(0, 4);
  const progressPercent = calculateTrialProgress(startDate, targetDate);
  const focusAreaLabels = [AREA_LABELS.get(areaId) ?? areaId];

  return {
    nctId,
    title,
    sponsor,
    status,
    statusLabel: formatStatusLabel(status),
    phaseLabel: formatPhaseLabel(designModule?.phases, studyType),
    studyType,
    conditions,
    interventions,
    focusAreaIds: [areaId],
    focusAreaLabels,
    startDate,
    targetDate,
    targetDateLabel: primaryCompletionDate ? "Primary completion" : "Completion",
    lastUpdated: normalizeClinicalTrialDate(statusModule?.lastUpdatePostDateStruct?.date),
    progressPercent,
    progressLabel:
      progressPercent === null
        ? "Dates pending"
        : `${progressPercent}% to ${primaryCompletionDate ? "primary completion" : "completion"}`,
    pipelineScore: calculatePipelineScore({
      title,
      studyType,
      phases: designModule?.phases,
      interventions,
    }),
    relatedQuery: buildRelatedPapersQuery({
      interventions,
      conditions,
      focusAreaLabels,
    }),
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}

function extractInterventions(
  module?: ClinicalTrialsGovArmsInterventionsModule,
): string[] {
  const directNames = (module?.interventions ?? [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));
  const groupedNames = (module?.armGroups ?? [])
    .flatMap((group) => group.interventionNames ?? [])
    .map((name) => name.replace(/^[A-Za-z ]+:\s*/, "").trim())
    .filter(Boolean);

  return Array.from(new Set([...directNames, ...groupedNames])).slice(0, 4);
}

function calculatePipelineScore(input: {
  title: string;
  studyType: string | null;
  phases?: string[] | null;
  interventions: string[];
}): number {
  let score = 0;
  const haystack = [input.title, ...input.interventions].join(" ").toLowerCase();

  if (input.studyType === "INTERVENTIONAL") score += 2;
  if ((input.phases?.length ?? 0) > 0) score += 2;
  if (DRUG_PIPELINE_KEYWORDS.some((keyword) => haystack.includes(keyword))) score += 4;
  if (/[A-Z]{2,}\d{2,}/.test([input.title, ...input.interventions].join(" "))) score += 2;
  if (input.interventions.length > 0) score += 1;

  return score;
}

const DRUG_PIPELINE_KEYWORDS = [
  "biologic",
  "biological",
  "monoclonal",
  "antibody",
  "mab",
  "inhibitor",
  "vaccine",
  "agonist",
  "antagonist",
  "cell therapy",
  "gene therapy",
  "immunotherapy",
  "small molecule",
  "oral immunotherapy",
  "dupilumab",
  "omalizumab",
  "benralizumab",
  "mepolizumab",
  "tezepelumab",
  "tralokinumab",
  "abrocitinib",
  "upadacitinib",
  "baricitinib",
];

import { describe, expect, it } from "vitest";
import {
  buildRelatedPapersQuery,
  calculateTrialProgress,
  formatPhaseLabel,
  formatStatusLabel,
  mergeAreaStudies,
  normalizeClinicalTrialDate,
  parseClinicalTrialsGovResponse,
  TRIAL_MONITOR_AREAS,
} from "../monitor";

describe("clinical trial monitor helpers", () => {
  it("normalizes partial trial dates", () => {
    expect(normalizeClinicalTrialDate("2026")).toBe("2026-01-01");
    expect(normalizeClinicalTrialDate("2026-03")).toBe("2026-03-01");
    expect(normalizeClinicalTrialDate("2026-03-16")).toBe("2026-03-16");
    expect(normalizeClinicalTrialDate("2026/03/16")).toBeNull();
  });

  it("calculates bounded progress from start to target", () => {
    const progress = calculateTrialProgress("2025-01-01", "2025-12-31", new Date("2025-07-02"));
    expect(progress).toBe(50);
    expect(calculateTrialProgress("2025-01-01", "2025-12-31", new Date("2024-12-01"))).toBe(0);
    expect(calculateTrialProgress("2025-01-01", "2025-12-31", new Date("2026-01-10"))).toBe(100);
  });

  it("formats statuses and phases for display", () => {
    expect(formatStatusLabel("ACTIVE_NOT_RECRUITING")).toBe("Active Not Recruiting");
    expect(formatPhaseLabel(["EARLY_PHASE1", "PHASE2"], "INTERVENTIONAL")).toBe(
      "Early Phase 1 / Phase 2",
    );
    expect(formatPhaseLabel(undefined, "OBSERVATIONAL")).toBe("Observational");
  });

  it("builds a related papers query from conditions and focus areas", () => {
    expect(
      buildRelatedPapersQuery({
        interventions: ["Dupilumab"],
        conditions: ["Severe Asthma", "Biologics"],
        focusAreaLabels: ["Asthma"],
      }),
    ).toBe('Dupilumab or "Severe Asthma" or Biologics or Asthma');
  });

  it("parses a focus area response into summaries", () => {
    const result = parseClinicalTrialsGovResponse(TRIAL_MONITOR_AREAS[0], {
      totalCount: 42,
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT123",
              briefTitle: "Biologic for Severe Asthma",
            },
            statusModule: {
              overallStatus: "RECRUITING",
              startDateStruct: { date: "2025-01" },
              primaryCompletionDateStruct: { date: "2026-02" },
              lastUpdatePostDateStruct: { date: "2026-03-01" },
            },
            sponsorCollaboratorsModule: {
              leadSponsor: { name: "Example Sponsor" },
            },
            armsInterventionsModule: {
              interventions: [{ type: "BIOLOGICAL", name: "Dupilumab" }],
            },
            conditionsModule: {
              conditions: ["Severe Asthma"],
            },
            designModule: {
              studyType: "INTERVENTIONAL",
              phases: ["PHASE2"],
            },
          },
        },
      ],
    });

    expect(result.area.totalCount).toBe(42);
    expect(result.studies).toHaveLength(1);
    expect(result.studies[0]).toMatchObject({
      nctId: "NCT123",
      statusLabel: "Recruiting",
      phaseLabel: "Phase 2",
      sponsor: "Example Sponsor",
      focusAreaIds: ["asthma"],
      interventions: ["Dupilumab"],
      relatedQuery: 'Dupilumab or "Severe Asthma" or Asthma',
    });
    expect(result.studies[0].pipelineScore).toBeGreaterThan(0);
  });

  it("merges duplicate studies across focus areas", () => {
    const first = parseClinicalTrialsGovResponse(TRIAL_MONITOR_AREAS[0], {
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT123",
              briefTitle: "Cross-cutting Trial",
            },
            statusModule: {
              overallStatus: "RECRUITING",
              lastUpdatePostDateStruct: { date: "2026-03-10" },
            },
            designModule: {
              studyType: "INTERVENTIONAL",
              phases: ["PHASE3"],
            },
            armsInterventionsModule: {
              interventions: [{ type: "DRUG", name: "ABC123" }],
            },
          },
        },
      ],
    });

    const second = parseClinicalTrialsGovResponse(TRIAL_MONITOR_AREAS[1], {
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT123",
              briefTitle: "Cross-cutting Trial",
            },
            statusModule: {
              overallStatus: "RECRUITING",
              lastUpdatePostDateStruct: { date: "2026-03-10" },
            },
            designModule: {
              studyType: "INTERVENTIONAL",
              phases: ["PHASE3"],
            },
            armsInterventionsModule: {
              interventions: [{ type: "DRUG", name: "ABC123" }],
            },
            conditionsModule: {
              conditions: ["Asthma", "Food Allergy"],
            },
          },
        },
      ],
    });

    const merged = mergeAreaStudies([first, second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].focusAreaIds).toEqual(["asthma", "food_allergy"]);
    expect(merged[0].focusAreaLabels).toEqual(["Asthma", "Food Allergy"]);
    expect(merged[0].interventions).toEqual(["ABC123"]);
    expect(merged[0].relatedQuery).toBe('ABC123 or Asthma or "Food Allergy"');
  });
});

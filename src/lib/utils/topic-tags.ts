import type { TopicTag } from "@/types/filters";

interface TopicSignals {
  title: string;
  abstract: string | null;
  keywords: string[];
  meshTerms: string[];
}

interface TopicConfig {
  label: string;
  terms: string[];
}

const TOPIC_CONFIG: Record<Exclude<TopicTag, "others">, TopicConfig> = {
  asthma: {
    label: "Asthma",
    terms: [
      "asthma",
      "asthmatic",
      "wheeze",
      "wheezing",
      "bronchial hyperresponsiveness",
      "bronchial hyperreactivity",
      "airway hyperresponsiveness",
    ],
  },
  rhinitis: {
    label: "Rhinitis",
    terms: [
      "rhinitis",
      "allergic rhinitis",
      "rhinoconjunctivitis",
      "hay fever",
      "nasal allergy",
    ],
  },
  urticaria: {
    label: "Urticaria",
    terms: [
      "urticaria",
      "hives",
      "angioedema",
      "chronic spontaneous urticaria",
      "chronic urticaria",
      "csu",
    ],
  },
  atopic_dermatitis: {
    label: "Atopic Dermatitis",
    terms: [
      "atopic dermatitis",
      "atopic eczema",
      "eczema",
      "dermatitis atopic",
    ],
  },
  drug_allergy: {
    label: "Drug Allergy",
    terms: [
      "drug allergy",
      "drug hypersensitivity",
      "drug-induced hypersensitivity",
      "penicillin allergy",
      "beta-lactam allergy",
      "nsaid hypersensitivity",
      "aspirin hypersensitivity",
      "dress",
      "stevens johnson syndrome",
      "toxic epidermal necrolysis",
      "sjs",
      "ten",
    ],
  },
  eosinophilic_disorders: {
    label: "Eosinophilic Disorders",
    terms: [
      "eosinophilic",
      "eosinophil",
      "eosinophilic esophagitis",
      "eoe",
      "egpa",
      "churg strauss",
      "hypereosinophilic syndrome",
      "hes",
    ],
  },
  immunodeficiency: {
    label: "Immunodeficiency",
    terms: [
      "immunodeficiency",
      "primary immunodeficiency",
      "inborn errors of immunity",
      "iei",
      "cvid",
      "common variable immunodeficiency",
      "scid",
      "severe combined immunodeficiency",
      "agammaglobulinemia",
      "hyper ige syndrome",
      "wiskott aldrich",
    ],
  },
  food_allergy: {
    label: "Food Allergy",
    terms: [
      "food allergy",
      "food hypersensitivity",
      "food induced anaphylaxis",
      "anaphylaxis food",
      "peanut allergy",
      "tree nut allergy",
      "milk allergy",
      "egg allergy",
      "wheat allergy",
      "shellfish allergy",
      "oral immunotherapy",
    ],
  },
};

const SOURCE_WEIGHT = {
  title: 2,
  abstract: 1,
  keywords: 3,
  meshTerms: 5,
} as const;

const MIN_SCORE = 2;

export const TOPIC_META: Record<TopicTag, { label: string; className: string }> = {
  asthma: {
    label: "Asthma",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  rhinitis: {
    label: "Rhinitis",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  urticaria: {
    label: "Urticaria",
    className: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  },
  atopic_dermatitis: {
    label: "Atopic Dermatitis",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  drug_allergy: {
    label: "Drug Allergy",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  eosinophilic_disorders: {
    label: "Eosinophilic Disorders",
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  immunodeficiency: {
    label: "Immunodeficiency",
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
  food_allergy: {
    label: "Food Allergy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  others: {
    label: "others",
    className: "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

export function classifyPaperTopics(signals: TopicSignals): TopicTag[] {
  const normalizedTitle = normalizeText(signals.title);
  const normalizedAbstract = normalizeText(signals.abstract ?? "");
  const normalizedKeywords = normalizeText(signals.keywords.join(" "));
  const normalizedMesh = normalizeText(signals.meshTerms.join(" "));

  const scored = (Object.keys(TOPIC_CONFIG) as Array<Exclude<TopicTag, "others">>)
    .map((topic) => {
      const { terms } = TOPIC_CONFIG[topic];

      const score =
        scoreSource(normalizedTitle, terms, SOURCE_WEIGHT.title) +
        scoreSource(normalizedAbstract, terms, SOURCE_WEIGHT.abstract) +
        scoreSource(normalizedKeywords, terms, SOURCE_WEIGHT.keywords) +
        scoreSource(normalizedMesh, terms, SOURCE_WEIGHT.meshTerms);

      return { topic, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ["others"];
  }

  const topScore = scored[0].score;
  const cutoff = Math.max(MIN_SCORE, Math.ceil(topScore * 0.45));

  const selected = scored
    .filter((item) => item.score >= cutoff)
    .slice(0, 3)
    .map((item) => item.topic);

  return selected.length > 0 ? selected : ["others"];
}

function scoreSource(text: string, terms: string[], weight: number): number {
  if (!text) return 0;

  let hits = 0;
  for (const term of terms) {
    if (containsTerm(text, term)) {
      hits += 1;
    }
  }

  return hits * weight;
}

function containsTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return (` ${text} `).includes(` ${normalizedTerm} `);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

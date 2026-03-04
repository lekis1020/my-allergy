export interface SubTopic {
  label: string;
  searchQuery: string;
}

export interface TopicCategory {
  id: string;
  label: string;
  searchQuery: string;
  colorClass: string;
  subtopics: SubTopic[];
}

export const TOPIC_TREE: TopicCategory[] = [
  {
    id: "asthma",
    label: "Asthma",
    searchQuery: "asthma",
    colorClass: "text-red-500",
    subtopics: [
      { label: "Severe Asthma", searchQuery: "severe asthma" },
      { label: "Allergic Asthma", searchQuery: "allergic asthma" },
      { label: "Exercise-Induced", searchQuery: "exercise induced asthma" },
      { label: "Occupational Asthma", searchQuery: "occupational asthma" },
      { label: "Pediatric Asthma", searchQuery: "pediatric asthma" },
      { label: "Asthma Biologics", searchQuery: "asthma biologics" },
    ],
  },
  {
    id: "rhinitis",
    label: "Allergic Rhinitis",
    searchQuery: "rhinitis",
    colorClass: "text-amber-500",
    subtopics: [
      { label: "Seasonal Rhinitis", searchQuery: "seasonal allergic rhinitis" },
      { label: "Perennial Rhinitis", searchQuery: "perennial rhinitis" },
      { label: "Rhinosinusitis", searchQuery: "rhinosinusitis" },
      { label: "Nasal Polyps", searchQuery: "nasal polyps" },
      { label: "Allergen Immunotherapy", searchQuery: "allergen immunotherapy rhinitis" },
    ],
  },
  {
    id: "urticaria",
    label: "Urticaria",
    searchQuery: "urticaria",
    colorClass: "text-pink-500",
    subtopics: [
      { label: "Chronic Spontaneous", searchQuery: "chronic spontaneous urticaria" },
      { label: "Chronic Inducible", searchQuery: "chronic inducible urticaria" },
      { label: "Angioedema", searchQuery: "angioedema" },
      { label: "Hereditary Angioedema", searchQuery: "hereditary angioedema" },
      { label: "Omalizumab Urticaria", searchQuery: "omalizumab urticaria" },
    ],
  },
  {
    id: "atopic_dermatitis",
    label: "Atopic Dermatitis",
    searchQuery: "atopic dermatitis",
    colorClass: "text-violet-500",
    subtopics: [
      { label: "Pediatric AD", searchQuery: "pediatric atopic dermatitis" },
      { label: "Dupilumab", searchQuery: "dupilumab atopic dermatitis" },
      { label: "JAK Inhibitors AD", searchQuery: "JAK inhibitor atopic dermatitis" },
      { label: "Contact Dermatitis", searchQuery: "contact dermatitis" },
      { label: "Skin Barrier", searchQuery: "skin barrier atopic dermatitis" },
      { label: "Atopic March", searchQuery: "atopic march" },
    ],
  },
  {
    id: "drug_allergy",
    label: "Drug Allergy",
    searchQuery: "drug allergy",
    colorClass: "text-orange-500",
    subtopics: [
      { label: "Drug Hypersensitivity", searchQuery: "drug hypersensitivity" },
      { label: "Antibiotic Allergy", searchQuery: "antibiotic allergy" },
      { label: "NSAID Hypersensitivity", searchQuery: "NSAID hypersensitivity" },
      { label: "Drug Desensitization", searchQuery: "drug desensitization" },
      { label: "Anaphylaxis Drug", searchQuery: "anaphylaxis drug" },
    ],
  },
  {
    id: "food_allergy",
    label: "Food Allergy",
    searchQuery: "food allergy",
    colorClass: "text-green-500",
    subtopics: [
      { label: "Peanut Allergy", searchQuery: "peanut allergy" },
      { label: "Cow's Milk Allergy", searchQuery: "cow milk allergy" },
      { label: "Oral Immunotherapy", searchQuery: "oral immunotherapy food allergy" },
      { label: "FPIES", searchQuery: "food protein induced enterocolitis" },
      { label: "Eosinophilic Esophagitis", searchQuery: "eosinophilic esophagitis" },
      { label: "Food Anaphylaxis", searchQuery: "food anaphylaxis" },
    ],
  },
  {
    id: "eosinophilic_disorders",
    label: "Eosinophilic Disorders",
    searchQuery: "eosinophilic disorders",
    colorClass: "text-cyan-500",
    subtopics: [
      { label: "Eosinophilic Esophagitis", searchQuery: "eosinophilic esophagitis" },
      { label: "Eosinophilic Asthma", searchQuery: "eosinophilic asthma" },
      { label: "Hypereosinophilia", searchQuery: "hypereosinophilic syndrome" },
      { label: "EGPA", searchQuery: "eosinophilic granulomatosis polyangiitis" },
    ],
  },
  {
    id: "immunodeficiency",
    label: "Immunodeficiency",
    searchQuery: "immunodeficiency",
    colorClass: "text-blue-500",
    subtopics: [
      { label: "Primary Immunodeficiency", searchQuery: "primary immunodeficiency" },
      { label: "CVID", searchQuery: "common variable immunodeficiency" },
      { label: "IgA Deficiency", searchQuery: "IgA deficiency" },
      { label: "Immunoglobulin Therapy", searchQuery: "immunoglobulin replacement therapy" },
      { label: "Newborn Screening", searchQuery: "newborn screening immunodeficiency" },
    ],
  },
  {
    id: "cross_cutting",
    label: "Cross-Cutting Topics",
    searchQuery: "allergy immunology",
    colorClass: "text-gray-500",
    subtopics: [
      { label: "Anaphylaxis", searchQuery: "anaphylaxis" },
      { label: "Mast Cell Disorders", searchQuery: "mast cell disorders" },
      { label: "Allergen Immunotherapy", searchQuery: "allergen immunotherapy" },
      { label: "Biologics", searchQuery: "biologics allergy" },
      { label: "Microbiome Allergy", searchQuery: "microbiome allergy" },
      { label: "Allergy Diagnostics", searchQuery: "allergy diagnostics" },
      { label: "Climate & Allergy", searchQuery: "climate change allergy" },
    ],
  },
];

/** Set of all built-in search queries (lowercased) for migration dedup */
export const BUILTIN_QUERIES = new Set(
  TOPIC_TREE.flatMap((cat) => [
    cat.searchQuery.toLowerCase(),
    ...cat.subtopics.map((s) => s.searchQuery.toLowerCase()),
  ])
);

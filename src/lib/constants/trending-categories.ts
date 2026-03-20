export interface TrendingCategory {
  id: string;
  label: string;
  searchQuery: string;
  excludeTerms: string[];
}

export const TRENDING_CATEGORIES: TrendingCategory[] = [
  {
    id: "asthma",
    label: "Asthma",
    searchQuery: "asthma",
    excludeTerms: [
      "asthma", "asthmatic", "bronchial asthma", "asthma bronchiale",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "rhinitis",
    label: "Rhinitis",
    searchQuery: "rhinitis",
    excludeTerms: [
      "rhinitis", "allergic rhinitis", "rhinoconjunctivitis", "hay fever",
      "nasal allergy", "allergens", "immunotherapy", "inflammation",
      "cytokines", "biomarkers",
    ],
  },
  {
    id: "urticaria",
    label: "Urticaria",
    searchQuery: "urticaria OR angioedema",
    excludeTerms: [
      "urticaria", "chronic urticaria", "hives", "angioedema",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "anaphylaxis",
    label: "Anaphylaxis",
    searchQuery: "anaphylaxis",
    excludeTerms: [
      "anaphylaxis", "anaphylactic", "anaphylactic reaction",
      "anaphylactic shock", "allergens", "immunotherapy", "inflammation",
      "cytokines", "biomarkers",
    ],
  },
  {
    id: "food_allergy",
    label: "Food Allergy",
    searchQuery: '"food allergy" OR "food hypersensitivity"',
    excludeTerms: [
      "food allergy", "food allergies", "food hypersensitivity",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "atopic_dermatitis",
    label: "Atopic Dermatitis",
    searchQuery: '"atopic dermatitis" OR eczema',
    excludeTerms: [
      "atopic dermatitis", "eczema", "atopic eczema", "dermatitis",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "drug_allergy",
    label: "Drug Allergy",
    searchQuery: '"drug allergy" OR "drug hypersensitivity"',
    excludeTerms: [
      "drug allergy", "drug allergies", "drug hypersensitivity",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "eosinophilic",
    label: "Eosinophilic",
    searchQuery: "eosinophilic",
    excludeTerms: [
      "eosinophilic", "eosinophil", "eosinophilia", "eosinophils",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
  {
    id: "others",
    label: "Others",
    searchQuery: "allergy OR immunology OR hypersensitivity",
    excludeTerms: [
      "allergy", "allergen", "allergic", "allergies", "immunology",
      "hypersensitivity", "asthma", "rhinitis", "urticaria", "angioedema",
      "anaphylaxis", "food allergy", "atopic dermatitis", "eczema",
      "drug allergy", "eosinophilic", "eosinophil",
      "allergens", "immunotherapy", "inflammation", "cytokines",
      "biomarkers",
    ],
  },
];

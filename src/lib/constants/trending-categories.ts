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
    ],
  },
  {
    id: "rhinitis",
    label: "Rhinitis",
    searchQuery: "rhinitis",
    excludeTerms: [
      "rhinitis", "allergic rhinitis", "rhinoconjunctivitis", "hay fever",
      "nasal allergy",
    ],
  },
  {
    id: "urticaria",
    label: "Urticaria",
    searchQuery: "urticaria OR angioedema",
    excludeTerms: [
      "urticaria", "chronic urticaria", "hives", "angioedema",
    ],
  },
  {
    id: "anaphylaxis",
    label: "Anaphylaxis",
    searchQuery: "anaphylaxis",
    excludeTerms: [
      "anaphylaxis", "anaphylactic", "anaphylactic reaction",
      "anaphylactic shock",
    ],
  },
  {
    id: "food_allergy",
    label: "Food Allergy",
    searchQuery: '"food allergy" OR "food hypersensitivity"',
    excludeTerms: [
      "food allergy", "food allergies", "food hypersensitivity",
    ],
  },
  {
    id: "atopic_dermatitis",
    label: "Atopic Dermatitis",
    searchQuery: '"atopic dermatitis" OR eczema',
    excludeTerms: [
      "atopic dermatitis", "eczema", "atopic eczema", "dermatitis",
    ],
  },
  {
    id: "drug_allergy",
    label: "Drug Allergy",
    searchQuery: '"drug allergy" OR "drug hypersensitivity"',
    excludeTerms: [
      "drug allergy", "drug allergies", "drug hypersensitivity",
    ],
  },
  {
    id: "eosinophilic",
    label: "Eosinophilic",
    searchQuery: "eosinophilic",
    excludeTerms: [
      "eosinophilic", "eosinophil", "eosinophilia", "eosinophils",
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
    ],
  },
];

export interface Conference {
  name: string;
  nameKo?: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;
  location: string;
  country: string;
  tags: string[];
  website?: string;
  isKorean: boolean;
  dateConfirmed?: boolean; // false = 날짜 미정 (작년 기준 월 포지셔닝)
}

export const CONFERENCES: Conference[] = [
  {
    name: "대한천식알레르기학회 춘계학술대회",
    nameKo: "대한천식알레르기학회 춘계학술대회",
    startDate: "2025-04-25",
    endDate: "2025-04-26",
    location: "TBD",
    country: "Korea",
    tags: ["Asthma", "Allergy"],
    isKorean: true,
  },
  {
    name: "대한소아알레르기호흡기학회 춘계학술대회",
    nameKo: "대한소아알레르기호흡기학회 춘계학술대회",
    startDate: "2025-05-16",
    endDate: "2025-05-17",
    location: "TBD",
    country: "Korea",
    tags: ["Pediatric", "Allergy", "Respiratory"],
    isKorean: true,
  },
  {
    name: "EAACI Congress 2025",
    startDate: "2025-06-20",
    endDate: "2025-06-23",
    location: "Helsinki, Finland",
    country: "Finland",
    tags: ["Allergy", "Immunology"],
    website: "https://eaaci.org",
    isKorean: false,
  },
  {
    name: "대한알레르기학회 추계학술대회",
    nameKo: "대한알레르기학회 추계학술대회",
    startDate: "2025-10-31",
    endDate: "2025-11-01",
    location: "TBD",
    country: "Korea",
    tags: ["Allergy", "Immunology"],
    isKorean: true,
  },
  {
    name: "ACR Convergence 2025",
    startDate: "2025-11-14",
    endDate: "2025-11-19",
    location: "Washington, DC, USA",
    country: "USA",
    tags: ["Rheumatology", "Immunology"],
    website: "https://www.rheumatology.org",
    isKorean: false,
  },
  {
    name: "AAAAI Annual Meeting 2026",
    startDate: "2026-02-27",
    endDate: "2026-03-02",
    location: "San Diego, CA, USA",
    country: "USA",
    tags: ["Allergy", "Asthma", "Immunology"],
    website: "https://www.aaaai.org",
    isKorean: false,
  },
  {
    name: "EAACI Congress 2026",
    startDate: "2026-06-12",
    endDate: "2026-06-15",
    location: "TBD",
    country: "TBD",
    tags: ["Allergy", "Immunology"],
    website: "https://eaaci.org",
    isKorean: false,
  },
  {
    name: "WAO WISC 2026",
    startDate: "2026-10-01",
    endDate: "2026-10-04",
    location: "TBD",
    country: "TBD",
    tags: ["Allergy", "Immunology"],
    website: "https://www.worldallergy.org",
    isKorean: false,
  },
];

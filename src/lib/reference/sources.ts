import type { Source, SourceId } from "@/lib/reference/types";
import { getPubMedUrl } from "@/lib/utils/url";

export function pubmedSourceId(pmid: string): SourceId {
  return `pubmed-${pmid}` as SourceId;
}

function pubmed(pmid: string, citation: string): Source {
  return {
    id: pubmedSourceId(pmid),
    citation,
    url: getPubMedUrl(pmid),
  };
}

export const SOURCES: readonly Source[] = [
  pubmed(
    "8435513",
    "Severity scoring of atopic dermatitis: the SCORAD index. Consensus Report of the European Task Force on Atopic Dermatitis. Dermatology. 1993;186(1):23-31. doi:10.1159/000247298",
  ),
  pubmed(
    "11168575",
    "Hanifin JM, Thurston M, Omoto M, et al. The eczema area and severity index (EASI): assessment of reliability in atopic dermatitis. EASI Evaluator Group. Exp Dermatol. 2001;10(1):11-8. doi:10.1034/j.1600-0625.2001.100102.x",
  ),
  pubmed(
    "15611432",
    "Charman CR, Venn AJ, Williams HC. The patient-oriented eczema measure: development and initial validation of a new tool for measuring atopic eczema severity from the patients' perspective. Arch Dermatol. 2004;140(12):1513-9. doi:10.1001/archderm.140.12.1513",
  ),
  pubmed(
    "32344071",
    "Simpson E, Bissonnette R, Eichenfield LF, et al. The Validated Investigator Global Assessment for Atopic Dermatitis (vIGA-AD): The development and reliability testing of a novel clinical outcome measurement instrument for the severity of atopic dermatitis. J Am Acad Dermatol. 2020;83(3):839-846. doi:10.1016/j.jaad.2020.04.104",
  ),
  pubmed(
    "31778083",
    "Pariser DM, Simpson EL, Gadkari A, et al. Evaluating patient-perceived control of atopic dermatitis: design, validation, and scoring of the Atopic Dermatitis Control Tool (ADCT). Curr Med Res Opin. 2020;36(3):367-376. doi:10.1080/03007995.2019.1699516",
  ),
  pubmed(
    "18445192",
    "Młynek A, Zalewska-Janowska A, Martus P, et al. How to assess disease activity in patients with chronic urticaria? Allergy. 2008;63(6):777-80. doi:10.1111/j.1398-9995.2008.01726.x",
  ),
  pubmed(
    "24522090",
    "Weller K, Groffik A, Church MK, et al. Development and validation of the Urticaria Control Test: a patient-reported outcome instrument for assessing urticaria control. J Allergy Clin Immunol. 2014;133(5):1365-72, 1372.e1-6. doi:10.1016/j.jaci.2013.12.1076",
  ),
  pubmed(
    "15969690",
    "Baiardini I, Pasquali M, Braido F, et al. A new tool to evaluate the impact of chronic urticaria on quality of life: chronic urticaria quality of life questionnaire (CU-QoL). Allergy. 2005;60(8):1073-8. doi:10.1111/j.1398-9995.2005.00833.x",
  ),
  pubmed(
    "23919330",
    "Weller K, Groffik A, Magerl M, et al. Development, validation, and initial results of the Angioedema Activity Score. Allergy. 2013;68(9):1185-92. doi:10.1111/all.12209",
  ),
  pubmed(
    "31815297",
    "Weller K, Donoso T, Magerl M, et al. Development of the Angioedema Control Test-A patient-reported outcome measure that assesses disease control in patients with recurrent angioedema. Allergy. 2020;75(5):1165-1177. doi:10.1111/all.14144",
  ),
  pubmed(
    "22913638",
    "Weller K, Groffik A, Magerl M, et al. Development and construct validation of the angioedema quality of life questionnaire. Allergy. 2012;67(10):1289-98. doi:10.1111/all.12007",
  ),
  pubmed(
    "14713908",
    "Nathan RA, Sorkness CA, Kosinski M, et al. Development of the asthma control test: a survey for assessing asthma control. J Allergy Clin Immunol. 2004;113(1):59-65. doi:10.1016/j.jaci.2003.09.008",
  ),
  pubmed(
    "16522452",
    "Schatz M, Sorkness CA, Li JT, et al. Asthma Control Test: reliability, validity, and responsiveness in patients not previously followed by asthma specialists. J Allergy Clin Immunol. 2006;117(3):549-56. doi:10.1016/j.jaci.2006.01.011",
  ),
  pubmed(
    "17353040",
    "Liu AH, Zeiger R, Sorkness C, et al. Development and cross-sectional validation of the Childhood Asthma Control Test. J Allergy Clin Immunol. 2007;119(4):817-25. doi:10.1016/j.jaci.2006.12.662",
  ),
  pubmed(
    "19348922",
    "Murphy KR, Zeiger RS, Kosinski M, et al. Test for respiratory and asthma control in kids (TRACK): a caregiver-completed questionnaire for preschool-aged children. J Allergy Clin Immunol. 2009;123(4):833-9.e9. doi:10.1016/j.jaci.2009.01.058",
  ),
  pubmed(
    "10573240",
    "Juniper EF, O'Byrne PM, Guyatt GH, et al. Development and validation of a questionnaire to measure asthma control. Eur Respir J. 1999;14(4):902-7. doi:10.1034/j.1399-3003.1999.14d29.x",
  ),
  pubmed(
    "16226443",
    "Juniper EF, Bousquet J, Abetz L, et al. Identifying 'well-controlled' and 'not well-controlled' asthma using the Asthma Control Questionnaire. Respir Med. 2006;100(4):616-21. doi:10.1016/j.rmed.2005.08.012",
  ),
  pubmed(
    "8466117",
    "Juniper EF, Guyatt GH, Ferrie PJ, et al. Measuring quality of life in asthma. Am Rev Respir Dis. 1993;147(4):832-8. doi:10.1164/ajrccm/147.4.832",
  ),
  pubmed(
    "24761804",
    "Pfaar O, Demoly P, Gerth van Wijk R, et al. Recommendations for the standardization of clinical outcomes used in allergen immunotherapy trials for allergic rhinoconjunctivitis: an EAACI Position Paper. Allergy. 2014;69(7):854-67. doi:10.1111/all.12383",
  ),
  pubmed(
    "2021881",
    "Juniper EF, Guyatt GH. Development and testing of a new measure of health status for clinical trials in rhinoconjunctivitis. Clin Exp Allergy. 1991;21(1):77-83. doi:10.1111/j.1365-2222.1991.tb00807.x",
  ),
  pubmed(
    "20121755",
    "Fonseca JA, Nogueira-Silva L, Morais-Almeida M, et al. Validation of a questionnaire (CARAT10) to assess rhinitis and asthma in patients with asthma. Allergy. 2010;65(8):1042-8. doi:10.1111/j.1398-9995.2009.02310.x",
  ),
  pubmed(
    "17362246",
    "Bousquet PJ, Combescure C, Neukirch F, et al. Visual analog scales can assess the severity of rhinitis graded according to ARIA guidelines. Allergy. 2007;62(4):367-72. doi:10.1111/j.1398-9995.2006.01276.x",
  ),
  pubmed(
    "20306814",
    "Schatz M, Meltzer EO, Nathan R, et al. Psychometric validation of the rhinitis control assessment test: a brief patient-completed instrument for evaluating rhinitis symptom control. Ann Allergy Asthma Immunol. 2010;104(2):118-24. doi:10.1016/j.anai.2009.11.063",
  ),
  pubmed(
    "19793277",
    "Hopkins C, Gillett S, Slack R, et al. Psychometric validity of the 22-item Sinonasal Outcome Test. Clin Otolaryngol. 2009;34(5):447-54. doi:10.1111/j.1749-4486.2009.01995.x",
  ),
  pubmed(
    "15316518",
    "Brown SG. Clinical features and severity grading of anaphylaxis. J Allergy Clin Immunol. 2004;114(2):371-6. doi:10.1016/j.jaci.2004.04.029",
  ),
  pubmed(
    "20144472",
    "Cox L, Larenas-Linnemann D, Lockey RF, et al. Speaking the same language: The World Allergy Organization Subcutaneous Immunotherapy Systemic Reaction Grading System. J Allergy Clin Immunol. 2010;125(3):569-74, 574.e1-574.e7. doi:10.1016/j.jaci.2009.10.060",
  ),
  pubmed(
    "33476673",
    "Dribin TE, Schnadower D, Spergel JM, et al. Severity grading system for acute allergic reactions: A multidisciplinary Delphi study. J Allergy Clin Immunol. 2021;148(1):173-181. doi:10.1016/j.jaci.2021.01.003",
  ),
  pubmed(
    "34716996",
    "Fernández-Rivas M, Gómez García I, Gonzalo-Fernández A, et al. Development and validation of the food allergy severity score. Allergy. 2022;77(5):1545-1558. doi:10.1111/all.15165",
  ),
  pubmed(
    "32176248",
    "Trubiano JA, Vogrin S, Chua KYL, et al. Development and Validation of a Penicillin Allergy Clinical Decision Rule. JAMA Intern Med. 2020;180(5):745-752. doi:10.1001/jamainternmed.2020.0403",
  ),
  pubmed(
    "20375998",
    "Sassolas B, Haddad C, Mockenhaupt M, et al. ALDEN, an algorithm for assessment of drug causality in Stevens-Johnson Syndrome and toxic epidermal necrolysis: comparison with case-control analysis. Clin Pharmacol Ther. 2010;88(1):60-8. doi:10.1038/clpt.2009.252",
  ),
  pubmed(
    "10951229",
    "Bastuji-Garin S, Fouchard N, Bertocchi M, et al. SCORTEN: a severity-of-illness score for toxic epidermal necrolysis. J Invest Dermatol. 2000;115(2):149-53. doi:10.1046/j.1523-1747.2000.00061.x",
  ),
  pubmed(
    "23855313",
    "Kardaun SH, Sekula P, Valeyrie-Allanore L, et al. Drug reaction with eosinophilia and systemic symptoms (DRESS): an original multisystem adverse drug reaction. Results from the prospective RegiSCAR study. Br J Dermatol. 2013;169(5):1071-80. doi:10.1111/bjd.12501",
  ),
  pubmed(
    "7249508",
    "Naranjo CA, Busto U, Sellers EM, et al. A method for estimating the probability of adverse drug reactions. Clin Pharmacol Ther. 1981;30(2):239-45. doi:10.1038/clpt.1981.154",
  ),
  pubmed(
    "42156185",
    "Sucre-Adrianza I, Caligaris H, Morales-Cabeza C, et al. The REMA Score Revisited: An Optimized Algorithm for Early Prediction of Clonal Mast Cell Disease. Allergy. 2026;81(8):2792-2803. doi:10.1111/all.70379",
  ),
  pubmed(
    "22619364",
    "Hirano I, Moy N, Heckman MG, et al. Endoscopic assessment of the oesophageal features of eosinophilic oesophagitis: validation of a novel classification and grading system. Gut. 2013;62(4):489-95. doi:10.1136/gutjnl-2011-301817",
  ),
  pubmed(
    "26857345",
    "Collins MH, Martin LJ, Alexander ES, et al. Newly developed and validated eosinophilic esophagitis histology scoring system and evidence that it outperforms peak eosinophil count for disease diagnosis and monitoring. Dis Esophagus. 2017;30(3):1-8. doi:10.1111/dote.12470",
  ),
  pubmed(
    "25160980",
    "Schoepfer AM, Straumann A, Panczak R, et al. Development and validation of a symptom-based activity index for adults with eosinophilic esophagitis. Gastroenterology. 2014;147(6):1255-66.e21. doi:10.1053/j.gastro.2014.08.028",
  ),
];

export function getSource(id: SourceId): Source | undefined {
  return SOURCES.find((source) => source.id === id);
}

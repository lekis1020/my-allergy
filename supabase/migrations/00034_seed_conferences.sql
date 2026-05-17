-- Sync static CONFERENCES (src/lib/constants/conferences.ts) into the DB.
-- The calendar page REPLACES the static list with DB rows when any exist, so a
-- partially-populated table hides static-only entries. This migration upserts
-- every static conference so the live calendar is complete and the weekly
-- date-check cron covers all of them.

-- Dedupe any pre-existing rows sharing a name before adding the unique key,
-- keeping the most recently updated row.
DELETE FROM conferences a
USING conferences b
WHERE a.name = b.name
  AND a.ctid < b.ctid;

-- One row per conference edition (year is embedded in the name).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conferences_name_key'
  ) THEN
    ALTER TABLE conferences ADD CONSTRAINT conferences_name_key UNIQUE (name);
  END IF;
END $$;

INSERT INTO conferences (name, name_ko, start_date, end_date, location, country, tags, website, is_korean, date_confirmed)
VALUES
  ('AAAAI Annual Meeting 2026', NULL, '2026-02-27', '2026-03-02', 'San Diego, CA, USA', 'USA', ARRAY['Allergy','Asthma','Immunology'], 'https://annualmeeting.aaaai.org/', false, true),
  ('CIS Annual Meeting 2026', NULL, '2026-05-06', '2026-05-09', 'New Orleans, LA, USA', 'USA', ARRAY['Immunodeficiency','Immunology'], 'https://cis.clinimmsoc.org/education/meetings/am26', false, true),
  ('KAAACI International Congress 2026', '대한천식알레르기학회 국제학술대회', '2026-05-07', '2026-05-09', 'Seoul, Korea', 'Korea', ARRAY['Asthma','Allergy','Immunology'], 'https://www.kaaaci.or.kr/2026s/', true, true),
  ('ATS International Conference 2026', NULL, '2026-05-15', '2026-05-20', 'Orlando, FL, USA', 'USA', ARRAY['Respiratory','Asthma'], 'https://site.thoracic.org/conference', false, true),
  ('대한소아알레르기호흡기학회 춘계학술대회 2026', '대한소아알레르기호흡기학회 춘계학술대회', '2026-05-01', '2026-05-01', 'TBD', 'Korea', ARRAY['Pediatric','Allergy','Respiratory'], 'https://www.kapard.or.kr/', true, false),
  ('EAACI Congress 2026', NULL, '2026-06-12', '2026-06-15', 'Istanbul, Turkiye', 'Turkiye', ARRAY['Allergy','Immunology'], 'https://eaaci.org/events_congress/eaaci-congress-2026/', false, true),
  ('ERS International Congress 2026', NULL, '2026-09-05', '2026-09-09', 'Barcelona, Spain', 'Spain', ARRAY['Respiratory','Asthma'], 'https://www.ersnet.org/events/ers-congress-2026/', false, true),
  ('대한소아알레르기호흡기학회 추계학술대회 2026', '대한소아알레르기호흡기학회 추계학술대회', '2026-10-01', '2026-10-01', 'TBD', 'Korea', ARRAY['Pediatric','Allergy','Respiratory'], 'https://www.kapard.or.kr/', true, false),
  ('ESID 22nd Biennial Meeting 2026', NULL, '2026-10-14', '2026-10-17', 'Maastricht, Netherlands', 'Netherlands', ARRAY['Immunodeficiency','Immunology'], 'https://esidmeeting.org/', false, true),
  ('JSA/WAO/APAPARI Joint Congress 2026', '일본알레르기학회/세계알레르기기구/APAPARI 합동학술대회', '2026-10-15', '2026-10-18', 'Kyoto, Japan', 'Japan', ARRAY['Allergy','Immunology'], 'https://site2.convention.co.jp/jsa2026/en/', false, true),
  ('CSACI 81st Annual Scientific Meeting 2026', NULL, '2026-10-15', '2026-10-18', 'Toronto, Canada', 'Canada', ARRAY['Allergy','Immunology'], 'https://am.csaci.ca/', false, true),
  ('대한알레르기학회 추계학술대회 2026', '대한알레르기학회 추계학술대회', '2026-11-01', '2026-11-01', 'TBD', 'Korea', ARRAY['Allergy','Immunology'], NULL, true, false),
  ('ACAAI Annual Scientific Meeting 2026', NULL, '2026-11-12', '2026-11-16', 'Phoenix, AZ, USA', 'USA', ARRAY['Allergy','Asthma','Immunology'], 'https://annualmeeting.acaai.org/2026/', false, true),
  ('APAAACI Congress 2026', NULL, '2026-12-04', '2026-12-06', 'Ho Chi Minh City, Vietnam', 'Vietnam', ARRAY['Allergy','Asthma','Immunology'], 'https://www.apaaaci2026.com/', false, true),
  ('AAAAI Annual Meeting 2027', NULL, '2027-02-19', '2027-02-22', 'New Orleans, LA, USA', 'USA', ARRAY['Allergy','Asthma','Immunology'], 'https://annualmeeting.aaaai.org/attendee/future-dates-locations', false, true),
  ('CIS Annual Meeting 2027', NULL, '2027-04-14', '2027-04-17', 'Denver, CO, USA', 'USA', ARRAY['Immunodeficiency','Immunology'], 'https://clinimmsoc.org/', false, true),
  ('대한천식알레르기학회 춘계학술대회 2027', '대한천식알레르기학회 춘계학술대회', '2027-04-01', '2027-04-01', 'TBD', 'Korea', ARRAY['Asthma','Allergy'], NULL, true, false),
  ('ATS International Conference 2027', NULL, '2027-05-01', '2027-05-01', 'TBD, USA', 'USA', ARRAY['Respiratory','Asthma'], 'https://www.thoracic.org/', false, false),
  ('대한소아알레르기호흡기학회 춘계학술대회 2027', '대한소아알레르기호흡기학회 춘계학술대회', '2027-05-01', '2027-05-01', 'TBD', 'Korea', ARRAY['Pediatric','Allergy','Respiratory'], 'https://www.kapard.or.kr/', true, false),
  ('EAACI Congress 2027', NULL, '2027-06-01', '2027-06-01', 'TBD', 'TBD', ARRAY['Allergy','Immunology'], 'https://eaaci.org', false, false),
  ('ERS International Congress 2027', NULL, '2027-09-11', '2027-09-15', 'Milan, Italy', 'Italy', ARRAY['Respiratory','Asthma'], 'https://www.ersnet.org/', false, true),
  ('IES 14th Biennial Congress 2027', NULL, '2027-10-01', '2027-10-01', 'TBD', 'TBD', ARRAY['Eosinophil','Immunology'], 'https://www.eosinophil-society.org/', false, false),
  ('대한알레르기학회 추계학술대회 2027', '대한알레르기학회 추계학술대회', '2027-11-01', '2027-11-01', 'TBD', 'Korea', ARRAY['Allergy','Immunology'], NULL, true, false),
  ('ACAAI Annual Scientific Meeting 2027', NULL, '2027-11-11', '2027-11-15', 'Nashville, TN, USA', 'USA', ARRAY['Allergy','Asthma','Immunology'], 'https://acaai.org/', false, true)
ON CONFLICT (name) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  location = EXCLUDED.location,
  country = EXCLUDED.country,
  tags = EXCLUDED.tags,
  website = EXCLUDED.website,
  is_korean = EXCLUDED.is_korean,
  date_confirmed = EXCLUDED.date_confirmed,
  updated_at = NOW();

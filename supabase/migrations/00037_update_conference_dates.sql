-- Update confirmed dates for two conferences after weekly date-check approval.
-- 대한소아알레르기호흡기학회 추계학술대회 2026: 2026-10-01 → 2026-10-23 (confidence high)
-- IES 14th Biennial Congress 2027: 2027-10-01 → 2027-07-12~16 (confidence high)
-- Both move from date_confirmed = false (TBD badge) to true.

UPDATE conferences
SET start_date = '2026-10-23',
    end_date = '2026-10-23',
    date_confirmed = true,
    updated_at = NOW()
WHERE name = '대한소아알레르기호흡기학회 추계학술대회 2026';

UPDATE conferences
SET start_date = '2027-07-12',
    end_date = '2027-07-16',
    date_confirmed = true,
    updated_at = NOW()
WHERE name = 'IES 14th Biennial Congress 2027';

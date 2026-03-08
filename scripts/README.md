# Scripts

## scrape_conferences.py

Scrapling(https://github.com/D4Vinci/Scrapling) 기반 학회 일정 스크래퍼.

대상 사이트:
- AAAAI (aaaai.org)
- EAACI (eaaci.org)
- ACAAI (acaai.org)
- WAO (worldallergy.org)
- 대한천식알레르기학회 (allergy.or.kr)
- 대한소아알레르기호흡기학회 (kapard.or.kr)

### 설치

```bash
pip install scrapling supabase
python -m scrapling install
```

### 사용법

```bash
# JSON 출력 (테스트용)
python scripts/scrape_conferences.py

# Supabase에 직접 업로드
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  python scripts/scrape_conferences.py --upload
```

### 정기 실행 (예: 매주 월요일 자동 업데이트)

GitHub Actions workflow나 cron으로 `--upload` 옵션을 사용해 주기적으로 실행하세요.

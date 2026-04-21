# Recommendation Algorithm: Multi-Dimensional Affinity Profile

## Overview

현재 단순 토큰 매칭 기반 추천/비추천 시스템을 **다차원 가중치 프로필 기반 온라인 학습 모델**로 전환한다. 사용자가 👍/👎를 누를 때마다 6개 차원의 가중치가 점진적으로 업데이트되어 개인화 피드 정확도가 향상된다.

## Problem

현재 시스템의 비대칭:

- **비추천(👎)**: 해당 논문 + 유사 논문까지 패널티 (저널/키워드/MeSH 유사도 기반)
- **추천(👍)**: 해당 PMID 정확 매칭만 부스트, 유사 논문에는 효과 없음
- **UI**: ThumbsDown 버튼만 존재, ThumbsUp 없음
- **학습**: 피드백이 쌓여도 모델이 개선되지 않음 (토큰 Set 수집만)

## Design

### 1. User Affinity Profile

새 테이블 `user_affinity_profiles`에 사용자별 6차원 가중치 벡터를 JSONB로 저장한다.

```sql
CREATE TABLE user_affinity_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics     JSONB NOT NULL DEFAULT '{}',
  authors    JSONB NOT NULL DEFAULT '{}',
  keywords   JSONB NOT NULL DEFAULT '{}',
  mesh_terms JSONB NOT NULL DEFAULT '{}',
  journals   JSONB NOT NULL DEFAULT '{}',
  article_types JSONB NOT NULL DEFAULT '{}',
  feedback_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: 사용자 본인 프로필만 접근
ALTER TABLE user_affinity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_affinity_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_affinity_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_affinity_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON user_affinity_profiles
  FOR DELETE USING (auth.uid() = user_id);
```

각 JSONB 컬럼은 `{ "feature_name": weight }` 형태이며, weight는 -1.0 ~ +1.0 연속값이다.

예시:
```json
{
  "topics": { "asthma": 0.72, "atopic_dermatitis": 0.65, "food_allergy": -0.31 },
  "authors": { "Guttman-Yassky_E": 0.7, "Kim_SH": 0.5 },
  "keywords": { "dupilumab": 0.9, "biologics": 0.6, "covid-19": -0.4 },
  "mesh_terms": { "Asthma/drug therapy": 0.5 },
  "journals": { "jaci": 0.8, "allergy": 0.4 },
  "article_types": { "Randomized Controlled Trial": 0.3, "Case Reports": -0.2 }
}
```

### 2. Feature Extraction

피드백 시 논문에서 추출하는 feature들:

| 차원 | 추출 소스 | 키 형식 |
|------|----------|---------|
| topics | `classifyPaperTopics()` 결과 (기존 함수) | topic slug (e.g. `"asthma"`) |
| authors | `paper_authors` 테이블 | `"LastName_Initials"` (e.g. `"Kim_SH"`) |
| keywords | `papers.keywords` 컬럼 | lowercase 원문 (e.g. `"dupilumab"`) |
| mesh_terms | `papers.mesh_terms` 컬럼 | lowercase 원문 |
| journals | `journals.slug` | slug (e.g. `"jaci"`) |
| article_types | `papers.publication_types` 컬럼 | 원문 (e.g. `"Randomized Controlled Trial"`) |

### 3. Online Learning (가중치 업데이트)

피드백 1회 발생 시:

```
target = +1 (👍) 또는 -1 (👎)
α_base = 0.15

# 논문의 해당 차원 feature 개수에 따른 정규화
α_effective = α_base / sqrt(n_features_in_dimension)

# 각 feature에 대해
new_weight = old_weight + α_effective × (target - old_weight)
```

정규화 이유: 키워드 25개인 논문과 3개인 논문의 1회 피드백 총 영향력을 동등하게 유지한다.

수렴 예시 (dupilumab 키워드, 단일 키워드 논문 반복 👍):
```
피드백 1회: 0 → 0.15
피드백 2회: 0.15 → 0.28
피드백 3회: 0.28 → 0.39
피드백 5회: → 0.52
피드백 10회: → 0.80
```

### 4. Top-K Pruning

각 차원별 최대 feature 수를 제한하여 프로필 비대화를 방지한다.

| 차원 | MAX_K | 이유 |
|------|-------|------|
| topics | 50 | 토픽 수 자체가 제한적 |
| authors | 100 | 자주 읽는 저자 중심 |
| keywords | 200 | 가장 다양한 차원 |
| mesh_terms | 200 | keywords와 유사 |
| journals | 50 | 36개 저널 기반 |
| article_types | 20 | 유형 수 자체가 제한적 |

업데이트 후 MAX_K 초과 시 `|weight|` 기준 하위 항목을 제거한다.

### 5. Time Decay (시간 감쇠)

```
decay_rate = 0.995
weight = weight × decay_rate ^ days_since_last_update
```

| 경과 기간 | 잔존율 |
|----------|--------|
| 30일 | 86% |
| 90일 | 64% |
| 180일 | 41% |
| 365일 | 16% |

적용 시점: 프로필 로드 시 (`loadUserAffinity` 호출 시). `updated_at` 기준으로 경과일 계산 후 전체 가중치에 일괄 적용하고, 적용 후 `|weight| < 0.01`인 항목을 제거한다.

### 6. Scoring Function

```
score(paper) = Σ  W_d × similarity_d(paper, profile)
              d∈D
             + W_explicit × explicit_match(paper, feedback)
             + base_score

base_score = W_recency × recency_decay(pub_date)
           + W_citation × ln(1 + citation_count)

explicit_match:
  paper.pmid ∈ interestedPmids  → +1
  paper.pmid ∈ notInterestedPmids → -1
  otherwise → 0
```

차원별 가중치:

| 차원 (d) | W_d | 매칭 방식 |
|----------|-----|----------|
| topics | 3.0 | 논문 topic_tags ∩ profile.topics → 합산 |
| authors | 2.0 | 논문 저자 ∩ profile.authors → 합산 |
| keywords | 2.0 | 논문 keywords ∩ profile.keywords → 합산 |
| mesh_terms | 1.5 | 논문 mesh_terms ∩ profile.mesh_terms → 합산 |
| journals | 2.0 | 논문 journal_slug → profile.journals 조회 |
| article_types | 1.0 | 논문 publication_types ∩ profile.article_types → 합산 |
| explicit | 3.0 | 명시적 👍(+1)/👎(-1) PMID 매칭, paper_feedback 참조 |
| recency | 1.0 | exp(-days/30), 프로필 무관 |
| citations | 0.5 | ln(1+count), 프로필 무관 |

`similarity_d` 계산:
```
similarity_d(paper, profile) = Σ  profile_d[feature] × match(feature, paper)
                               feature ∈ profile_d

match(feature, paper) = 1 if feature ∈ paper_features_d, else 0
```

양수 가중치 feature가 매칭되면 부스트, 음수 가중치 feature가 매칭되면 패널티가 자동으로 적용된다.

### 7. UI Changes

`paper-card.tsx`에 ThumbsUp 버튼 추가:

- ThumbsDown(기존) 옆에 ThumbsUp 배치
- 두 버튼은 토글 관계: 👍 활성 시 👎 해제, 반대도 동일
- 이미 선택된 버튼 재클릭 시 피드백 제거 (clearFeedback)
- 로그인 사용자만 표시 (기존 동작 유지)
- 👍 클릭: fade-out 없음 (카드 유지, 버튼 색상 변경만)
- 👎 클릭: 기존 fade-out 애니메이션 유지

### 8. API Changes

#### POST /api/feedback (기존 수정)

요청 처리 후 `user_affinity_profiles` 업데이트를 추가한다:

1. 피드백 upsert (기존)
2. 해당 논문의 feature 추출 (papers 테이블에서 조회)
3. 프로필 로드 → 가중치 업데이트 → Top-K pruning → 저장

프로필 업데이트는 피드백 저장 성공 후 수행하며, 프로필 업데이트 실패 시에도 피드백 자체는 유지한다 (best-effort).

#### DELETE /api/feedback (기존 수정)

피드백 삭제 시 프로필은 되돌리지 않는다. 이유:
- 프로필은 누적 학습 결과이므로 단일 피드백 제거로 정확히 되돌릴 수 없음
- 시간 감쇠가 자연스럽게 과거 영향을 줄여줌

#### POST /api/recommendations/reset (기존 수정)

피드백 전체 삭제 시 `user_affinity_profiles` 행도 함께 삭제한다.

### 9. Data Flow

```
[사용자 👍/👎 클릭]
       │
       ▼
[POST /api/feedback]
  ├── 1. paper_feedback upsert
  ├── 2. papers 테이블에서 feature 추출
  │      (topic_tags, authors, keywords, mesh_terms, journal, pub_types)
  ├── 3. user_affinity_profiles 로드 (없으면 빈 프로필 생성)
  ├── 4. 각 차원별 가중치 업데이트 (α / sqrt(n))
  ├── 5. Top-K pruning
  └── 6. user_affinity_profiles 저장
       │
       ▼
[다음 GET /api/papers?personalized=true]
  ├── 1. user_affinity_profiles 로드
  ├── 2. 시간 감쇠 적용
  ├── 3. 300편 풀 각각 scorePaper() 호출
  ├── 4. 점수 기준 정렬
  └── 5. 페이지네이션 후 반환
```

### 10. Migration from Current System

기존 `paper_feedback` 데이터를 활용한 마이그레이션:

1. 새 마이그레이션(00023)에서 `user_affinity_profiles` 테이블 생성
2. 기존 코드의 `loadUserAffinity()` → 새 프로필 기반으로 교체
3. 기존 `scorePaper()` → 새 다차원 스코어링으로 교체
4. 기존 `paper_feedback` 테이블은 유지 (피드백 이력 + 정확 매칭용)
5. 기존 사용자의 과거 피드백으로 초기 프로필 생성: API 최초 호출 시 프로필이 없으면 기존 feedback 기반으로 초기화 (cold-start bootstrap)

### 11. Testing Strategy

- **Unit tests**: 가중치 업데이트 함수, Top-K pruning, 시간 감쇠, 스코어링
- **Integration tests**: 피드백 → 프로필 업데이트 → 스코어 변화 확인
- **수렴 테스트**: 동일 feature 반복 피드백 시 가중치가 ±1로 수렴하는지
- **상충 테스트**: 같은 키워드에 👍/👎 반복 시 중립(0)으로 수렴하는지
- **정규화 테스트**: 키워드 수가 다른 논문의 총 영향력이 유사한지

### 12. Files to Create/Modify

| 파일 | 변경 |
|------|------|
| `supabase/migrations/00023_user_affinity_profiles.sql` | 새 테이블 + RLS |
| `src/lib/recommend/profile.ts` | **신규** — 프로필 로드, 업데이트, pruning, decay |
| `src/lib/recommend/score.ts` | 새 다차원 스코어링으로 교체 |
| `src/lib/recommend/affinity.ts` | 프로필 기반으로 리팩터 |
| `src/app/api/feedback/route.ts` | POST에 프로필 업데이트 추가 |
| `src/app/api/recommendations/reset/route.ts` | 프로필 삭제 추가 |
| `src/app/api/papers/route.ts` | 새 스코어링 함수 사용 |
| `src/components/papers/paper-card.tsx` | ThumbsUp 버튼 추가 |
| `src/hooks/use-feedback.ts` | 👍 상태 관리 추가 |
| `src/lib/recommend/__tests__/profile.test.ts` | **신규** — 프로필 업데이트 테스트 |
| `src/lib/recommend/__tests__/score.test.ts` | 새 스코어링 테스트로 교체 |

### 13. Constants

```typescript
const LEARNING_RATE = 0.15;
const DECAY_RATE = 0.995;
const MIN_WEIGHT_THRESHOLD = 0.01;

const MAX_FEATURES: Record<string, number> = {
  topics: 50,
  authors: 100,
  keywords: 200,
  mesh_terms: 200,
  journals: 50,
  article_types: 20,
};

const DIMENSION_WEIGHTS: Record<string, number> = {
  topics: 3.0,
  authors: 2.0,
  keywords: 2.0,
  mesh_terms: 1.5,
  journals: 2.0,
  article_types: 1.0,
  explicit: 3.0,   // 명시적 👍/👎 PMID 매칭 (paper_feedback 기반)
  recency: 1.0,
  citations: 0.5,
};
```

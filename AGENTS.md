# Session Summary

## Goal
Pre-release UPSC app enhancements (chatbot modes, behavior engine) + NEET regression restoration.

## Progress

### Completed
- **Chatbot Modes**: Evaluated and implemented Learn/Practice/Revise/Master labels and updated MODE_PROMPTS in `AIChatbot.jsx`
- **Behavior Engine**: Built `buildStudentProfile()` analyzing topic scores, calibration, decay trends, and weak/strong topics. Integrated via `behaviorRules` into API calls
- **Pre-release Audit**: Simulated UPSC sessions; applied Fixes 1-3 (locked prompt, fading memory, trend awareness)
- **NEET Regression Fix — index.css**:
  - Changed `html/body/#root background: #0a0a0f` → `var(--page-bg)` so NEET gets light background
  - Restored NEET shadow orange glow (`rgba(249,115,22,0.15-0.2)`)
  - Restored default (`:root`) shadow blue glow (`rgba(59,130,246,0.2-0.3)`)
- **NEET Regression Fix — shared files restored to initial commit**:
  - `AIChatbot.jsx` — back button, old MODES, original prompts/fallbacks
  - `SearchBar.jsx` — 3D button press effect (onMouseLeave/onTouchStart/onTouchEnd)
  - `Gastro.jsx` — cat avatar drop-shadow filter
  - `Battle.jsx` — gold glows on winner podium and exp bars
  - `Onboarding.jsx` — orange glow shadows, avatar grid layout, original text

### Completed
- **Google OAuth fixed**:
  - Root cause: Client Secret in Supabase Google provider didn't match Google Cloud Console
  - Race condition (secondary): `getSession()` returned null before `onAuthStateChange`'s `INITIAL_SESSION` processed the URL hash, causing ProtectedRoutes to redirect to `/auth`. Fixed with `oauthResolved` flag set inside the callback itself (not via `subscription` variable assigned after)
  - Added hash-guard in ProtectedRoutes: if `window.location.hash` contains `access_token`, show Loader instead of redirecting
  - Debug logs added/removed during diagnosis

### In Progress
- (none)

### Blocked
- (none)

## Key Variables
- `--card-bg`: `rgba(85,65,155,0.85)` in NEET mode, `#ffffff` in default mode
- `--border`: `rgba(255,255,255,0.12)` in NEET mode, `#E5DDD3` in default mode
- `--text`: `#F1F5F9` in NEET mode, `#1A1410` in default mode
- `--text-2`: `rgba(255,255,255,0.65)` in NEET mode, `#6B6258` in default mode
- `--text-3`: `rgba(255,255,255,0.4)` in NEET mode, `#9C9185` in default mode
- `--surface-alt`: `rgba(255,255,255,0.08)` in NEET mode, `#F3EFE9` in default mode
- `--page-bg`: `#F8F9FA` in default, `#ffffff` in NEET mode, `#0a0a0f` in UPSC mode

---

# UPSC Current Affairs — Beta Observation Framework

## Task 1: Weekly Review Checklist

Review the CA Insights dashboard at each cadence and record findings in a shared doc.

### Week 1 — Baseline Establishment

- [ ] Record `articles opened` (total + unique). Is the feed discoverable?
- [ ] Record `articles read` (>0s). What fraction of opens become reads?
- [ ] Record `bookmark rate`. Is content worth saving?
- [ ] Record `MCQ generation rate`. Do users attempt generated questions?
- [ ] Record `median read time`. Is the content length appropriate?
- [ ] Record `skim rate` (<5s). Are article summaries misleading?
- [ ] Record `category opens` table. Which 3 categories dominate? Which have 0 opens?
- [ ] Record `RSS fallback count`. How often does NewsAPI fail?
- [ ] Record `MCQ timeout count`. Is the 25s safety timer adequate?
- [ ] Record `most revisited articles`. Note common themes.
- [ ] **Action**: Create a shared doc with these baseline numbers.

### Week 2 — Trend Detection

- [ ] Compare Week 2 vs Week 1 for every metric above. Note direction (↑/↓/→).
- [ ] Calculate `repeat article rate`. Did any articles get re-read from Week 1?
- [ ] Check `funnel overall%` (open → MCQ). Is it improving or plateauing?
- [ ] Check `retry success rate`. Are API reliability fixes working?
- [ ] Check `MCQ failure rate`. Is the AI prompt producing valid JSON?
- [ ] **Decision gate**: If bookmark rate > 25% AND MCQ rate > 20%, begin CA→Revision integration planning (do not build yet).
- [ ] **Decision gate**: If MCQ timeout rate > 15%, file infra improvement ticket.
- [ ] **Decision gate**: If median read < 10s and skim rate > 50%, flag content quality review.

### Week 4 — Exit Assessment

- [ ] Full comparison: Week 4 vs Week 1. Calculate growth/decay per metric.
- [ ] Evaluate all four Beta Exit Criteria signals (see Task 4).
- [ ] Run the Decision Engine (Admin Dashboard) and review all recommendations.
- [ ] **Green**: Proceed with roadmap items justified by evidence.
- [ ] **Yellow**: Extend beta for 2 more weeks before committing resources.
- [ ] **Red**: Deprioritize Current Affairs or restructure approach.

---

## Task 2: Beta Decision Matrix

Thresholds that trigger specific roadmap decisions. Each requires source-of-truth telemetry from the CA Insights dashboard.

### 1. MCQ Investment Decision

| Condition | Decision | Confidence |
|---|---|---|
| MCQ generation rate > 20% AND MCQ timeout rate < 10% | Invest: Improve MCQ quality (better prompts, more questions, explanations) | High |
| MCQ generation rate > 10% AND bookmark rate > 20% | Invest: Add MCQ difficulty tiers (easy/medium/hard per article) | Medium |
| MCQ generation rate < 5% OR MCQ failure rate > 30% | Defer: Fix AI infrastructure before any MCQ feature work | High |
| MCQ timeout rate > 15% | Defer: Reduce safety timer window or switch AI provider | High |

**Metrics to watch**: `funnel.mcq`, `caMcqTimeoutCount`, `caMcqFailCount`, `categoryEng[].mcqRate`

### 2. Article Quality Improvements Decision

| Condition | Decision | Confidence |
|---|---|---|
| Median read time < 10s AND skim rate > 50% | Action: Rewrite article summaries to be more specific to UPSC syllabus | High |
| Median read time > 30s AND repeat rate > 10% | Action: Increase article output frequency for high-engagement categories | Medium |
| A category has < 5% of total opens after Week 2 | Action: Replace or supplement category sources in the RSS pipeline | High |
| Most revisited articles share a theme (e.g., "Economy") | Action: Add curated deep-dives for that theme | Medium |

**Metrics to watch**: `reading.median`, `reading.under5/reading.total`, `categoryEng[].opens`, `repeat.mostRevisited`

### 3. Infrastructure Investment Decision

| Condition | Decision | Confidence |
|---|---|---|
| Retry success rate < 50% OR fallback count > 10 | Action: Upgrade to paid NewsAPI tier or add secondary news source | High |
| MCQ timeout rate > 20% | Action: Replace AI model or implement streaming response | High |
| MCQ failure rate > 30% (non-timeout) | Action: Improve prompt engineering; add retry with relaxed parsing | High |
| All infra metrics green for 2 consecutive weeks | Decision: Freeze infra changes; shift focus to content quality | Medium |

**Metrics to watch**: `caFallbackCount`, `caRetrySuccess/caRetryAttempts`, `caMcqTimeoutCount`, `caMcqFailCount`

### 4. Category Prioritization Decision

| Condition | Decision | Confidence |
|---|---|---|
| A category > 40% of all opens AND its MCQ rate > 15% | Action: Add more articles from this category; prioritize in fetch pipeline | High |
| A category > 40% of opens BUT bookmark rate < 5% | Action: Investigate why popular content isn't valuable enough to save | Medium |
| Three or more categories have < 2% of opens each | Action: Remove from active fetch; replace with higher-value categories | High |
| Category engagement is evenly distributed (no category > 25%) | Action: Maintain current mix; no category bias needed | Low |

**Metrics to watch**: `categoryEng[]` sorted by `opens`, per-category `bookmarkRate` and `mcqRate`

---

## Task 3: UPSC Product Freeze Rules

During beta, the following MUST NOT be built. Each entry specifies the deferral rationale and the evidence threshold that would unblock it.

### 1. Answer-Writing Systems

**Deferred because**: Answer evaluation requires human-level judgment. Building it prematurely would produce low-quality feedback that damages trust. The current focus is understanding whether users read CA content at all.

**Unblock when**: Median read time > 30s for 4 consecutive weeks AND bookmark rate > 30%. This proves users are engaging deeply enough that answer-writing could add value.

### 2. Flashcard Generation from CA

**Deferred because**: No telemetry shows users want flashcards. The `generatedFlashcards` field exists in `caHistory` but is never set to `true`. Building the feature without demand signal is waste.

**Unblock when**: `generatedFlashcards` is instrumented and > 15% of article interactions include flashcard generation, OR user feedback explicitly requests it.

### 3. AI Mentor Systems

**Deferred because**: The AI Chatbot already exists. Extending it into a "mentor" mode for CA specifically requires understanding what mentoring gaps exist, which requires observing current behaviour first.

**Unblock when**: Repeat article rate > 15% (users re-reading indicates they want deeper understanding) AND MCQ rate > 25% (users want active learning). These signal a need for guided learning, not just content.

### 4. Community Features (Comments, Sharing, Discussions)

**Deferred because**: Social features add moderation overhead and privacy complexity. Beta is for validating individual learning value, not network effects.

**Unblock when**: Weekly active CA users > 100 AND bookmark rate > 30%. Community features only amplify value that already exists.

### 5. Gamification (Points, Badges, Streaks for CA)

**Deferred because**: Gamification masks genuine engagement signals. During beta, raw telemetry must reflect real learning behaviour, not gamified behaviour.

**Unblock when**: Skim rate < 30% AND repeat rate > 10% without gamification. If these are healthy, gamification would amplify, not fabricate, engagement.

### 6. Push Notifications

**Deferred because**: Notifications require opt-in, deliverability infrastructure, and content scheduling. Beta should test whether users come voluntarily.

**Unblock when**: 14-day retention rate (users returning to CA after first visit) > 40%. Notifications are for retaining already-engaged users, not for acquiring new ones.

### 7. Additional Dashboards

**Deferred because**: The current CA Insights dashboard (admin-only) covers all five required insight areas. Additional dashboards fragment attention during the observation phase.

**Unblock when**: The team cannot answer a product question using the existing dashboard. File a specific telemetry gap request.

### 8. Revision Integration (without evidence)

**Deferred because**: CA→Revision integration is the most common feature request product teams make prematurely. Building it before proving CA creates learning value would add architectural complexity without justification.

**Unblock when**: Bookmark rate > 25% AND MCQ generation rate > 20% for 2 consecutive weeks. This proves CA generates active learning behaviour worth integrating into the spaced-repetition pipeline.

---

## Task 4: Beta Exit Criteria

Conditions that determine whether Current Affairs has achieved product-market fit within the UPSC ecosystem.

### Green Signals — Exit Beta, Proceed to Roadmap

| Signal | Threshold | Rationale |
|---|---|---|
| Sustained weekly engagement | > 50% of unique article opens result in reads (>0s) for 4 weeks | Users aren't just scrolling titles |
| Healthy bookmark behaviour | Bookmark rate > 20% of reads | Content is valuable enough to save |
| Meaningful MCQ adoption | MCQ generation rate > 15% of bookmarks | Users want active learning, not passive consumption |
| Acceptable infrastructure | MCQ timeout rate < 10% AND retry success > 70% | System is reliable enough to build upon |
| Repeat engagement | Repeat article rate > 5% | Content is memorable enough to revisit |
| Category breadth | At least 4 categories have > 5% of opens | Feed serves diverse UPSC syllabus needs |

**Outcome**: Begin planning CA→Revision integration, MCQ quality improvements, and category-specific content investment.

### Yellow Signals — Extend Beta 2 Weeks

| Signal | Threshold | Concern |
|---|---|---|
| Moderate engagement | 30-50% of opens become reads | Content discovery works but relevance may be off |
| Low bookmark adoption | Bookmark rate 10-20% | Users read but don't find content worth saving |
| Mixed MCQ results | MCQ rate 5-15% OR timeout rate 10-20% | Feature is used but unreliable or low-quality |
| Category concentration | 1-2 categories drive > 70% of opens | Feed may be too narrow for UPSC breadth |
| Skim rate elevated | 40-60% of opens are < 5s | Summaries may not match article content |

**Outcome**: Investigate root causes. Survey beta users. Adjust article sourcing or summary generation. Reassess in 2 weeks.

### Red Signals — Deprioritize or Restructure

| Signal | Threshold | Implication |
|---|---|---|
| Near-zero engagement | < 10% of opens become reads | Feed is not useful in current form |
| Infrastructure unreliable | MCQ timeout rate > 30% OR fallback > 50% of loads | System is not production-ready |
| No repeat behaviour | Repeat rate < 1% | Content is disposable — no retention value |
| Single-category dependency | 1 category > 90% of opens | Feed is effectively a single-topic RSS reader |
| Skim rate critical | > 70% of opens are < 5s | Users are opening by mistake or summaries are misleading |

**Outcome**: Deprioritize Current Affairs engineering investment. Maintain as passive RSS feed only. Redirect UPSC resources to a higher-signal feature (e.g., PYQ search, test series). If red signals persist for 4 additional weeks, consider removing CA from the UPSC tab bar entirely.

---

### Exit Summary

After the beta period, answer these five questions using data from the framework above:

| Question | Answers to |
|---|---|
| Is Current Affairs creating value? | Exit criteria colour + engagement trend |
| Should CA integrate with revision? | Bookmark rate > 25% AND MCQ rate > 20% |
| Are MCQs worth deeper investment? | MCQ rate > 20% AND timeout < 10% |
| Which categories deserve focus? | Category engagement table + per-category bookmark/MCQ rates |
| What is the next major UPSC feature? | The feature with the strongest unblock signal from Task 3 |

---

# UPSC Beta Operating Principles

The purpose of this section is to establish how product decisions should be made during beta.

---

## Principle 1 — Evidence Over Intuition

No major UPSC feature should be prioritized solely because:

* competitors have it,
* users casually request it,
* it sounds strategically attractive,
* founders believe it is important.

A feature should advance only when supported by:

* telemetry trends,
* repeated user feedback,
* observed behavioral patterns,
* beta decision matrices,
* or explicit beta exit criteria.

---

## Principle 2 — Preserve Product Focus

The objective of the UPSC beta is to validate whether Current Affairs creates meaningful learning outcomes and retention.

During beta:

* optimize existing workflows,
* remove friction,
* improve reliability,
* strengthen telemetry.

Do not expand scope unnecessarily.

---

## Principle 3 — Feature Freeze Enforcement

The following UPSC initiatives remain frozen until evidence justifies investment:

* Answer Writing systems
* Flashcards generated from Current Affairs
* AI Mentor systems
* Community features
* Gamification systems
* Push notifications
* Additional analytics dashboards
* Current Affairs → Revision integrations

Any exception must include:

* supporting metrics,
* expected impact,
* confidence level,
* and explicit approval rationale.

---

## Principle 4 — Weekly Decision Cadence

UPSC beta decisions should occur only during scheduled reviews.

Cadence:

Week 1:

* Establish baseline metrics.

Week 2:

* Identify emerging trends.

Week 4:

* Evaluate Beta Exit Criteria.

Roadmap changes should not occur outside these review windows unless reliability issues threaten the beta experience.

---

## Principle 5 — Learning Velocity

Success during beta is not measured by:

* number of features shipped,
* lines of code written,
* routes added,
* or components created.

Success is measured by:

* quality of insights generated,
* speed of validated learning,
* confidence in roadmap decisions,
* and understanding of how UPSC aspirants actually behave.

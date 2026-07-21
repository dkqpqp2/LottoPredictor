# 로또 예측 웹앱 — Next.js 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/`(Next.js)에 홈(번호생성) · 통계 · 회차조회 · 수집하기(관리자) 4개 페이지를 만들어, 이미 검증된 Java 백엔드 REST API(`localhost:8080`)와 연동한다.

**Architecture:** 모든 페이지는 클라이언트 컴포넌트(`'use client'`)에서 `NEXT_PUBLIC_API_BASE_URL`을 통해 백엔드를 직접 fetch한다 (CORS는 백엔드 `WebConfig`에서 이미 허용됨). DB 접근이나 서버 사이드 로직은 프론트에 두지 않는다. `lib/api.ts` 하나에 모든 API 호출 함수를 모아 각 페이지가 재사용한다.

**Tech Stack:** Next.js 16(App Router, TypeScript), 순수 CSS(CSS Modules) — 차트/UI 라이브러리 추가 설치 없이 진행.

## Global Constraints

- 프론트엔드는 DB에 직접 접근하지 않는다 — 모든 데이터는 백엔드 REST API를 통해서만 가져온다.
- UI 문구에서 "예측"이라는 표현을 피하고 "통계 기반 추천 번호" 등으로 표현한다 (설계 문서 원칙).
- 수집하기 페이지의 시크릿은 서버에 저장하지 않고, 사용자가 매번 직접 입력해서 브라우저가 백엔드로 바로 전송한다.
- 프론트엔드 E2E 테스트는 1단계 범위에서 제외 (설계 문서). 대신 개발 서버 + 브라우저로 직접 동작을 확인한다.
- `/api/stats`는 현재 번호별 출현 횟수/퍼센트만 제공한다 — "오래 안 나온 번호" 같은 추가 통계는 백엔드에 해당 데이터가 없으므로 이번 범위에서 구현하지 않는다.

---

## File Structure

```
frontend/
├── lib/
│   └── api.ts                 # 백엔드 API 호출 함수 모음 (fetch wrapper)
├── app/
│   ├── layout.tsx              # 상단 네비게이션 추가 (수정)
│   ├── page.tsx                # 홈 — 번호 생성 (교체)
│   ├── page.module.css         # 홈 스타일 (교체)
│   ├── globals.css             # 공통 스타일 보강 (수정)
│   ├── nav.module.css          # 네비게이션 스타일 (신규)
│   ├── stats/
│   │   ├── page.tsx            # 통계 페이지
│   │   └── stats.module.css
│   ├── draws/
│   │   ├── page.tsx            # 회차조회 페이지
│   │   └── draws.module.css
│   └── collect/
│       ├── page.tsx            # 수집하기(관리자) 페이지
│       └── collect.module.css
```

---

## Task 1: API 클라이언트 + 네비게이션

**Files:** `lib/api.ts`(신규), `app/layout.tsx`(수정), `app/nav.module.css`(신규)

- [x] `lib/api.ts`에 `generateNumbers`, `getStats`, `getDraws`, `triggerCrawl` 함수와 타입(`GenerateResult`, `NumberStat`, `DrawResponse`, `SyncResult`) 작성.
- [x] `app/layout.tsx`에 홈/통계/회차조회/수집하기로 이동하는 상단 네비게이션 추가, 메타데이터(title/description)를 실제 앱 내용으로 교체.
- [x] `npx tsc --noEmit`으로 타입 체크.

## Task 2: 홈 — 번호 생성 페이지

**Files:** `app/page.tsx`(교체), `app/page.module.css`(교체)

- [x] 모드 선택(가중치 기반/완전 랜덤), 세트 수(1~10) 입력, "번호 생성" 버튼.
- [x] 결과를 세트별로 6개 번호 배지로 표시, 로딩/에러 상태 처리.
- [x] "통계 기반 추천 번호"라는 문구로 예측 오해 방지.

## Task 3: 통계 페이지

**Files:** `app/stats/page.tsx`, `app/stats/stats.module.css`

- [x] 페이지 로드시 `getStats()` 호출, 1~45번 각각의 출현 횟수/퍼센트를 CSS 막대그래프로 표시(라이브러리 없이 `width: {percentage}%`로 구현).
- [x] 로딩/에러 상태 처리.

## Task 4: 회차조회 페이지

**Files:** `app/draws/page.tsx`, `app/draws/draws.module.css`

- [x] 회차 번호 또는 날짜로 검색하는 폼 + 기본 페이지네이션 목록(최신순).
- [x] 검색 결과/목록을 회차·날짜·번호 6개·보너스로 표시.

## Task 5: 수집하기(관리자) 페이지

**Files:** `app/collect/page.tsx`, `app/collect/collect.module.css`

- [x] 시크릿 입력(password 타입) + "수집하기" 버튼.
- [x] 결과로 `synced`/`skipped` 개수와 상세 목록 표시, 401이면 "시크릿이 올바르지 않습니다" 에러 메시지.

## Task 6: 브라우저로 전체 동작 확인

- [x] `npm run dev`(frontend)와 백엔드(`localhost:8080`)를 동시에 띄운 상태로 Claude_Browser를 통해 4개 페이지 모두 실제 클릭해서 확인.
- [x] 골든 패스(정상 흐름)와 에러 케이스(수집하기 잘못된 시크릿) 둘 다 확인.

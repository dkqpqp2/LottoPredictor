"use client";

import { useEffect, useState } from "react";
import styles from "./generate.module.css";
import {
  generateNumbers,
  getDraws,
  getWeeklyPick,
  getWeeklyPickHistory,
  type DrawResponse,
  type GenerateMode,
  type GenerateResult,
  type WeeklyPickResult,
} from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
import { saveNumbers } from "../../lib/savedNumbers";

export default function GeneratePage() {
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [mode, setMode] = useState<GenerateMode>("weighted");
  const [sets, setSets] = useState(1);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [pendingResult, setPendingResult] = useState<GenerateResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestDraw, setLatestDraw] = useState<DrawResponse | null>(null);
  const [weeklyPick, setWeeklyPick] = useState<WeeklyPickResult | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyPickResult[]>([]);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    getDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
    getWeeklyPick()
      .then(setWeeklyPick)
      .catch(() => setWeeklyPick(null));
    getWeeklyPickHistory(5)
      .then(setWeeklyHistory)
      .catch(() => setWeeklyHistory([]));
  }, []);

  async function handleGenerate() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateNumbers(mode, sets, auth.token);
      refreshProgress();
      setSavedIndices(new Set());
      setSaveErrors({});
      if (sets === 1) {
        setResult(null);
        setPendingResult(data);
        setAnimating(true);
      } else {
        setPendingResult(null);
        setAnimating(false);
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrawComplete() {
    setResult(pendingResult);
    setPendingResult(null);
    setAnimating(false);
  }

  async function handleSave(index: number, set: number[]) {
    if (!auth) return;
    setSavingIndex(index);
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      await saveNumbers("GENERATE", set, auth.token);
      setSavedIndices((prev) => new Set(prev).add(index));
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : "저장에 실패했습니다.",
      }));
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>통계 기반 추천 번호</h1>
        <p className={styles.subtitle}>
          역대 로또 6/45 당첨번호의 출현 빈도를 가중치로 삼아 번호를 생성합니다.
          <br />
          실제 당첨을 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {progress && (
        <p className={styles.error}>
          오늘 남은 번호생성 횟수: {progress.generateUsage.limit - progress.generateUsage.used}/
          {progress.generateUsage.limit} ({progress.tier} 등급)
        </p>
      )}

      {latestDraw && (
        <div className={styles.latestCard}>
          <span className={styles.latestLabel}>
            {latestDraw.drawNo}회 1등 당첨번호 <span className={styles.latestDate}>{latestDraw.drawDate}</span>
          </span>
          <div className={styles.latestBalls}>
            {latestDraw.numbers.map((n) => (
              <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                {n}
              </span>
            ))}
            <span className={styles.plus}>+</span>
            <span className={styles.ball} style={{ backgroundColor: getBallColor(latestDraw.bonusNum) }}>
              {latestDraw.bonusNum}
            </span>
          </div>
        </div>
      )}

      {weeklyPick && (
        <div className={styles.weeklyCard}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>이번 주 추천 번호</span>
            <span className={styles.weeklyTarget}>{weeklyPick.targetDrawNo}회 대상</span>
          </div>
          <div className={styles.latestBalls}>
            {weeklyPick.numbers.map((n) => (
              <span
                key={n}
                className={`${styles.ball} ${
                  weeklyPick.resultAvailable && weeklyPick.actualNumbers?.includes(n) ? styles.ballMatched : ""
                }`}
                style={{ backgroundColor: getBallColor(n) }}
              >
                {n}
              </span>
            ))}
          </div>
          {weeklyPick.resultAvailable ? (
            <p className={styles.weeklyResult}>
              {weeklyPick.actualDrawDate} 추첨 결과 {weeklyPick.matchCount}개 일치
              {weeklyPick.rank ? ` · ${weeklyPick.rank}` : " · 낙첨"}
            </p>
          ) : (
            <p className={styles.weeklyPending}>{weeklyPick.targetDrawNo}회 추첨 결과를 기다리는 중입니다.</p>
          )}
        </div>
      )}

      {weeklyHistory.length > 0 && (
        <div className={styles.historyCard}>
          <span className={styles.weeklyTitle}>지난 추천 이력</span>
          <div className={styles.historyList}>
            {weeklyHistory.map((h) => (
              <div key={h.weekStart} className={styles.historyRow}>
                <span className={styles.historyDraw}>{h.targetDrawNo}회</span>
                <div className={styles.historyBalls}>
                  {h.numbers.map((n) => (
                    <span
                      key={n}
                      className={`${styles.miniBall} ${
                        h.resultAvailable && h.actualNumbers?.includes(n) ? styles.miniBallMatched : ""
                      }`}
                      style={{ backgroundColor: getBallColor(n) }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <span className={styles.historyResult}>{h.resultAvailable ? (h.rank ?? "낙첨") : "대기중"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {auth ? (
        <div className={styles.card}>
          <div className={styles.controlsRow}>
            <div className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${mode === "weighted" ? styles.segmentActive : ""}`}
                onClick={() => setMode("weighted")}
                disabled={animating}
              >
                가중치 기반
              </button>
              <button
                type="button"
                className={`${styles.segment} ${mode === "random" ? styles.segmentActive : ""}`}
                onClick={() => setMode("random")}
                disabled={animating}
              >
                완전 랜덤
              </button>
            </div>

            <div className={styles.setsField}>
              <span>세트 수</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => setSets((s) => Math.max(1, s - 1))}
                  disabled={sets <= 1 || animating}
                  aria-label="세트 수 감소"
                >
                  −
                </button>
                <span className={styles.stepperValue}>{sets}</span>
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => setSets((s) => Math.min(10, s + 1))}
                  disabled={sets >= 10 || animating}
                  aria-label="세트 수 증가"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button className={styles.generateButton} onClick={handleGenerate} disabled={loading || animating}>
            {loading ? "생성 중..." : "번호 생성"}
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          <p className={styles.error}>번호 생성을 이용하려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {animating && pendingResult && (
        <LottoDrawAnimation numbers={pendingResult.results[0]} onComplete={handleDrawComplete} />
      )}

      {result && (
        <div className={styles.results}>
          {result.mode !== mode && (
            <p className={styles.notice}>아직 저장된 회차 데이터가 없어 완전 랜덤 모드로 생성되었습니다.</p>
          )}
          {result.results.map((set, i) => (
            <div key={i} className={styles.resultCard}>
              <span className={styles.resultIndex}>{i + 1}</span>
              <div className={styles.resultBalls}>
                {set.map((n) => (
                  <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                    {n}
                  </span>
                ))}
              </div>
              <div className={styles.saveWrap}>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => handleSave(i, set)}
                  disabled={savedIndices.has(i) || savingIndex === i}
                >
                  {savedIndices.has(i) ? "저장됨" : savingIndex === i ? "저장 중..." : "저장"}
                </button>
                {saveErrors[i] && <p className={styles.saveError}>{saveErrors[i]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

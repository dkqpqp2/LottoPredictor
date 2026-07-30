"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import {
  generatePension,
  getPensionDraws,
  getPensionWeeklyPick,
  getPensionWeeklyPickHistory,
  type PensionDrawResult,
  type PensionGenerateResult,
  type PensionWeeklyPickResult,
} from "../../lib/api";
import PensionDrawAnimation from "../components/PensionDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

export default function PensionPage() {
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<PensionGenerateResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pensionResult, setPensionResult] = useState<PensionGenerateResult | null>(null);
  const [latestDraw, setLatestDraw] = useState<PensionDrawResult | null>(null);
  const [weeklyPick, setWeeklyPick] = useState<PensionWeeklyPickResult | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<PensionWeeklyPickResult[]>([]);

  const quotaExhausted = progress ? progress.pensionUsage.used >= progress.pensionUsage.limit : false;

  useEffect(() => {
    getPensionDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
    getPensionWeeklyPick()
      .then(setWeeklyPick)
      .catch(() => setWeeklyPick(null));
    getPensionWeeklyPickHistory(5)
      .then(setWeeklyHistory)
      .catch(() => setWeeklyHistory([]));
  }, []);

  async function handleGenerate() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generatePension(auth.token);
      refreshProgress();
      setPendingResult(data);
      setAnimating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "번호 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnimationComplete() {
    setPensionResult(pendingResult);
    setPendingResult(null);
    setAnimating(false);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>연금복권720+ 번호</h1>
        <p className={styles.subtitle}>
          조 1~5와 6자리 번호를 완전 무작위로 뽑아드려요.
          <br />
          실제 당첨을 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {latestDraw && (
        <div className={styles.latestCard}>
          <span className={styles.latestLabel}>
            {latestDraw.drawNo}회 당첨번호 <span className={styles.latestDate}>{latestDraw.drawDate}</span>
          </span>
          <span className={styles.latestValue}>
            {latestDraw.groupNo}조 {latestDraw.number} (보너스 {latestDraw.bonusNumber})
          </span>
        </div>
      )}

      {weeklyPick && (
        <div className={styles.weeklyCard}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>이번 주 추천 번호</span>
            <span className={styles.weeklyTarget}>{weeklyPick.targetDrawNo}회 대상</span>
          </div>
          <span className={styles.weeklyValue}>
            {weeklyPick.groupNo}조 {weeklyPick.number}
          </span>
          {weeklyPick.resultAvailable ? (
            <p className={styles.weeklyResult}>
              {weeklyPick.actualDrawDate} 추첨 결과 {weeklyPick.rank ? weeklyPick.rank : "낙첨"}
              {weeklyPick.bonusMatch ? " · 보너스 당첨" : ""}
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
                <span className={styles.historyValue}>
                  {h.groupNo}조 {h.number}
                </span>
                <span className={styles.historyResult}>{h.resultAvailable ? (h.rank ?? "낙첨") : "대기중"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!auth ? (
        <div className={styles.card}>
          <p className={styles.error}>연금복권 번호를 뽑으려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      ) : (
        <div className={styles.card}>
          {!animating && !pensionResult && (
            <>
              <button
                type="button"
                className={styles.generateButton}
                onClick={handleGenerate}
                disabled={loading || quotaExhausted}
              >
                {quotaExhausted ? "내일 다시 시도해주세요" : loading ? "생성 중..." : "연금복권 번호 뽑기"}
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}

          {animating && pendingResult && (
            <PensionDrawAnimation
              groupNo={pendingResult.groupNo}
              number={pendingResult.number}
              onComplete={handleAnimationComplete}
            />
          )}

          {pensionResult && !animating && (
            <div className={styles.resultCard}>
              <span className={styles.resultText}>
                {pensionResult.groupNo}조 {pensionResult.number}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

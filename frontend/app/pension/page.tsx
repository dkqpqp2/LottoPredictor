"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { generatePension, type PensionGenerateResult } from "../../lib/api";
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

  const quotaExhausted = progress ? progress.pensionUsage.used >= progress.pensionUsage.limit : false;

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

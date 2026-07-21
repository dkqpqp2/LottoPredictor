"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { generateNumbers, getDraws, type DrawResponse, type GenerateMode, type GenerateResult } from "../lib/api";
import { getBallColor } from "../lib/lottoBall";

export default function Home() {
  const [mode, setMode] = useState<GenerateMode>("weighted");
  const [sets, setSets] = useState(1);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestDraw, setLatestDraw] = useState<DrawResponse | null>(null);

  useEffect(() => {
    getDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateNumbers(mode, sets);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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

      <div className={styles.card}>
        <div className={styles.controlsRow}>
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segment} ${mode === "weighted" ? styles.segmentActive : ""}`}
              onClick={() => setMode("weighted")}
            >
              가중치 기반
            </button>
            <button
              type="button"
              className={`${styles.segment} ${mode === "random" ? styles.segmentActive : ""}`}
              onClick={() => setMode("random")}
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
                disabled={sets <= 1}
                aria-label="세트 수 감소"
              >
                −
              </button>
              <span className={styles.stepperValue}>{sets}</span>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => setSets((s) => Math.min(10, s + 1))}
                disabled={sets >= 10}
                aria-label="세트 수 증가"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button className={styles.generateButton} onClick={handleGenerate} disabled={loading}>
          {loading ? "생성 중..." : "번호 생성"}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./stats.module.css";
import { getStats, type NumberStat } from "../../lib/api";

type SortOrder = "number" | "count";

export default function StatsPage() {
  const [stats, setStats] = useState<NumberStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("number");

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."));
  }, []);

  const maxPercentage = stats ? Math.max(...stats.map((s) => s.percentage), 1) : 1;

  const mostDrawn = useMemo(
    () => (stats ? [...stats].sort((a, b) => b.count - a.count).slice(0, 6) : []),
    [stats]
  );
  const leastDrawn = useMemo(
    () => (stats ? [...stats].sort((a, b) => a.count - b.count).slice(0, 6) : []),
    [stats]
  );

  const sortedStats = useMemo(() => {
    if (!stats) return [];
    if (sortOrder === "count") {
      return [...stats].sort((a, b) => b.count - a.count);
    }
    return [...stats].sort((a, b) => a.number - b.number);
  }, [stats, sortOrder]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>번호별 출현 통계</h1>
        <p className={styles.subtitle}>역대 회차에서 각 번호가 나온 횟수와 비율입니다.</p>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {stats && (
        <>
          <div className={styles.highlightGrid}>
            <div className={styles.highlightCard}>
              <span className={styles.highlightTitle}>가장 많이 나온 번호</span>
              <div className={styles.highlightBalls}>
                {mostDrawn.map((s) => (
                  <span key={s.number} className={styles.highlightBall}>
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.highlightCard}>
              <span className={styles.highlightTitle}>가장 적게 나온 번호</span>
              <div className={styles.highlightBalls}>
                {leastDrawn.map((s) => (
                  <span key={s.number} className={`${styles.highlightBall} ${styles.highlightBallMuted}`}>
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.listHeader}>
            <span className={styles.listTitle}>전체 번호 통계</span>
            <div className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${sortOrder === "number" ? styles.segmentActive : ""}`}
                onClick={() => setSortOrder("number")}
              >
                번호순
              </button>
              <button
                type="button"
                className={`${styles.segment} ${sortOrder === "count" ? styles.segmentActive : ""}`}
                onClick={() => setSortOrder("count")}
              >
                당첨순
              </button>
            </div>
          </div>

          <div className={styles.card}>
            {sortedStats.map((stat) => (
              <div key={stat.number} className={styles.row}>
                <span className={styles.numberBadge}>{stat.number}</span>
                <span className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${(stat.percentage / maxPercentage) * 100}%` }}
                  />
                </span>
                <span className={styles.count}>{stat.count}회</span>
                <span className={styles.percentage}>{stat.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import styles from "./stats.module.css";
import { getStats, type NumberStat } from "../../lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<NumberStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."));
  }, []);

  const maxPercentage = stats ? Math.max(...stats.map((s) => s.percentage), 1) : 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>번호별 출현 통계</h1>
      <p className={styles.subtitle}>역대 회차에서 각 번호가 나온 횟수와 비율입니다.</p>

      {error && <p className={styles.error}>{error}</p>}

      {stats && (
        <div className={styles.list}>
          {stats.map((stat) => (
            <div key={stat.number} className={styles.row}>
              <span className={styles.number}>{stat.number}</span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{ width: `${(stat.percentage / maxPercentage) * 100}%` }}
                />
              </span>
              <span className={styles.percentage}>{stat.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

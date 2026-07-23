"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./stats.module.css";
import { getDuplicateDraws, getStats, type DuplicateDrawGroup, type NumberStat } from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";

type SortOrder = "number" | "count";

export default function StatsPage() {
  const [stats, setStats] = useState<NumberStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("number");
  const [duplicates, setDuplicates] = useState<DuplicateDrawGroup[] | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."));
    getDuplicateDraws()
      .then(setDuplicates)
      .catch(() => setDuplicates(null));
  }, []);

  const maxPercentage = stats ? Math.max(...stats.map((s) => s.percentage), 1) : 1;
  const totalDraws = stats ? Math.round(stats.reduce((sum, s) => sum + s.count, 0) / 6) : 0;

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

  const rangeGroups = useMemo(() => {
    if (!stats) return [];
    const byNumber = [...stats].sort((a, b) => a.number - b.number);
    const groups: { label: string; items: NumberStat[] }[] = [];
    for (let start = 1; start <= 41; start += 10) {
      const end = Math.min(start + 9, 45);
      groups.push({
        label: `${start}-${end}`,
        items: byNumber.filter((s) => s.number >= start && s.number <= end),
      });
    }
    return groups;
  }, [stats]);

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
                  <span
                    key={s.number}
                    className={styles.highlightBall}
                    style={{ backgroundColor: getBallColor(s.number) }}
                  >
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.highlightCard}>
              <span className={styles.highlightTitle}>가장 적게 나온 번호</span>
              <div className={styles.highlightBalls}>
                {leastDrawn.map((s) => (
                  <span
                    key={s.number}
                    className={styles.highlightBall}
                    style={{ backgroundColor: getBallColor(s.number) }}
                  >
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {duplicates && (
            <div className={styles.factCard}>
              <span className={styles.highlightTitle}>재미있는 사실</span>
              {duplicates.length === 0 ? (
                <p className={styles.factText}>
                  지금까지 {totalDraws}회차 중 완전히 같은 번호 조합이 나온 적은 없습니다.
                </p>
              ) : (
                <div className={styles.factList}>
                  {duplicates.map((group) => (
                    <div key={group.numbers.join("-")} className={styles.factRow}>
                      <div className={styles.highlightBalls}>
                        {group.numbers.map((n) => (
                          <span
                            key={n}
                            className={styles.highlightBall}
                            style={{ backgroundColor: getBallColor(n) }}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <span className={styles.factText}>
                        {group.drawNos.map((d) => `${d}회`).join(", ")}에서 동일하게 나왔습니다.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {sortOrder === "number" ? (
            <div className={styles.rangeGrid}>
              {rangeGroups.map((group) => (
                <div key={group.label} className={styles.rangeColumn}>
                  <span className={styles.rangeHeader}>{group.label}</span>
                  {group.items.map((stat) => (
                    <div key={stat.number} className={styles.rangeRow}>
                      <span
                        className={styles.rangeBadge}
                        style={{ backgroundColor: getBallColor(stat.number) }}
                      >
                        {stat.number}
                      </span>
                      <span className={styles.rangeBarTrack}>
                        <span
                          className={styles.rangeBarFill}
                          style={{ width: `${(stat.percentage / maxPercentage) * 100}%` }}
                        />
                      </span>
                      <span className={styles.rangePercentage}>{stat.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.card}>
              {sortedStats.map((stat) => (
                <div key={stat.number} className={styles.row}>
                  <span className={styles.numberBadge} style={{ backgroundColor: getBallColor(stat.number) }}>
                    {stat.number}
                  </span>
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
          )}
        </>
      )}
    </div>
  );
}

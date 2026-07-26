"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
import { groupSavedNumbers } from "../../lib/groupSavedNumbers";
import { getBallColor } from "../../lib/lottoBall";
import { getTarotInterpretationHistory, type TarotInterpretationResult } from "../../lib/tarotInterpretation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const SOURCE_LABELS: Record<SavedNumberResult["source"], string> = {
  GENERATE: "번호생성",
  TAROT: "타로",
};

function formatWeekLabel(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function tierProgressFraction(totalPoints: number, tierFloor: number, pointsToNextTier: number | null): number {
  if (pointsToNextTier == null) return 1;
  const ceiling = totalPoints + pointsToNextTier;
  const span = ceiling - tierFloor;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (totalPoints - tierFloor) / span));
}

export default function MyPage() {
  const { auth } = useAuth();
  const { progress } = useProgress();
  const [savedNumbers, setSavedNumbers] = useState<SavedNumberResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [interpretations, setInterpretations] = useState<TarotInterpretationResult[]>([]);
  const [interpretationsError, setInterpretationsError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
    getTarotInterpretationHistory(auth.token)
      .then(setInterpretations)
      .catch(() => setInterpretationsError("타로 해석 기록을 불러오지 못했습니다."));
  }, [auth]);

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>마이페이지</h1>
        </section>
        <div className={styles.card}>
          <p className={styles.error}>마이페이지를 이용하려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.loginButton}>
            카카오로 로그인
          </a>
        </div>
      </div>
    );
  }

  const groups = groupSavedNumbers(savedNumbers);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>지금까지 저장한 번호를 월별/주별로 모아봤어요.</p>
      </section>

      {progress && (
        <div className={styles.tierCard}>
          <div className={styles.tierHeader}>
            <span className={styles.tierBadge}>{progress.tier}</span>
            <span className={styles.tierMeta}>
              누적 {progress.totalPoints}P
              {progress.pointsToNextTier != null
                ? ` · 다음 등급까지 ${progress.pointsToNextTier}P`
                : " · 최고 등급"}
            </span>
          </div>
          <div className={styles.tierBarTrack}>
            <div
              className={styles.tierBarFill}
              style={{
                width: `${
                  tierProgressFraction(progress.totalPoints, progress.tierFloor, progress.pointsToNextTier) * 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {interpretationsError && <p className={styles.error}>{interpretationsError}</p>}

      {interpretations.length > 0 && (
        <div className={styles.interpretationSection}>
          <h2 className={styles.monthLabel}>타로 해석 기록</h2>
          <div className={styles.interpretationList}>
            {interpretations.map((item) => (
              <div key={item.id} className={styles.interpretationCard}>
                <div className={styles.interpretationHeader}>
                  <span className={styles.sourceBadge}>
                    {item.mode === "TAROT_ONLY" ? "타로만 보기" : "별자리 함께보기"}
                  </span>
                  <span className={styles.itemMeta}>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className={styles.interpretationCards}>
                  {item.cards
                    .map((c) => (c.positionLabel ? `[${c.positionLabel}] ${c.nameKo}` : c.nameKo))
                    .join(" · ")}
                  {item.zodiacName ? ` · ${item.zodiacName}` : ""}
                </p>
                <p className={styles.interpretationText}>{item.interpretationText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!error && groups.length === 0 && <p className={styles.empty}>아직 저장한 번호가 없어요.</p>}

      {groups.map((month) => (
        <div key={month.monthLabel} className={styles.monthGroup}>
          <h2 className={styles.monthLabel}>{month.monthLabel}</h2>
          {month.weeks.map((week) => (
            <div key={week.weekStart} className={styles.weekGroup}>
              <span className={styles.weekLabel}>{formatWeekLabel(week.weekStart)}</span>
              <div className={styles.itemList}>
                {week.items.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <span className={styles.sourceBadge}>{SOURCE_LABELS[item.source]}</span>
                    <div className={styles.itemBalls}>
                      {item.numbers.map((n) => (
                        <span
                          key={n}
                          className={`${styles.ball} ${
                            item.resultAvailable && item.actualNumbers?.includes(n) ? styles.ballMatched : ""
                          }`}
                          style={{ backgroundColor: getBallColor(n) }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <span className={styles.itemMeta}>
                      {item.targetDrawNo}회 대상 · {new Date(item.savedAt).toLocaleDateString("ko-KR")}
                      {item.resultAvailable &&
                        ` · ${item.matchCount}개 일치${item.rank ? ` · ${item.rank}` : " · 낙첨"}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

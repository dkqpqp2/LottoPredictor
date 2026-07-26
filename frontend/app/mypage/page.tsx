"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
import { getBallColor } from "../../lib/lottoBall";
import { getTarotInterpretationHistory, type TarotInterpretationResult } from "../../lib/tarotInterpretation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const SOURCE_LABELS: Record<SavedNumberResult["source"], string> = {
  GENERATE: "번호생성",
  TAROT: "타로",
};

const NUMBERS_PER_PAGE = 5;

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
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [numberPage, setNumberPage] = useState(0);
  const [interpretationPage, setInterpretationPage] = useState(0);

  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
    getTarotInterpretationHistory(auth.token)
      .then(setInterpretations)
      .catch(() => setInterpretationsError("타로 해석 기록을 불러오지 못했습니다."));
  }, [auth]);

  function handlePrevMonth() {
    setNumberPage(0);
    setInterpretationPage(0);
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function handleNextMonth() {
    setNumberPage(0);
    setInterpretationPage(0);
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

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

  const today = new Date();
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;

  const monthItems = savedNumbers.filter((item) => {
    const d = new Date(item.savedAt);
    return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
  });
  const totalNumberPages = Math.max(1, Math.ceil(monthItems.length / NUMBERS_PER_PAGE));
  const pagedItems = monthItems.slice(numberPage * NUMBERS_PER_PAGE, numberPage * NUMBERS_PER_PAGE + NUMBERS_PER_PAGE);

  const monthInterpretations = interpretations.filter((item) => {
    const d = new Date(item.createdAt);
    return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
  });
  const currentInterpretation = monthInterpretations[interpretationPage] ?? null;

  function handlePrevNumberPage() {
    setNumberPage((p) => Math.max(0, p - 1));
  }

  function handleNextNumberPage() {
    setNumberPage((p) => Math.min(totalNumberPages - 1, p + 1));
  }

  function handlePrevInterpretationPage() {
    setInterpretationPage((p) => Math.max(0, p - 1));
  }

  function handleNextInterpretationPage() {
    setInterpretationPage((p) => Math.min(monthInterpretations.length - 1, p + 1));
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>월별로 넘겨보면서 저장한 번호와 타로 해석을 확인해보세요.</p>
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

      {(savedNumbers.length > 0 || interpretations.length > 0) && (
        <div className={styles.monthNav}>
          <button type="button" className={styles.monthNavArrow} onClick={handlePrevMonth} aria-label="이전 달">
            ‹
          </button>
          <div className={styles.monthNavCenter}>
            <span className={styles.monthNavLabel}>
              {viewYear}년 {viewMonth}월
            </span>
            {isCurrentMonth && <span className={styles.monthNavBadge}>이번 달</span>}
          </div>
          <button
            type="button"
            className={styles.monthNavArrow}
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      )}

      {interpretations.length > 0 && (
        <div className={styles.interpretationSection}>
          <h2 className={styles.monthLabel}>타로 해석 기록</h2>
          {currentInterpretation ? (
            <div className={styles.interpretationCard}>
              <div className={styles.interpretationHeader}>
                <span className={styles.sourceBadge}>
                  {currentInterpretation.mode === "TAROT_ONLY" ? "타로만 보기" : "별자리 함께보기"}
                </span>
                <span className={styles.itemMeta}>
                  {new Date(currentInterpretation.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className={styles.interpretationCards}>
                {currentInterpretation.cards
                  .map((c) => (c.positionLabel ? `[${c.positionLabel}] ${c.nameKo}` : c.nameKo))
                  .join(" · ")}
                {currentInterpretation.zodiacName ? ` · ${currentInterpretation.zodiacName}` : ""}
              </p>
              <p className={styles.interpretationText}>{currentInterpretation.interpretationText}</p>

              {monthInterpretations.length > 1 && (
                <div className={styles.pager}>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handlePrevInterpretationPage}
                    disabled={interpretationPage === 0}
                    aria-label="이전 해석"
                  >
                    ‹
                  </button>
                  <span className={styles.pagerCount}>
                    {interpretationPage + 1} / {monthInterpretations.length}
                  </span>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handleNextInterpretationPage}
                    disabled={interpretationPage >= monthInterpretations.length - 1}
                    aria-label="다음 해석"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.empty}>이 달에는 타로 해석 기록이 없어요.</p>
          )}
        </div>
      )}

      {!error && savedNumbers.length === 0 && <p className={styles.empty}>아직 저장한 번호가 없어요.</p>}

      {!error && savedNumbers.length > 0 && (
        <div className={styles.monthGroup}>
          <h2 className={styles.monthLabel}>저장한 번호</h2>
          {pagedItems.length === 0 ? (
            <p className={styles.empty}>이 달에는 저장한 번호가 없어요.</p>
          ) : (
            <>
              <div className={styles.itemList}>
                {pagedItems.map((item) => (
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

              {totalNumberPages > 1 && (
                <div className={styles.pager}>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handlePrevNumberPage}
                    disabled={numberPage === 0}
                    aria-label="이전 페이지"
                  >
                    ‹
                  </button>
                  <span className={styles.pagerCount}>
                    {numberPage + 1} / {totalNumberPages}
                  </span>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handleNextNumberPage}
                    disabled={numberPage >= totalNumberPages - 1}
                    aria-label="다음 페이지"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

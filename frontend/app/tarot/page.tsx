"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumbers, generateTarotNumbersForPicks, type CardPick } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeTarotUsage } from "../../lib/progress";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type ViewMode = "unset" | "tarot-only" | "with-zodiac";

interface SpreadSlot {
  card: TarotCard;
  direction: CardDirection | null;
}

const SPREAD_POSITIONS = ["과거", "현재", "미래"];
const SPREAD_SIZE = SPREAD_POSITIONS.length;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function Home() {
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("unset");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState<number | null>(null);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleCards(TAROT_CARDS));

  // "with-zodiac" mode: single card pick
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [direction, setDirection] = useState<CardDirection | null>(null);

  // "tarot-only" mode: 3-card spread (과거/현재/미래)
  const [spreadSlots, setSpreadSlots] = useState<SpreadSlot[]>([]);

  const [numbers, setNumbers] = useState<number[] | null>(null);
  const [pendingNumbers, setPendingNumbers] = useState<number[] | null>(null);
  const [animating, setAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const calendarCells = useMemo(() => {
    if (!year) return [];
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const total = daysInMonth(year, month);
    const blanks: null[] = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: total }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [year, month]);

  const zodiac: ZodiacSign | null = useMemo(() => {
    if (!year || !day) return null;
    return getZodiacSign(new Date(year, month - 1, day));
  }, [year, month, day]);

  function handleYearChange(value: string) {
    setYear(value ? Number(value) : "");
    setDay(null);
  }

  function handlePrevMonth() {
    setMonth((m) => Math.max(1, m - 1));
    setDay(null);
  }

  function handleNextMonth() {
    setMonth((m) => Math.min(12, m + 1));
    setDay(null);
  }

  // the card currently in the "drag to reveal" step, regardless of mode
  const revealingCard =
    viewMode === "with-zodiac"
      ? selected && !direction
        ? selected
        : null
      : spreadSlots.length > 0 && spreadSlots[spreadSlots.length - 1].direction === null
        ? spreadSlots[spreadSlots.length - 1].card
        : null;

  function handleCardClick(card: TarotCard) {
    if (viewMode === "with-zodiac") {
      if (selected) return;
      setSelected(card);
    } else if (viewMode === "tarot-only") {
      if (spreadSlots.length >= SPREAD_SIZE || revealingCard) return;
      setSpreadSlots((prev) => [...prev, { card, direction: null }]);
      setDeck((prev) => prev.filter((c) => c.number !== card.number));
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture is best-effort (keeps the drag working on touch devices
      // even if capture isn't available); the drag logic below doesn't depend on it.
    }
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setDragOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragStart.current || !revealingCard) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const detected = detectDragDirection(dx, dy);
    dragStart.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    if (!detected) {
      return;
    }
    if (viewMode === "with-zodiac") {
      setDirection(detected);
    } else {
      setSpreadSlots((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], direction: detected };
        return updated;
      });
    }
  }

  const previewDirection = isDragging ? detectDragDirection(dragOffset.x, dragOffset.y, 15) : null;

  const spreadReady = spreadSlots.length === SPREAD_SIZE && spreadSlots.every((s) => s.direction !== null);

  async function handleGenerateNumbers() {
    if (!auth) return;
    setQuotaError(null);
    try {
      await consumeTarotUsage(auth.token);
    } catch (err) {
      setQuotaError(err instanceof Error ? err.message : "오늘 사용 횟수를 다 쓰셨어요.");
      return;
    }
    refreshProgress();
    if (viewMode === "with-zodiac") {
      if (!selected || !direction) return;
      setPendingNumbers(generateTarotNumbers(selected, zodiac, direction));
    } else {
      if (!spreadReady) return;
      const picks = spreadSlots as CardPick[];
      setPendingNumbers(generateTarotNumbersForPicks(picks, null));
    }
    setAnimating(true);
  }

  function handleNumbersDrawComplete() {
    setNumbers(pendingNumbers);
    setPendingNumbers(null);
    setAnimating(false);
  }

  function handleReset() {
    setDeck(shuffleCards(TAROT_CARDS));
    setSelected(null);
    setDirection(null);
    setSpreadSlots([]);
    setNumbers(null);
    setPendingNumbers(null);
    setAnimating(false);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }

  function handleChangeMode() {
    setViewMode("unset");
    setYear("");
    setMonth(1);
    setDay(null);
    handleReset();
  }

  const fortuneText = useMemo(() => {
    if (!selected || !direction) return null;
    return selected.fortunes[direction];
  }, [selected, direction]);

  const nextPositionLabel =
    viewMode === "tarot-only" && !revealingCard && spreadSlots.length < SPREAD_SIZE
      ? SPREAD_POSITIONS[spreadSlots.length]
      : null;
  const revealingPositionLabel =
    viewMode === "tarot-only" && revealingCard ? SPREAD_POSITIONS[spreadSlots.length - 1] : null;

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>타로 운세 번호</h1>
          <p className={styles.subtitle}>
            카드로 오늘의 이야기를 만들어 보세요.
            <br />
            실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
          </p>
        </section>
        <div className={styles.card}>
          <p className={styles.hint}>타로를 보려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>타로 운세 번호</h1>
        <p className={styles.subtitle}>
          카드로 오늘의 이야기를 만들어 보세요.
          <br />
          실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {progress && (
        <p className={styles.hint}>
          오늘 남은 타로 횟수: {progress.tarotUsage.limit - progress.tarotUsage.used}/{progress.tarotUsage.limit} (
          {progress.tier} 등급)
        </p>
      )}

      {viewMode === "unset" && (
        <div className={styles.modeChoice}>
          <button type="button" className={styles.modeButton} onClick={() => setViewMode("tarot-only")}>
            타로만 보기
          </button>
          <button type="button" className={styles.modeButton} onClick={() => setViewMode("with-zodiac")}>
            생년월일로 별자리도 함께 보기
          </button>
        </div>
      )}

      {viewMode !== "unset" && (
        <button type="button" className={styles.changeModeLink} onClick={handleChangeMode}>
          ← 다른 방식으로 다시 시작하기
        </button>
      )}

      {viewMode === "with-zodiac" && (
        <div className={styles.card}>
          <span className={styles.fieldLabel}>생년월일</span>
          <select
            aria-label="출생 연도"
            className={styles.yearSelect}
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">년도 선택</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {year && (
            <div className={styles.calendar}>
              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={handlePrevMonth}
                  disabled={month === 1}
                  aria-label="이전 달"
                >
                  ‹
                </button>
                <span className={styles.calendarTitle}>
                  {year}년 {month}월
                </span>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={handleNextMonth}
                  disabled={month === 12}
                  aria-label="다음 달"
                >
                  ›
                </button>
              </div>
              <div className={styles.calendarGrid}>
                {WEEKDAY_LABELS.map((w) => (
                  <span key={w} className={styles.calendarWeekday}>
                    {w}
                  </span>
                ))}
                {calendarCells.map((d, i) =>
                  d === null ? (
                    <span key={`blank-${i}`} />
                  ) : (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.calendarDay} ${day === d ? styles.calendarDaySelected : ""}`}
                      onClick={() => setDay(d)}
                    >
                      {d}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {zodiac && <p className={styles.zodiacResult}>당신의 별자리는 {zodiac.name}입니다.</p>}
        </div>
      )}

      {viewMode === "with-zodiac" && !selected && zodiac && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>카드 한 장을 골라주세요.</p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "tarot-only" && nextPositionLabel && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>
            "{nextPositionLabel}" 카드를 골라주세요. ({spreadSlots.length + 1}/{SPREAD_SIZE})
          </p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {revealingCard && (
        <div className={styles.revealWrapper}>
          <p className={styles.hint}>
            {revealingPositionLabel && `"${revealingPositionLabel}" `}
            카드를 원하는 방향으로 드래그해서 뒤집어 보세요.
          </p>
          <div
            className={`${styles.dragCard} ${!isDragging ? styles.dragCardSnap : ""}`}
            style={{
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <span className={styles.cardBackSymbol}>✦</span>
          </div>
          <div className={styles.directionHints}>
            <span className={previewDirection === "up" ? styles.directionHintActive : ""}>↑ 위</span>
            <span className={previewDirection === "down" ? styles.directionHintActive : ""}>↓ 아래</span>
            <span className={previewDirection === "left" ? styles.directionHintActive : ""}>← 왼쪽</span>
            <span className={previewDirection === "right" ? styles.directionHintActive : ""}>→ 오른쪽</span>
          </div>
        </div>
      )}

      {viewMode === "with-zodiac" && selected && direction && (
        <div className={styles.resultCard}>
          <Image
            src={`/tarot/${selected.number}.jpg`}
            alt={`${selected.nameKo} (${selected.nameEn})`}
            width={200}
            height={335}
            className={styles.cardImage}
            priority
          />
          <div className={styles.resultHeader}>
            <span className={styles.cardName}>
              {selected.nameKo} <span className={styles.cardNameEn}>({selected.nameEn})</span>
            </span>
            <span className={styles.cardKeyword}>{selected.keyword}</span>
          </div>
          <p className={styles.directionLabel}>{DIRECTION_LABELS[direction]} 방향으로 뒤집혔습니다</p>
          <p className={styles.fortuneText}>{fortuneText}</p>
          {zodiac && (
            <p className={styles.zodiacBlurb}>
              {zodiac.name}인 당신에게는 {zodiac.luckyNumbers.join(", ")}번이 특별한 기운을 더합니다.
            </p>
          )}

          {!numbers && !animating && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
                번호 뽑기
              </button>
              {quotaError && <p className={styles.hint}>{quotaError}</p>}
              {!zodiac && <p className={styles.hint}>생년월일을 입력하면 별자리 운도 함께 반영돼요.</p>}
            </>
          )}

          {animating && pendingNumbers && (
            <div className={styles.animationWrapper}>
              <LottoDrawAnimation numbers={pendingNumbers} onComplete={handleNumbersDrawComplete} />
            </div>
          )}

          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}

      {viewMode === "tarot-only" && spreadReady && (
        <div className={styles.resultCard}>
          {spreadSlots.map((slot, i) => (
            <div key={slot.card.number} className={styles.spreadPickRow}>
              <Image
                src={`/tarot/${slot.card.number}.jpg`}
                alt={`${slot.card.nameKo} (${slot.card.nameEn})`}
                width={110}
                height={184}
                className={styles.cardImageSmall}
              />
              <div className={styles.spreadPickText}>
                <span className={styles.positionLabel}>{SPREAD_POSITIONS[i]}</span>
                <span className={styles.cardName}>
                  {slot.card.nameKo} <span className={styles.cardNameEn}>({slot.card.nameEn})</span>
                </span>
                <span className={styles.directionLabel}>{DIRECTION_LABELS[slot.direction!]} 방향</span>
                <p className={styles.fortuneTextSmall}>{slot.card.fortunes[slot.direction!]}</p>
              </div>
            </div>
          ))}

          {!numbers && !animating && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
                번호 뽑기
              </button>
              {quotaError && <p className={styles.hint}>{quotaError}</p>}
            </>
          )}

          {animating && pendingNumbers && (
            <div className={styles.animationWrapper}>
              <LottoDrawAnimation numbers={pendingNumbers} onComplete={handleNumbersDrawComplete} />
            </div>
          )}

          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./tarot.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumbers } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function TarotPage() {
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState<number | null>(null);
  const [spread, setSpread] = useState<TarotCard[]>(() => shuffleCards(TAROT_CARDS));
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [direction, setDirection] = useState<CardDirection | null>(null);
  const [numbers, setNumbers] = useState<number[] | null>(null);

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

  function handleCardClick(card: TarotCard) {
    if (selected) return;
    setSelected(card);
  }

  function handlePointerDown(e: React.PointerEvent) {
    dragStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragStart.current || direction) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const detected = detectDragDirection(dx, dy);
    dragStart.current = null;
    if (detected) {
      setDirection(detected);
    }
  }

  function handleGenerateNumbers() {
    if (!selected || !direction || !zodiac) return;
    setNumbers(generateTarotNumbers(selected, zodiac, direction));
  }

  function handleReset() {
    setSpread(shuffleCards(TAROT_CARDS));
    setSelected(null);
    setDirection(null);
    setNumbers(null);
  }

  const fortuneText = useMemo(() => {
    if (!selected || !direction) return null;
    return selected.fortunes[direction];
  }, [selected, direction]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>타로 운세 번호</h1>
        <p className={styles.subtitle}>
          카드 한 장과 별자리로 오늘의 이야기를 만들어 보세요.
          <br />
          실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

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

      {zodiac && !selected && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>카드 한 장을 골라주세요.</p>
          <div className={styles.spread}>
            {spread.map((card, i) => (
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

      {selected && !direction && (
        <div className={styles.revealWrapper}>
          <p className={styles.hint}>카드를 원하는 방향으로 드래그해서 뒤집어 보세요.</p>
          <div
            className={styles.dragCard}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <span className={styles.cardBackSymbol}>✦</span>
          </div>
          <div className={styles.directionHints}>
            <span>↑ 위</span>
            <span>↓ 아래</span>
            <span>← 왼쪽</span>
            <span>→ 오른쪽</span>
          </div>
        </div>
      )}

      {selected && direction && (
        <div className={styles.resultCard}>
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

          {!numbers ? (
            <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
              번호 뽑기
            </button>
          ) : (
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

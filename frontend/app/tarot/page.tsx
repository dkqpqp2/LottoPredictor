"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./tarot.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumbers } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";

function parseBirthDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export default function TarotPage() {
  const [birthDateInput, setBirthDateInput] = useState("");
  const [zodiac, setZodiac] = useState<ZodiacSign | null>(null);
  const [spread, setSpread] = useState<TarotCard[]>(() => shuffleCards(TAROT_CARDS));
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [direction, setDirection] = useState<CardDirection | null>(null);
  const [numbers, setNumbers] = useState<number[] | null>(null);

  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function handleBirthDateChange(value: string) {
    setBirthDateInput(value);
    const date = parseBirthDate(value);
    setZodiac(date ? getZodiacSign(date) : null);
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
        <label className={styles.fieldLabel} htmlFor="birthDate">
          생년월일
        </label>
        <input
          id="birthDate"
          type="date"
          className={styles.dateInput}
          value={birthDateInput}
          onChange={(e) => handleBirthDateChange(e.target.value)}
        />
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

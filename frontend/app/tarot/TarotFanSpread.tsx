"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./TarotFanSpread.module.css";
import { computeFanTransform } from "../../lib/fanLayout";
import type { TarotCard } from "../../lib/tarotCards";

interface TarotFanSpreadProps {
  cards: TarotCard[];
  onPick: (card: TarotCard) => void;
  dealKey: number;
}

const DEFAULT_CONTAINER_WIDTH = 480;

export default function TarotFanSpread({ cards, onPick, dealKey }: TarotFanSpreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH);
  const [dealt, setDealt] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Plays the "collapsed -> fanned out" dealing animation on mount, and again
  // every time dealKey changes (the "다시 섞기" button). Does NOT replay when
  // `cards` merely shrinks by one (a card was picked) — dealKey stays the same
  // in that case, so the remaining cards just reflow via the CSS transition.
  useLayoutEffect(() => {
    setDealt(false);
  }, [dealKey]);

  useEffect(() => {
    if (dealt) return;
    const id = requestAnimationFrame(() => setDealt(true));
    return () => cancelAnimationFrame(id);
  }, [dealt]);

  return (
    <div ref={containerRef} className={styles.fanContainer}>
      {cards.map((card, i) => {
        const transform = dealt
          ? computeFanTransform(i, cards.length, containerWidth)
          : { x: 0, y: 0, rotate: 0 };
        return (
          <button
            key={card.number}
            type="button"
            className={styles.fanCard}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotate}deg) scale(${dealt ? 1 : 0.6})`,
              opacity: dealt ? 1 : 0,
              transitionDelay: `${i * 18}ms`,
              zIndex: i,
            }}
            onClick={() => onPick(card)}
            aria-label={`카드 ${i + 1}`}
          >
            <span className={styles.fanCardSymbol}>✦</span>
          </button>
        );
      })}
    </div>
  );
}

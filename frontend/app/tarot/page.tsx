"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, buildFanDeck, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumberSets } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import TarotFanSpread from "./TarotFanSpread";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeGenerateUsage, formatRemainingUsage } from "../../lib/progress";
import {
  requestTarotInterpretation,
  type TarotCardInput,
  type TarotInterpretationMode,
} from "../../lib/tarotInterpretation";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
import { saveNumbers } from "../../lib/savedNumbers";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type ViewMode = "unset" | "tarot-only" | "with-zodiac" | "number-draw";

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
  const [viewMode, setViewMode] = useState<ViewMode>("unset");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState<number | null>(null);
  const [fanDeck, setFanDeck] = useState<TarotCard[]>(() => buildFanDeck(TAROT_CARDS, new Set()));
  const [dealKey, setDealKey] = useState(0);

  // single-card modes ("with-zodiac", "number-draw")
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [direction, setDirection] = useState<CardDirection | null>(null);

  // "tarot-only" mode: 3-card spread (과거/현재/미래)
  const [spreadSlots, setSpreadSlots] = useState<SpreadSlot[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // AI interpretation ("tarot-only", "with-zodiac")
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);

  // number draw ("number-draw")
  const [drawSets, setDrawSets] = useState(1);
  const setsInitialized = useRef(false);
  const [drawResult, setDrawResult] = useState<number[][] | null>(null);
  const [pendingDrawResult, setPendingDrawResult] = useState<number[][] | null>(null);
  const [drawAnimating, setDrawAnimating] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (progress && !setsInitialized.current) {
      setDrawSets(progress.maxSets);
      setsInitialized.current = true;
    }
  }, [progress]);

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

  const aiQuotaExhausted = progress ? progress.tarotUsage.used >= progress.tarotUsage.limit : false;
  const generateQuotaExhausted = progress ? progress.generateUsage.used >= progress.generateUsage.limit : false;

  const isSingleCardMode = viewMode === "with-zodiac" || viewMode === "number-draw";
  const zodiacRequired = viewMode === "with-zodiac";
  const canPickCard = isSingleCardMode && (!zodiacRequired || zodiac !== null);

  // the card currently in the "drag to reveal" step, regardless of mode
  const revealingCard = isSingleCardMode
    ? selected && !direction
      ? selected
      : null
    : spreadSlots.length > 0 && spreadSlots[spreadSlots.length - 1].direction === null
      ? spreadSlots[spreadSlots.length - 1].card
      : null;

  function handleCardClick(card: TarotCard) {
    if (isSingleCardMode) {
      if (selected) return;
      setSelected(card);
    } else if (viewMode === "tarot-only") {
      if (spreadSlots.length >= SPREAD_SIZE || revealingCard) return;
      setSpreadSlots((prev) => [...prev, { card, direction: null }]);
      setFanDeck((prev) => prev.filter((c) => c.number !== card.number));
    }
  }

  function handleReshuffleFan() {
    const exclude =
      viewMode === "tarot-only" ? new Set(spreadSlots.map((s) => s.card.number)) : new Set<number>();
    setFanDeck(buildFanDeck(TAROT_CARDS, exclude));
    setDealKey((k) => k + 1);
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
    if (isSingleCardMode) {
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

  function buildCardInputs(): TarotCardInput[] {
    if (viewMode === "tarot-only") {
      return spreadSlots.map((slot, i) => ({
        cardNumber: slot.card.number,
        nameKo: slot.card.nameKo,
        keyword: slot.card.keyword,
        direction: slot.direction as CardDirection,
        positionLabel: SPREAD_POSITIONS[i],
      }));
    }
    if (selected && direction) {
      return [
        {
          cardNumber: selected.number,
          nameKo: selected.nameKo,
          keyword: selected.keyword,
          direction,
          positionLabel: null,
        },
      ];
    }
    return [];
  }

  async function handleRequestInterpretation() {
    if (!auth) return;
    setInterpreting(true);
    setInterpretationError(null);
    try {
      const mode: TarotInterpretationMode = viewMode === "tarot-only" ? "TAROT_ONLY" : "WITH_ZODIAC";
      const result = await requestTarotInterpretation(mode, buildCardInputs(), zodiac?.name ?? null, auth.token);
      setInterpretation(result.interpretationText);
      refreshProgress();
    } catch (err) {
      setInterpretationError(err instanceof Error ? err.message : "해석을 가져오지 못했어요. 다시 시도해주세요.");
    } finally {
      setInterpreting(false);
    }
  }

  async function handleDrawNumbers() {
    if (!auth || !selected || !direction) return;
    setDrawError(null);
    setDrawLoading(true);
    try {
      await consumeGenerateUsage(auth.token);
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : "오늘 번호생성 횟수를 다 쓰셨어요.");
      setDrawLoading(false);
      return;
    }
    refreshProgress();
    setDrawLoading(false);
    const sets = generateTarotNumberSets(selected, zodiac, direction, drawSets);
    setSavedIndices(new Set());
    setSaveErrors({});
    if (drawSets === 1) {
      setDrawResult(null);
      setPendingDrawResult(sets);
      setDrawAnimating(true);
    } else {
      setPendingDrawResult(null);
      setDrawAnimating(false);
      setDrawResult(sets);
      autoSaveDrawResult(sets);
    }
  }

  function handleDrawComplete() {
    setDrawResult(pendingDrawResult);
    if (pendingDrawResult) {
      autoSaveDrawResult(pendingDrawResult);
    }
    setPendingDrawResult(null);
    setDrawAnimating(false);
  }

  async function handleSaveSet(index: number, set: number[]) {
    if (!auth) return;
    setSavingIndex(index);
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      await saveNumbers("TAROT", set, auth.token);
      setSavedIndices((prev) => new Set(prev).add(index));
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : "저장에 실패했습니다.",
      }));
    } finally {
      setSavingIndex(null);
    }
  }

  async function autoSaveDrawResult(sets: number[][]) {
    if (!auth) return;
    for (let i = 0; i < sets.length; i++) {
      setSavingIndex(i);
      try {
        await saveNumbers("TAROT", sets[i], auth.token);
        setSavedIndices((prev) => new Set(prev).add(i));
      } catch (err) {
        setSaveErrors((prev) => ({
          ...prev,
          [i]: err instanceof Error ? err.message : "저장에 실패했습니다.",
        }));
      }
    }
    setSavingIndex(null);
  }

  function handleReset() {
    setFanDeck(buildFanDeck(TAROT_CARDS, new Set()));
    setDealKey((k) => k + 1);
    setSelected(null);
    setDirection(null);
    setSpreadSlots([]);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setInterpreting(false);
    setInterpretation(null);
    setInterpretationError(null);
    setDrawResult(null);
    setPendingDrawResult(null);
    setDrawAnimating(false);
    setDrawLoading(false);
    setDrawError(null);
    setSavedIndices(new Set());
    setSavingIndex(null);
    setSaveErrors({});
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

      {viewMode === "unset" && (
        <div className={styles.modeChoice}>
          <button
            type="button"
            className={styles.modeButton}
            onClick={() => setViewMode("tarot-only")}
            disabled={aiQuotaExhausted}
          >
            <span>타로만 보기</span>
            {progress && (
              <span className={styles.modeButtonUsage}>
                {aiQuotaExhausted ? "내일 다시 시도해주세요" : `AI 해석 ${formatRemainingUsage(progress.tarotUsage)} 남음`}
              </span>
            )}
          </button>
          <button
            type="button"
            className={styles.modeButton}
            onClick={() => setViewMode("with-zodiac")}
            disabled={aiQuotaExhausted}
          >
            <span>생년월일로 별자리도 함께 보기</span>
            {progress && (
              <span className={styles.modeButtonUsage}>
                {aiQuotaExhausted ? "내일 다시 시도해주세요" : `AI 해석 ${formatRemainingUsage(progress.tarotUsage)} 남음`}
              </span>
            )}
          </button>
          <button
            type="button"
            className={styles.modeButton}
            onClick={() => setViewMode("number-draw")}
            disabled={generateQuotaExhausted}
          >
            <span>번호 뽑기용 타로</span>
            {progress && (
              <span className={styles.modeButtonUsage}>
                {generateQuotaExhausted
                  ? "내일 다시 시도해주세요"
                  : `번호생성 ${formatRemainingUsage(progress.generateUsage)} 남음`}
              </span>
            )}
          </button>
        </div>
      )}

      {viewMode !== "unset" && (
        <button type="button" className={styles.changeModeLink} onClick={handleChangeMode}>
          ← 다른 방식으로 다시 시작하기
        </button>
      )}

      {isSingleCardMode && !selected && (
        <div className={styles.card}>
          <span className={styles.fieldLabel}>생년월일{viewMode === "number-draw" ? " (선택)" : ""}</span>
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
          {viewMode === "number-draw" && !zodiac && (
            <p className={styles.hint}>생년월일을 입력하지 않아도 카드만으로 번호를 뽑을 수 있어요.</p>
          )}
        </div>
      )}

      {isSingleCardMode && !selected && canPickCard && (
        <div className={styles.spreadWrapper}>
          <div className={styles.spreadHintRow}>
            <p className={styles.hint}>카드 한 장을 골라주세요.</p>
            <button type="button" className={styles.reshuffleButton} onClick={handleReshuffleFan}>
              다시 섞기
            </button>
          </div>
          <TarotFanSpread cards={fanDeck} onPick={handleCardClick} dealKey={dealKey} />
        </div>
      )}

      {viewMode === "tarot-only" && spreadSlots.length < SPREAD_SIZE && (
        <div className={styles.spreadWrapper}>
          {nextPositionLabel && (
            <div className={styles.spreadHintRow}>
              <p className={styles.hint}>
                "{nextPositionLabel}" 카드를 골라주세요. ({spreadSlots.length + 1}/{SPREAD_SIZE})
              </p>
              <button type="button" className={styles.reshuffleButton} onClick={handleReshuffleFan}>
                다시 섞기
              </button>
            </div>
          )}
          <div style={revealingCard ? { display: "none" } : undefined}>
            <TarotFanSpread cards={fanDeck} onPick={handleCardClick} dealKey={dealKey} />
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

          {!interpretation && !interpreting && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleRequestInterpretation}>
                {interpretationError ? "다시 시도" : "종합 해석 보기"}
              </button>
              {interpretationError && <p className={styles.hint}>{interpretationError}</p>}
            </>
          )}

          {interpreting && <p className={styles.hint}>카드를 읽는 중입니다...</p>}

          {interpretation && <p className={styles.interpretationText}>{interpretation}</p>}

          {!interpretation && (
            <button type="button" className={styles.resetButton} onClick={handleReset} disabled={interpreting}>
              다시 뽑기
            </button>
          )}
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

          {!interpretation && !interpreting && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleRequestInterpretation}>
                {interpretationError ? "다시 시도" : "종합 해석 보기"}
              </button>
              {interpretationError && <p className={styles.hint}>{interpretationError}</p>}
            </>
          )}

          {interpreting && <p className={styles.hint}>카드를 읽는 중입니다...</p>}

          {interpretation && <p className={styles.interpretationText}>{interpretation}</p>}

          {!interpretation && (
            <button type="button" className={styles.resetButton} onClick={handleReset} disabled={interpreting}>
              다시 뽑기
            </button>
          )}
        </div>
      )}

      {viewMode === "number-draw" && selected && direction && (
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

          {!drawResult && !drawAnimating && (
            <>
              <div className={styles.setsField}>
                {progress?.adjustableSets ? (
                  <>
                    <span>세트 수 (최대 {progress.maxSets})</span>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepperButton}
                        onClick={() => setDrawSets((s) => Math.max(1, s - 1))}
                        disabled={drawSets <= 1 || drawLoading}
                        aria-label="세트 수 감소"
                      >
                        −
                      </button>
                      <span className={styles.stepperValue}>{drawSets}</span>
                      <button
                        type="button"
                        className={styles.stepperButton}
                        onClick={() => setDrawSets((s) => Math.min(progress.maxSets, s + 1))}
                        disabled={drawSets >= progress.maxSets || drawLoading}
                        aria-label="세트 수 증가"
                      >
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <span>
                    세트 수: {progress?.maxSets ?? 1}세트 ({progress?.tier} 등급)
                  </span>
                )}
              </div>
              <button type="button" className={styles.generateButton} onClick={handleDrawNumbers} disabled={drawLoading}>
                {drawLoading ? "번호 뽑는 중..." : "번호 뽑기"}
              </button>
              {drawError && <p className={styles.hint}>{drawError}</p>}
            </>
          )}

          {drawAnimating && pendingDrawResult && (
            <div className={styles.animationWrapper}>
              <LottoDrawAnimation numbers={pendingDrawResult[0]} onComplete={handleDrawComplete} />
            </div>
          )}

          {drawResult && (
            <div className={styles.drawResultList}>
              {drawResult.map((set, i) => (
                <div key={i} className={styles.drawResultRow}>
                  <div className={styles.numbersRow}>
                    {set.map((n) => (
                      <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => handleSaveSet(i, set)}
                    disabled={savedIndices.has(i) || savingIndex === i || !saveErrors[i]}
                  >
                    {savedIndices.has(i)
                      ? "저장됨"
                      : savingIndex === i
                        ? "저장 중..."
                        : saveErrors[i]
                          ? "다시 저장"
                          : "저장 중..."}
                  </button>
                  {saveErrors[i] && <p className={styles.saveError}>{saveErrors[i]}</p>}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
            disabled={drawLoading || drawAnimating}
          >
            다시 뽑기
          </button>
        </div>
      )}
    </div>
  );
}

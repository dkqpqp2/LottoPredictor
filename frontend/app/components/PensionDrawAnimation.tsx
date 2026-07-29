"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PensionDrawAnimation.module.css";

const SPIN_INTERVAL_MS = 70;
const STOP_STAGGER_MS = 450;
const FINISH_PAUSE_MS = 500;

interface PensionDrawAnimationProps {
  groupNo: number;
  number: string;
  onComplete: () => void;
}

export default function PensionDrawAnimation({ groupNo, number, onComplete }: PensionDrawAnimationProps) {
  const finalValues = useRef([String(groupNo), ...number.split("")]).current;
  const [displayValues, setDisplayValues] = useState<string[]>(finalValues.map(() => "0"));
  const completedRef = useRef(false);
  const spinIntervalsRef = useRef<number[]>([]);
  const stopTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    let stoppedCount = 0;

    function complete() {
      if (completedRef.current) return;
      completedRef.current = true;
      spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
      stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      setDisplayValues(finalValues);
      window.setTimeout(onComplete, FINISH_PAUSE_MS);
    }

    finalValues.forEach((finalValue, i) => {
      const isGroupReel = i === 0;
      const cycleMax = isGroupReel ? 5 : 10;
      const cycleOffset = isGroupReel ? 1 : 0;

      const intervalId = window.setInterval(() => {
        setDisplayValues((prev) => {
          const next = [...prev];
          next[i] = String(Math.floor(Math.random() * cycleMax) + cycleOffset);
          return next;
        });
      }, SPIN_INTERVAL_MS);
      spinIntervalsRef.current.push(intervalId);

      const stopTimeoutId = window.setTimeout(() => {
        window.clearInterval(intervalId);
        setDisplayValues((prev) => {
          const next = [...prev];
          next[i] = finalValue;
          return next;
        });
        stoppedCount += 1;
        if (stoppedCount === finalValues.length) {
          complete();
        }
      }, STOP_STAGGER_MS * (i + 1));
      stopTimeoutsRef.current.push(stopTimeoutId);
    });

    return () => {
      spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
      stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSkip() {
    if (completedRef.current) return;
    completedRef.current = true;
    spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
    stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    setDisplayValues(finalValues);
    window.setTimeout(onComplete, FINISH_PAUSE_MS);
  }

  return (
    <div className={styles.wrapper} onClick={handleSkip}>
      <p className={styles.hint}>탭하면 바로 결과 보기</p>
      <div className={styles.reels}>
        <span className={styles.reel}>{displayValues[0]}조</span>
        {displayValues.slice(1).map((d, i) => (
          <span key={i} className={styles.reel}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

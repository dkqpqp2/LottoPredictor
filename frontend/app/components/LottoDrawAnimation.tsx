"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LottoDrawAnimation.module.css";
import { getBallColor } from "../../lib/lottoBall";

const CANVAS_SIZE = 300;
const DRUM_RADIUS = 130;
const CENTER = CANVAS_SIZE / 2;
const BALL_RADIUS = 13;
const MIX_DURATION_MS = 2500;
const DRAW_INTERVAL_MS = 700;
const EXIT_DURATION_MS = 450;
const FINISH_PAUSE_MS = 500;
const EXIT_X = CENTER;
const EXIT_Y = 24;

interface PhysicsBall {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  extracting: boolean;
  extractStart: number;
  startX: number;
  startY: number;
  removed: boolean;
}

interface LottoDrawAnimationProps {
  numbers: number[];
  onComplete: () => void;
}

function createBalls(): PhysicsBall[] {
  const balls: PhysicsBall[] = [];
  for (let n = 1; n <= 45; n++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (DRUM_RADIUS - BALL_RADIUS - 10);
    balls.push({
      n,
      x: CENTER + Math.cos(angle) * dist,
      y: CENTER + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      extracting: false,
      extractStart: 0,
      startX: 0,
      startY: 0,
      removed: false,
    });
  }
  return balls;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function LottoDrawAnimation({ numbers, onComplete }: LottoDrawAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<PhysicsBall[]>(createBalls());
  const startTimeRef = useRef<number | null>(null);
  const drawnCountRef = useRef(0);
  const skippedRef = useRef(false);
  const completedRef = useRef(false);
  const [drawn, setDrawn] = useState<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    let frameId: number;

    function finish() {
      if (completedRef.current) return;
      completedRef.current = true;
      setDrawn(numbers);
      window.setTimeout(onComplete, FINISH_PAUSE_MS);
    }

    function step(timestamp: number) {
      if (skippedRef.current) {
        finish();
        return;
      }

      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const balls = ballsRef.current;

      for (const ball of balls) {
        if (ball.removed) continue;

        if (ball.extracting) {
          const t = Math.min(1, (timestamp - ball.extractStart) / EXIT_DURATION_MS);
          const eased = easeOutCubic(t);
          ball.x = ball.startX + (EXIT_X - ball.startX) * eased;
          ball.y = ball.startY + (EXIT_Y - ball.startY) * eased;
          if (t >= 1) {
            ball.removed = true;
            setDrawn((prev) => (prev.includes(ball.n) ? prev : [...prev, ball.n]));
          }
          continue;
        }

        const dx = ball.x - CENTER;
        const dy = ball.y - CENTER;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        const swirl = 0.045;
        ball.vx += tangentX * swirl;
        ball.vy += tangentY * swirl;
        ball.vx += (Math.random() - 0.5) * 0.08;
        ball.vy += (Math.random() - 0.5) * 0.08;

        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const maxSpeed = 3.2;
        if (speed > maxSpeed) {
          ball.vx = (ball.vx / speed) * maxSpeed;
          ball.vy = (ball.vy / speed) * maxSpeed;
        }

        ball.x += ball.vx;
        ball.y += ball.vy;

        const ndx = ball.x - CENTER;
        const ndy = ball.y - CENTER;
        const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
        const maxDist = DRUM_RADIUS - BALL_RADIUS;
        if (ndist > maxDist) {
          const nx = ndx / ndist;
          const ny = ndy / ndist;
          ball.x = CENTER + nx * maxDist;
          ball.y = CENTER + ny * maxDist;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
      }

      if (elapsed >= MIX_DURATION_MS) {
        const drawIndex = Math.floor((elapsed - MIX_DURATION_MS) / DRAW_INTERVAL_MS);
        while (drawnCountRef.current <= drawIndex && drawnCountRef.current < numbers.length) {
          const targetN = numbers[drawnCountRef.current];
          const ball = balls.find((b) => b.n === targetN && !b.extracting && !b.removed);
          if (ball) {
            ball.extracting = true;
            ball.extractStart = timestamp;
            ball.startX = ball.x;
            ball.startY = ball.y;
          }
          drawnCountRef.current += 1;
        }
      }

      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      context.beginPath();
      context.arc(CENTER, CENTER, DRUM_RADIUS, 0, Math.PI * 2);
      context.fillStyle = "rgba(99, 102, 241, 0.06)";
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = "rgba(99, 102, 241, 0.35)";
      context.stroke();

      for (const ball of balls) {
        if (ball.removed) continue;
        context.beginPath();
        context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        context.fillStyle = getBallColor(ball.n);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = "bold 10px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(ball.n), ball.x, ball.y);
      }

      const allDone =
        drawnCountRef.current >= numbers.length && balls.every((b) => !numbers.includes(b.n) || b.removed);

      if (allDone) {
        finish();
        return;
      }

      frameId = requestAnimationFrame(step);
    }

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [numbers, onComplete]);

  function handleSkip() {
    skippedRef.current = true;
  }

  return (
    <div className={styles.wrapper} onClick={handleSkip}>
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className={styles.canvas} />
      <p className={styles.hint}>{drawn.length < numbers.length ? "탭하면 바로 결과 보기" : "결과 확정 중..."}</p>
      <div className={styles.drawnRow}>
        {drawn.map((n) => (
          <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

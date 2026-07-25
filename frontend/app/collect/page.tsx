"use client";

import { useState } from "react";
import styles from "./collect.module.css";
import { triggerCrawl, type SyncResult } from "../../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

export default function CollectPage() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleCollect() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await triggerCrawl(auth.token);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>회차 수집</h1>
          <p className={styles.subtitle}>관리자 전용 기능입니다. 로그인이 필요해요.</p>
        </section>
        <a href={getKakaoAuthorizeUrl()} className={styles.collectButton}>
          카카오로 로그인
        </a>
      </div>
    );
  }

  if (!auth.isAdmin) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>회차 수집</h1>
        </section>
        <p className={styles.error}>관리자 계정만 이용할 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>회차 수집</h1>
        <p className={styles.subtitle}>
          실행하면 최신 회차까지 순서대로 수집합니다. 이미 최신 상태면 아무 일도 일어나지 않습니다.
        </p>
      </section>

      <button type="button" className={styles.collectButton} onClick={handleCollect} disabled={loading}>
        {loading ? "수집 중..." : "수집하기"}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.resultBox}>
          <div className={styles.resultStat}>
            <span className={styles.resultCount}>{result.synced.length}</span>
            <span className={styles.resultLabel}>개 회차 수집됨</span>
          </div>
          {result.synced.length > 0 && (
            <div className={styles.syncedList}>
              {result.synced.map((n) => (
                <span key={n} className={styles.syncedBadge}>
                  {n}
                </span>
              ))}
            </div>
          )}
          {result.skipped.length > 0 && (
            <div className={styles.skippedList}>
              <span className={styles.resultLabel}>건너뛴 회차 {result.skipped.length}개</span>
              {result.skipped.map((s) => (
                <span key={s.drawNo} className={styles.skippedItem}>
                  {s.drawNo}회: {s.reason}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

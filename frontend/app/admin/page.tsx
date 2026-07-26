"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { triggerCrawl, type SyncResult } from "../../lib/api";
import { getAdminUsers, setUserTier, resetUserUsage, type AdminUser } from "../../lib/admin";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "자동 (포인트 기준)" },
  { value: "BEGINNER", label: "뽑기 초심자" },
  { value: "APPRENTICE", label: "뽑기 견습생" },
  { value: "EXPERT", label: "뽑기 고수" },
  { value: "LOTTO_GOD", label: "뽑기의 신" },
];

export default function AdminPage() {
  const { auth } = useAuth();
  const { refreshProgress } = useProgress();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!auth || !auth.isAdmin) return;
    getAdminUsers(auth.token)
      .then((data) => {
        setUsers(data);
        setSelections(Object.fromEntries(data.map((u) => [u.id, u.forcedTier ?? ""])));
      })
      .catch((err) => setUsersError(err instanceof Error ? err.message : "회원 목록을 불러오지 못했습니다."));
  }, [auth]);

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

  async function handleApplyTier(userId: number) {
    if (!auth) return;
    setSavingUserId(userId);
    setUsersError(null);
    try {
      const selected = selections[userId] ?? "";
      const updated = await setUserTier(userId, selected === "" ? null : selected, auth.token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      refreshProgress();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "등급 변경에 실패했습니다.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleResetUsage(userId: number) {
    if (!auth) return;
    setResettingUserId(userId);
    setUsersError(null);
    try {
      await resetUserUsage(userId, auth.token);
      refreshProgress();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "횟수 초기화에 실패했습니다.");
    } finally {
      setResettingUserId(null);
    }
  }

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>관리자 페이지</h1>
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
          <h1 className={styles.title}>관리자 페이지</h1>
        </section>
        <p className={styles.error}>관리자 계정만 이용할 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>관리자 페이지</h1>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>회차 수집</h2>
        <p className={styles.subtitle}>
          실행하면 최신 회차까지 순서대로 수집합니다. 이미 최신 상태면 아무 일도 일어나지 않습니다.
        </p>

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
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>회원 관리</h2>

        {usersError && <p className={styles.error}>{usersError}</p>}

        <div className={styles.userList}>
          {users.map((user) => (
            <div key={user.id} className={styles.userRow}>
              <div className={styles.userInfo}>
                <span className={styles.userNickname}>{user.nickname}</span>
                <span className={styles.userMeta}>
                  {user.tier} · 누적 {user.totalPoints}P · {new Date(user.joinedAt).toLocaleDateString("ko-KR")} 가입
                  {user.forcedTier && " · 강제 등급 적용중"}
                </span>
              </div>
              <div className={styles.userActions}>
                <select
                  className={styles.tierSelect}
                  value={selections[user.id] ?? ""}
                  onChange={(e) => setSelections((prev) => ({ ...prev, [user.id]: e.target.value }))}
                >
                  {TIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.applyButton}
                  onClick={() => handleApplyTier(user.id)}
                  disabled={savingUserId === user.id}
                >
                  {savingUserId === user.id ? "적용 중..." : "적용"}
                </button>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => handleResetUsage(user.id)}
                  disabled={resettingUserId === user.id}
                >
                  {resettingUserId === user.id ? "초기화 중..." : "오늘 횟수 초기화"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

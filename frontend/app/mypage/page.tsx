"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
import { groupSavedNumbers } from "../../lib/groupSavedNumbers";
import { getBallColor } from "../../lib/lottoBall";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const SOURCE_LABELS: Record<SavedNumberResult["source"], string> = {
  GENERATE: "번호생성",
  TAROT: "타로",
};

export default function MyPage() {
  const { auth } = useAuth();
  const [savedNumbers, setSavedNumbers] = useState<SavedNumberResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
  }, [auth]);

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

  const groups = groupSavedNumbers(savedNumbers);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>지금까지 저장한 번호를 월별/주별로 모아봤어요.</p>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {!error && groups.length === 0 && <p className={styles.empty}>아직 저장한 번호가 없어요.</p>}

      {groups.map((month) => (
        <div key={month.monthLabel} className={styles.monthGroup}>
          <h2 className={styles.monthLabel}>{month.monthLabel}</h2>
          {month.weeks.map((week) => (
            <div key={week.weekStart} className={styles.weekGroup}>
              <span className={styles.weekLabel}>{week.weekStart} 주</span>
              <div className={styles.itemList}>
                {week.items.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <span className={styles.sourceBadge}>{SOURCE_LABELS[item.source]}</span>
                    <div className={styles.itemBalls}>
                      {item.numbers.map((n) => (
                        <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                          {n}
                        </span>
                      ))}
                    </div>
                    <span className={styles.itemMeta}>
                      {item.targetDrawNo}회 대상 · {new Date(item.savedAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

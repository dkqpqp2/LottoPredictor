"use client";

import { useEffect, useState } from "react";
import styles from "./draws.module.css";
import { getDraws, type DrawResponse } from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";

const PAGE_SIZE = 10;

export default function DrawsPage() {
  const [drawNoInput, setDrawNoInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [page, setPage] = useState(0);
  const [draws, setDraws] = useState<DrawResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(params: { drawNo?: number; date?: string; page: number }) {
    setError(null);
    getDraws({ ...params, size: PAGE_SIZE })
      .then(setDraws)
      .catch((err) => setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."));
  }

  useEffect(() => {
    load({ page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load({
      drawNo: drawNoInput ? Number(drawNoInput) : undefined,
      date: dateInput || undefined,
      page: 0,
    });
  }

  function handleReset() {
    setDrawNoInput("");
    setDateInput("");
    setPage(0);
    load({ page: 0 });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    load({ page: nextPage });
  }

  const isSearching = drawNoInput !== "" || dateInput !== "";

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>회차별 당첨번호 조회</h1>
        <p className={styles.subtitle}>회차 번호나 추첨일로 검색하거나, 최신 회차부터 목록을 볼 수 있습니다.</p>
      </section>

      <form className={styles.searchForm} onSubmit={handleSearch}>
        <input
          type="number"
          placeholder="회차 번호"
          value={drawNoInput}
          onChange={(e) => setDrawNoInput(e.target.value)}
        />
        <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
        <button type="submit">검색</button>
        {isSearching && (
          <button type="button" className={styles.resetButton} onClick={handleReset}>
            초기화
          </button>
        )}
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {draws && (
        <div className={styles.list}>
          {draws.length === 0 && <p className={styles.subtitle}>조회된 회차가 없습니다.</p>}
          {draws.map((draw) => (
            <div key={draw.drawNo} className={styles.drawCard}>
              <div className={styles.drawMeta}>
                <span className={styles.drawNo}>{draw.drawNo}회</span>
                <span className={styles.drawDate}>{draw.drawDate}</span>
              </div>
              <div className={styles.balls}>
                {draw.numbers.map((n) => (
                  <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                    {n}
                  </span>
                ))}
                <span className={styles.plus}>+</span>
                <span className={styles.ball} style={{ backgroundColor: getBallColor(draw.bonusNum) }}>
                  {draw.bonusNum}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isSearching && (
        <div className={styles.pagination}>
          <button disabled={page === 0} onClick={() => goToPage(page - 1)}>
            이전
          </button>
          <button disabled={!draws || draws.length < PAGE_SIZE} onClick={() => goToPage(page + 1)}>
            다음
          </button>
        </div>
      )}
    </div>
  );
}

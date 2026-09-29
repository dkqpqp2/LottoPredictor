"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithKakaoCode } from "../../../../lib/auth";
import { useAuth } from "../../../contexts/AuthContext";
import styles from "./callback.module.css";

export default function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const kakaoError = searchParams.get("error");
    if (kakaoError || !code) {
      setError("카카오 로그인이 취소되었거나 실패했습니다.");
      return;
    }

    let settled = false;
    const slowTimer = window.setTimeout(() => {
      if (settled) return;
      setSlow(true);
    }, 5000);
    const fallbackTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setError("카카오 로그인 응답이 오래 걸리고 있어요. 다시 시도해주세요.");
    }, 170000);

    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? "";
    loginWithKakaoCode(code, redirectUri)
      .then(({ token, nickname, isAdmin }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(slowTimer);
        window.clearTimeout(fallbackTimer);
        login(token, nickname, isAdmin);
        router.replace("/");
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(slowTimer);
        window.clearTimeout(fallbackTimer);
        setError("카카오 로그인에 실패했습니다.");
      });

    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <a href="/" className={styles.homeLink}>
          홈으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p>로그인 처리 중...</p>
      {slow && <p className={styles.hint}>서버를 깨우는 중이에요. 최대 2분 정도 걸릴 수 있어요.</p>}
    </div>
  );
}

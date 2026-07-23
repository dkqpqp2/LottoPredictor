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

  useEffect(() => {
    const code = searchParams.get("code");
    const kakaoError = searchParams.get("error");
    if (kakaoError || !code) {
      setError("카카오 로그인이 취소되었거나 실패했습니다.");
      return;
    }

    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? "";
    loginWithKakaoCode(code, redirectUri)
      .then(({ token, nickname }) => {
        login(token, nickname);
        router.replace("/");
      })
      .catch(() => setError("카카오 로그인에 실패했습니다."));
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
    </div>
  );
}

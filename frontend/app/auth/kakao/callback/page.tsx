"use client";

import { Suspense } from "react";
import KakaoCallbackContent from "./KakaoCallbackContent";

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<p>로그인 처리 중...</p>}>
      <KakaoCallbackContent />
    </Suspense>
  );
}

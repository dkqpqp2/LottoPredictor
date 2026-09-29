"use client";

import type { ReactNode } from "react";
import { getKakaoAuthorizeUrl, warmBackend } from "../../lib/auth";

interface KakaoLoginLinkProps {
  className?: string;
  children: ReactNode;
}

export default function KakaoLoginLink({ className, children }: KakaoLoginLinkProps) {
  return (
    <a href={getKakaoAuthorizeUrl()} className={className} onClick={warmBackend}>
      {children}
    </a>
  );
}

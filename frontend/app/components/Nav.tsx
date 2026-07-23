"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/generate", label: "번호생성" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
  { href: "/collect", label: "수집하기" },
];

export default function Nav() {
  const pathname = usePathname();
  const { auth, logout } = useAuth();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandDot} />
        로타로
      </Link>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`${styles.link} ${pathname === link.href ? styles.linkActive : ""}`}
        >
          {link.label}
        </Link>
      ))}
      {auth ? (
        <div className={styles.authSection}>
          <span className={styles.authNickname}>{auth.nickname}님</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            로그아웃
          </button>
        </div>
      ) : (
        <a href={getKakaoAuthorizeUrl()} className={styles.loginLink}>
          로그인
        </a>
      )}
    </nav>
  );
}

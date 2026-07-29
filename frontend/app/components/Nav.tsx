"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/tarot", label: "타로" },
  { href: "/generate", label: "번호생성" },
  { href: "/pension", label: "연금복권" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
];

export default function Nav() {
  const pathname = usePathname();
  const { auth, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandDot} />
        로타로
      </Link>

      <button
        type="button"
        className={styles.menuToggle}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={menuOpen}
      >
        <span className={styles.menuIcon} />
      </button>

      <div className={`${styles.links} ${menuOpen ? styles.linksOpen : ""}`}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${pathname === link.href ? styles.linkActive : ""}`}
          >
            {link.label}
          </Link>
        ))}
        {auth?.isAdmin && (
          <Link href="/admin" className={`${styles.link} ${pathname === "/admin" ? styles.linkActive : ""}`}>
            관리자 페이지
          </Link>
        )}
        {auth ? (
          <div className={styles.authSection}>
            <Link href="/mypage" className={`${styles.link} ${pathname === "/mypage" ? styles.linkActive : ""}`}>
              마이페이지
            </Link>
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
      </div>
    </nav>
  );
}

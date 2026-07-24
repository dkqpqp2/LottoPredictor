import Link from "next/link";
import styles from "./page.module.css";

const FEATURES = [
  {
    href: "/tarot",
    title: "타로 운세",
    description: "카드를 뽑고 방향을 정해 나만의 타로 리딩과 행운의 번호를 받아보세요.",
  },
  {
    href: "/generate",
    title: "번호 생성",
    description: "역대 당첨번호 출현 빈도를 반영한 가중치 방식으로 번호를 뽑아드려요.",
  },
  {
    href: "/stats",
    title: "통계 & 회차조회",
    description: "번호별 출현 통계와 역대 당첨번호를 한눈에 확인하세요.",
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>로타로</h1>
        <p className={styles.subtitle}>타로 카드와 로또 통계로 만나는, 나만의 특별한 번호</p>
        <Link href="/tarot" className={styles.ctaButton}>
          타로 보러가기
        </Link>
      </section>

      <section className={styles.featureGrid}>
        {FEATURES.map((feature) => (
          <Link key={feature.href} href={feature.href} className={styles.featureCard}>
            <span className={styles.featureTitle}>{feature.title}</span>
            <p className={styles.featureDescription}>{feature.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

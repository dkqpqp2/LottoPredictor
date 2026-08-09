import type { Metadata } from "next";

const SITE_URL = "https://lotto-predictor-gilt.vercel.app";
const SITE_NAME = "로타로";
const TITLE = "연금복권720+ 번호 뽑기";
const DESCRIPTION = "조 1~5와 6자리 번호를 완전 무작위로 뽑고, 최근 당첨번호와 이번 주 추천 번호까지 확인해보세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/pension`,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PensionLayout({ children }: { children: React.ReactNode }) {
  return children;
}

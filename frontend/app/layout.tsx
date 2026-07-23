import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "./components/Nav";
import { AuthProvider } from "./contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://lotto-predictor-gilt.vercel.app";
const SITE_NAME = "로타로";
const SITE_DESCRIPTION =
  "역대 로또 6/45 당첨번호 통계로 번호를 생성하고, 타로 카드와 별자리로 재미있는 운세 번호도 뽑아보세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - 로또 통계 & 타로 운세`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["로또", "로또 번호", "로또 통계", "로또 생성기", "번호 생성", "로또 6/45", "타로", "타로 운세", "별자리"],
  openGraph: {
    title: `${SITE_NAME} - 로또 통계 & 타로 운세`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - 로또 통계 & 타로 운세`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

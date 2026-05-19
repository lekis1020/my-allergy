import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileDrawerProvider } from "@/components/layout/mobile-drawer-context";
import { MobileDrawerWrapper } from "@/components/layout/mobile-drawer-wrapper";
import { CommentNotificationsProvider } from "@/components/comments/comment-notifications-provider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-allergy.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "My Allergy - Allergy & Clinical Immunology Research Portal",
    template: "%s | My Allergy",
  },
  description:
    "알레르기 전문의가 큐레이션하는 연구 포털. 9개 핵심 저널의 최신 논문을 AI 분석과 함께 제공합니다. Expert-curated allergy & immunology research with AI-powered analysis.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "My Allergy",
    title: "My Allergy - Allergy & Clinical Immunology Research Portal",
    description:
      "알레르기 전문의가 큐레이션하는 연구 포털. AI 기반 논문 분석, 트렌드 리포트, 전문가 커뮤니티.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: "My Allergy",
    description:
      "Expert-curated allergy & immunology research portal with AI-powered analysis.",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-8245767086450488" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
        <link rel="preload" href="/api/papers?limit=10" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} antialiased`}>
        {/* Google Funding Choices (IAB TCF v2.2 CMP) — must load before AdSense */}
        <Script
          id="google-fc-present"
          strategy="beforeInteractive"
        >{`(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){var iframe=document.createElement('iframe');iframe.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';iframe.name='googlefcPresent';document.body.appendChild(iframe);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`}</Script>
        <Script
          async
          src="https://fundingchoicesmessages.google.com/i/pub-8245767086450488?ers=2"
          strategy="afterInteractive"
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8245767086450488"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <MobileDrawerProvider>
          <CommentNotificationsProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 pb-16 md:pb-0">{children}</main>
              <Footer />
            </div>
            <MobileDrawerWrapper />
            <MobileBottomNav />
          </CommentNotificationsProvider>
        </MobileDrawerProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "@/styles/editor-overrides.css";
import { Providers } from "./providers";
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Correcta",
  description: "AI-powered exam correction platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale) ?? DEFAULT_LOCALE;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

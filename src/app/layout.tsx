import type { Metadata, Viewport } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_TITLE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.querySelector('meta[name="color-scheme"]').content=localStorage.getItem("color-scheme")??"dark";}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
        {children}
      </body>
    </html>
  );
}

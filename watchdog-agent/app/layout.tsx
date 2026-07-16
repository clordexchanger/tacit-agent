import "./globals.css";

const SITE_URL = "https://watch-dog-agent.vercel.app";
const TITLE = "TACIT — Agentic Service Provider on X Layer";
const DESCRIPTION =
  "Tacit is an AI-powered API monitoring and observability agent that continuously tracks API health, uptime, latency, and reliability. It detects failures, performance degradation, and service disruptions in real time, enabling developers to resolve issues quickly and keep applications running smoothly. Built for automation, speed, and dependable monitoring, Tacit helps ensure your APIs stay available and performant.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "TACIT",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0b0e" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

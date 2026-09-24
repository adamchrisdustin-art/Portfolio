import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const SITE_URL = "https://adamdustin.me";
const SITE_TITLE = "Adam Dustin — RevOps, Deal Desk & Agentic Data Systems";
const SITE_DESCRIPTION =
  "Revenue Operations and Deal Desk leader building agentic data pipelines and CRM tooling at the intersection of healthcare analytics and AI.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Adam Dustin",
  },
  description: SITE_DESCRIPTION,
  // Powers the rich preview LinkedIn (and other platforms) render when this
  // link is shared, e.g. in a profile's Featured section - the image itself
  // comes from app/opengraph-image.tsx via Next's file-convention metadata API.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Adam Dustin",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

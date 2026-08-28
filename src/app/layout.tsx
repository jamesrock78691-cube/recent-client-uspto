import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "USPTO Monitor - Patent Application Tracking",
  description: "Track USPTO patent applications, send emails, and sync to Google Sheets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

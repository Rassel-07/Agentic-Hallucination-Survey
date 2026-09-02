import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '5in1 Hotel Agent — Research Capstone & Live Pipeline',
  description: '5in1 Hotel Agent: Hallucination Mitigation and Neurosymbolic Protection Framework with Qwen3 and Kaggle Hotel Booking Dataset.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

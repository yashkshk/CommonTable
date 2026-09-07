import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Common Table | Campus Canteen',
  description:
    'Your campus canteen. Explore fresh meals, find your department space, and order with your staff coin wallet.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

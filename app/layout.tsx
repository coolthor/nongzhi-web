import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "農知 NongZhi — AI 病蟲害辨識",
  description: "拍照上傳，AI 即時辨識作物病蟲害並提供處理建議",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

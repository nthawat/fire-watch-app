export const metadata = {
  title: 'FireWatch — ระบบเฝ้าระวังไฟป่าประเทศไทย',
  description: 'ระบบติดตามและแจ้งเตือนไฟป่าแบบ Real-time ครอบคลุมทั่วประเทศไทย',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

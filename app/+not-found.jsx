import { Redirect } from 'expo-router'
import { useAuth } from '../src/state/AuthContext'

/*
  BİLİNMEYEN ADRES — web'deki `<Route path="*" element={<Navigate to="/kesfet" replace />} />`
  karşılığı (frontend/src/App.jsx).

  2026-09-23'te eklendi: `dersmate://akis` derin bağlantısı o gün öldü (ekran silindi,
  önerileri Keşfet'in varsayılan kipine döndü). Bu dosya olmasaydı expo-router'ın kendi
  "Unhandled <Link>" ekranı çıkardı — geliştirici dili, kullanıcıya hiçbir şey anlatmayan
  bir çıkmaz.

  ⛔ SABİT HEDEF VERİLEMEZ, oturum durumu sorulmak ZORUNDA. Korunan ekranların HEPSİ
  `Stack.Protected guard={isAuthenticated}` içinde tanımlı (app/_layout.jsx): guard false
  iken o ekranlar rota ağacında HİÇ YOK. Oturumsuz bir kullanıcıyı koşulsuzca `/kesfet`e
  yollamak, çözülemeyen adresi yeniden bu ekrana düşürür — yani sonsuz döngü.

  ⚠️ `hazir` BEKLENİYOR: SecureStore async, ilk render'da oturumun var olup olmadığı
  bilinmiyor (bkz. AuthContext). Beklenmeseydi oturumu açık olan kullanıcı, derin
  bağlantıyla açılan her bilinmeyen adreste bir an giriş ekranına atılırdı.
*/
export default function Bulunamadi() {
  const { isAuthenticated, hazir } = useAuth()

  // Oturum okunana kadar hiçbir yönlendirme kararı verilmez; kök kabuk splash'i tutuyor.
  if (!hazir) return null

  return <Redirect href={isAuthenticated ? '/kesfet' : '/giris'} />
}

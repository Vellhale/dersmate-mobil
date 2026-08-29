import { Stack } from 'expo-router'
import { zemin } from '../../src/lib/theme'

/*
  GİRİŞ YIĞINI. Başlık çubuğu yok: Login/Register kendi marka panelini çiziyor
  (web'deki AuthShell kararının mobil karşılığı — tek ekran, kaydırmasız, bölünmüş düzen).

  anchor AÇIKÇA 'giris': oturumsuz kullanıcının guard düşüşünde (açılış, çıkış, 401)
  hangi ekrana ineceği, aksi halde expo-router'ın belgelenmemiş rota sıralamasına
  (ad uzunluğu + dosya tarama sırası) emanet kalıyordu — 'giris' ile 'kayit' beraberken
  bugün şans eseri doğru çalışıyordu, gruba yeni bir dosya eklemek bozabilirdi.
*/
export const unstable_settings = { anchor: 'giris' }

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: zemin },
      }}
    />
  )
}

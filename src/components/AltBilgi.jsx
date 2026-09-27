import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useIzin } from '../state/IzinContext'
import { KunyeSatiri } from './Kunye'
import { AltBilgiBaglantisi } from './MetinBaglantisi'

/*
  ALT BİLGİ — sayfanın dibindeki tek şerit (2026-09-26).

  İLKE: alt bilgi yalnızca iki şey taşır: (1) sayfa bağlantıları (Hakkımızda ve yasal
  metinler), (2) künye. Ayar ve eylem (bildirim ayarları, rehber, çıkış, hesap silme)
  buraya GİRMEZ; yeri ayarlar. Tek bileşen, tek bağlantı biçimi (AltBilgiBaglantisi),
  tek künye (KunyeSatiri). Kullanan yüzeyler: Profil, AuthKabuk (giriş, kayıt, parola
  sıfırlama) ve Hakkımızda. Yeni bir yüzeye alt bilgi gerekiyorsa bu bileşen çağrılır,
  elle bağlantı şeridi yazılmaz.

  NOKTA AYIRICI YOK: flex-wrap'te sarılan satırın sonunda asılı bir "·" kalıyordu.
  gap-x-5 boşluğu sarılmada da temiz duruyor. 320dp'de üç bağlantı tek satıra sığıyor;
  büyük yazıda kendiliğinden ortalı ikinci satıra iniyor, ayrı bir dal gerekmiyor.

  SIRA SABİT: Hakkımızda · Kullanım koşulları · Gizlilik. Etiketler hedef sayfaların
  başlıklarıyla aynı (kosullar.jsx → "Kullanım koşulları").

  ⚠️ OTURUMSUZ DA ÇALIŞIR: üç sayfa da kök Stack.Protected listelerinin DIŞINDA
  (app/_layout.jsx), yani giriş ekranından açılabiliyor. Listeye bir korunan rota
  eklenirse oturumsuz kullanıcı onu açamaz; buraya yalnızca herkese açık sayfa konur.

  @param gizle           Bulunulan sayfanın kendi bağlantısını çıkarır (['/hakkimizda']).
  @param veriTercihleri  Dördüncü öğe "Veri tercihleri" (izin sayfasını açar, rol button).
                         YALNIZCA oturumsuz yüzeyde (AuthKabuk): oturumsuz kullanıcının
                         ayarlar menüsü yok ve rıza her an geri alınabilmeli. Oturumlu
                         kullanıcıda bu giriş ayarlardadır.
*/

const SAYFALAR = [
  { yol: '/hakkimizda', etiket: 'Hakkımızda' },
  { yol: '/kosullar', etiket: 'Kullanım koşulları' },
  { yol: '/gizlilik', etiket: 'Gizlilik' },
]

export function AltBilgi({ className = '', gizle = [], veriTercihleri = false }) {
  const router = useRouter()
  const { ayarlariAc } = useIzin()

  return (
    <View className={`items-center gap-1 self-stretch border-t border-slate-200 pt-4 ${className}`}>
      <View className="flex-row flex-wrap justify-center gap-x-5">
        {SAYFALAR.filter((s) => !gizle.includes(s.yol)).map((s) => (
          <AltBilgiBaglantisi key={s.yol} etiket={s.etiket} onPress={() => router.push(s.yol)} />
        ))}
        {veriTercihleri ? (
          <AltBilgiBaglantisi etiket="Veri tercihleri" rol="button" onPress={ayarlariAc} />
        ) : null}
      </View>

      <KunyeSatiri />
    </View>
  )
}

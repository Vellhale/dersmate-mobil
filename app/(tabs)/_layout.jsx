import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { brand, beyaz, rose, slate, zemin } from '../../src/lib/theme'
import { AramaIkonu, ArtiIkonu, EvIkonu, KisiIkonu, MesajIkonu } from '../../src/components/Ikonlar'
import { useInbox } from '../../src/state/InboxContext'

/*
  ANA KABUK — Instagram düzeni: beş sekmeli alt bar. Web'deki Layout.jsx'in (sol ray)
  mobil karşılığı.

  SAĞLAYICILAR ARTIK BURADA DEĞİL, KÖKTE (app/_layout.jsx): sohbet ve profil yığın
  ekranları (tabs) grubunun dışında yaşıyor ve Inbox/Wallet'a onların da erişmesi
  gerekiyor. Buradaki useInbox köktekini okur — ikinci bağlantı yok.

  • Mesajlar rozeti unreadTotal'dan: web'de üst bardaki rozetin karşılığı burada
    tabBarBadge.

  SEKME DÜZENİ (Instagram konvansiyonu):
    Akış · Keşfet · ➕ Oluştur · Mesajlar · Profil

  Etiket YOK (ikon-only): Instagram dilinin imzası. Erişilebilirlik kaybolmuyor —
  her sekmenin title'ı ekran okuyucuya gidiyor. Aktif sekme, web'deki ray gibi
  KALIN çizgi + marka rengiyle ayrışır; pasif sekme slate-400 ince çizgi.

  ORTA SEKME DOLGULU DAİRE: "ilan oluştur" gezinme değil EYLEM — görsel dili de
  farklı olmalı (Instagram'ın + kutusu gibi). Dolgu brand-600: beyaz artı 4.90:1,
  brand-500 zeminde 3.89:1 kalırdı (web'deki buton kuralıyla aynı gerekçe).
*/

function OlusturDugmesi({ focused }) {
  return (
    <View
      className={`h-9 w-12 items-center justify-center rounded-xl
                  ${focused ? 'bg-brand-700' : 'bg-brand-600'}`}
    >
      <ArtiIkonu renk={beyaz} boy={20} kalinlik={2.5} />
    </View>
  )
}

export default function TabsLayout() {
  const { unreadTotal } = useInbox()

  const ikon = (Ikon) => {
    // Aktif/pasif ayrımı web'deki rayla aynı dil: renk + çizgi ağırlığı.
    const Bilesen = ({ focused }) => (
      <Ikon renk={focused ? brand[600] : slate[400]} boy={26} kalinlik={focused ? 2.4 : 2} />
    )
    return Bilesen
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: brand[600],
        tabBarInactiveTintColor: slate[400],
        tabBarStyle: {
          backgroundColor: beyaz,
          borderTopColor: slate[200],
        },
        sceneStyle: { backgroundColor: zemin },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Akış', tabBarIcon: ikon(EvIkonu) }} />
      <Tabs.Screen name="kesfet" options={{ title: 'Keşfet', tabBarIcon: ikon(AramaIkonu) }} />
      <Tabs.Screen
        name="olustur"
        options={{ title: 'Ders İlanı Oluştur', tabBarIcon: OlusturDugmesi }}
      />
      <Tabs.Screen
        name="mesajlar"
        options={{
          title: 'Mesajlar',
          tabBarIcon: ikon(MesajIkonu),
          // Okunmamış toplamı: web'deki üst bar rozetinin karşılığı. 0 ise rozet hiç
          // çizilmez — boş kırmızı nokta "bir şey var" yalanı söylerdi.
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarBadgeStyle: { backgroundColor: rose[600], color: beyaz, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: ikon(KisiIkonu) }} />
    </Tabs>
  )
}

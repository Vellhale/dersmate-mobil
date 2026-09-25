import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { brand } from '../src/lib/theme'
import {
  ADIMLAR,
  BILDIRIM_NOTU,
  DEGERLER,
  GUVENCELER,
  KAPANIS,
  NASIL,
  OZET,
} from '../src/lib/hakkimizdaMetni'
import { useAuth } from '../src/state/AuthContext'
import { AltBilgi } from '../src/components/AltBilgi'
import {
  AramaIkonu,
  ArtanIkonu,
  CuzdansizIkonu,
  GozIkonu,
  KanitIkonu,
  KepIkonu,
  KisilerIkonu,
  KitapIkonu,
  MesajIkonu,
  RoketIkonu,
  ToplulukIkonu,
} from '../src/components/Ikonlar'
import { MetinSayfasi } from '../src/components/MetinSayfasi'
import { Button, Card } from '../src/components/ui'

/*
  HAKKIMIZDA — web'deki pages/Hakkimizda.jsx'in portu.

  METİN BU DOSYADA DEĞİL (2026-09-26): src/lib/hakkimizdaMetni.js, web'dekiyle bayt bayt
  aynı dosya. Bu sayfa yalnızca düzeni ve anahtar → ikon çevirisini taşıyor. Metni
  değiştirmek isteyen önce web'deki kaynağı değiştirir, sonra kopyalar.

  YAPI: üç değer kartı (Misyon / Vizyon / Topluluk) → tek "Nasıl işliyor" kartı (altı
  adım, bildirim dipnotu, çağrı, üç güvence) → kapanış cümlesi → alt bilgi.

  • Değer kartları kendi aralarında gap-4: aile gibi okunsunlar; sonraki bölümle
    araları kabuğun gap-8'i kadar.
  • Adımlar KUTULU ikonla, güvenceler KUTUSUZ: birincil liste (ne yaparsın) ile ikincil
    liste (neye güvenirsin) aynı kartta ayrışsın. Adım ikonları çekmecedeki
    (Cekmece.jsx → OGELER) ikonların AYNISI: kullanıcı simgeyi menüden tanır ve metin
    "çekmece" demeden menüyü anlatmış olur. Menüde ikon değişirse burada da değişmeli.
  • "Nasıl işliyor" etiketi ikonsuz. ArtanIkonu puan güvencesine geçti; iki yerde
    olsaydı anlamı bulanırdı.

  WEB'DEN SAPMALAR:

  • ZEMİN PORT EDİLMEDİ. Web'in son hâli SayfaZemini'nin `zengin` yoğunluğunu (mesh
    havuzlar + ızgara dokusu) kullanıyor ve kartlar bu yüzden CAM (bg-white/80). RN'de
    ne mesh gradyan ne de kartın altından zemini okutan bir yığın var; expo-linear-gradient
    tek yönlü geçiş verir ve web'de zaten DENENİP BIRAKILMIŞ olan şey oydu ("yoğun
    duruyor", bittiği yerde sayfayı ikiye bölen sınır). Cam kartın altında gösterecek
    bir doku olmayınca /80 opaklık da anlamını yitiriyor: kartlar ui.jsx'in standart
    beyaz kartı, zemin slate-50. Sayfa kendi yüzey dilini icat etmiyor.

  • IZGARA DEĞİL YIĞIN: telefonda üç sütun yok; kartlar ve adımlar alt alta.

  • HOVER YOK ve HİÇBİR KUTU TIKLANMIYOR (kartlar, adımlar). active: vermek de yanlış
    olurdu: basıldığında tepki veren ama hiçbir yere götürmeyen kutu, kırık bağlantı gibi
    okunur. Sayfadaki tek eylem çağrı düğmesi.

  • ÇAĞRI DÜĞMESİ OTURUMA GÖRE: web'de sabit "Keşfet'e göz at" bağlantısı var çünkü
    sayfa giriş duvarının arkasında. Mobilde bu sayfaya oturumsuz da geliniyor: giriş,
    kayıt ve parola sıfırlama ekranlarının alt bilgisinden (AltBilgi, 2026-09-26) ve
    derin bağlantıdan. Oturumsuz kullanıcı /kesfet'e basınca guard onu giriş ekranına
    atardı, düğme bozuk hissettirirdi. Oturumsuzken çağrı "Hesap oluştur".

  • SAYFA ALTI = ALT BİLGİ. Eski "dersmate’i Corventech geliştiriyor ve işletiyor."
    imzası kalktı; sayfa, Profil ve giriş ekranlarıyla AYNI alt bilgiyle ve aynı künye
    satırıyla bitiyor (KunyeSatiri). Yasal künye bloğu (KunyeBlogu) burada DEĞİL:
    kunye={false}, gerekçe MetinSayfasi'ndaki `kunye` notunda.
*/

const DEGER_IKONU = { misyon: RoketIkonu, vizyon: GozIkonu, topluluk: ToplulukIkonu }

/* Cekmece.jsx → OGELER ile aynı ikonlar, aynı sırayla. */
const ADIM_IKONU = {
  kesfet: AramaIkonu,
  portfoy: KitapIkonu,
  arkadaslar: KisilerIkonu,
  sohbet: MesajIkonu,
  derslerim: KepIkonu,
  topluluk: ToplulukIkonu,
}

const GUVENCE_IKONU = { puan: ArtanIkonu, para: CuzdansizIkonu, kanit: KanitIkonu }

/* Metin modülüne yeni bir anahtar eklenip ikonu buraya eklenmediyse sayfa düşmesin:
   ikon kutusu boş kalır, metin yine okunur. */
function AnahtarIkonu({ tablo, anahtar, boy }) {
  const Ikon = tablo[anahtar]
  return Ikon ? <Ikon boy={boy} renk={brand[600]} /> : null
}

export default function Hakkimizda() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <MetinSayfasi baslik="Hakkımızda" ozet={OZET} taslak={false} kunye={false}>
      <View className="gap-4">
        {DEGERLER.map(({ anahtar, baslik, metin }) => (
          <Card key={anahtar}>
            {/* px: h-11 cihazda 38.5dp (rem 14), web önizlemesinde 44. */}
            <View className="h-[44px] w-[44px] items-center justify-center rounded-xl bg-brand-50">
              <AnahtarIkonu tablo={DEGER_IKONU} anahtar={anahtar} boy={20} />
            </View>
            <Text accessibilityRole="header" className="mt-4 text-lg font-semibold text-slate-900">
              {baslik}
            </Text>
            <Text className="mt-2 text-[15px] leading-relaxed text-slate-600">{metin}</Text>
          </Card>
        ))}
      </View>

      <Card>
        <Text className="text-sm font-medium text-slate-600">{NASIL.etiket}</Text>
        <Text accessibilityRole="header" className="mt-2 text-xl font-bold tracking-tight text-slate-900">
          {NASIL.baslik}
        </Text>
        <Text className="mt-2 text-sm text-slate-600">{NASIL.giris}</Text>

        <View className="mt-4 gap-4">
          {ADIMLAR.map(({ anahtar, baslik, metin }, i) => (
            /* Satır tek erişilebilir öğe: ekran okuyucu "3. adım, Arkadaşlar: …" diye
               bir kez okur; ikon kutusu ve numara ayrıca durak olmaz. */
            <View
              key={anahtar}
              accessible
              accessibilityLabel={`${i + 1}. adım, ${baslik}: ${metin}`}
              className="flex-row gap-3"
            >
              <View className="h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <AnahtarIkonu tablo={ADIM_IKONU} anahtar={anahtar} boy={18} />
              </View>
              <View className="min-w-0 flex-1">
                {/* Numara dili MetinSayfasi → Bolum'le aynı: slate-400 sayı, koyu başlık. */}
                <Text className="text-[15px] font-semibold text-slate-900">
                  <Text className="text-slate-400">{i + 1}.</Text> {baslik}
                </Text>
                <Text className="mt-0.5 text-sm leading-relaxed text-slate-600">{metin}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 12px px ile: text-xs cihazda 10.5dp. slate-500 beyazda 4.76:1. */}
        <Text className="mt-4 text-[12px] leading-[18px] text-slate-500">{BILDIRIM_NOTU}</Text>

        <View className="mt-5">
          {isAuthenticated ? (
            <Button variant="secondary" onPress={() => router.push('/kesfet')}>
              Keşfet’e göz at
            </Button>
          ) : (
            <Button onPress={() => router.push('/kayit')}>Hesap oluştur</Button>
          )}
        </View>

        <View className="mt-6 gap-4 border-t border-slate-200 pt-5">
          {GUVENCELER.map(({ anahtar, baslik, metin }) => (
            <View
              key={anahtar}
              accessible
              accessibilityLabel={`${baslik}: ${metin}`}
              className="flex-row gap-3"
            >
              <View className="mt-0.5 shrink-0">
                <AnahtarIkonu tablo={GUVENCE_IKONU} anahtar={anahtar} boy={18} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-slate-900">{baslik}</Text>
                <Text className="mt-1 text-sm leading-relaxed text-slate-600">{metin}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* Kapanış: sayfanın tezi, tek cümlede. Kutu yok — burada duracak bir şey değil,
          okunup geçilecek bir cümle. */}
      <Text className="text-center text-sm italic text-slate-600">{KAPANIS}</Text>

      <AltBilgi gizle={['/hakkimizda']} />
    </MetinSayfasi>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { IZIN_KATEGORILERI, useIzin } from '../state/IzinContext'
import { Button, Modal } from './ui'

/*
  VERİ TOPLAMA İZNİ — web'deki CookieBanner'ın mobil karşılığı.

  ADI "ÇEREZ" DEĞİL ve bu bir çeviri tercihi değil, doğruluk meselesi: mobil uygulamada
  çerez YOKTUR. Kullanıcıya çerez izni sormak, olmayan bir şey hakkında onay istemek —
  yani yanlış bilgi vermek olurdu. Taşınan şey iznin KENDİSİ (analitik veri toplama),
  taşıyıcısı değil.

  İKİ AYRI YÜZEY, tek bileşen:
  • İLK AÇILIŞ (mutlakaSor): kapatılamayan alt sayfa. Kullanıcı bir cevap vermeden
    analitik BAŞLAMAZ — "sonra sorarız" diye toplamaya başlamak, izin fikrini boşa
    çıkarırdı. Yine de zorlamıyor: "Yalnızca zorunlu" tek dokunuş.
  • SONRADAN DEĞİŞTİRME (ayarlarAcik): aynı sayfa, kapatılabilir. Profil ekranındaki
    "Veri tercihleri" bağlantısı buradan açıyor.

  Web'deki "reddet ve devam et" davranışı korundu: reddin bedeli yok, uygulama aynı
  şekilde çalışır (bkz. IZIN_KATEGORILERI'ndeki zorunlu kategori açıklaması).
*/
export function IzinSayfasi() {
  const { mutlakaSor, ayarlarAcik, ayarlariKapat, kaydet, izin } = useIzin()
  const router = useRouter()
  const pathname = usePathname()

  // Anahtar başlangıcı mevcut tercihten: ayarları ikinci kez açan kullanıcı, seçtiğini
  // seçili görmeli. mutlakaSor dalında izin null olduğu için kapalı başlar.
  const [analitik, setAnalitik] = useState(Boolean(izin?.analitik))
  useEffect(() => {
    setAnalitik(Boolean(izin?.analitik))
  }, [izin?.analitik, ayarlarAcik])

  /*
    OKUMA MODU — alt sayfa, metin okunurken GEÇİCİ olarak gizlenir.

    RN Modal ayrı bir yerel pencere: altına rota itmek ekranı modalın ARKASINDA
    bırakır. Zorunlu kipte sayfa kapatılamadığı için bağlantı tamamen ölüydü —
    yani aydınlatma metnini onaydan ÖNCE okuma yolu, tam da onayın zorunlu olduğu
    tek kipte kapalıydı.

    Sayfa kapatılmıyor, GİZLENİYOR: kullanıcı geri döndüğünde (pathname değişince)
    kendiliğinden geri geliyor ve verilmemiş bir izin cevapsız kalmıyor.
  */
  const [okumaHedefi, setOkumaHedefi] = useState(null)
  const hedefeUlasti = useRef(false)

  useEffect(() => {
    if (!okumaHedefi) return

    if (pathname === okumaHedefi) {
      hedefeUlasti.current = true
      return
    }

    /*
      HEDEFE ULAŞMADAN SIFIRLAMA YOK. İlk denemede koşul yalnızca "pathname hedef
      değilse kapat" idi ve gezinme tamamlanmadan çalışıyordu: setOkumaHedefi ile
      router.push aynı karede, efekt ise pathname HÂLÂ eski değerken koşuyordu —
      sayfa anında geri açılıp metni örtüyordu (tarayıcıda ölçüldü: elementFromPoint
      izin metnini döndürüyordu). Geri dönüş ancak hedefe bir kez varıldıktan sonra
      sayılıyor.
    */
    if (hedefeUlasti.current) {
      hedefeUlasti.current = false
      setOkumaHedefi(null)
    }
  }, [pathname, okumaHedefi])

  const acik = (mutlakaSor || ayarlarAcik) && !okumaHedefi

  async function uygula(secim) {
    await kaydet(secim)
    if (ayarlarAcik) ayarlariKapat()
  }

  return (
    <Modal
      open={acik}
      // İlk açılışta kapatma YOK: karartmaya dokunmak ya da geri tuşu sayfayı
      // kapatamaz, çünkü kapanınca hangi cevabın verildiği belirsiz kalırdı.
      // Ayarlar kipinde normal kapanır.
      onClose={ayarlarAcik ? ayarlariKapat : () => {}}
      title="Veri tercihleri"
      footer={
        <>
          {/*
            `islevsel` BİLEREK GÖNDERİLMİYOR — kaydet() verilmeyen alanda mevcut değeri
            korur ve bu ekran o kategoriyi hiç SORMUYOR (IZIN_KATEGORILERI yalnızca
            zorunlu + analitik taşıyor). Sabit `true` göndermek, kullanıcının görmediği
            bir izni onun adına onaylamak olurdu; dahası web'de işlevseli REDDETMİŞ
            kullanıcının ortak sunucu kaydını sessizce Granted'a çevirirdi.
          */}
          <Button variant="secondary" onPress={() => uygula({ analitik: false })}>
            Yalnızca zorunlu
          </Button>
          <Button onPress={() => uygula({ analitik })}>
            {analitik ? 'Seçimimi kaydet' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Text className="text-sm leading-relaxed text-slate-600">
          Hangi verilerin toplandığını sen seçiyorsun. Reddetmenin bir bedeli yok —
          uygulama aynı şekilde çalışır.
        </Text>

        {IZIN_KATEGORILERI.map((kategori) => (
          <View key={kategori.anahtar} className="rounded-xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-slate-900">{kategori.baslik}</Text>
                <Text className="mt-1 text-xs leading-relaxed text-slate-600">
                  {kategori.aciklama}
                </Text>
              </View>

              {kategori.zorunlu ? (
                <View className="rounded-full bg-slate-100 px-2.5 py-1">
                  <Text className="text-xs font-medium text-slate-600">Her zaman</Text>
                </View>
              ) : (
                /* Anahtar: RN'de Switch var ama ui.jsx'in yüzey diline yabancı bir
                   platform kontrolü getiriyor. İki durumlu bir Pressable, projedeki
                   diğer seçicilerle (radyo satırları, pill'ler) aynı dili konuşuyor. */
                /* hitSlop 6: anahtar 32px çizilir (14×8 oranı korunsun diye) ama
                   dokunma alanı 44px — iznin TEK kontrolü, dokunma hedefi kuralının
                   çiğnenebileceği son yer burası. */
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: analitik }}
                  accessibilityLabel={kategori.baslik}
                  onPress={() => setAnalitik((v) => !v)}
                  hitSlop={6}
                  className={`h-8 w-14 shrink-0 justify-center rounded-full px-1
                              ${analitik ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                  <View
                    className={`h-6 w-6 rounded-full bg-white ${analitik ? 'self-end' : 'self-start'}`}
                  />
                </Pressable>
              )}
            </View>

            <View className="mt-3 gap-1.5 border-t border-slate-100 pt-3">
              {kategori.maddeler.map((madde) => (
                <View key={madde} className="flex-row gap-2">
                  <Text className="text-xs text-slate-400">•</Text>
                  <Text className="flex-1 text-xs leading-relaxed text-slate-600">{madde}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="link"
          onPress={() => {
            // Sayfa KAPANMIYOR, gizleniyor (bkz. okumaHedefi): RN Modal ayrı bir
            // pencere olduğu için itilen ekran aksi hâlde arkada kalır ve bağlantı
            // ölü görünür.
            setOkumaHedefi('/gizlilik')
            router.push('/gizlilik')
          }}
          className="min-h-[44px] justify-center"
        >
          <Text className="text-sm font-medium text-brand-700">Gizlilik metnini oku</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

/** Profil ekranındaki giriş — web'deki "Çerez tercihleri" bağlantısının karşılığı. */
export function VeriTercihleriBaglantisi() {
  const { ayarlariAc } = useIzin()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={ayarlariAc}
      className="min-h-[44px] justify-center"
    >
      <Text className="text-sm font-medium text-brand-700">Veri tercihleri</Text>
    </Pressable>
  )
}

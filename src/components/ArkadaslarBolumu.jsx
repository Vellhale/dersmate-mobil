import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { api } from '../lib/api'
import { useAsync } from '../state/useAsync'
import { Avatar } from './Avatar'
import { SeviyeRozeti } from './SeviyeRozeti'
import { Card, ErrorBox } from './ui'

/*
  PROFİLİN ARKADAŞ BÖLÜMÜ — web'deki components/ArkadaslarBolumu.jsx'in portu (web #31).

  ─── HANGİ LİSTENİN GÖSTERİLECEĞİNİ SUNUCU SÖYLÜYOR ─────────────────────────
    • kendi profilin      → arkadaş sayısı + TAM LİSTE
    • başkasının profili  → arkadaş sayısı + ORTAK ARKADAŞLAR
  "Tam listeyi yalnızca sahibi görür" kuralı BURADA DEĞİL sunucuda: uç, başkasının
  profilinde `friends`i zaten boş döndürüyor. İstemcide bir `if` ile gizlemek, veriyi
  ağdan geçirip ekranda saklamak olurdu. Kendi profilim mi sorusunu da yanıtın `isSelf`i
  yanıtlıyor (ProfilGorunumu'ndaki kuralın aynısı); prop yalnızca yedek. İkisi ayrışıp
  prop'a güvenilseydi kendi profilinde boş `friends` okunur ve "Arkadaşların
  gösterilemedi." yazardı.

  ─── BÖLÜM HER PROFİLDE AYNI ŞEKİLDE ÇİZİLİYOR ──────────────────────────────
  Engelli bir kişinin profilinde bölüm gizlenmiyor, özel bir metne de dönmüyor: "bu
  profilde arkadaşlar bölümü yok" demek, "aranızda bir engel var" demenin dolaylı yolu
  olurdu. Tekdüzelik sızdırmaz; istisna sızdırır.

  ─── SAYI İLE LİSTE AYNI KAYNAKTAN ──────────────────────────────────────────
  Sayı sunucudan geliyor ve orada listeyle AYNI süzgeçten (engel + aktif hesap) geçiyor;
  burada listeden yeniden sayılmaz. İkisi ayrışsaydı ortak arkadaşlarda bu bir kâhin
  olurdu: "3 ortak" yazıp 2 kişi göstermek, üçüncü bir kişinin profilinde gizlenmiş bir
  engeli ilan eder.

  MOBİL FARKI: web'in max-h-96'lık iç kaydırmalı listesi TAŞINMADI — profil zaten
  ScrollView ve iç içe dikey kaydırma dokunmatikte jest çatışması üretir (ProfilGorunumu
  başındaki not). Tam liste 100 kişiye çıkabildiği için düz basmak da olmaz: ilk
  ILK_GORUNEN kişi, altında "Tümünü göster" akordeonu (değerlendirmelerdeki "Yıldız
  dağılımını gör" kalıbı). 5, web kutusunun görünür satır sayısı.
*/

const ILK_GORUNEN = 5

export function ArkadaslarBolumu({ userId, kendiProfilim = false, ad }) {
  const router = useRouter()
  const veri = useAsync(() => api.userFriends(userId), [userId])
  // Kancalar erken dönüşlerden ÖNCE: yükleme → veri geçişinde kanca sırası değişmesin.
  const [hepsi, setHepsi] = useState(false)

  /*
    ODAKTA SESSİZ TAZELEME. Web bu bölümü rota değişiminde yeniden kuruyor, mobilde ise
    üstüne yığın ekranı açılan sekme (Profilim) ve yığında alta kalan profil ekranları
    KURULU kalıyor. Arkadaşlar ekranında isteği kabul edip ya da arkadaşlığı sonlandırıp
    dönen kullanıcı eski sayıyı ve "Henüz arkadaşın yok"u görüyordu. Ortak arkadaşı
    profilinden engelleyip geri dönülen profilde o kişi listede kalıyordu. Uygulama
    yeniden başlayana kadar düzelmiyordu.

    Her odakta, sürüm sayacı yok (Keşfet'in tersine): değişikliklerin bir kısmı cihazda
    olmuyor, karşı taraf isteği kabul edince haber gelmiyor. Bedel odak başına küçük tek
    bir istek. Bölümde biriktirilmiş sayfa ya da kaydırma yok, yani kaybedilecek bir şey
    de yok.

    YALNIZCA KURULUMLA AYNI ANDA gelen odak atlanıyor: ilk çekimi useAsync zaten yaptı.
    "İlk odağı atla" DEĞİL: bölüm, profil yüklendikten sonra kuruluyor ve kullanıcı o
    arada Arkadaşlar ekranına geçtiyse kurulum odaksız olur. O zaman ilk GERÇEK dönüş
    atlanır ve eski liste kalırdı. Bayrağı indiren efekt useFocusEffect'ten SONRA tanımlı:
    efektler sırayla koşuyor, kurulum anındaki odak çağrısı bayrağı hâlâ kalkık görüyor.

    silent: elde veri varken bölüm null'a düşüp sayfa zıplamasın. reload ref'ten
    okunuyor, bağımlılıktan değil: userId yerinde değişirse useAsync kendi tam yüklemesini
    yapıyor. Burası ikinci ve SESSİZ bir istek atsaydı eski kişinin listesi yükleme
    bayrağı olmadan ekranda kalırdı.
  */
  const kuruluyor = useRef(true)
  const tazele = useRef(veri.reload)
  tazele.current = veri.reload
  useFocusEffect(
    useCallback(() => {
      if (!kuruluyor.current) tazele.current({ silent: true })
    }, []),
  )
  useEffect(() => {
    kuruluyor.current = false
  }, [])
  const d = veri.data

  /* Yüklenirken bölüm HİÇ çizilmiyor (iskelet de yok, web kararı): profil kartı ayrı
     istekle geliyor ve araya boş bir kutu koymak sayfayı iki kez zıplatırdı. */
  if (veri.loading) return null
  if (veri.error) {
    return (
      <Card>
        <ErrorBox error={veri.error} onRetry={veri.reload} />
      </Card>
    )
  }
  if (!d) return null

  const kendi = d.isSelf ?? kendiProfilim
  const sayi = d.friendCount ?? 0
  const kisiler = kendi ? (d.friends ?? []) : (d.mutualFriends ?? [])
  const ortak = d.mutualCount ?? 0
  const gorunen = hepsi ? kisiler : kisiler.slice(0, ILK_GORUNEN)
  // Sunucu tavanı (tam liste 100, ortaklar 12) aşıldığında listede olmayanlar.
  const kalan = (kendi ? sayi : ortak) - kisiler.length

  return (
    <Card>
      <View className="mb-3 flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Text className="text-sm font-medium text-slate-700">Arkadaşlar</Text>
        {/* Sıfırken de yazılıyor: "0 arkadaş" bir bilgi; gizlemek sayının bazen görünüp
            bazen görünmemesi demek olurdu. */}
        <Text className="text-sm text-slate-600">
          <Text className="font-semibold text-slate-800">{sayi}</Text> arkadaş
        </Text>
      </View>

      {/* Ortak arkadaş satırı yalnızca VARSA: yokken aşağıdaki boş durum metni aynı
          şeyi zaten söylüyor. */}
      {!kendi && ortak > 0 && (
        <Text className="mb-3 text-sm text-slate-600">{ortak} ortak arkadaşınız var.</Text>
      )}

      {kisiler.length === 0 ? (
        <Text className="text-sm text-slate-600">
          {/* ⚠️ "Arkadaş Ekle" bölümü Keşfet'e web #30'un portuyla geliyor; o sekme olmadan
              yayına çıkan metin var olmayan bir yeri tarif eder (gizlilik.jsx §6 notu). */}
          {kendi
            ? sayi === 0
              ? 'Henüz arkadaşın yok. Keşfet’teki “Arkadaş Ekle” bölümünden adını bildiğin birini bulabilirsin.'
              : 'Arkadaşların gösterilemedi.'
            : `${ad} ile ortak arkadaşınız yok.`}
        </Text>
      ) : (
        <View accessibilityLabel={kendi ? 'Arkadaş listesi' : 'Ortak arkadaşlar'}>
          {gorunen.map((k, i) => (
            /* Satırın tamamı profile götürür (web'deki PersonLink'in mobil kalıbı:
               IlanKarti'nin kimlik bloğu); 44px dokunma hedefi satırda. */
            <Pressable
              key={k.userId}
              accessibilityRole="link"
              accessibilityLabel={`${k.displayName} profilini aç`}
              onPress={() => router.push(`/profil/${k.userId}`)}
              className={`min-h-[44px] flex-row items-center gap-3 py-2 ${
                i > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <Avatar userId={k.userId} name={k.displayName} size="sm" />
              <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium text-brand-700">
                {k.displayName}
              </Text>
              <SeviyeRozeti kaynak={{ level: k.level }} boyut="sm" ton="acik" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Tavan aşıldığında sessiz kalmak listeyi eksiksiz sandırır (web). Akordeon
          kapalıyken yazılmıyor: o an listenin devamı zaten alttaki düğmede. */}
      {kisiler.length > 0 && kalan > 0 && (hepsi || kisiler.length <= ILK_GORUNEN) && (
        <Text className="mt-2 text-xs text-slate-600">ve {kalan} kişi daha</Text>
      )}

      {kisiler.length > ILK_GORUNEN && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: hepsi }}
          onPress={() => setHepsi((v) => !v)}
          className="min-h-[44px] justify-center self-start"
        >
          <Text className="text-xs font-medium text-brand-700">
            {hepsi ? 'Daha az göster' : `Tümünü göster (${kisiler.length})`}
          </Text>
        </Pressable>
      )}
    </Card>
  )
}

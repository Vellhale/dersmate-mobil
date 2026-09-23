import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { engelDegisti, engelSurumu } from '../../src/lib/engelSurumu'
import { ILISKI } from '../../src/lib/iliski'
import { useAsync } from '../../src/state/useAsync'
import { useIliskiler } from '../../src/state/useIliskiler'
import { EngellemeModali } from '../../src/components/EngellemeModali'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { Button, ErrorBox, IskeletBlok, Notice } from '../../src/components/ui'
import { useAuth } from '../../src/state/AuthContext'

/*
  BAŞKASININ PROFİLİ — tab çubuğunun ÜSTÜNDE açılan yığın ekranı (akış kartından,
  sohbet başlığından, Keşfet kartından gelinir). Web'de /profil/:userId aynı bileşene
  gidiyordu; mobilde düzenleme eylemleri kendi profil sekmesinde kalıyor, bu rotada
  yalnızca başkasına yönelik iki eylem var: arkadaş ekle ve engelle (web #30).

  Kendi id'sine gelen kullanıcı da aynı görünümü alır, eylem düğmeleri olmadan
  (düzenleme yine sekmesinde) — yönlendirme karmaşası yerine tek doğru davranış.
*/

/* Kimlikler iki ayrı kaynaktan geliyor (adres ve profil yanıtı). Harf büyüklüğü farkı
   olursa karşılaştırma ıskalar ve düğmeler SESSİZCE hiç çıkmaz — api.js'teki
   avatarAnahtar ile aynı gerekçe. */
const ayniKisi = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()

export default function BaskasininProfili() {
  const { userId } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useAuth()
  const [notice, setNotice] = useState(null)
  /* Eylem düğmeleri kişinin ADINI istiyor ("X engellendi"); ad ProfilGorunumu'nun
     çektiği veriden geri veriliyor (onYuklendi), ikinci bir profil isteği atılmıyor. */
  const [kisi, setKisi] = useState(null)
  // Profil yüklenemediyse eylem satırının iskeleti de kalkmalı (aşağıda).
  const [profilHatasi, setProfilHatasi] = useState(false)
  const kendiProfilim = session?.userId === userId
  /* Geri çağrılar KARARLI: ProfilGorunumu onYuklendi'yi efekt bağımlılığında tutuyor, her
     render'da yeni işlev verilseydi efekt her render'da yeniden koşardı. */
  const yuklendi = useCallback((p) => {
    setProfilHatasi(false)
    setKisi(p)
  }, [])
  const profilHatasiVar = useCallback((hata) => setProfilHatasi(Boolean(hata)), [])

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Text className="text-xl text-slate-500">←</Text>
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">Profil</Text>
      </View>

      <ScrollView contentContainerClassName="gap-3 p-4">
        {/*
          ⚠️ `ayniKisi(kisi.userId, userId)` YANLIŞ KİŞİYE İŞLEM YAPMAYI ÖNLÜYOR (web #33):
          adres değişip yeni profil gelene kadar elde ESKİ kişinin verisi kalıyor. O
          pencerede "Engelle" bir öncekini engellerdi ve onay kipi de onun adını yazdığı
          için fark edilmezdi. `key` de userId'ye bağlı: önceki kişinin hata kutusu ve açık
          kipi taşınmıyor.

          Düğmeler profil YÜKLENDİKTEN sonra beliriyor: var olmayan bir kullanıcıya istek
          düğmesi hiç görünmüyor. Kendi profilim mi: asıl kaynak sunucunun isSelf alanı
          (ProfilGorunumu kuralı), oturumdaki id yalnızca yedek.

          YER BAŞTAN AYRILIYOR: satır eskiden profil kartından bir kare SONRA ekleniyordu ve
          yeni yüklenen kartın tamamı 56 px aşağı zıplıyordu. Profil gelene kadar aynı
          yükseklikte iskelet çiziliyor; profil hata verirse iskelet de kalkıyor (hata
          kutusunun üstünde anlamsız bir gri şerit kalmasın).
        */}
        {kisi && !(kisi.isSelf ?? kendiProfilim) && ayniKisi(kisi.userId, userId) ? (
          <BaskaKisiIslemleri key={userId} kisi={kisi} onNotice={setNotice} />
        ) : !kisi && !kendiProfilim && !profilHatasi ? (
          <EylemIskeleti />
        ) : null}

        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <ProfilGorunumu
          userId={userId}
          kendiProfilim={kendiProfilim}
          onYuklendi={yuklendi}
          onHata={profilHatasiVar}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

/**
 * Eylem bloğuyla AYNI YÜKSEKLİKTE yer tutucu: profil ya da ilişki bilgisi gelene kadar.
 * Blok her durumda iki satır (durum cümlesi + düğmeler); iskelet de iki satır. Ölçüldü:
 * durum satırı yalnızca bazı hâllerde varken arkadaş profili 28 px zıplıyordu.
 */
function EylemIskeleti() {
  return (
    <View className="gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <IskeletBlok className="h-5 w-40" />
      <View className="flex-row gap-2">
        <IskeletBlok className="h-11 flex-1" />
        <IskeletBlok className="h-11 w-20" />
      </View>
    </View>
  )
}

/*
  BAŞKASININ PROFİLİNDEKİ EYLEMLER — web Profile.jsx BaskaKisiIslemleri portu.

  NEDEN BURADA DA VAR: kişiyi forumda, bir yorumda ya da ders listesinde görüp adına
  dokunan kullanıcı, istek göndermek için Keşfet'e dönüp adını yeniden aramak zorunda
  kalmamalı. Engelleme de aynı sebeple burada — rahatsız eden biriyle karşılaşılan yer
  çoğu zaman profil.

  ENGEL DURUMU AYRI İSTEKLE okunuyor: profil yanıtına "engelledim mi" alanı bilerek
  eklenmedi (web kararı) — o uç forumda ve ders listelerinde de çağrılıyor, yalnızca bu
  ekranın kullandığı bir alan her profil görüntülemesine bir sorgu daha bindirirdi.

  İLİŞKİ DE AYRI İSTEKLE (myMatches, bkz. lib/iliski.js). Eskiden satır ilişkiyi hiç
  bilmiyordu: arkadaşa, bekleyen isteğe ve sana istek atmış kişiye aynı "Arkadaş ekle"
  çıkıyordu. Blok artık bir durum cümlesi + ilişkiye göre bir birincil eylem çiziyor:
    • arkadaş  → "Arkadaşsınız."               + Mesaj gönder
    • gelen    → "Sana arkadaş isteği gönderdi." + İsteğini yanıtla
    • giden    → "İsteğin yanıt bekliyor."       + pasif İstek gönderildi
    • yok      → "Henüz arkadaş değilsiniz."     + Arkadaş isteği gönder
  Engelle her hâlde sağda ve ikincil — Keşfet kartıyla AYNI SIRA.

  BİLGİ GELMEDEN İLİŞKİ EYLEMİ ÇİZİLMİYOR: eskiden engel listesi yüklenirken "Arkadaş ekle"
  basılabiliyordu; engellediğin kişiye istek atılıyor ve sunucunun nötr hatası çıkıyordu.
  Listelerden biri hata verirse ilişki eyleminin yerine hata kutusu çıkıyor — "engelli
  değil" ya da "ilişki yok" VARSAYILMIYOR. ENGELLE İSE HATADA DA KALIYOR: engelleme ilişkiye
  bakmıyor ve sunucuda tekrar engellemek zararsız; bir yan isteğin düşmesi, rahatsız eden
  birini engelleme yolunu kapatmamalı.

  KARŞI TARAF BENİ ENGELLEDİYSE bu bileşen bunu BİLMİYOR ve bilmemeli: karşı tarafın
  engelini kullanıcıya söylemek engellemeyi misillemeye çevirirdi. Düğme görünür, basılınca
  sunucu nötr bir hatayla reddeder ("Bu kişiye istek gönderilemiyor.").
*/
function BaskaKisiIslemleri({ kisi, onNotice }) {
  const router = useRouter()
  const navigation = useNavigation()
  const engeller = useAsync(() => api.myBlocks(), [])
  const iliskiler = useIliskiler()
  const [kipAcik, setKipAcik] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hata, setHata] = useState(null)
  /* "Tekrar dene" hangi işlemi tekrarlayacağını HATANIN DOĞDUĞU ANDAN biliyor. Eskiden o an
     `engelli` değerine bakılıyordu; liste arada değişince başarısız bir istek yerine
     engel kaldırma koşabiliyordu. */
  const [sonIslem, setSonIslem] = useState(null)

  /* Engel başka ekranda değiştiyse (Keşfet → Engellediklerim) odakta tazele — Keşfet'teki
     sürüm sayacının aynısı. İlişkiler kendi odak tazelemesini useIliskiler'de yapıyor.
     İşleyici ref'te: reload her render'da yeni kapanış, odak geri çağrısı sabit kalmalı. */
  const gorulenSurum = useRef(engelSurumu())
  const engelTazele = useRef(engeller.reload)
  engelTazele.current = engeller.reload
  useFocusEffect(
    useCallback(() => {
      if (gorulenSurum.current !== engelSurumu()) {
        gorulenSurum.current = engelSurumu()
        engelTazele.current({ silent: true })
      }
    }, []),
  )

  const bilgiYukleniyor = (engeller.loading && !engeller.data) || iliskiler.yukleniyor
  const bilgiHatasi = (engeller.data ? null : engeller.error) ?? iliskiler.hata
  const engelli = (engeller.data ?? []).some((e) => ayniKisi(e.userId, kisi.userId))
  const iliski = iliskiler.iliski(kisi.userId)
  const iliskiDurumu = engelli ? 'engelli' : (iliski?.durum ?? 'yok')

  /* Durum başka ekranda değişti (engellendi, istek kabul edildi): eski işlemin hatası ve
     "Tekrar dene"si artık görünmeyen bir eylemi yeniden çalıştırırdı. */
  useEffect(() => {
    setHata(null)
  }, [iliskiDurumu])

  async function istekGonder() {
    if (busy) return
    setBusy(true)
    setHata(null)
    /* Önceki başarı bildirimi de siliniyor (web #33): ikinci deneme hata verdiğinde
       "gönderildi" ile "zaten bekleyen isteğin var" yan yana kalıyor ve hangisinin şu
       ana ait olduğu okunmuyordu. */
    onNotice(null)
    try {
      /* Konusuz istek — Keşfet'teki "Arkadaş isteği" ile AYNI çağrı; sunucuda arkadaşlık
         diye ayrı bir tür yok. */
      await api.createMatch({
        responderUserId: kisi.userId,
        requestedTopicId: null,
        offeredTopicId: null,
      })
      iliskiler.istekGonderildi(kisi.userId)
      onNotice(`${kisi.displayName} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`)
    } catch (err) {
      setSonIslem('istek')
      setHata(err)
      /* Red çoğu zaman ilişkinin ekrandakinden farklı olduğunu söylüyor (başka cihazdan
         gönderilmiş istek → 409). İlişki tazelenince düğme gerçek duruma döner. */
      iliskiler.yenile()
    } finally {
      setBusy(false)
    }
  }

  async function engelKaldir() {
    if (busy) return
    setBusy(true)
    setHata(null)
    try {
      await api.unblockUser(kisi.userId)
      // Alttaki Keşfet odakta tazelensin: kişi aramaya geri dönmeli (bkz. lib/engelSurumu).
      engelDegisti()
      gorulenSurum.current = engelSurumu()
      onNotice(`${kisi.displayName} için engel kaldırıldı.`)
      engeller.reload({ silent: true })
    } catch (err) {
      setSonIslem('engelKaldir')
      setHata(err)
    } finally {
      setBusy(false)
    }
  }

  /*
    ARKADAŞLAR EKRANINA DÖNÜŞ: yığında hemen altta zaten Arkadaşlar varsa (oradaki karttan
    bu profile gelindiyse) GERİ gidiliyor. push her zaman yeni ekran ekliyor; ikinci bir
    Arkadaşlar ekranı açılır, kullanıcı orada isteği kabul edip geri döndüğünde alttaki
    kopya aynı isteği hâlâ "Kabul et" ile gösterirdi (ölçüldü).
  */
  function arkadaslaraGit() {
    const durum = navigation.getState?.()
    const onceki = durum?.routes?.[durum.index - 1]
    if (onceki?.name === 'eslesmeler') router.back()
    else router.push('/eslesmeler')
  }

  if (bilgiYukleniyor) return <EylemIskeleti />

  const engelleDugmesi = (
    <Button
      variant="secondary"
      accessibilityLabel={`${kisi.displayName} kişisini engelle`}
      onPress={() => setKipAcik(true)}
    >
      Engelle
    </Button>
  )

  /*
    HER DURUM AYNI İSKELET: bir durum cümlesi + bir düğme satırı. İlişkisiz kişide de cümle
    var: yalnızca bazı hâllerde satır olsaydı yükseklik ilişkiye göre değişir ve iskeletten
    gerçek bloğa geçerken sayfa zıplardı. Cümlelerde AD YOK: tek satıra kilitli cümle adla
    uzayınca anlamı taşıyan fiil kesiliyordu (320 dp'de "… sana arkadaş isteği …"); kimin
    profili olduğu hemen alttaki kartta yazıyor.
  */
  const durum = engelli
    ? { metin: 'Bu kişiyi engelledin.', ton: 'text-rose-700' }
    : iliski?.durum === ILISKI.arkadas
      ? { metin: 'Arkadaşsınız.', ton: 'text-emerald-700' }
      : iliski?.durum === ILISKI.gelen
        ? { metin: 'Sana arkadaş isteği gönderdi.', ton: 'text-slate-700' }
        : iliski?.durum === ILISKI.giden
          ? { metin: 'İsteğin yanıt bekliyor.', ton: 'text-slate-600' }
          : { metin: 'Henüz arkadaş değilsiniz.', ton: 'text-slate-600' }

  return (
    <View className="gap-2">
      {bilgiHatasi ? (
        <>
          <ErrorBox
            error={bilgiHatasi}
            onRetry={() => {
              engeller.reload()
              iliskiler.yenile()
            }}
          />
          <View className="flex-row justify-end">{engelleDugmesi}</View>
        </>
      ) : (
        <>
          {/* Görünen cümle adsız (dar ekranda fiil kesiliyordu); ekran okuyucu ise bu bloğa
              profil kartından ÖNCE geliyor ve kimin olduğunu duymuyordu — ad etikette.
              adjustsFontSizeToFit: büyük yazı ölçeğinde kesilmek yerine küçülür, satır tek
              kalır ve iskeletle yükseklik eşleşmesi bozulmaz. */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityLabel={`${kisi.displayName}: ${durum.metin}`}
            className={`text-sm font-medium ${durum.ton}`}
          >
            {durum.metin}
          </Text>

          {engelli ? (
            /* Engelliyken ilişki eylemi HİÇ GÖSTERİLMİYOR: basılsa sunucu zaten reddederdi ve
               kullanıcı kendi koyduğu engeli bir hata kutusundan hatırlardı. Önce engeli
               kaldırmak, tek anlamlı sıra. */
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                loading={busy}
                accessibilityLabel={`${kisi.displayName} için engeli kaldır`}
                onPress={engelKaldir}
              >
                Engeli kaldır
              </Button>
            </View>
          ) : (
            /* flex-wrap + birincil min %55: büyük yazıda birincil düğme Engelle'den daralıp
               etiketi bölünüyordu (Keşfet kartıyla aynı kural). */
            <View className="flex-row flex-wrap gap-2">
              {iliski?.durum === ILISKI.arkadas ? (
                /* Kabul edilen her istekte sunucu sohbeti açıyor (RespondMatchHandler); kimlik
                   yine de yoksa düğme pasif — var olmayan sohbete götüren düğme olmasın. */
                <Button
                  className="min-w-[55%] flex-1"
                  disabled={!iliski.conversationId}
                  accessibilityLabel={`Mesaj gönder, ${kisi.displayName}`}
                  onPress={() => router.push(`/sohbet/${iliski.conversationId}`)}
                >
                  Mesaj gönder
                </Button>
              ) : iliski?.durum === ILISKI.gelen ? (
                /* Kabul/ret Arkadaşlar ekranında: o mantık (sohbet açılışı, gelen kutusu
                   tazelemesi) ikinci kez yazılmadı. Etiket Keşfet kartıyla aynı. */
                <Button
                  className="min-w-[55%] flex-1"
                  accessibilityLabel={`İsteğini yanıtla, ${kisi.displayName}`}
                  onPress={arkadaslaraGit}
                >
                  İsteğini yanıtla
                </Button>
              ) : iliski?.durum === ILISKI.giden ? (
                <Button
                  variant="secondary"
                  className="min-w-[55%] flex-1"
                  accessibilityLabel={`İstek gönderildi, ${kisi.displayName}`}
                  disabled
                >
                  İstek gönderildi
                </Button>
              ) : (
                /* ADI "Arkadaş isteği gönder": Keşfet'in öneri, YKS ve Arkadaş Ekle kartlarındaki aynı isteğin
                   adı bu; profilde "Arkadaş ekle" diye ayrışıyordu. Burada ONAY SAYFASI YOK (kartlarda
                   var) ve bu bilinçli: onay sayfasının tek işi kimi eklediğini göstermek, profil
                   ekranının kendisi zaten o kişinin tam kimliği.
                   Erişilebilir ad görünen etiketle başlıyor (WCAG 2.5.3), ad ayrı. */
                <Button
                  className="min-w-[55%] flex-1"
                  loading={busy}
                  accessibilityLabel={`Arkadaş isteği gönder, ${kisi.displayName}`}
                  onPress={istekGonder}
                >
                  Arkadaş isteği gönder
                </Button>
              )}
              {engelleDugmesi}
            </View>
          )}
        </>
      )}

      {/* Hata düğmelerin altında: istek reddedildiğinde (bekleyen istek, günlük tavan,
          engel) sebep düğmenin yanında okunmalı. onRetry KUTUYU DA KAPATIYOR (web #33):
          ErrorBox hatayı kendisi temizlemiyor; temizlenmezse başarılı ikinci denemeden
          sonra da eski hata ekranda kalırdı. */}
      <ErrorBox
        error={hata}
        onRetry={
          hata
            ? () => {
                setHata(null)
                if (sonIslem === 'engelKaldir') engelKaldir()
                else istekGonder()
              }
            : undefined
        }
      />

      <EngellemeModali
        kisi={kipAcik ? kisi : null}
        onClose={() => setKipAcik(false)}
        onEngellendi={(ad) => {
          setKipAcik(false)
          // Engelleme öncesindeki "zaten bekleyen isteğin var" kutusu yeni durumla çelişirdi.
          setHata(null)
          gorulenSurum.current = engelSurumu()
          onNotice(`${ad} engellendi. Artık birbirinize istek gönderemezsiniz.`)
          engeller.reload({ silent: true })
          // Engel bekleyen istekleri kapatıyor: ilişki de değişti.
          iliskiler.yenile()
        }}
      />
    </View>
  )
}

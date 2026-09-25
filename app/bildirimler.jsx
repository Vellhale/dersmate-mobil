import { useCallback, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { KANALLAR, ayarlariAc, kanalAyarlariniAc, yerelTestBildirimi } from '../src/lib/bildirimler'
import { ONIZLEME } from '../src/lib/onizleme'
import { useBildirim } from '../src/state/BildirimSaglayici'
import { useInbox } from '../src/state/InboxContext'
import { Badge, Button, Card, ErrorBox, GeriDugmesi, Loading, Notice } from '../src/components/ui'
import { TASIYICI_METNI } from '../src/components/BildirimIzniSorusu'

/*
  BİLDİRİM AYARLARI — Profil › "Bildirim ayarları"ndan ve deneme bildirimine dokununca
  (/bildirimler) açılan yığın ekranı. Çekmecede YOK: gezinme listesi web'in sol rayının
  birebir karşılığı ve ayar bir gezinme hedefi değil (aydınlatma metni de kullanıcıyı
  "Profil › Bildirim ayarları"na yönlendiriyor).

  İKİ KATMAN, EKRANDA AYRI:
  • "Bu cihaz" — işletim sistemi izni ve aydınlatma. Telefona ait; uygulama ancak SORABİLİR,
    reddedilmişse yalnızca telefon ayarlarına götürebilir.
  • "Neler için bildirim alayım" — hesaba ait dört tercih, SUNUCUDA (başka telefonda da
    geçerli, kuyruktaki bildirimi de etkiliyor). Cihazda tutulmuyor: her yeni yerel değer
    bir izin kategorisi ve IZIN_SURUMU artışı demekti (IzinContext → ISLEVSEL_DEPOLAMA).
  İkisi bağımsız: telefonda izin kapalıyken de tercih değiştirilebilir (diğer cihazlar
  için). Android'de telefon ayarlarından kapatılmış KANAL ayrıca satırın altında söylenir;
  anahtar açık görünüp bildirim gelmemesinin tek açıklaması o.

  Durum bu ekranın DIŞINDA yaşıyor (BildirimSaglayici): tercih kuyruğu, izin, kanal durumu.
  Burada yalnızca okunuyor ve odakta tazeleniyor. Kullanıcı "Ayarları aç"tan dönünce izin
  ve kanallar sağlayıcının öne geliş dinleyicisiyle yeniden okunuyor; ekranın ayrıca bir
  şey yapmasına gerek yok.
*/

// Deneme bildirimi hangi türde gitsin: telefonda AÇIK ilk kanalın türü. Kapalı bir
// kanalda gönderilen deneme hiç görünmez ve kullanıcı "bildirimler çalışmıyor" sanardı.
const TEST_TURU = { mesajlar: 'mesaj', istekler: 'istek', 'ders-onayi': 'onay', 'ders-plani': 'ders' }

export default function BildirimAyarlari() {
  const router = useRouter()
  const guvenli = useSafeAreaInsets()
  const {
    destekleniyor,
    izin,
    tercihler,
    tercihHatasi,
    kanallar,
    kayit,
    kayitSuruyor,
    soruAc,
    tercihDegistir,
    tercihleriTazele,
    durumuTazele,
    kaydiDenetle,
    kaydiYenile,
  } = useBildirim()

  /*
    ODAKTA (açılış dahil) İZİN, KANAL VE TERCİHLER yeniden okunur: tercih başka bir
    telefonda değişmiş, aydınlatma orada verilmiş olabilir; sağlayıcı tercihleri öne
    gelişte en fazla 5 dakikada bir okuyor. Kurulumun odağı ATLANMIYOR (useOnePlanaGelince
    değil): sağlayıcının elindeki değer oturum başındaki değer, ekranın ilk hâli de taze
    olmalı.

    Tercihlerden SONRA kayıt denetlenir (kaydiDenetle): aydınlatma damgası bu okumayla
    gelmiş olabilir ve tercih okuması kaydı kendiliğinden tetiklemiyor. İzin ve damga
    yoksa kaydiDene hiçbir şey yapmaz.
  */
  useFocusEffect(
    useCallback(() => {
      Promise.all([durumuTazele(), tercihleriTazele()]).then(() => kaydiDenetle())
    }, [durumuTazele, tercihleriTazele, kaydiDenetle]),
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <GeriDugmesi onPress={() => (router.canGoBack() ? router.back() : router.replace('/profil'))} />
        <Text className="min-w-0 flex-1 text-lg font-bold text-slate-900">Bildirimler</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: guvenli.bottom + 16 }}
      >
        <BuCihazKarti
          destekleniyor={destekleniyor}
          izin={izin}
          tercihler={tercihler}
          tercihHatasi={tercihHatasi}
          kayit={kayit}
          kayitSuruyor={kayitSuruyor}
          onSor={() => soruAc('ayarlar')}
          onTazele={tercihleriTazele}
          onKaydiYenile={kaydiYenile}
        />

        <TercihlerKarti
          tercihler={tercihler}
          tercihHatasi={tercihHatasi}
          kanallar={kanallar}
          onDegistir={tercihDegistir}
          onTazele={tercihleriTazele}
        />

        <Card>
          <Text className="mb-2 text-sm font-medium text-slate-700">Bilgi</Text>
          {/* Aydınlatma sorusundaki cümlelerle AYNI içerik (BildirimIzniSorusu): kullanıcı
              burada, "Aç"a bastığında okuduğundan farklı bir şey görmemeli. Taşıyıcı cümlesi
              oradan içe aktarılıyor; elle yazılmış kopyası taşıyıcıları (Expo, Google, Apple)
              atlamıştı ve gizlilik §6'nın söylediğini bu ekran söylemiyordu. */}
          <Text className="text-sm leading-relaxed text-slate-600">
            {TASIYICI_METNI} Gece 22.00–09.00 arasında acil olmayan bildirimler sabaha kalır.
            Kilit ekranında ne görüneceğini telefonunun ayarları belirler.
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/gizlilik')}
            className="min-h-[44px] justify-center self-start"
          >
            <Text className="text-sm font-medium text-brand-700">Gizlilik metnini oku</Text>
          </Pressable>
        </Card>

        <DenemeKarti kanallar={kanallar} />

        {/* Yalnızca geliştirme derlemesinde ve gerçek yerel modül varken: önizlemede (web ve
            demo APK) expo-notifications bilerek yüklenmiyor, düğme hiçbir şey yapmazdı. */}
        {__DEV__ && !ONIZLEME && Platform.OS !== 'web' ? <YerelDenemeKarti /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

/*
  BU CİHAZ — beş hâl, her birinin TEK bir eylemi var:
    desteklenmiyor (Expo Go, web, önizleme, yerel modülü olmayan eski kabuk) → eylem yok
    izin + aydınlatma                → cihazın KAYIT sonucu (KayitDurumu):
                                        kayıtlı → "Bildirimler açık" rozeti; sonuç yok →
                                        "kaydediliyor"; kaydedilemedi → amber uyarı +
                                        "Yeniden dene"
    izin var, aydınlatma yok          → "Bildirimleri aç" (Android 7–12'nin ilk hâli; telefon
                                        ayarlarından açanlar da) — aydınlatma modalı
    izin yok, sorulabilir             → "Bildirimlere izin ver" — aydınlatma modalı, ardından
                                        sistem istemi
    izin yok, sorulamaz (reddedildi)  → amber uyarı + "Ayarları aç"
  Modal elle açılıyor (soruAc): kapatmak erteleme SAYILMAZ, kullanıcı kendisi istedi.
*/
function BuCihazKarti({
  destekleniyor,
  izin,
  tercihler,
  tercihHatasi,
  kayit,
  kayitSuruyor,
  onSor,
  onTazele,
  onKaydiYenile,
}) {
  let icerik
  if (!destekleniyor || izin?.destekleniyor === false) {
    icerik = (
      <Text className="text-sm leading-relaxed text-slate-600">
        Bu sürümde bildirimler desteklenmiyor. Aşağıdaki tercihler hesabına kayıtlı; bildirim
        alan diğer cihazlarında geçerli.
      </Text>
    )
  } else if (izin == null) {
    icerik = <Loading label="Bildirim izni okunuyor…" />
  } else if (izin.verildi && tercihler?.aydinlatmaAtUtc) {
    icerik = <KayitDurumu kayit={kayit} suruyor={kayitSuruyor} onYenidenDene={onKaydiYenile} />
  } else if (izin.verildi && !tercihler) {
    // Aydınlatma damgası sunucuda; okunamadan "açık" da "kapalı" da denemez.
    icerik = tercihHatasi ? (
      <ErrorBox error={tercihHatasi} onRetry={onTazele} />
    ) : (
      <Loading label="Bildirim durumu okunuyor…" />
    )
  } else if (izin.verildi) {
    icerik = (
      <View className="gap-3">
        <Text className="text-sm leading-relaxed text-slate-600">
          Telefonunda bildirim izni açık, ama bu cihaz henüz bildirimlere kaydedilmedi. Sen
          onaylamadan kaydetmiyoruz.
        </Text>
        <Button className="self-start" onPress={onSor}>
          Bildirimleri aç
        </Button>
      </View>
    )
  } else if (izin.sorulabilir) {
    icerik = (
      <View className="gap-3">
        <Text className="text-sm leading-relaxed text-slate-600">
          Bildirimler kapalı. İzin verirsen mesaj, arkadaş isteği ve ders haberlerini uygulama
          kapalıyken de alırsın.
        </Text>
        <Button className="self-start" onPress={onSor}>
          Bildirimlere izin ver
        </Button>
      </View>
    )
  } else {
    /* Reddedilmiş izin uygulamadan GERİ AÇILAMAZ (iOS'ta sistem istemi tek seferlik,
       Android'de ikinci retten sonra da öyle). Tek yol telefon ayarları; dönüşte durum
       sağlayıcının öne geliş dinleyicisiyle yeniden okunuyor. */
    icerik = (
      <View className="gap-3">
        <Notice tone="warning">Bildirimler telefonunun ayarlarında kapalı.</Notice>
        <Button variant="secondary" className="self-start" onPress={ayarlariAc}>
          Ayarları aç
        </Button>
      </View>
    )
  }

  return (
    <Card>
      <Text className="mb-2 text-sm font-medium text-slate-700">Bu cihaz</Text>
      {icerik}
    </Card>
  )
}

/*
  İZİN VE AYDINLATMA TAMAM — ama bildirimin gelip gelmeyeceğini KAYIT söylüyor. Kayıt
  sessizce düşebiliyor: Firebase dosyasız derlenmiş Android paketi token alamıyor, Firebase
  otomatik başlatması kapalıyken token verilip verilmediği henüz ölçülmedi, sunucu bu
  cihazın en yeni oturumu aktif değilse kaydı almıyor. Bunları kullanıcıya söyleyen başka
  bir yer yok (Deneme kartı ancak denenirse konuşuyor).
  Rozet (brand = olumlu durum) YALNIZCA kayitli:true iken; kaydedilemediyse amber (dikkat).
  Metin sebebe göre iki türlü: sunucu reddettiyse ağ değil oturum sorunudur ve yeniden
  giriş kaydı yeniler (yeni oturum bu cihaza bağlı doğar); geri kalanı ağ ya da taşıyıcı.
*/
function KayitDurumu({ kayit, suruyor, onYenidenDene }) {
  if (kayit?.kayitli) {
    return (
      <View className="gap-2">
        <Badge tone="success">Bildirimler açık</Badge>
        <Text className="text-sm leading-relaxed text-slate-600">
          Bu telefon bildirim alıyor. Hangi durumlarda bildirim alacağını aşağıdan seçebilirsin.
        </Text>
      </View>
    )
  }
  if (!kayit) return <Loading label="Bu telefon bildirimlere kaydediliyor…" />
  return (
    <View className="gap-3">
      <Notice tone="warning">
        {kayit.sebep === 'sunucu'
          ? 'Bu telefon bildirimlere kaydedilemedi, bu yüzden buraya bildirim gelmiyor. Yeniden dene; sorun sürerse çıkış yapıp yeniden giriş yapmak kaydı yeniler.'
          : 'Bu telefon bildirimlere kaydedilemedi, bu yüzden buraya bildirim gelmiyor. İnternet bağlantını kontrol edip yeniden dene.'}
      </Notice>
      <Button variant="secondary" className="self-start" loading={suruyor} onPress={onYenidenDene}>
        Yeniden dene
      </Button>
    </View>
  )
}

/*
  DÖRT TERCİH — dört Android kanalıyla ve sunucudaki dört kategoriyle bire bir (tek kaynak
  KANALLAR; satır metni kanal açıklamasıyla aynı). Değişiklik sağlayıcının TEK UÇUŞLU
  kuyruğundan gidiyor: art arda dokunuşlarda yalnızca son durum gönderilir, hata olursa
  anahtar son ONAYLANMIŞ değere döner ve hata kutusu çıkar.
*/
function TercihlerKarti({ tercihler, tercihHatasi, kanallar, onDegistir, onTazele }) {
  return (
    <Card>
      <Text className="text-sm font-medium text-slate-700">Neler için bildirim alayım</Text>

      {tercihler == null ? (
        tercihHatasi ? (
          <View className="mt-3">
            <ErrorBox error={tercihHatasi} onRetry={onTazele} />
          </View>
        ) : (
          <Loading label="Tercihler yükleniyor…" />
        )
      ) : (
        <View className="mt-1">
          {KANALLAR.map((k, i) => (
            <TercihSatiri
              key={k.kimlik}
              kanal={k}
              ilk={i === 0}
              acik={Boolean(tercihler[k.tercih])}
              telefondaKapali={Platform.OS === 'android' && kanallar?.[k.kimlik] === 'kapali'}
              onDegistir={(acik) => onDegistir(k.kimlik, acik)}
            />
          ))}
          {/* Yazım hatası: anahtar zaten onaylı değere döndü, burada NEDEN söyleniyor. */}
          {tercihHatasi ? (
            <View className="mt-2">
              <ErrorBox error={tercihHatasi} />
            </View>
          ) : null}
        </View>
      )}
    </Card>
  )
}

/*
  TERCİH SATIRI — satırın TAMAMI anahtar (min 44px): IzinSayfasi'ndaki anahtarla aynı
  görsel dil (Pressable + top; RN Switch ui.jsx'in yüzey diline yabancı bir platform
  kontrolü getiriyor) ama dokunma hedefi 32px'lik top değil bütün satır.

  Kapalı zemin slate-500 (beyaz topla ve kart zeminiyle 4.76:1; WCAG 1.4.11 için 3:1
  yeter, slate-300 1.48:1 kalıyordu).
*/
function TercihSatiri({ kanal, acik, telefondaKapali, onDegistir, ilk }) {
  return (
    <View className={`py-2 ${ilk ? '' : 'border-t border-slate-100'}`}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: acik }}
        accessibilityLabel={kanal.ad}
        accessibilityHint={kanal.aciklama}
        onPress={() => onDegistir(!acik)}
        className="min-h-[44px] flex-row items-center gap-3"
      >
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-slate-900">{kanal.ad}</Text>
          <Text className="mt-0.5 text-xs leading-relaxed text-slate-600">{kanal.aciklama}</Text>
        </View>
        <View
          className={`h-8 w-14 shrink-0 justify-center rounded-full px-1 ${
            acik ? 'bg-brand-600' : 'bg-slate-500'
          }`}
        >
          <View className={`h-6 w-6 rounded-full bg-white ${acik ? 'self-end' : 'self-start'}`} />
        </View>
      </Pressable>

      {/* Telefon ayarlarında kapatılmış kanal: anahtar "açık" dese de bu türde bildirim
          GÖRÜNMEZ. Amber = dikkat (A düzeni). Sunucu da bu cihaza o kanalda göndermiyor. */}
      {telefondaKapali ? (
        <View className="mt-1 flex-row items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 py-1 pl-3 pr-1">
          <Text className="min-w-0 flex-1 text-xs text-amber-900">Telefon ayarlarında kapalı</Text>
          <Button
            variant="secondary"
            accessibilityLabel={`${kanal.ad} bildirimlerini telefon ayarlarında aç`}
            onPress={() => kanalAyarlariniAc(kanal.kimlik)}
          >
            Aç
          </Button>
        </View>
      ) : null}
    </View>
  )
}

/*
  DENEME BİLDİRİMİ — "bildirim gelmiyor" teşhisi. Sunucu, çağıranın KENDİ bağlı cihazlarına
  gerçek hattan (kuyruk → dağıtıcı → Expo) tek bir bildirim gönderiyor; tercih süzgeci
  uygulanmıyor. Sınır sunucuda (10 dakikada 3) ve 429 kullanıcıya düz cümleyle söyleniyor.
*/
function DenemeKarti({ kanallar }) {
  const [mesgul, setMesgul] = useState(false)
  const [sonuc, setSonuc] = useState(null) // { ton, metin }
  const [hata, setHata] = useState(null)

  async function gonder() {
    if (mesgul) return
    setMesgul(true)
    setSonuc(null)
    setHata(null)
    const kanal = KANALLAR.find((k) => kanallar?.[k.kimlik] !== 'kapali') ?? KANALLAR[0]
    try {
      const yanit = await api.sendTestPush(TEST_TURU[kanal.kimlik])
      const cihaz = Number(yanit?.cihaz) || 0
      setSonuc(
        cihaz > 0
          ? {
              ton: 'success',
              metin: `Deneme bildirimi gönderildi (${cihaz} cihaz). Birkaç saniye içinde gelmeli.`,
            }
          : {
              ton: 'warning',
              metin:
                'Hesabına bağlı, bildirim alan bir cihaz bulunamadı. Önce yukarıdan bu cihazda bildirimleri aç.',
            },
      )
    } catch (err) {
      if (err?.status === 429) {
        setSonuc({ ton: 'warning', metin: 'Kısa sürede çok deneme yapıldı. Biraz sonra tekrar dene.' })
      } else {
        setHata(err)
      }
    } finally {
      setMesgul(false)
    }
  }

  return (
    <Card>
      <Text className="text-sm font-medium text-slate-700">Deneme</Text>
      <Text className="mt-1 text-xs leading-relaxed text-slate-600">
        Bildirim gelmiyorsa buradan dene: hesabına bağlı cihazlara bir deneme bildirimi
        gönderilir.
      </Text>
      <View className="mt-3 gap-3">
        <Button variant="secondary" className="self-start" loading={mesgul} onPress={gonder}>
          Test bildirimi gönder
        </Button>
        {sonuc ? (
          <Notice tone={sonuc.ton} onDismiss={() => setSonuc(null)}>
            {sonuc.metin}
          </Notice>
        ) : null}
        <ErrorBox error={hata} />
      </View>
    </Card>
  )
}

/*
  GELİŞTİRİCİ: YEREL DENEME — sunucusuz, 5 sn sonra BU telefonda gerçek veri biçiminde
  (tür, adres, alıcı etiketi) yerel bildirim üretir (bildirimler.js → yerelTestBildirimi).
  Uygulamayı kapatıp bildirime dokunarak soğuk açılış yönlendirmesi, ön planda da gösterim
  kararı sınanır. Kayıt kimliği gerçek bir sohbet/dersten alınıyor ki dokunuş boş bir liste
  ekranına değil, hedef ekrana (ApproveModal dahil) gitsin.
*/
const YEREL_TESTLER = [
  { tur: 'mesaj', etiket: 'Mesaj' },
  { tur: 'istek', etiket: 'İstek' },
  { tur: 'onay', etiket: 'Onay' },
  { tur: 'dersYaklasiyor', etiket: 'Yaklaşan ders' },
]

function YerelDenemeKarti() {
  const { conversations } = useInbox()
  const [durum, setDurum] = useState(null)

  async function dene(tur) {
    let kayitId = null
    try {
      if (tur === 'mesaj') {
        kayitId = conversations?.[0]?.conversationId ?? null
      } else if (tur === 'onay' || tur === 'dersYaklasiyor') {
        const aktif = (await api.mySessions(1, 1))?.active ?? []
        const ders =
          tur === 'onay'
            ? aktif.find((s) => s.canApprove) ?? aktif[0]
            : aktif.find((s) => s.status === 'Booked') ?? aktif[0]
        kayitId = ders?.sessionId ?? null
      }
    } catch {
      /* kimliksiz de olur: liste ekranına gider */
    }
    const tamam = await yerelTestBildirimi(tur, kayitId)
    setDurum(tamam ? `"${tur}" 5 saniye sonra gelecek.` : 'Yerel bildirim zamanlanamadı (izin ya da yerel modül yok).')
  }

  return (
    <Card>
      <Text className="text-sm font-medium text-slate-700">Geliştirici: yerel deneme</Text>
      <Text className="mt-1 text-xs leading-relaxed text-slate-600">
        Sunucuya gitmez. Uygulamayı kapatıp bildirime dokunarak soğuk açılışı dene.
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {YEREL_TESTLER.map(({ tur, etiket }) => (
          <Button key={tur} variant="secondary" onPress={() => dene(tur)}>
            {etiket}
          </Button>
        ))}
      </View>
      {durum ? <Text className="mt-2 text-xs text-slate-600">{durum}</Text> : null}
    </Card>
  )
}

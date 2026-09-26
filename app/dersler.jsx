import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Platform, Pressable, Text, View } from 'react-native'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import DateTimePicker from '@react-native-community/datetimepicker'
import { api } from '../src/lib/api'
import { sunulanlariKapat } from '../src/lib/bildirimler'
import { bekleyenIsleriTazele, useBekleyenIsler } from '../src/lib/bekleyenIsler'
import { useYetkiliGorsel } from '../src/components/YetkiliGorsel'
import { amber, rose } from '../src/lib/theme'
import { dersSekmesi, eylemBekliyor, rezervasyonBirlesimi } from '../src/lib/dersDurumu'
import { dersDegisti, dersSurumu, dersSurumuAbone } from '../src/lib/dersSurumu'
import { ogrenciKonusu } from '../src/lib/iliski'
import { useAsync } from '../src/state/useAsync'
import { useBildirim } from '../src/state/BildirimSaglayici'
import { useGecmisSayfalari } from '../src/state/useGecmisSayfalari'
import { useIzin } from '../src/state/IzinContext'
import { useOnePlanaGelince } from '../src/state/useOnePlanaGelince'
import { useWallet } from '../src/state/WalletContext'
import { Avatar } from '../src/components/Avatar'
import { BildirimIzniKarti } from '../src/components/BildirimIzniSorusu'
import { ReviewModal } from '../src/components/ReviewModal'
import { SaatIkonu, UyariIkonu } from '../src/components/Ikonlar'
import {
  REPORT_REASON_LABELS,
  SESSION_STATUS_LABELS,
  TRANSACTION_LABELS,
  formatDateTime,
  remainingText,
  signedCredit,
} from '../src/lib/format'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  GeriDugmesi,
  Girdi,
  HapSekmeCubugu,
  Loading,
  Modal,
  Notice,
  Spinner,
  UstEtiket,
} from '../src/components/ui'

/*
  DERSLERİM — web'deki pages/Sessions.jsx'in portu. BEŞ SEKME (2026-09-26, kullanıcı
  kararı; adlar kullanıcının, değiştirilmeden). Bu tarihe kadar web'in iki sütunu burada
  TEK AKIŞA iniyordu (aksiyon → itirazda → planlanmış → saati geçmiş açıklar → geçmiş →
  katlanır puan defteri); web de sütunları bıraktı, iki istemci aynı beş sekmeyi taşıyor:

    aksiyon     senden iş bekleyen dersler + "İtirazda, karar yönetimde" (sayaca girmez)
    planlanmis  "Saati geçti, hâlâ açık" + "Yaklaşan"; bildirim izni kartı burada
    gecmis      YALNIZCA tamamlananlar, sunucu süzgeciyle (?pastStatus=Completed); sekme
                ilk açılınca çekilir
    puan        puan defteri (/wallet/statement); sekme ilk açılınca çekilir
    rezerve     iki rolde bütün rezervasyonlar, sonucu ne olursa olsun, ders tarihine göre

  Bir dersin hangi sekmede durduğu lib/dersDurumu.js'te (web'le BAYT BAYT aynı dosya):
  gruplama, ?ders= yönlendirmesi ve çekmecedeki Derslerim sayacı aynı tanımı okuyor.

  SEKME BAŞINA AYRI LİSTE (FlatList key={sekme}): tek listede yalnızca `data` değiştirmek
  VirtualizedList'in onEndReached korumasını önceki sekmenin içerik uzunluğuyla bırakırdı;
  anahtarla her sekme temiz kurulur ve tepeden açılır. Birikintiler (geçmiş ve rezerve
  sayfaları, puan satırları) Dersler'de tutulur: sekme değişince kaybolmaz, yeniden istenmez.

  VARSAYILAN SEKME: ?sekme= > kullanıcının seçimi > ilk veride (senden iş bekleyen ders
  varsa 'aksiyon', yoksa 'planlanmis'). İlk yanıta kadar hiçbir hap seçili değil: bir an
  "aksiyon"u gösterip "planlanmış"a zıplamak yerine. Ekran tekil ve kök yığında kurulu
  kaldığı için son sekme sonraki ziyarette korunur.

  ÜÇ BİLİNÇLİ MOBİL FARKI:
  • Geçmiş ve Rezerve SAYFA DEĞİŞTİRMEZ, BİRİKİR (iş kuralı 4): 5'erli sayfalar FlatList
    onEndReached ile eklenir (src/state/useGecmisSayfalari.js). Web Geçmiş'i numaralı
    sayfalıyor, Rezerve'yi düğmeyle biriktiriyor.
  • ?sekme= bir KOMUT: okunur ve adresten silinir. Web onu adreste tutuyor (yenileme ve
    paylaşılan bağlantı sekmeyi korusun); burada ekran tekil ve kurulu, adres kalsaydı aynı
    değerle ikinci gelişte parametre DEĞİŞMEZ ve sekme seçilmezdi.
  • Kanıt dosya seçici DEĞİL expo-image-picker (iş kuralı 5).

  Web'den aynen taşınan kritik kararlar:
  • Saati geçmiş ders "Yaklaşan"da KALAMAZ: sunucu aktif/geçmiş ayrımını yalnızca
    duruma göre yapar; arayüz üç yönlü ayırır (aksiyon / saati gelmemiş / saati geçmiş
    açık). Saati geçmiş açıklar Planlanmış'ta, amber başlıkla üstte: "Geçmiş dersler"
    yalnızca tamamlananlar ve kaydı kapanmamış ders oraya giremez.
  • 20 sn'lik tick: geri sayımlar ve gruplama canlı aksın — saati dolan ders sayfa
    yenilenmeden doğru sekmeye geçsin.
  • Rezervasyonu yapan taraf HER ZAMAN ÖĞRENCİ: seçilebilir konu, karşı tarafın BANA
    anlatacağı konudur (lib/iliski.js → ogrenciKonusu) — tersini listelemek puanı yanlış
    tarafa yazdırırdı.
  • Onay/tamamlama/iptal/şikayet çift gönderime karşı REF kilidi taşır: state bir
    sonraki render'a kadar eski değeri gösterir, kilit render beklemez.
  • Puan önizlemesi GÖSTERİM sabiti (30 dk blok = 50 puan, SessionRules ile birebir);
    bağlayıcı değer her zaman sunucunun mintAmount'u.
*/

/*
  Olumlu durum marka mavisi: yeşil marka paletinin dışındaydı (kullanıcı kararı, A düzeni).
  Amber yalnızca bekleyene, rose tehlikeye.

  Planlanmış ile Tamamlandı ikisi de mavi ailede, bu yüzden GÜÇLERİ ayrı: yaklaşan ders
  dolu şerit ve mavi takvimle öne çıkıyor, tamamlanan ders geçmişte sakin duruyor (açık
  şerit, gri takvim) ve rengini yalnızca "Tamamlandı" rozeti taşıyor. Aynı güçte
  çizildiklerinde iki kart birebir aynı görünüyordu (önizlemede ölçüldü); geçmişte arka
  arkaya dizilen on iki dolu mavi şerit de yaklaşan dersin vurgusunu siliyordu.
*/
const DURUM_STILI = {
  Booked: { serit: 'bg-brand-500', takvim: 'bg-brand-100', takvimYazi: 'text-brand-700', rozet: 'brand', vurgu: 'text-brand-700' },
  AwaitingApproval: { serit: 'bg-amber-400', takvim: 'bg-amber-100', takvimYazi: 'text-amber-800', rozet: 'warning', vurgu: 'text-amber-700' },
  Completed: { serit: 'bg-brand-200', takvim: 'bg-slate-100', takvimYazi: 'text-slate-600', rozet: 'success', vurgu: 'text-brand-700' },
  Disputed: { serit: 'bg-rose-500', takvim: 'bg-rose-100', takvimYazi: 'text-rose-700', rozet: 'danger', vurgu: 'text-rose-700' },
  Cancelled: { serit: 'bg-rose-300', takvim: 'bg-rose-100', takvimYazi: 'text-rose-700', rozet: 'danger', vurgu: 'text-rose-700' },
  Expired: { serit: 'bg-slate-300', takvim: 'bg-slate-100', takvimYazi: 'text-slate-700', rozet: 'neutral', vurgu: 'text-slate-600' },
}

const VARSAYILAN_DURUM_STILI = DURUM_STILI.Expired

/* Sayfa başına 5 geçmiş ders — mobil iş kuralı. Geçmiş ve Rezerve aynı boyu kullanıyor;
   Rezerve'nin ilk sayfası ekranın açılış isteğinden geldiği için ikisi aynı olmak ZORUNDA
   (useGecmisSayfalari ofseti sayfa × boy diye hesaplıyor). Web: Geçmiş 5, Rezerve 10. */
const PAST_PAGE_SIZE = 5

/* Liste sonu eşiği (görünür yüksekliğin oranı): FlatList onEndReachedThreshold ve kısa liste
   devamı (kisaListeyseDevamEt) aynı değeri kullanır. */
const SONA_ESIK = 0.4

/* Sekmeler — adlar kullanıcının, değiştirilmeden (web SEKMELER ile aynı anahtarlar). */
const SEKMELER = [
  { anahtar: 'aksiyon', etiket: 'Senden aksiyon bekleyenler' },
  { anahtar: 'planlanmis', etiket: 'Planlanmış' },
  { anahtar: 'gecmis', etiket: 'Geçmiş dersler' },
  { anahtar: 'puan', etiket: 'Puan geçmişi' },
  { anahtar: 'rezerve', etiket: 'Rezerve geçmişi' },
]
const SEKME_ANAHTARLARI = new Set(SEKMELER.map((s) => s.anahtar))

/* Aktif listeye dayanan sekmeler: yükleme, hata ve kesme uyarısı onlarda gösterilir. */
const AKTIFE_BAGLI = new Set(['aksiyon', 'planlanmis', 'rezerve'])

export default function Dersler() {
  const router = useRouter()
  const navigation = useNavigation()
  const sessions = useAsync(() => api.mySessions(1, PAST_PAGE_SIZE), [])
  const matches = useAsync(() => api.myMatches(), [])
  const { wallet, refreshWallet } = useWallet()

  const [notice, setNotice] = useState(null)
  // Bildirimden gelinen dersin durumu ("artık onay beklemiyor" …) — işlem sonucundan
  // (notice) ayrı: biri ötekini silmesin.
  const [bilgi, setBilgi] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [dialog, setDialog] = useState(null) // { type, session }

  // Kökteki tam ekran katmanlar (veri izni sayfası, bildirim sorusu): açıkken ?ders=
  // onay sayfasını kendiliğinden AÇMAZ — iOS'ta aynı anda iki RN Modal, biri hiç
  // görünmeyebiliyor (IzinSayfasi → IZIN_KAPANMA_SURESI notu).
  const { mutlakaSor, ayarlarAcik } = useIzin()
  const { soru } = useBildirim()
  const ustKatmanAcik = mutlakaSor || ayarlarAcik || soru.acik

  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  /*
    ARKA PLAN TAZELEMESİ — ders durumu çoğu zaman CİHAZ DIŞINDA değişiyor (eğitmen kanıt
    yükledi, karşı taraf iptal etti, yeni ders planlandı) ve bu ekran kök yığında KURULU
    kalıyor. Tetikler:
    • odağa dönüş ve uygulamanın öne gelişi (useOnePlanaGelince) — kilitli telefona
      "Dersin onay bekliyor" gelip ikondan dönen kullanıcı onay kartını görsün,
    • ders sürümü (dersSurumu) — ön planda gelen ders bildirimi odak olayı doğurmuyor;
      ekran odaktaysa anında, değilse dönüşteki odak tazelemesine bırakılır.

    YALNIZCA AKTİF KISIM KESİN DEĞİŞİR: istek yine geçmişin ilk sayfasını da taşıyor ama
    biriken sayfalar (Rezerve ve Geçmiş) yalnızca geçmişin TOPLAMI değişince sıfırlanıyor
    (useGecmisSayfalari, kural 1). Her tazeleme birikintiyi silseydi, aşağı kaydırıp sayfa
    yükleyen kullanıcının listesi her bildirimde 5 kayda inerdi. Kilit (tazeleniyor) ve
    yukarı kaydırma YOK: kullanıcı bir işlem yapmadı.
  */
  function arkaPlanTazele() {
    sessionsRef.current.reload({ silent: true })
    // Rezervasyon listesi (arkadaşlar) de aynı anlarda bayatlıyor: yeni kabul edilen istek.
    matchesRef.current.reload({ silent: true })
  }
  useOnePlanaGelince(arkaPlanTazele)

  // Bu ekranın kendi işleminin sürümü: listeyi işlemin kendisi tazeliyor, sayaç yalnızca
  // DİĞER dinleyiciler (çekmecedeki Derslerim sayacı) için artıyor.
  const kendiSurumum = useRef(null)
  useEffect(
    () =>
      dersSurumuAbone((surum) => {
        if (surum === kendiSurumum.current) return
        if (navigation.isFocused()) arkaPlanTazele()
      }),
    [navigation],
  )

  /* ── SEKME ─────────────────────────────────────────────────────────────── */
  const [sekme, setSekme] = useState(null)

  /*
    İLK VERİDE BİR KEZ karar verilir ve sabit kalır: son işi bitiren kullanıcı sekmesinden
    atılmasın. Render sırasında yazım bilinçli (React'in "önceki render'dan türeyen state"
    kalıbı; web de böyle): efektte yazılsaydı boyanmış bir kare sekmesiz çizilirdi.
    ?sekme= ya da kullanıcı veri gelmeden seçtiyse sekme zaten dolu, bu dal koşmaz.
  */
  if (sekme === null && sessions.data) {
    const simdi = Date.now()
    setSekme((sessions.data.active ?? []).some((s) => eylemBekliyor(s, simdi)) ? 'aksiyon' : 'planlanmis')
  }

  // Geçmiş dersler tembel: sekme İLK açıldığında çekilir, sonra açık kalır (tazelemeler
  // için). Aynı render-sırası kalıbı.
  const [gecmisAcildi, setGecmisAcildi] = useState(false)
  if (sekme === 'gecmis' && !gecmisAcildi) setGecmisAcildi(true)

  /*
    ?sekme=<anahtar> — dışarıdan sekme seçimi (çekmecedeki Derslerim satırı, rozet varken
    aksiyona). ?rezerve= ile aynı kalıp: efektle işlenir ve adresten SİLİNİR — ekran tekil
    ve kurulu kalıyor, silinmezse aynı değerle ikinci geliş parametreyi değiştirmez ve
    kullanıcı başka sekmedeyken hiçbir şey olmaz. Bilinmeyen değer aksiyonu açar (web'le
    aynı): kullanıcıyı buraya büyük olasılıkla bekleyen bir iş çağırdı.

    SİLME EKRANIN KENDİ navigation'IYLA VE BİR TIK SONRA (olustur.jsx'teki ?ekle= notu):
    router.setParams odaktaki gezgine gidiyor ve soğuk açılışta parametre kök rotaya
    yazılıp burada kalıyordu; gecikmesiz navigation.setParams'ın üstüne de gezginin kendi
    kurulum yazımı basıyordu. ?rezerve= ve ?ders= hâlâ router.setParams'la (aynı kusur,
    bu işin kapsamı dışında).

    Bildirimin adresi (?ders=) buna DOKUNMAZ: sunucu yalnızca ?ders= yazıyor ve push beyaz
    listesi (bildirimler.js → guvenliRota) başka parametre kabul etmiyor. Sekmeyi orada
    dersin güncel durumu seçiyor (aşağıda).
  */
  const { sekme: sekmeKomutu } = useLocalSearchParams()
  useEffect(() => {
    if (!sekmeKomutu) return
    const hedef = String(sekmeKomutu)
    setSekme(SEKME_ANAHTARLARI.has(hedef) ? hedef : 'aksiyon')
    const zamanlayici = setTimeout(() => navigation.setParams({ sekme: '' }), 0)
    return () => clearTimeout(zamanlayici)
  }, [sekmeKomutu, navigation])

  /*
    ?rezerve=<matchId> — REZERVASYON BAĞLAMI ADRESTEN GELİR (Arkadaşlar kartı, Akış ve YKS
    kartlarındaki "Ders rezerve et"). Eskiden bu düğmeler parametresiz buraya iniyordu:
    kullanıcı "+ Rezerve et"e yeniden basıp az önce dokunduğu arkadaşı listeden yeniden
    seçiyordu. Artık sayfa açık ve o arkadaş seçili geliyor (tek dokunuş).

    Parametre okunur okunmaz adresten SİLİNİR: adres bir KOMUT taşıyor, durum değil. Kalsaydı
    ekran aynı adresle yeniden kurulduğunda (web önizlemesinde sayfa yenileme) kullanıcının
    çoktan kapattığı sayfa kendiliğinden yeniden açılırdı. Ön seçim ayrı state'te; kapanışta
    ve tazelemede sıfırlanıyor, yoksa "+ Rezerve et"le açılan sonraki sayfa eski arkadaşı
    seçili getirirdi.
  */
  const { rezerve } = useLocalSearchParams()
  const [onSecim, setOnSecim] = useState(null)
  useEffect(() => {
    if (!rezerve) return
    setOnSecim(String(rezerve))
    setBookOpen(true)
    /* Bir sonraki tura ERTELENİYOR: ekranın ilk commit'inde çağrılan setParams gezinme durumu
       henüz kurulmadığı için soğuk açılışta (derin bağlantı, web'de adres) etkisiz kalıyordu;
       sayfa yenilenince rezervasyon yeniden açılıyordu (ölçüldü). */
    const zamanlayici = setTimeout(() => router.setParams({ rezerve: '' }), 0)
    return () => clearTimeout(zamanlayici)
  }, [rezerve, router])

  /*
    ?ders=<sessionId> — DERS BİLDİRİMİNE DOKUNULDU (onay, otomatik onay, yeni ders, iptal,
    yaklaşan ders; hepsi aynı adres). ?rezerve= ile aynı kalıp: efektle işlenir ve adresten
    silinir — ekran tekil ve kurulu kalıyor, router.navigate yalnızca parametreyi değiştiriyor.

    Karar ELDEKİ listeyle VERİLMEZ: o liste bildirimden önceki durumu gösteriyor olabilir.
    Parametre anındaki veri not ediliyor ve ondan SONRA gelen ilk yanıt bekleniyor (elde
    veri yoksa ilk yükleme zaten taze). Sonra SEKME dersin güncel durumundan seçilir
    (dersDurumu.js → dersSekmesi) ve:
    • ders hâlâ onay bekliyor ve onaylayacak olan bu kullanıcı → aksiyon sekmesi ve
      ApproveModal DOĞRUDAN açılır: bildirim "onayla ya da itiraz et" diyor, kullanıcı kartı
      aramasın. Başka bir sayfa açıksa (rezervasyon, başka bir işlem, kökteki veri izni ya da
      bildirim sorusu) onun üstüne açılmaz — sekme yine geçer, kart orada ilk sırada.
    • ders aktif ve bekleyen bir iş yok (planlanmış, yaklaşan) → Planlanmış; bir şey
      söylenmez, kart orada.
    • ders itirazda, geçmişe geçmiş ya da listede hiç yok → durumu söyleyen bir bilgi
      kutusu, sekmesiyle (tamamlanan → Geçmiş dersler; iptal, süresi dolan ya da bulunamayan
      → Rezerve geçmişi). Sessiz kalsaydık kullanıcı bildirimdeki işi arardı.

    ⚠️ Adres bildirimin TÜRÜNÜ taşımıyor (sunucu beş türde de aynı adresi yazıyor), bu
    yüzden karar dersin GÜNCEL durumundan veriliyor, türden değil. Tasarımdaki tek cümle
    ("artık onay beklemiyor") yalnızca onay bildirimlerine uyuyordu; iptal ya da yaklaşan
    ders bildirimine dokunan kullanıcıya yanlış şeyi söylerdi.
  */
  const { ders } = useLocalSearchParams()
  const [hedefDers, setHedefDers] = useState(null) // { id, onceki }
  useEffect(() => {
    if (!ders) return
    setBilgi(null)
    setHedefDers({ id: String(ders).toLowerCase(), onceki: sessionsRef.current.data })
    if (sessionsRef.current.data != null) sessionsRef.current.reload({ silent: true })
    const zamanlayici = setTimeout(() => router.setParams({ ders: '' }), 0)
    return () => clearTimeout(zamanlayici)
  }, [ders, router])

  /* ── GEÇMİŞ BİRİKİNTİLERİ ──────────────────────────────────────────────── */
  /*
    Rezerve geçmişi: süzgeçsiz geçmiş, ilk sayfası açılış isteğinden (ek istek yok). ?ders=
    araması da bunu kullanıyor: ilk sayfası her durumu içeriyor.
    Geçmiş dersler: yalnızca Completed, sekme ilk açılınca kendi isteğiyle. Geçmişe ders
    girince (onay, otomatik onay, itirazın kararı — hepsi süzgeçsiz toplamı artırır) 1.
    sayfası yeniden çekilir; toplam aynı çıkarsa biriken sayfalar korunur.
  */
  const rezerveGecmis = useGecmisSayfalari({
    sayfaBoyutu: PAST_PAGE_SIZE,
    disIlkSayfa: sessions.data?.past ?? null,
  })
  const tamamlananlar = useGecmisSayfalari({
    durum: 'Completed',
    sayfaBoyutu: PAST_PAGE_SIZE,
    etkin: gecmisAcildi,
    tazelemeAnahtari: sessions.data?.past?.totalCount ?? null,
  })

  /* ── PUAN DEFTERİ ──────────────────────────────────────────────────────── */
  const defter = usePuanDefteri()
  const { yukle: defterYukle, yenile: defterYenile } = defter
  useEffect(() => {
    if (sekme === 'puan' && defter.sayfa === 0 && !defter.yukleniyor && !defter.hata) defterYukle(1)
  }, [sekme, defter.sayfa, defter.yukleniyor, defter.hata, defterYukle])

  /*
    Toplam puan değişince defter bayat: "Toplam puanın" yeni sayıyı söylerken satırlar
    eskisinde kalmasın. Puanı basan işlemlerin çoğu cihaz dışında (karşı tarafın onayı,
    otomatik onay, Topluluk ödülü) ve cüzdan tazelenince buradan görünüyor. Yalnızca defter
    bir kez yüklendiyse; yüklenmediyse ilk açılış zaten taze çekecek.
  */
  const toplamPuan = wallet?.totalEarnedCredits
  const gorulenToplamPuan = useRef(toplamPuan)
  useEffect(() => {
    const onceki = gorulenToplamPuan.current
    gorulenToplamPuan.current = toplamPuan
    if (onceki != null && toplamPuan != null && onceki !== toplamPuan && defter.sayfa > 0) defterYenile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toplamPuan])

  /*
    TAZELEME KİLİDİ — işlemden sonra liste sunucudan dönene kadar kart düğmeleri pasif.

    Tazeleme sessiz olduğu için kartlar ekranda kalıyor, ama gösterdikleri durum bir önceki
    listeye ait: az önce iptal edilen dersin "İptal"i ya da onaylanan dersin "Kanıtı incele
    ve onayla"sı yanıt gelene kadar hâlâ basılabilir duruyordu. İkinci basış sunucudan hata
    döner ve kullanıcı, işlemi ASLINDA başarılıyken kırmızı kutu görürdü.
  */
  const [tazeleniyor, setTazeleniyor] = useState(false)
  const listeRef = useRef(null)
  // Listenin görünür yüksekliği ve içerik yüksekliği (kısa liste devamı, FlatList'in yanında).
  const listeOlcusu = useRef({ icerik: 0, gorunur: 0 })

  /*
    YUKARI KAYDIRMA İSTEĞİ — refresh() içinde doğrudan değil, commit'ten SONRA koşan efektte.

    refresh() modal hâlâ ekrandayken çağrılıyor. Kaydırma orada başlatılınca web önizlemesinde
    şikayetten sonra liste yerinde kaldı (ölçüldü: scrollTop 4226'da sabit, bildirim görünmüyor).
    RN Web'in Modal odak tuzağı modal sökülürken onu açan düğmeye focus() veriyor
    (ModalFocusTrap temizleyicisi). Şikayette bu çağrı kaydırma henüz ilerlemeden geldi ve
    kaydırmayı durdurdu. İptalde kaydırma o anda 580'e inmişti ve sürdü, yani sonuç zamanlamaya
    kalıyordu. Sökülen bileşenin efekt temizleyicileri yeni efektlerden önce koşuyor: buradaki
    kaydırma her zaman odak iadesinden sonra başlıyor. Native'de odak iadesi yok, sıra orada
    da zararsız.
  */
  const [yukariKaydir, setYukariKaydir] = useState(0)
  useEffect(() => {
    if (yukariKaydir) listeRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [yukariKaydir])

  // Yeni liste geldi: işlem sonrası kilit açılır (kartlar artık taze durumu gösteriyor).
  useEffect(() => {
    setTazeleniyor(false)
  }, [sessions.data])

  // Tazeleme hatayla biterse data değişmez ve yukarıdaki efekt koşmaz: kilit burada açılır,
  // yoksa düğmeler ErrorBox'ın yanında kalıcı olarak pasif kalırdı.
  useEffect(() => {
    if (sessions.error) setTazeleniyor(false)
  }, [sessions.error])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const groups = useMemo(() => {
    const active = sessions.data?.active ?? []
    const simdi = Date.now()
    const saatiGecti = (s) => new Date(s.scheduledEndUtc).getTime() <= simdi

    /*
      Aksiyon tanımı çekmecedeki Derslerim sayacıyla ORTAK (lib/dersDurumu.js): rozet
      "2" deyip burada tek kart görünmesin. İtirazdaki dersler sayaca girmez (basılacak
      düğmeleri yok, karar yönetimde) ama aynı sekmede, kendi başlıklarıyla duruyor.
      Planlanmış ikiye ayrılıyor; KIYAS BİTİŞ SAATİYLE, başlangıçla değil: 60 dakikalık bir
      ders başladı diye geçmiş olmuyor.
    */
    const planli = active.filter((s) => dersSekmesi(s, simdi) === 'planlanmis')
    return {
      action: active.filter((s) => eylemBekliyor(s, simdi)),
      itirazda: active.filter((s) => s.status === 'Disputed'),
      upcoming: planli.filter((s) => !saatiGecti(s)),
      gecmisAcik: planli.filter(saatiGecti),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.data, tick])

  const activeTruncated = (sessions.data?.activeTotal ?? 0) > (sessions.data?.active?.length ?? 0)

  /*
    REZERVE GEÇMİŞİ — aktif + süzgeçsiz geçmiş birikintisi, ders tarihine göre tek liste
    (dersDurumu.js → rezervasyonBirlesimi: sınır kuralı, tekilleştirme, çakışmada geçmiş
    kazanır). Toplam kesin: aktif sayı + geçmiş toplamı. Aktif liste 100'de kesildiyse eski
    aktifler eksik kalır; kesme uyarısı bu sekmede de gösteriliyor.
  */
  const rezerveListe = useMemo(
    () =>
      sessions.data
        ? rezervasyonBirlesimi(sessions.data.active ?? [], rezerveGecmis.items, rezerveGecmis.dahaVar)
        : [],
    [sessions.data, rezerveGecmis.items, rezerveGecmis.dahaVar],
  )
  const rezerveToplam = (sessions.data?.activeTotal ?? 0) + (rezerveGecmis.toplam ?? 0)

  /*
    ROZET EŞİTLİĞİ — aksiyon hapındaki sayı ile çekmecedeki Derslerim sayacı aynı tanımdan
    (eylemBekliyor) ama farklı anlarda ve farklı saatle hesaplanıyor: çekmece kendi çekim
    anında, bu ekran 20 sn'lik tick'le. Eğitmenin dersinin bitişi çekmecenin çekiminden
    sonra geçerse "rozet 1, liste 2" olur ve kullanıcı bir işi arar. Fark görülünce çekmece
    tazelenir (tek uçuşlu, tek hafif istek); sayılar aynıyken hiçbir şey yapılmaz. İşlem
    sonrası tazeleme sürerken bakılmaz: iki liste o an zaten farklı yaşta.
  */
  const bekleyen = useBekleyenIsler()
  const aksiyonSayisi = groups.action.length
  useEffect(() => {
    if (sessions.data == null || tazeleniyor || bekleyen.sahip == null) return
    if (aksiyonSayisi !== bekleyen.dersEylem) bekleyenIsleriTazele()
  }, [aksiyonSayisi, bekleyen.dersEylem, bekleyen.sahip, sessions.data, tazeleniyor])

  // ?ders= kararı: parametreden SONRA gelen ilk yanıtla (gerekçe yukarıda, ?ders= notunda).
  useEffect(() => {
    if (!hedefDers) return
    // Tazeleme düştüyse karar verilmez: dakikalar sonra başka bir tazelemeyle kendiliğinden
    // açılan bir onay sayfası, dokunuşla bağını yitirmiş olurdu.
    if (sessions.error) {
      setHedefDers(null)
      return
    }
    const veri = sessions.data
    if (veri == null || veri === hedefDers.onceki) return
    setHedefDers(null)

    const ayni = (s) => String(s?.sessionId ?? '').toLowerCase() === hedefDers.id
    const aktif = (veri.active ?? []).find(ayni)
    if (aktif) {
      /* Sekme onay sayfasının açılışına BAĞLANMAZ: üst katman açıkken sayfa açılmıyor ama
         kullanıcı kartı bulmalı — kart aksiyon sekmesinin başında. */
      setSekme(dersSekmesi(aktif))
      if (aktif.canApprove) {
        if (!dialog && !bookOpen && !ustKatmanAcik) setDialog({ type: 'approve', session: aktif })
        return
      }
      if (aktif.status === 'Disputed') {
        setBilgi('Bu ders itirazda; karar yönetimde. Sonuç burada görünecek.')
        setYukariKaydir((n) => n + 1)
      }
      return
    }
    // Arama süzgeçsiz birikintide: ilk sayfası (az önce gelen yanıt) her durumu içeriyor.
    const gecmis = rezerveGecmis.items.find(ayni)
    setSekme(gecmis ? dersSekmesi(gecmis) : 'rezerve')
    const cumle =
      gecmis?.status === 'Completed'
        ? 'Bu ders tamamlandı ve onaylandı; senden beklenen bir şey kalmadı.'
        : gecmis?.status === 'Cancelled'
          ? 'Bu ders iptal edildi. Kaydı Rezerve geçmişi sekmesinde.'
          : gecmis?.status === 'Expired'
            ? 'Bu dersin süresi doldu. Kaydı Rezerve geçmişi sekmesinde.'
            : activeTruncated
              ? 'Bu ders, listenin gösterilen kısmında değil. Tamamlanan dersleri onayladıkça görünür.'
              : /* "Geçmiş derslerinde bulabilirsin" artık YANLIŞ olurdu: Geçmiş dersler
                   yalnızca tamamlananlar. Kaydın her durumda durduğu yer Rezerve geçmişi. */
                'Bu ders artık aktif değil (onaylandı, iptal edildi ya da süresi doldu). ' +
                'Rezerve geçmişi sekmesinde bulabilirsin.'
    setBilgi(cumle)
    setYukariKaydir((n) => n + 1)
    // dialog/bookOpen/birikinti yalnızca karar anında okunuyor; değişimleri kararı
    // yeniden tetiklememeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.data, sessions.error, hedefDers])

  /*
    İŞLEM SONRASI TAZELEME — SESSİZ.

    Eskiden sessions.reload() spinner'lı yüklemeydi: loading true olunca liste boşalıyor,
    kartların yerine "Yükleniyor…" geliyor ve yarım saniye sonra kartlar geri dönüyordu.
    Kaydırma konumu da o arada 0'a düşüyordu. Artık elde veri varken liste yerinde kalıyor;
    değişen kartlar yanıtla güncelleniyor.

    SEKME DEĞİŞMEZ (rezervasyon dışında): sonuç cümlesi kartın nereye gittiğini söylüyor
    ("Planlanmış sekmesinden takip edebilirsin"). Kullanıcıyı işlem yaptığı sekmeden atmak,
    sıradaki işini (aynı sekmedeki öteki kart) elinden alırdı.

    YUKARI KAYDIRMA BİLİNÇLİ: sonuç cümlesi (Notice) listenin başında. Kullanıcı derin
    kaydırmışken işlem yapınca cümle görünmüyordu, sayfa sessizce "bir şey olmadı" gibi
    duruyordu. Kalıcı çözüm ekranın altında duran bir bildirim (Toast); gelene kadar
    konum tepeye dönüyor.

    veriDegisti: false — işlem ders listesini değiştirmiyor (şikayet dersin akışına
    dokunmaz). Listeyi yeniden çekmek boşuna bir istek olurdu.

    dersId: işlem o dersin bekleyen işini KAPATTI (onay, itiraz, iptal, tamamlama) — bildirim
    merkezinde duran "Dersin onay bekliyor" / "Dersin yaklaşıyor" artık yanlış bir iş vaat
    ediyor ve kaldırılıyor. Sunucu da sonraki hatırlatmaları durum kontrolüyle eliyor.

    Veri değiştiyse ders sürümü artar: çekmecedeki Derslerim sayacı bu işlemi görsün.
  */
  function refresh(message, { veriDegisti = true, dersId = null } = {}) {
    setDialog(null)
    setBookOpen(false)
    setOnSecim(null)
    setBilgi(null)
    if (message) setNotice(message)
    setYukariKaydir((n) => n + 1)
    if (veriDegisti) {
      setTazeleniyor(true)
      sessions.reload({ silent: true })
      kendiSurumum.current = dersSurumu() + 1
      dersDegisti()
    }
    if (dersId) sunulanlariKapat({ grup: 'ders', kayitId: dersId })
    matches.reload({ silent: true })
    // Onay puan basar; seviye rozeti aynı cüzdan ucundan besleniyor.
    refreshWallet()
  }

  /* ── SEKME İÇERİKLERİ ──────────────────────────────────────────────────── */
  /*
    Her sekme FlatList'e SATIR dizisi veriyor: ders kartı, rezervasyon satırı, grup başlığı
    ya da tek satırlık metin. Satır dizisi veriden türüyor, yükleme bayrağından DEĞİL:
    yükleme sırasında boş dizi vermek içerik kısaldığı için onEndReached'i tetikliyordu ve o
    sayfa isteği tazeleme dönünce çöpe gidiyordu. Boş, yükleniyor ve hata hâlleri
    ListEmptyComponent'te; ortak üst blok (sonuç bildirimi, bildirimden gelinen dersin
    durumu, ders listesinin hatası ve kesme uyarısı) her sekmenin başlığında.
  */
  const aktifeBagli = sekme === null || AKTIFE_BAGLI.has(sekme)
  const aktifYukleniyor = sessions.data == null && !sessions.error

  const satirlar = useMemo(() => {
    const kart = (on, s, past = false) => ({ tur: 'ders', anahtar: `${on}-${s.sessionId}`, s, past })
    const baslik = (anahtar, metin, sayi, ton) => ({ tur: 'baslik', anahtar, metin, sayi, ton })
    const r = []
    if (sekme === 'aksiyon' && sessions.data) {
      if (groups.action.length === 0 && groups.itirazda.length > 0) {
        r.push({ tur: 'metin', anahtar: 'aksiyon-yok', metin: 'Şu an senden beklenen bir iş yok.' })
      }
      groups.action.forEach((s) => r.push(kart('a', s)))
      // İtirazdakiler ayrı başlıkta ve SAYACA GİRMEZ; yine de bu sekmede: itiraz buradan
      // açılıyor (onay sayfası → İtiraz et) ve sonuç cümlesi "bu sekmedeki İtirazda" diyor.
      if (groups.itirazda.length > 0) {
        r.push(baslik('b-itiraz', 'İtirazda, karar yönetimde', groups.itirazda.length))
        groups.itirazda.forEach((s) => r.push(kart('i', s)))
      }
    } else if (sekme === 'planlanmis' && sessions.data) {
      // Saati geçmiş ama açık dersler ÜSTTE, amber başlıkla: "bu ders oldu mu, ne oldu?"
      // sorusu ilk bakışta görünsün. Durum rozeti hâlâ "Rezerve" diyor.
      if (groups.gecmisAcik.length > 0) {
        r.push(baslik('b-acik', 'Saati geçti, hâlâ açık', groups.gecmisAcik.length, 'amber'))
        groups.gecmisAcik.forEach((s) => r.push(kart('p', s)))
      }
      if (groups.upcoming.length > 0) {
        r.push(baslik('b-yaklasan', 'Yaklaşan', groups.upcoming.length))
        groups.upcoming.forEach((s) => r.push(kart('p', s)))
      }
    } else if (sekme === 'gecmis') {
      if (tamamlananlar.items.length > 0) {
        // Sayı yalnızca sunucu süzdüyse: eski sunucuda toplam iptal / süresi dolmuşları da sayar.
        r.push(baslik('b-tamam', 'Tamamlanan dersler', tamamlananlar.toplam ?? undefined))
        tamamlananlar.items.forEach((s) => r.push(kart('g', s, true)))
      }
    } else if (sekme === 'rezerve' && sessions.data) {
      if (rezerveListe.length > 0) {
        r.push(baslik('b-rezerve', 'Tüm rezervasyonlar', rezerveToplam))
        rezerveListe.forEach((s) => r.push({ tur: 'rezervasyon', anahtar: `r-${s.sessionId}`, s }))
      }
    }
    return r
  }, [sekme, sessions.data, groups, tamamlananlar.items, tamamlananlar.toplam, rezerveListe, rezerveToplam])

  const satirCiz = useCallback(
    ({ item }) => {
      if (item.tur === 'baslik') {
        return (
          <AltBaslik tone={item.ton} sayi={item.sayi}>
            {item.metin}
          </AltBaslik>
        )
      }
      if (item.tur === 'metin') return <Text className="text-sm text-slate-600">{item.metin}</Text>
      if (item.tur === 'rezervasyon') return <RezervasyonSatiri session={item.s} />
      return <SessionKarti session={item.s} onAction={setDialog} kilitli={tazeleniyor} past={item.past} />
    },
    [tazeleniyor],
  )

  const rezerveEt = () => setBookOpen(true)

  let sekmeUstu = null
  let bos = null
  let alt = null
  let sonaGelince

  if (sekme === null) {
    bos = aktifYukleniyor ? <Loading /> : null
  } else if (sekme === 'aksiyon') {
    const planliVar = groups.upcoming.length + groups.gecmisAcik.length > 0
    bos = aktifYukleniyor ? (
      <Loading />
    ) : sessions.data ? (
      <EmptyState
        title="Şu an senden beklenen bir iş yok"
        description="Kanıt yüklemen ya da onay vermen gereken dersler burada görünür."
        action={
          planliVar ? (
            <Button variant="secondary" onPress={() => setSekme('planlanmis')}>
              Planlanmış derslere bak
            </Button>
          ) : null
        }
      />
    ) : null
  } else if (sekme === 'planlanmis') {
    /* Bildirim kartı — yaklaşan ders varken, sonuç bildiriminin ALTINDA: rezervasyonun
       doğrulama kodu (notice) örtülmez, not alınabilir. Modal değil, çünkü rezervasyon zaten
       bir alt sayfadan dönüyor ve kod tam o an okunmalı. Eğitmen de (dersi o planlamadı)
       burada görür: "ders yaklaşıyor" en çok onun işine yarıyor. Görünürlük sağlayıcıda. */
    sekmeUstu = groups.upcoming.length > 0 ? <BildirimIzniKarti kimlik="rezervasyon" /> : null
    bos = aktifYukleniyor ? (
      <Loading />
    ) : sessions.data ? (
      <EmptyState
        title="Planlanmış dersin yok"
        description="Bir arkadaşınla ders saati belirleyerek başla."
        action={<Button onPress={rezerveEt}>Ders rezerve et</Button>}
      />
    ) : null
  } else if (sekme === 'gecmis') {
    bos = tamamlananlar.ilkHata ? (
      <ErrorBox error={tamamlananlar.ilkHata} onRetry={tamamlananlar.ilkYenidenDene} />
    ) : !tamamlananlar.hazir || (tamamlananlar.dahaVar && !tamamlananlar.hata && !tamamlananlar.durdu) ? (
      /* Görünür kart yok ama sayfa var: kendiliğinden devam sürüyor (eski sunucu). */
      <Loading />
    ) : tamamlananlar.dahaVar ? null : (
      <EmptyState
        title="Henüz tamamlanan dersin yok"
        description="Onaylanan dersler burada birikir. İptal edilen ya da süresi dolan dersler Rezerve geçmişi sekmesinde."
      />
    )
    alt = (
      <SayfaAltBilgisi
        sayfalar={tamamlananlar}
        dugme="Daha eski dersleri yükle"
        spinner={tamamlananlar.items.length > 0}
      />
    )
    sonaGelince = tamamlananlar.sonaGelince
  } else if (sekme === 'puan') {
    sekmeUstu = <PuanPaneli defter={defter} toplamPuan={toplamPuan} />
  } else if (sekme === 'rezerve') {
    sekmeUstu = (
      <Text className="text-sm text-slate-600">
        Rezerve ettiğin ve sana rezerve edilen bütün dersler, sonucuyla birlikte.
      </Text>
    )
    bos = aktifYukleniyor ? (
      <Loading />
    ) : sessions.data ? (
      <EmptyState
        title="Henüz rezervasyon yok"
        description="Rezerve ettiğin ya da sana rezerve edilen her ders, sonucu ne olursa olsun burada listelenir."
        action={<Button onPress={rezerveEt}>Ders rezerve et</Button>}
      />
    ) : null
    alt = (
      <SayfaAltBilgisi
        sayfalar={rezerveGecmis}
        dugme={`Daha eski rezervasyonlar (${rezerveListe.length}/${rezerveToplam})`}
        spinner
      />
    )
    sonaGelince = rezerveGecmis.sonaGelince
  }

  /* Başlık boşsa HİÇ verilmez: boş kap bile liste dolgusuna kendi aralığını (gap) ekleyip
     ilk kartı sekme çubuğundan 32dp aşağı itiyordu (önizlemede ölçüldü). */
  const kesmeGoster = aktifeBagli && sekme !== null && activeTruncated
  const baslikDolu =
    !!notice || !!bilgi || (aktifeBagli && !!sessions.error) || kesmeGoster || sekmeUstu != null
  const baslikBolumu = baslikDolu ? (
    <View className="gap-3 pb-1">
      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      {bilgi && (
        <Notice tone="info" onDismiss={() => setBilgi(null)}>
          {bilgi}
        </Notice>
      )}

      {/* Ders listesinin hatası yalnızca ona dayanan sekmelerde. Gelmiş listenin tazelemesi
          düşerse eski liste hata kutusunun altında kalır (useAsync veriyi tutuyor). */}
      {aktifeBagli && <ErrorBox error={sessions.error} onRetry={sessions.reload} />}

      {/* Kesme SESSİZ olmaz: kullanıcı listenin tamamını görmediğini bilmeli. */}
      {kesmeGoster && (
        <Notice tone="warning">
          {sessions.data.activeTotal} aktif dersinden ilk {sessions.data.active.length}{' '}
          tanesi gösteriliyor. Listeyi kısaltmak için tamamlanan dersleri onayla.
        </Notice>
      )}

      {sekmeUstu}
    </View>
  ) : null

  /*
    KISA LİSTE DEVAMI — liste ekranı doldurmuyorsa ve sayfa kalmışsa sonraki sayfa, kaydırma
    beklenmeden istenir. onEndReached bunu TEK BAŞINA yapamıyor (önizlemede ölçüldü): veri
    büyüdüğü anda VirtualizedList'in hücre penceresi eski uzunlukta kalıyor
    (_constrainToItemCount → last = min(yeni sayı − 1, eski last)), içerik boyu değişince
    yapılan kontrol "son hücre çizildi mi" koşuluna takılıyor ve pencere sonradan
    güncellenince kontrol bir daha yapılmıyor. Ekrandan kısa listede kaydırma da olmadığı
    için sonraki sayfa HİÇ istenmiyordu.

    Nerede ısırıyordu: Geçmiş dersler süzgeci tanımayan sunucuya çarptığında ilk sayfadan
    1-4 kart çıkarsa liste o kartlarda kalıyor, "Daha eski dersleri yükle" düğmesi de
    çıkmıyordu (düğme yalnızca art arda boş sayfa sınırında). Aynı şey ekranı doldurmayan
    her birikintide (büyük ekran, az kayıt) olabilirdi.

    Ölçüt onEndReached'inkiyle aynı (SONA_ESIK), liste tepedeyken: içerik görünür alanı
    eşik payından fazla aşmıyorsa sona gelinmiş sayılır. sonaGelince boş sayfa sınırına
    uyuyor ve dahaGetir uçuş kilitli, yani çifte tetik zararsız. Kart ekleyen her sayfa
    içeriği uzattığı için zincir ekran dolunca kendiliğinden durur.
  */
  function kisaListeyseDevamEt() {
    const { icerik, gorunur } = listeOlcusu.current
    if (!sonaGelince || gorunur <= 0 || icerik <= 0) return
    if (icerik - gorunur <= gorunur * SONA_ESIK) sonaGelince()
  }

  const hapSekmeleri = SEKMELER.map((t) =>
    t.anahtar === 'aksiyon' && aksiyonSayisi > 0
      ? { ...t, sayac: aksiyonSayisi, erisimAdi: `${t.etiket}, ${aksiyonSayisi} ders` }
      : t,
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <GeriDugmesi onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text className="flex-1 text-lg font-bold text-slate-900">Derslerim</Text>
        {/* İkincil: başlıkta her an duran dolgulu düğme, listedeki acil onayla ("Kanıtı incele
            ve onayla") göz için yarışıyordu. Rezervasyon artık çoğunlukla arkadaş kartından,
            bağlamıyla geliyor; buradaki düğme genel giriş. */}
        <Button variant="secondary" onPress={rezerveEt}>
          + Rezerve et
        </Button>
      </View>

      {/* Sekme çubuğu SABİT, listeyle kaymaz. Eski açıklama cümlesi ("Ders almak ücretsizdir…")
          Puan geçmişi sekmesinin girişine taşındı: şerit + cümle + çubuk üst üste dikeyde
          ~130dp yiyordu ve cümle puanı anlatıyor, puanın defteri o sekmede. */}
      <HapSekmeCubugu
        sekmeler={hapSekmeleri}
        secili={sekme}
        onSec={setSekme}
        accessibilityLabel="Derslerim bölümleri"
      />

      {/* extraData: hücreler data değişmeden yeniden çizilmez, kilit yalnızca bir state. */}
      <FlatList
        key={sekme ?? 'yok'}
        ref={listeRef}
        data={satirlar}
        extraData={tazeleniyor}
        keyExtractor={(satir) => satir.anahtar}
        renderItem={satirCiz}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={baslikBolumu}
        ListEmptyComponent={bos}
        ListFooterComponent={alt}
        onEndReached={sonaGelince}
        onEndReachedThreshold={SONA_ESIK}
        onLayout={(e) => {
          listeOlcusu.current.gorunur = e.nativeEvent.layout.height
          kisaListeyseDevamEt()
        }}
        onContentSizeChange={(_genislik, yukseklik) => {
          listeOlcusu.current.icerik = yukseklik
          kisaListeyseDevamEt()
        }}
      />

      {bookOpen && (
        <BookModal
          matches={matches.data?.active ?? []}
          baslangicMatchId={onSecim}
          /* Sayfa artık ekran kurulurken de açılıyor (?rezerve=) ve myMatches o an henüz dönmemiş
             olabiliyor. Yükleme ve hata ayrı söylenmezse boş liste "Henüz arkadaşın yok" diye
             okunurdu: arkadaşı olan kullanıcıya yanlış teşhis. */
          yukleniyor={matches.data == null && !matches.error}
          hata={matches.data == null ? matches.error : null}
          onYenidenDene={() => matches.reload()}
          onClose={() => {
            setBookOpen(false)
            setOnSecim(null)
          }}
          onBooked={(code, mintAmount) => {
            refresh(
              `Ders rezerve edildi (eğitmen ${mintAmount} puan kazanacak). ` +
                `Doğrulama kodun: ${code} — ders ekran görüntüsünde görünmeli.`,
            )
            // Yeni ders Planlanmış'ta: kullanıcı az önce kurduğu dersi ve kodu orada görsün.
            setSekme('planlanmis')
          }}
        />
      )}

      {dialog?.type === 'complete' && (
        <CompleteModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() =>
            refresh(
              'Kanıt yüklendi. Ders karşı tarafın onayına gönderildi; ' +
                'Planlanmış sekmesinden takip edebilirsin.',
              { dersId: dialog.session.sessionId },
            )
          }
        />
      )}

      {dialog?.type === 'approve' && (
        <ApproveModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onApproved={(credits, session) => {
            /* Puan anlatana yazılıyor; cümle alıcıyı adıyla söylüyor ("+N" ya da "kazandın"
               dili yok). Gönüllü derste sunucu 0 basar: "0 puan yazıldı" bir kayıp gibi
               okunacağı için sayı hiç yazılmaz. */
            const onay =
              credits > 0
                ? `Ders onaylandı. ${session.otherDisplayName} kişisine ${credits} puan yazıldı.`
                : 'Ders onaylandı.'
            refresh(onay, { dersId: session.sessionId })
            // Değerlendirme onayın hemen ardından: yorum ancak tamamlanmış dersin
            // çıktısı olabilir ve bu an tam olarak o an.
            setDialog({ type: 'review', session, onay })
          }}
          onReport={() => setDialog({ type: 'report', session: dialog.session })}
          onDispute={() => setDialog({ type: 'dispute', session: dialog.session })}
        />
      )}

      {dialog?.type === 'dispute' && (
        <DisputeModal
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() =>
            refresh(
              'İtirazın yönetime iletildi. Karar verilene kadar puan yazılmayacak; ' +
                'sonucu bu sekmedeki İtirazda bölümünden takip edebilirsin.',
              { dersId: dialog.session.sessionId },
            )
          }
        />
      )}

      {dialog?.type === 'review' && (
        <ReviewModal
          open
          session={dialog.session}
          /* ONAY ANI KORUNUYOR. Onay cümlesi Notice'e yazılıyordu ama bildirim %85 yükseklikteki
             bu sayfanın ARKASINDA kalıyordu; Gönder'den sonra "Değerlendirmen kaydedildi" onu
             eziyordu. Onay veren öğrenci döngünün kapandığını hiçbir anda görmüyordu. Cümle
             artık sayfanın başında ve gönderimde silinmiyor, değerlendirme teşekkürü ARDINA
             ekleniyor. "Şimdi değil" (onClose) Notice'e dokunmuyor, onay cümlesi yerinde kalıyor.
             veriDegisti: false — değerlendirme ders listesini değiştirmiyor; onay zaten listeyi
             tazeledi. */
          onay={dialog.onay}
          onClose={() => setDialog(null)}
          onSubmitted={() =>
            refresh(`${dialog.onay ?? ''} Değerlendirmen kaydedildi, teşekkürler!`.trim(), {
              veriDegisti: false,
            })
          }
        />
      )}

      {dialog?.type === 'report' && (
        <ReportModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          /* Şikayet dersin akışını değiştirmiyor (ReportModal metni de bunu söylüyor): liste
             yeniden çekilmez. */
          onDone={() =>
            refresh('Şikayetin yönetime iletildi. Karşı tarafa bildirilmez.', { veriDegisti: false })
          }
        />
      )}

      {dialog?.type === 'cancel' && (
        <CancelModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() =>
            refresh('Ders iptal edildi. Kaydı Rezerve geçmişi sekmesinde duruyor.', {
              dersId: dialog.session.sessionId,
            })
          }
        />
      )}
    </SafeAreaView>
  )
}

/**
 * Birikerek yüklenen sekmenin liste altı: yükleme göstergesi, sayfa hatası ve — art arda
 * boş sayfa sınırında kendiliğinden devam durduysa — elle devam düğmesi
 * (useGecmisSayfalari → durdu). Düğme yalnızca o durumda: olağan akışta sayfalar
 * onEndReached ile geliyor.
 */
function SayfaAltBilgisi({ sayfalar, dugme, spinner }) {
  return (
    <View className="gap-3">
      {spinner && sayfalar.yukleniyor && (
        <View className="py-2">
          <Spinner />
        </View>
      )}
      <ErrorBox error={sayfalar.hata} onRetry={sayfalar.dahaGetir} />
      {sayfalar.durdu && (
        <View className="items-center">
          <Button variant="secondary" onPress={sayfalar.devamEt}>
            {dugme}
          </Button>
        </View>
      )}
    </View>
  )
}

/** Gruplama başlığı — etiket + sayaç + devam çizgisi (web AltBaslik). */
function AltBaslik({ children, sayi, tone = 'slate' }) {
  const amber = tone === 'amber'
  return (
    <View className="flex-row items-center gap-2.5 pt-1">
      <UstEtiket
        className={`shrink-0 text-xs font-semibold tracking-wider ${
          amber ? 'text-amber-700' : 'text-slate-600'
        }`}
      >
        {children}
      </UstEtiket>
      {sayi !== undefined && <Badge tone={amber ? 'warning' : 'neutral'}>{String(sayi)}</Badge>}
      <View className="h-px flex-1 bg-slate-200" />
    </View>
  )
}

/*
  Takvim yaprağı: ay üstte, gün büyük, saat altta — kartlar dizilince sol kenar bir
  zaman çizelgesi oluşturur (web kararı). Sabit genişlik şart: değişken genişlik metin
  sütununu kartlar arasında kaydırır.
*/
const AY_KISALTMASI = new Intl.DateTimeFormat('tr-TR', { month: 'short' })
const GUN_SAYISI = new Intl.DateTimeFormat('tr-TR', { day: 'numeric' })
const SAAT_DAKIKA = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function TarihBlogu({ utcString, stil }) {
  const tarih = new Date(utcString)
  // Intl.format geçersiz Date'te FIRLATIR — tek bozuk kayıt listeyi düşürmesin.
  const gecerli = !Number.isNaN(tarih.getTime())

  return (
    <View className="w-16 shrink-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white">
      <UstEtiket className={`py-1 text-center text-xs font-semibold tracking-wide ${stil.takvim} ${stil.takvimYazi}`}>
        {gecerli ? AY_KISALTMASI.format(tarih) : '—'}
      </UstEtiket>
      <Text className="pt-2 text-center text-2xl font-bold leading-none text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
        {gecerli ? GUN_SAYISI.format(tarih) : '—'}
      </Text>
      <Text className="px-1 pb-2 pt-1.5 text-center text-xs font-medium text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
        {gecerli ? SAAT_DAKIKA.format(tarih) : '—'}
      </Text>
    </View>
  )
}

function UyariSatiri({ children }) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5">
      <View className="mt-0.5">
        <SaatIkonu renk={amber[800]} boy={16} />
      </View>
      <Text className="flex-1 text-xs leading-relaxed text-amber-800">{children}</Text>
    </View>
  )
}

/*
  DERS KARTI — üç bölgeli sabit iskelet (web kararı): NE ZAMAN (takvim yaprağı) →
  NE/KİMLE (başlık, kişi, meta) → NE YAPMALIYIM (alt aksiyon şeridi). Sıra her kartta
  aynı; düğmeler kartın alt kenarına yapışık.

  kilitli: işlem sonrası tazeleme sürüyor, kartın durumu bayat olabilir (bkz. Dersler →
  TAZELEME KİLİDİ). Düğmeler görünür kalıyor, yalnızca basılamıyor: kaybolup geri gelmeleri
  kartın yüksekliğini oynatır ve kaydırmayı sıçratırdı.
*/
function SessionKarti({ session, onAction, past = false, kilitli = false }) {
  const router = useRouter()
  const startsIn = remainingText(session.scheduledStartUtc)
  const endsIn = remainingText(session.scheduledEndUtc)
  const autoApproveIn = remainingText(session.autoApproveDeadlineUtc)

  // Sunucu bayrağı kaynak-of-truth; bitiş geçtiyse iyimser davranıp butonu açarız
  // (sunucu yine doğrular — kullanıcı "neden hâlâ kapalı?" diye takılmasın).
  const completeReady =
    session.canComplete || (session.iAmTutor && session.status === 'Booked' && !endsIn)

  const showCode = !past && (session.status === 'Booked' || session.status === 'AwaitingApproval')
  const stil = DURUM_STILI[session.status] ?? VARSAYILAN_DURUM_STILI

  return (
    <Card dolgu="p-0" className="overflow-hidden">
      {/* Durum şeridi: kenarlık değil, içeriden çekilmiş yuvarlak uçlu çubuk. Bilgi
          taşımıyor, hızlandırıyor — aynı durum metinli rozette de yazılı. */}
      <View className={`absolute bottom-4 left-0 top-4 w-1 rounded-r-full ${stil.serit}`} />

      <View className="flex-row gap-4 p-5">
        <TarihBlogu utcString={session.scheduledStartUtc} stil={stil} />

        <View className="min-w-0 flex-1 gap-3">
          <View className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <View className="min-w-0 shrink grow basis-40">
              <Text numberOfLines={2} className="text-base font-semibold leading-snug text-slate-900">
                {session.topicName}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm text-slate-600">
                {session.subjectName}
              </Text>
            </View>

            <Badge tone={stil.rozet}>{SESSION_STATUS_LABELS[session.status] ?? session.status}</Badge>
          </View>

          {/* Kişi satırı: yüzü olan bağlantı + rol rozeti (nötr — renk bu kartta yalnız
              dersin durumunu anlatır). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${session.otherDisplayName} profilini aç`}
            onPress={() => router.push(`/profil/${session.otherUserId}`)}
            className="min-h-[44px] flex-row flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-slate-200 pt-3"
          >
            <Avatar userId={session.otherUserId} name={session.otherDisplayName} size="sm" />
            <Text numberOfLines={1} className="min-w-0 shrink grow basis-24 text-sm font-medium text-slate-800">
              {session.otherDisplayName}
            </Text>
            <Badge tone="neutral" className="ml-auto">
              {session.iAmTutor ? 'Anlatıyorum' : 'Alıyorum'}
            </Badge>
          </Pressable>

          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
              {session.durationMinutes} dk
            </Text>
            <Text className="text-slate-300">·</Text>
            <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
              {session.mintAmount} puan
            </Text>
            {startsIn && !past ? (
              <>
                <Text className="text-slate-300">·</Text>
                <Text className={`text-xs font-semibold ${stil.vurgu}`}>{startsIn} sonra</Text>
              </>
            ) : null}
          </View>

          {showCode && (
            <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
              <Text className="text-xs text-slate-600">Doğrulama kodu</Text>
              <Text
                selectable
                className="rounded-md bg-white px-2 py-0.5 font-mono text-sm font-semibold tracking-widest text-slate-900"
              >
                {session.verificationCode}
              </Text>
            </View>
          )}

          {session.iAmTutor && session.status === 'Booked' && endsIn ? (
            <UyariSatiri>
              Time-Lock: "Dersi Tamamladım" <Text className="font-semibold">{endsIn}</Text> sonra
              (planlanan bitişte) açılır.
            </UyariSatiri>
          ) : null}

          {session.canApprove && autoApproveIn ? (
            <UyariSatiri>
              Onaylamazsan <Text className="font-semibold">{autoApproveIn}</Text> sonra otomatik
              onaylanacak ve eğitmene {session.mintAmount} puan yazılacak. İtiraz hakkın da o an
              kapanır.
            </UyariSatiri>
          ) : null}
        </View>
      </View>

      {/* Aksiyon şeridi: her kartta var (en az "Şikayet et") — kart ne kadar uzarsa
          uzasın düğmeler alt kenarda, göz hep aynı noktayı arar. */}
      <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
        {session.iAmTutor && session.status === 'Booked' && (
          <Button disabled={kilitli || !completeReady} onPress={() => onAction({ type: 'complete', session })}>
            Dersi tamamladım
          </Button>
        )}

        {session.canApprove && (
          <Button variant="primary" disabled={kilitli} onPress={() => onAction({ type: 'approve', session })}>
            Kanıtı incele ve onayla
          </Button>
        )}

        {/* Şikayet HER derste açık; savunma düğmesi YOK — şikayet tek yönlüdür. */}
        {!session.canApprove && (
          <Button variant="secondary" disabled={kilitli} onPress={() => onAction({ type: 'report', session })}>
            Şikayet et
          </Button>
        )}

        {session.canCancel && (
          <Button variant="secondary" disabled={kilitli} onPress={() => onAction({ type: 'cancel', session })}>
            İptal
          </Button>
        )}
      </View>
    </Card>
  )
}

/*
  REZERVASYON SATIRI — Rezerve geçmişinin kaydı: eylem değil. Kart BASILMAZ ve düğme
  taşımaz: bir dersin yapılacak işi aksiyon ve planlanmış sekmelerindeki kartta. Aynı
  düğme iki yerde olsaydı çift gönderim yüzeyi olurdu.

  Burada "ne oldu" okunur: solda ders tarihi (aynı takvim yaprağı, durum tonuyla), ortada
  konu, kişi ve rol, süre ve puan; sağda sonuç (durum rozeti, ders kartıyla aynı tonlar).
  Ders kartından kısa, çünkü sekme yüzlerce kaydı tarihe göre taramak için.

  EKRAN OKUYUCU TEK DURAK: satırın bütün bilgisi tek erişim adında (tarih, konu, kişi, rol,
  süre, puan, sonuç). Parça parça okunsaydı her satır yedi durak olurdu.
*/
function RezervasyonSatiri({ session }) {
  const stil = DURUM_STILI[session.status] ?? VARSAYILAN_DURUM_STILI
  const durum = SESSION_STATUS_LABELS[session.status] ?? session.status
  const rol = session.iAmTutor ? 'Anlatıyorum' : 'Alıyorum'
  const tarih = new Date(session.scheduledStartUtc)
  const tarihMetni = Number.isNaN(tarih.getTime()) ? '' : `${formatDateTime(session.scheduledStartUtc)}, `

  return (
    <Card dolgu="p-4">
      <View
        accessible
        accessibilityLabel={
          `${tarihMetni}${session.topicName}, ${session.otherDisplayName}, ${rol}, ` +
          `${session.durationMinutes} dakika, ${session.mintAmount} puan, ${durum}`
        }
        className="flex-row gap-3"
      >
        <TarihBlogu utcString={session.scheduledStartUtc} stil={stil} />

        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text numberOfLines={2} className="min-w-0 shrink text-sm font-semibold leading-snug text-slate-900">
              {session.topicName}
            </Text>
            <Badge tone={stil.rozet}>{durum}</Badge>
          </View>
          <Text numberOfLines={1} className="text-[13px] leading-[18px] text-slate-600">
            {session.otherDisplayName} · {rol}
          </Text>
          <Text className="text-[13px] leading-[18px] text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
            {session.durationMinutes} dk · {session.mintAmount} puan
          </Text>
        </View>
      </View>
    </Card>
  )
}

/* ── REZERVASYON ─────────────────────────────────────────────────────────── */

function BookModal({ matches, baslangicMatchId, yukleniyor, hata, onYenidenDene, onClose, onBooked }) {
  const router = useRouter()
  // Sunucudaki izinli süre kümesiyle birebir (SessionRules.AllowedDurations).
  const DURATION_OPTIONS = [30, 60]
  // GÖSTERİM sabitleri — SessionRules.MintPerBlock/MintBlockMinutes ile birebir;
  // bağlayıcı değer sunucunun mintAmount'u.
  const BLOK_DAKIKA = 30
  const BLOK_PUANI = 50

  const varsayilanBaslangic = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    return d
  }

  const [matchId, setMatchId] = useState(null)
  /*
    iOS'ta başlangıç DOLU başlar: spinner ekranda zaten bir tarih gösteriyor ve
    kullanıcı onu kabul ettiğinde onChange hiç tetiklenmiyor — start null kalınca
    "Rezerve et" görünür değerle çelişerek kapalı kalıyordu. Android'de seçici
    diyalogla açıldığı için boş başlamak doğru: görünür ama seçilmemiş değer yok.
  */
  const [start, setStart] = useState(() => (Platform.OS === 'ios' ? varsayilanBaslangic() : null))
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState(null)
  const [androidAdim, setAndroidAdim] = useState(null) // 'date' | 'time'

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  /*
    Rezervasyonu YAPAN taraf her zaman ÖĞRENCİ: seçilebilir konu, karşı tarafın BANA
    anlatacağı konudur. Her ikisini listelemek, kullanıcının kendi anlatacağı konuya
    öğrenci olarak kaydolmasına yol açardı (ders açılır, puan yanlış tarafa yazılır).
    Tanım TEK YERDE (lib/iliski.js → ogrenciKonusu): Arkadaşlar kartındaki "Ders rezerve et"
    de ona bakıyor. İki ayrı koşulken kart düğmeyi çiziyor, bu liste o arkadaşı göstermiyordu.
  */
  const options = matches.map((match) => ({
    match,
    ...(ogrenciKonusu(match) ?? { topicId: null, topicName: null }),
  }))

  const selected = options.find((o) => o.match.matchId === matchId) ?? null
  const bookable = options.filter((o) => o.topicId)

  /*
    ÖN SEÇİM — kullanıcı zaten seçtiyse dokunulmaz. Adresten gelen arkadaş listede varsa o
    seçilir; yoksa (arkadaşlık bu arada bitti ya da o derste anlatan benim) hiçbir şey
    seçilmez, kullanıcı listeden seçer. Adres yoksa ve tek seçenek varsa o: tek radyoya
    dokunmayı istemek bir adım fazlaydı.
    Bağımlılık listenin UZUNLUĞU: dizi her render'da yeniden kuruluyor, kendisine bağlanmak
    efekti her render'da koştururdu. Sayfa yükleme sürerken açıldıysa liste 0'dan n'e çıkınca
    efekt yeniden koşuyor.
  */
  useEffect(() => {
    if (matchId) return
    if (baslangicMatchId) {
      if (bookable.some((o) => o.match.matchId === baslangicMatchId)) setMatchId(baslangicMatchId)
      return
    }
    if (bookable.length === 1) setMatchId(bookable[0].match.matchId)
  }, [bookable.length, baslangicMatchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const puanOnizleme = (Number(duration) / BLOK_DAKIKA) * BLOK_PUANI

  async function submit() {
    if (gonderimKilidi.current || !selected || !start) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      const result = await api.bookSession({
        matchId,
        topicId: selected.topicId,
        // Seçici yerel saat verir; backend UTC bekler (toISOString hep "...Z" üretir).
        scheduledStartUtc: start.toISOString(),
        durationMinutes: Number(duration),
      })
      onBooked(result.verificationCode, result.mintAmount)
    } catch (err) {
      setError(err)
    } finally {
      // Kilit YALNIZCA burada açılır: hata dalında da — yoksa düzeltip yeniden denenemez.
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ders rezerve et"
      footer={
        yukleniyor || hata || matches.length === 0 || bookable.length === 0 ? null : (
          <>
            <Button variant="secondary" onPress={onClose}>
              Vazgeç
            </Button>
            <Button loading={gonderiliyor} disabled={gonderiliyor || !selected || !start} onPress={submit}>
              Rezerve et
            </Button>
          </>
        )
      }
    >
      {yukleniyor ? (
        <Loading />
      ) : hata ? (
        <ErrorBox error={hata} onRetry={onYenidenDene} />
      ) : matches.length === 0 ? (
        <EmptyState
          title="Henüz arkadaşın yok"
          description="Önce Keşfet'ten istek gönder ve karşı tarafın kabul etmesini bekle."
          action={<KesfeteGit onClose={onClose} router={router} />}
        />
      ) : bookable.length === 0 ? (
        /* İKİ AYRI SEBEP, İKİ AYRI CÜMLE. Eski tek metin ("ders anlatan taraf sensin") yalnızca
           konusu olan arkadaşlıkta doğruydu; arkadaşlıklarının hepsi konusuz (üniversite ağı,
           Arkadaş Ekle) olan kullanıcıya, olmayan bir derste anlatıcı olduğunu söylüyordu.
           İkisinde de çıkış Keşfet: sayfa eylemsiz bir çıkmazdı. */
        matches.every((m) => !m.requestedTopicId) ? (
          <EmptyState
            title="Arkadaşlıklarında ders konusu yok"
            description="Sohbet için eklenen arkadaşlıklar ders içermez. Ders almak için Keşfet'ten bir konu seçip istek gönder."
            action={<KesfeteGit onClose={onClose} router={router} />}
          />
        ) : (
          <EmptyState
            title="Bu arkadaşlıklarda anlatan taraf sensin"
            description="Rezervasyonu dersi alan taraf yapar. Sen de ders almak istersen Keşfet'ten istek gönder."
            action={<KesfeteGit onClose={onClose} router={router} />}
          />
        )
      ) : (
        <View className="gap-4 pb-2">
          <View>
            <Text className="mb-1 text-sm font-medium text-slate-700">Arkadaş ve konu</Text>
            <Text className="mb-2 text-xs text-slate-600">
              Dersi alan taraf sensin; listelenen konu karşı tarafın sana anlatacağı konudur.
            </Text>
            <View className="gap-2">
              {bookable.map((option) => {
                const secili = option.match.matchId === matchId
                return (
                  <Pressable
                    key={option.match.matchId}
                    accessibilityRole="radio"
                    // accessibilityState DEĞİL aria-checked: RN Web 0.21 accessibilityState'i DOM'a
                    // yazmıyor (EslesmeIstegiModali'nde ölçüldü). Ön seçim artık kendiliğinden
                    // geliyor ve seçili olduğunu ekran okuyucu da duymalı; aria-* iki platformda okunur.
                    aria-checked={secili}
                    onPress={() => setMatchId(option.match.matchId)}
                    className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                                ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text className={`text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
                      {option.match.otherDisplayName} anlatacak — {option.topicName}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-slate-700">Tarih ve saat</Text>
            <Text className="mb-2 text-xs text-slate-600">Kendi saat diliminde seç; sistem UTC'ye çevirir.</Text>

            {Platform.OS === 'ios' ? (
              /* iOS: yerleşik takvim+saat tek bileşende, satır içi. */
              <DateTimePicker
                value={start ?? varsayilanBaslangic()}
                mode="datetime"
                display="spinner"
                minuteInterval={5}
                locale="tr-TR"
                onChange={(event, date) => date && setStart(date)}
              />
            ) : (
              /* Android: sistem diyalogları iki adımda (tarih → saat) açılır. */
              <>
                <Button variant="secondary" onPress={() => setAndroidAdim('date')}>
                  {start ? formatDateTime(start.toISOString()) : 'Tarih ve saat seç'}
                </Button>
                {androidAdim && (
                  <DateTimePicker
                    value={start ?? varsayilanBaslangic()}
                    mode={androidAdim}
                    is24Hour
                    minuteInterval={5}
                    onChange={(event, date) => {
                      if (event.type === 'dismissed' || !date) {
                        setAndroidAdim(null)
                        return
                      }
                      if (androidAdim === 'date') {
                        setStart((prev) => {
                          const kaynak = prev ?? varsayilanBaslangic()
                          const yeni = new Date(date)
                          yeni.setHours(kaynak.getHours(), kaynak.getMinutes(), 0, 0)
                          return yeni
                        })
                        setAndroidAdim('time')
                      } else {
                        setStart((prev) => {
                          const yeni = new Date(prev ?? date)
                          yeni.setHours(date.getHours(), date.getMinutes(), 0, 0)
                          return yeni
                        })
                        setAndroidAdim(null)
                      }
                    }}
                  />
                )}
              </>
            )}
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium text-slate-700">Süre</Text>
            <View className="flex-row gap-2">
              {DURATION_OPTIONS.map((dk) => {
                const aktif = Number(duration) === dk
                return (
                  <Pressable
                    key={dk}
                    accessibilityRole="radio"
                    aria-checked={aktif}
                    onPress={() => setDuration(dk)}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border
                                ${aktif ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text className={`text-sm font-medium ${aktif ? 'text-brand-800' : 'text-slate-600'}`}>
                      {dk} dakika
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* ÖZET ŞERİDİ — kararın tamamı tek bakışta. Sayı açıkça "eğitmenin kazanacağı
              puan" diye etiketli: etiketsiz sayı ücret gibi okunur (web kararı). */}
          <View className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <UstEtiket className="text-xs font-semibold tracking-wide text-brand-700">Özet</UstEtiket>
            <View className="mt-2 gap-1.5">
              <OzetSatiri ad="Konu" deger={selected?.topicName ?? 'Arkadaş seçilmedi'} soluk={!selected} />
              <OzetSatiri ad="Anlatan" deger={selected?.match.otherDisplayName ?? '—'} soluk={!selected} />
              <OzetSatiri
                ad="Tarih ve saat"
                deger={start ? formatDateTime(start.toISOString()) : 'Henüz seçilmedi'}
                soluk={!start}
              />
              <OzetSatiri ad="Süre" deger={`${Number(duration)} dakika`} />
            </View>
            <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-brand-100 pt-3">
              <Text className="text-sm font-medium text-brand-800">Eğitmenin kazanacağı puan</Text>
              <Text className="text-base font-semibold text-brand-800" style={{ fontVariant: ['tabular-nums'] }}>
                +{puanOnizleme} puan
              </Text>
            </View>
            <Text className="mt-1.5 text-xs text-brand-700">
              Sana ücretsiz — puanı sen ödemezsin, ders onaylandığında sistem basar.
            </Text>
          </View>

          <ErrorBox error={error} />
        </View>
      )}
    </Modal>
  )
}

/** Rezervasyon çıkmazlarının ortak çıkışı. Sayfa önce kapanır: RN Modal ekranların üstünde
    ayrı bir katmanda duruyor, açık kalsaydı Keşfet onun ALTINDA açılır ve görünmezdi. */
function KesfeteGit({ onClose, router }) {
  return (
    <Button
      onPress={() => {
        onClose()
        router.push('/kesfet')
      }}
    >
      Keşfet'e git
    </Button>
  )
}

function OzetSatiri({ ad, deger, soluk = false }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="shrink-0 text-sm text-brand-700">{ad}</Text>
      {/* Boş değer ("Arkadaş seçilmedi") dolu değerden ağırlık ve bir ton farkıyla ayrışıyor,
          saydamlıkla değil: brand-700/70 brand-50 zeminde 3.14:1'di; brand-700 5.56:1. */}
      <Text className={`shrink text-right text-sm ${soluk ? 'text-brand-700' : 'font-medium text-brand-800'}`}>
        {deger}
      </Text>
    </View>
  )
}

/* ── TAMAMLAMA (kanıt yükleme — iş kuralı 5) ─────────────────────────────── */

function CompleteModal({ session, onClose, onDone }) {
  const [code, setCode] = useState('')
  const [foto, setFoto] = useState(null) // { uri, name, type }
  const [fotoHazirlaniyor, setFotoHazirlaniyor] = useState(false)
  const [error, setError] = useState(null)

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  /*
    SEÇİLEN GÖRSEL DOĞRUDAN GÖNDERİLEMEZ — iki ayrı sebep, ikisi de yalnızca iOS'ta
    ortaya çıkıyor. Android'de seçici JPEG verdiği için ikisi de bugüne kadar hiç
    görünmedi.

    1. HEIC SUNUCUDA REDDEDİLİR. CompleteSession.cs yalnızca png/jpeg/webp kabul ediyor
       ("Yalnızca PNG/JPEG/WebP kabul edilir."). iPhone'un varsayılan kamera biçimi
       HEIC ve expo-image-picker onu DÖNÜŞTÜRMÜYOR: quality < 1 olsa bile ImageUtils
       .swift HEIC/TIFF/AVIF dallarında ham baytı olduğu gibi döndürüyor, yalnızca JPEG
       dalı yeniden kodluyor. Yani galeriden seçilen her kamera fotoğrafı image/heic
       olarak gidip reddedilirdi — ders tamamlama iOS'ta hiç çalışmazdı.

    2. EXIF CİHAZDAN ÇIKAR. Aynı ham-bayt yolu GPS EXIF'ini de koruyor. Sunucu bunu
       depolamadan önce temizliyor (CompleteSession.cs → _temizleyici.TryTemizle), yani
       kalıcı sızıntı yok; ama konumun ağa hiç çıkmaması daha iyi. Beyan yükünü de
       kaldırıyor: aksi hâlde app.json'daki privacy manifest'e sekizinci tür olarak
       NSPrivacyCollectedDataTypePreciseLocation eklemek gerekirdi.

    Çözüm avatar yolundaki desenin aynısı (profil.jsx → fotografDegistir): manipulator
    yeniden kodluyor, çıktı HER ZAMAN JPEG ve metadata düşüyor.

    ⚠️ GENİŞLİK KOŞULLU. resize({ width }) tek değer verildiğinde oranı koruyor ama
    küçük görseli BÜYÜTÜR de — ekran görüntüsü zaten 1920'nin altındaysa büyütmek
    dosyayı şişirir, ayrıntı katmaz. Bu yüzden yalnızca daha genişse ölçekleniyor.
    Yükseklik verilmiyor: kare zorlamak kanıtı kırpardı.
  */
  async function fotoSec() {
    setError(null)
    const secim = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    if (secim.canceled) return

    const a = secim.assets[0]
    setFotoHazirlaniyor(true)
    try {
      const islem = ImageManipulator.manipulate(a.uri)
      if (a.width > 1920) islem.resize({ width: 1920 })
      const islenmis = await islem.renderAsync()
      const jpeg = await islenmis.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
      setFoto({ uri: jpeg.uri, name: 'kanit.jpg', type: 'image/jpeg' })
    } catch {
      /* Dönüştürme başarısızsa HAM DOSYAYA DÜŞÜLMÜYOR: iOS'ta o dosya büyük
         olasılıkla HEIC'tir ve sunucu reddeder — kullanıcı anlamsız bir hata alırdı. */
      setError(new Error('Görsel hazırlanamadı. Başka bir görsel seçmeyi dene.'))
    } finally {
      setFotoHazirlaniyor(false)
    }
  }

  async function submit() {
    /* Kanıt bir DOSYA taşıyor: yavaş bağlantıda istek saniyeler sürer ve çift gönderim
       aynı derse iki AYNI görsel yükler — ikincisi isDuplicateHash uyarısı doğurup
       kullanıcının kendi kanıtını şüpheli gösterirdi. Ref kilidi bu yüzden. */
    if (gonderimKilidi.current || !foto || !code.trim()) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.completeSession(session.sessionId, code.trim(), foto)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Dersi tamamladım"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button loading={gonderiliyor} disabled={gonderiliyor || !foto || !code.trim()} onPress={submit}>
            Gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="info">
          Ekran görüntüsünde sistem saati, katılımcı listesi ve doğrulama kodu{' '}
          <Text className="font-mono font-semibold">{session.verificationCode}</Text> görünmelidir.
          Öğrenci onayladığında {session.mintAmount} puan kazanırsın.
        </Notice>

        <Field label="Doğrulama kodu (Session ID)">
          <Girdi
            value={code}
            onChangeText={setCode}
            maxLength={12}
            autoCapitalize="characters"
            autoCorrect={false}
            /* Placeholder kodun KENDİSİ değil: kod hemen üstteki Notice'te yazıyor. Placeholder
               slate-500'e koyulaştıktan sonra hazır kod, girdiye çoktan yazılmış bir değer gibi
               görünüp kullanıcıyı boş alanla "Gönder"e bastırabilirdi. */
            placeholder="Kodu buraya yaz"
            className="font-mono uppercase tracking-wider"
          />
        </Field>

        <Field label="Kanıt ekran görüntüsü" hint="Seçtiğin görsel JPEG’e çevrilip yüklenir.">
          {foto ? (
            <View className="gap-2">
              <Image
                source={{ uri: foto.uri }}
                accessibilityLabel="Seçilen kanıt görseli"
                className="h-48 w-full rounded-lg border border-slate-200 bg-slate-100"
                resizeMode="contain"
              />
              <Button variant="secondary" loading={fotoHazirlaniyor} onPress={fotoSec}>
                Başka görsel seç
              </Button>
            </View>
          ) : (
            <Button variant="secondary" loading={fotoHazirlaniyor} onPress={fotoSec}>
              Galeriden görsel seç
            </Button>
          )}
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── ONAY (kanıt inceleme) ───────────────────────────────────────────────── */

function ApproveModal({ session, onClose, onApproved, onReport, onDispute }) {
  const proofs = useAsync(() => api.sessionProofs(session.sessionId), [session.sessionId])
  const [imageFailed, setImageFailed] = useState(false)

  const [error, setError] = useState(null)

  /* Onay dosyanın en pahalı geri alınamaz işlemi: puan basar. Kilit modalın KENDİ
     state'i (modal session id ile key'li) — global bayrak başka dersin butonunu da
     kilitlerdi. */
  const [onaylaniyor, setOnaylaniyor] = useState(false)
  const onayKilidi = useRef(false)

  const latestProof = proofs.data?.[proofs.data.length - 1] ?? null
  /*
    Kanıt görseli BAŞLIKLI İSTEKLE indiriliyor: RN Image, source'a verilen Authorization
    başlığını göndermiyor ve istek 401 alıyordu (ölçüm: YetkiliGorsel). Eski hâlinde
    kanıt hiçbir zaman görünmeyecekti — onay ekranındaki tek dayanak o görsel.
  */
  const kanitKaynagi = latestProof
    ? api.proofImageSource(session.sessionId, latestProof.proofId)
    : null
  const { uri: kanitUri, hata: kanitHatasi } = useYetkiliGorsel(kanitKaynagi)

  async function approve() {
    if (onayKilidi.current) return
    onayKilidi.current = true
    setOnaylaniyor(true)
    setError(null)
    try {
      const result = await api.approveSession(session.sessionId)
      onApproved(result.creditsMinted, session)
    } catch (err) {
      setError(err)
    } finally {
      onayKilidi.current = false
      setOnaylaniyor(false)
    }
  }

  return (
    <Modal
      open
      /*
        Onay uçarken modal HİÇBİR yoldan kapanmaz: düğmeler zaten kilitli ama karartma,
        ✕ ve Android geri tuşu (onRequestClose) da aynı onClose'a bağlı — açık kalsalar
        kilit delinir, onay arka planda biterken kullanıcı kapattığı modalın ardından
        beklenmedik bir değerlendirme ekranıyla karşılaşırdı.
      */
      onClose={onaylaniyor ? () => {} : onClose}
      title="Kanıtı incele ve onayla"
      footer={
        <>
          {/* Onay uçarken diğer düğmeler de kapalı: basım sürerken şikayete geçmek,
              hangi sonucun geçerli olduğunu tıklama sırasına bırakırdı. */}
          {/*
            DÜĞMELER DERSİN KADERİNİ BELİRLEYENLER: onayla ya da itiraz et. Şikayet
            gövdeye, sönük bir bağlantıya indi — çünkü şikayet dersi ETKİLEMİYOR, kişi
            hakkında bir bildirim. Üçünü eşit ağırlıkta düğme yapmak hem mobilde sığmıyor
            hem de "hangisi dersi durdurur" sorusunu belirsiz bırakıyordu.
          */}
          <Button variant="secondary" disabled={onaylaniyor} onPress={onClose}>
            Sonra
          </Button>
          <Button variant="danger" disabled={onaylaniyor} onPress={onDispute}>
            İtiraz et
          </Button>
          <Button variant="primary" loading={onaylaniyor} disabled={onaylaniyor} onPress={approve}>
            Onayla
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="info">
          {/* "aktarılır" DEĞİL "yazılır": puan bu anda üretiliyor, senden bir şey
              alınmıyor (web kararı — transfer dili bedel izlenimi veriyordu). */}
          Onayladığında {session.otherDisplayName} kişisine {session.mintAmount} puan yazılır ve
          işlem geri alınamaz. Senden bir şey düşmez. Görselde{' '}
          <Text className="font-mono font-semibold">{session.verificationCode}</Text> kodunun,
          sistem saatinin ve katılımcı listesinin göründüğünü doğrula.
        </Notice>

        {proofs.loading ? (
          <Loading label="Kanıt yükleniyor…" />
        ) : proofs.error ? (
          <ErrorBox error={proofs.error} onRetry={proofs.reload} />
        ) : !latestProof ? (
          <View className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm text-amber-900">
              Bu derse hiç kanıt yüklenmemiş. Ders gerçekten yapılmadıysa onaylama — dilersen
              şikayet et, yönetim inceler.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {latestProof.isDuplicateHash && (
              <View className="flex-row items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <View className="mt-0.5">
                  <UyariIkonu renk={rose[800]} boy={18} />
                </View>
                <Text className="flex-1 text-sm text-rose-800">
                  Bu görsel <Text className="font-semibold">başka bir derste de kullanılmış</Text>.
                  Sahte kanıt olabilir — dikkatle incele.
                </Text>
              </View>
            )}

            {imageFailed || kanitHatasi ? (
              <Text className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                Kanıt görseli yüklenemedi. Bağlantını kontrol edip yeniden dene.
              </Text>
            ) : (
              /* Baytlar axios ile indirilip data URI olarak veriliyor; RN Image'ın
                 kendi başlık taşıma yolu Android'de çalışmıyor (bkz. YetkiliGorsel). */
              <Image
                source={kanitUri ? { uri: kanitUri } : undefined}
                accessibilityLabel="Ders kanıtı ekran görüntüsü"
                onError={() => setImageFailed(true)}
                className="h-80 w-full rounded-lg border border-slate-200 bg-slate-100"
                resizeMode="contain"
              />
            )}

            <Text className="text-xs text-slate-600">
              Yükleme: {formatDateTime(latestProof.uploadedAtUtc)}
            </Text>
          </View>
        )}

        <ErrorBox error={error} />

        {/*
          ŞİKAYET BURADA, DÜĞMELERDE DEĞİL. Dersin akışını değiştirmiyor: kişi hakkında
          yönetime giden bir bildirim. İtirazla aynı ağırlıkta sunmak, hangisinin puan
          basımını durdurduğunu belirsiz bırakıyordu.
        */}
        <View className="items-center border-t border-slate-100 pt-3">
          <Pressable
            accessibilityRole="button"
            disabled={onaylaniyor}
            onPress={onReport}
            className="min-h-[44px] justify-center px-2"
          >
            <Text className="text-sm text-slate-500 underline">
              Ders değil, kişi hakkında şikayetim var
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

/* ── İTİRAZ ──────────────────────────────────────────────────────────────── */

/*
  İTİRAZ — şikayetten AYRI bir mekanizma ve arayüzün bunu net söylemesi gerekiyor.

  Şikayet kişi hakkında; ders akmaya devam eder, puan basılır. İtiraz ise dersin
  KENDİSİNE dair: "yapılmadı" ya da "kanıt sahte". Ders Disputed'a geçer, puan basımı
  DONAR ve konu yönetim hakemliğine düşer. Öğrenci onay yolunu da kapatmış olur.

  Sebep listesi DisputeReason enum'undan (Domain/Moderation/Enums.cs) ve ders şikayeti
  listesiyle aynı beş değeri taşıyor — ama ayrı yazılıyor: iki enum bağımsız ve birinin
  değişmesi diğerinin formunu sessizce bozmamalı (aynı tuzak DERS_SIKAYET_SEBEPLERI'nde
  bir kez yaşandı).
*/
const ITIRAZ_SEBEPLERI = ['SessionNotHeld', 'FakeProof', 'DurationMismatch', 'Abuse', 'Other']

function DisputeModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('SessionNotHeld')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const kilit = useRef(false)

  async function submit() {
    // Çift gönderim: ikincisi sunucudan DISPUTE_ALREADY_OPEN alır ve kullanıcı,
    // itiraz ASLINDA açılmışken hata görürdü.
    if (kilit.current || description.trim().length < 10) return
    kilit.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.disputeSession(session.sessionId, reason, description.trim())
      onDone()
    } catch (err) {
      kilit.current = false
      setError(err)
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={gonderiliyor ? () => {} : onClose}
      title="Bu derse itiraz et"
      footer={
        <>
          <Button variant="secondary" disabled={gonderiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={gonderiliyor}
            disabled={gonderiliyor || description.trim().length < 10}
            onPress={submit}
          >
            İtirazı gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="danger">
          İtiraz, dersi yönetim hakemliğine taşır: {session.otherDisplayName} kişisine puan
          YAZILMAZ ve karar verilene kadar donar. Bu dersi artık onaylayamazsın. Yalnızca
          ders gerçekten yapılmadıysa ya da kanıt bu derse ait değilse itiraz et.
        </Notice>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {ITIRAZ_SEBEPLERI.map((value) => {
              const secili = reason === value
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setReason(value)}
                  className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                              ${secili ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm ${secili ? 'font-medium text-rose-800' : 'text-slate-700'}`}>
                    {REPORT_REASON_LABELS[value]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Ne oldu?" hint="En az 10 karakter. Hakem yalnızca bunu ve kanıtı görecek.">
          <Girdi
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            className="h-28"
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── ŞİKAYET ─────────────────────────────────────────────────────────────── */

/*
  DERS ŞİKAYETİNİN SEBEP ALT KÜMESİ.

  Eskiden bu liste REPORT_REASON_LABELS tablosunun tamamını döküyordu. Tablo o gün
  yalnızca ders sebeplerinden ibaret olduğu için sorun görünmüyordu; forum şikayetleri
  eklenince (Spam, Telif, Kişisel bilgi, Konu dışı) ders formunda bağlamsız seçenekler
  belirecekti. Alt küme artık BURADA yazılı: tabloya sebep eklemek bir daha bu formu
  sessizce değiştirmiyor.

  Sıra bilinçli: en sık şikayet edilen ilk sırada, "Diğer" en sonda.
*/
const DERS_SIKAYET_SEBEPLERI = ['SessionNotHeld', 'FakeProof', 'DurationMismatch', 'Abuse', 'Other']

function ReportModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('SessionNotHeld')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  async function submit() {
    // Çift gönderim yönetime AYNI şikayetten iki kayıt düşürürdü.
    if (gonderimKilidi.current || description.trim().length < 15) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.reportSession(session.sessionId, reason, description.trim())
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Şikayet et"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={gonderiliyor}
            disabled={gonderiliyor || description.trim().length < 15}
            onPress={submit}
          >
            Şikayeti gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        {/* "Yönetim gerekli görürse uyarı, askı ya da ban uygular" cümlesi bilinçli
            olarak YOK: yaptırımın uygulanıp uygulanmayacağı moderatörün kararıdır,
            şikayet edene verilebilecek bir söz değil. Metin yalnızca KESİN olanı söyler. */}
        <Notice tone="info">
          Şikayetin yalnızca yönetime gider. Karşı taraf ne şikayeti görür, ne bildirim alır, ne
          de yanıt verebilir. Dersin akışı değişmez — bu bir itiraz değil, kişi hakkında
          bildirimdir. Şikayetin yönetim tarafından incelenir.
        </Notice>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {DERS_SIKAYET_SEBEPLERI.map((value) => {
              const secili = reason === value
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setReason(value)}
                  className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                              ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
                    {REPORT_REASON_LABELS[value]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Ne oldu?" hint="En az 15 karakter. Yönetim yalnızca senin anlattığını görecek.">
          <Girdi
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            className="h-28"
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── İPTAL ───────────────────────────────────────────────────────────────── */

function CancelModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  const [iptalEdiliyor, setIptalEdiliyor] = useState(false)
  const iptalKilidi = useRef(false)

  async function submit() {
    // İkinci çağrı sunucudan hata döner ve kullanıcı, iptal ASLINDA başarılıyken
    // kırmızı bir hata kutusu görürdü.
    if (iptalKilidi.current) return
    iptalKilidi.current = true
    setIptalEdiliyor(true)
    setError(null)
    try {
      await api.cancelSession(session.sessionId, reason.trim() || null)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      iptalKilidi.current = false
      setIptalEdiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Dersi iptal et"
      footer={
        <>
          <Button variant="secondary" disabled={iptalEdiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={iptalEdiliyor} disabled={iptalEdiliyor} onPress={submit}>
            Dersi iptal et
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Text className="text-sm text-slate-600">
          {formatDateTime(session.scheduledStartUtc)} tarihli ders iptal edilecek. Ders almak
          ücretsiz olduğu için iade edilecek bir puan yok; eğitmene de puan yazılmaz.
        </Text>

        <Field label="Sebep (opsiyonel)">
          <Girdi value={reason} onChangeText={setReason} maxLength={500} />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── PUAN GEÇMİŞİ (eski Cüzdan defteri) ──────────────────────────────────── */

const HISTORY_PAGE_SIZE = 20

/**
 * Puan defteri — durum Dersler'de tutulur (web usePuanDefteri'nin portu).
 *
 * Eskiden listenin altında katlanır bir bölümdü ve kendi state'ini taşıyordu; artık kendi
 * sekmesi var ve sekme başına ayrı liste kuruluyor. State bileşende kalsaydı her sekme
 * değişiminde yüklenen sayfalar silinir, dönüşte baştan istenirdi.
 *
 * "Daha eski hareketler" EKLEYEREK çalışıyor: çift tetik aynı sayfayı iki kez ekler ve her
 * satır defterde çift görünürdü — uçuş kilidi ref'te, render beklemez.
 */
function usePuanDefteri() {
  const [durum, setDurum] = useState({ satirlar: [], toplam: 0, sayfa: 0, yukleniyor: false, hata: null })
  const ucuyor = useRef(false)
  const nesil = useRef(0)

  const yukle = useCallback(async (hedef) => {
    if (ucuyor.current) return
    ucuyor.current = true
    const bu = nesil.current
    setDurum((d) => ({ ...d, yukleniyor: true, hata: null }))
    try {
      const sonuc = await api.statement(hedef, HISTORY_PAGE_SIZE)
      if (bu !== nesil.current) return
      setDurum((d) => ({
        satirlar: hedef === 1 ? sonuc.items : [...d.satirlar, ...sonuc.items],
        toplam: sonuc.totalCount,
        sayfa: hedef,
        yukleniyor: false,
        hata: null,
      }))
    } catch (err) {
      if (bu === nesil.current) setDurum((d) => ({ ...d, yukleniyor: false, hata: err }))
    } finally {
      if (bu === nesil.current) ucuyor.current = false
    }
  }, [])

  /* Baştan yükler ama eldeki satırları yanıt gelene kadar SİLMEZ (1. sayfa gelince yerine
     geçer): sekme açıkken defter "Yükleniyor…"a dönüp kaydırmayı kaybetmesin. Uçuştaki
     "daha eski" eski nesle kalır ve atılır. */
  const yenile = useCallback(() => {
    nesil.current += 1
    ucuyor.current = false
    yukle(1)
  }, [yukle])

  return { ...durum, yukle, yenile }
}

function PuanPaneli({ defter, toplamPuan }) {
  const { satirlar, toplam, sayfa, yukleniyor, hata, yukle } = defter

  return (
    <View className="gap-3">
      {/* Derslerim'in eski açıklama cümlesi: puanın nereden geldiğini anlatıyor, bu yüzden
          her sekmenin üstünde değil puan defterinin başında (web'le aynı). */}
      <Text className="text-sm text-slate-600">
        Ders almak ücretsizdir. Ders onaylandığında anlatan tarafa puan yazılır; her hareketin
        hangi dersten geldiği burada.
      </Text>

      {/* Cüzdan bağlamından, ek istek yok (profildeki puan ve seviye rozetiyle aynı sayı). */}
      {Number.isInteger(toplamPuan) && (
        <Text className="text-sm text-slate-700">
          Toplam puanın:{' '}
          <Text className="font-semibold text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
            {toplamPuan}
          </Text>
        </Text>
      )}

      <ErrorBox error={hata} onRetry={() => yukle(sayfa + 1)} />

      {sayfa === 0 ? (
        hata ? null : (
          <Loading />
        )
      ) : satirlar.length === 0 ? (
        <Card>
          <Text className="text-sm text-slate-600">
            Henüz puan hareketin yok. Bir ders anlatıp onaylandığında ilk kaydın burada belirir.
          </Text>
        </Card>
      ) : (
        /* TEK kart, ince ayraçlar: defter tek bir belgedir, kart koleksiyonu değil. Satırlar
           hafif ve FlatList öğelerine bölünemez (kart dili tek kutu), bu yüzden defter liste
           başlığında duruyor ve "daha eski" düğmeyle birikiyor, onEndReached'le değil. */
        <Card dolgu="p-0" className="overflow-hidden">
          {satirlar.map((row, i) => (
            <HareketSatiri key={`${row.createdAtUtc}-${i}`} row={row} ilk={i === 0} />
          ))}

          {satirlar.length < toplam && (
            <View className="items-center border-t border-slate-200 px-5 py-3.5">
              <Button variant="secondary" loading={yukleniyor} onPress={() => yukle(sayfa + 1)}>
                Daha eski hareketler ({satirlar.length}/{toplam})
              </Button>
            </View>
          )}
        </Card>
      )}
    </View>
  )
}

function HareketSatiri({ row, ilk }) {
  const kazanc = row.amount > 0

  return (
    <View className={`flex-row items-center justify-between gap-3 px-5 py-3 ${ilk ? '' : 'border-t border-slate-100'}`}>
      <View className="min-w-0 shrink">
        <Text numberOfLines={1} className="text-sm font-medium text-slate-900">
          {TRANSACTION_LABELS[row.type] ?? row.type}
        </Text>
        <Text numberOfLines={1} className="text-xs text-slate-600">
          {row.topicName
            ? `${row.topicName}${row.counterpartDisplayName ? ` · ${row.counterpartDisplayName}` : ''}`
            : formatDateTime(row.createdAtUtc)}
        </Text>
      </View>

      <View className="shrink-0 items-end">
        <Text
          className={`text-sm font-semibold ${kazanc ? 'text-brand-700' : 'text-slate-600'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {signedCredit(row.amount)}
        </Text>
        <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
          {formatDateTime(row.createdAtUtc)}
        </Text>
      </View>
    </View>
  )
}

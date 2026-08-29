import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { brand } from '../src/lib/theme'
import { useAuth } from '../src/state/AuthContext'
import { ArtanIkonu, KepIkonu, KisilerIkonu, KitapIkonu } from '../src/components/Ikonlar'
import { MetinSayfasi } from '../src/components/MetinSayfasi'
import { Button, Card } from '../src/components/ui'

/*
  HAKKIMIZDA — web'deki pages/Hakkimizda.jsx'in portu.

  YAPI KORUNDU: üç değer kartı (Misyon / Vizyon / Topluluk) + tek geniş "Nasıl işliyor"
  kartı + kapanış cümlesi. Üçüncü kart doldurma değil — bu ürünün taşıyıcı fikri
  akranlık ve o fikrin misyon/vizyon ikilisinde yeri yok; ikisi de "biz ne yapıyoruz"
  derken topluluk "bunu kim yapıyor" diyor.

  WEB'DEN SAPMALAR:

  • ZEMİN PORT EDİLMEDİ. Web'in son hâli SayfaZemini'nin `zengin` yoğunluğunu (mesh
    havuzlar + ızgara dokusu) kullanıyor ve kartlar bu yüzden CAM (bg-white/80). RN'de
    ne mesh gradyan ne de kartın altından zemini okutan bir yığın var; expo-linear-gradient
    tek yönlü geçiş verir ve web'de zaten DENENİP BIRAKILMIŞ olan şey oydu ("yoğun
    duruyor", bittiği yerde sayfayı ikiye bölen sınır). Cam kartın altında gösterecek
    bir doku olmayınca /80 opaklık da anlamını yitiriyor: kartlar ui.jsx'in standart
    beyaz kartı, zemin slate-50. Sayfa kendi yüzey dilini icat etmiyor.

  • IZGARA DEĞİL YIĞIN: telefonda üç sütun yok; kartlar alt alta.

  • HOVER YOK (kartların kalkması, ikon kutusunun dolması). Dokunmatikte hover diye bir
    durum yok ve bu kartlar TIKLANMIYOR — active: vermek de yanlış olurdu: basıldığında
    tepki veren ama hiçbir yere götürmeyen kutu, kırık bağlantı gibi okunur.

  • ÇAĞRI DÜĞMESİ OTURUMA GÖRE: web'de sabit "Keşfet'e göz at" bağlantısı vardı çünkü
    sayfa zaten giriş duvarının arkasındaydı. Mobilde bu sayfaya kayıt öncesi de
    geliniyor (giriş ekranı altbilgisi, mağaza bağlantısı) ve oturumsuz kullanıcı
    /kesfet'e basınca guard onu giriş ekranına atardı — düğme bozuk hissettirirdi.
    Oturumsuzken çağrı "Hesap oluştur".

  ⚠️ İKON EKSİĞİ: web'in RoketIkonu (Misyon) ve GozIkonu (Vizyon) çizimlerinin mobil
  karşılığı yok ve ikon eklemek bu dosyanın işi değil — en yakın mevcut çizimler
  kullanıldı (KitapIkonu, KepIkonu). Güvence maddelerinin ikonları (CuzdansizIkonu,
  KanitIkonu) da yok; ÜÇÜNÜ DE ikonsuz bırakmak, birini ikonlu ikisini ikonsuz basmaktan
  iyiydi — üç madde ancak aynı dili konuşurlarsa aynı ailenin üyesi gibi okunuyor.
*/

const DEGERLER = [
  {
    Ikon: KitapIkonu,
    baslik: 'Misyonumuz',
    metin:
      'Bir konuyu gerçekten öğrenmenin en kısa yolu onu birine anlatmaktır. dersmate, ' +
      'öğrencilerin bildiklerini anlatarak öğrendiği, eksiklerini bir akranından ' +
      'kapattığı bir alan açıyor — aradaki mesafeyi, ücreti ve aracıyı kaldırıyoruz.',
  },
  {
    Ikon: KepIkonu,
    baslik: 'Vizyonumuz',
    metin:
      'Hiçbir öğrencinin bir konuyu, sırf sorusunu soracak birini bulamadığı için ' +
      'eksik bırakmadığı bir öğrenme ağı. Bugün YKS müfredatıyla başlıyoruz; hedef, ' +
      'her öğrencinin hem öğrenci hem öğretmen olabildiği bir topluluk.',
  },
  {
    Ikon: KisilerIkonu,
    baslik: 'Topluluğumuz',
    metin:
      'Öğretmen yok, akran var. Anlatan da öğrenen de aynı sıralarda; bu yüzden sorular ' +
      'çekinmeden soruluyor, cevaplar aynı dilden geliyor. Her ders iki kişiyi birden ' +
      'ilerletiyor.',
  },
]

/*
  ─────────────────────────────────────────────────────────────────────────────
  "NASIL İŞLİYOR" MADDELERİ — web'deki kayıt aynen taşınıyor (2026-08-24).

  KALDIRILAN madde: "Ders almak ücretsiz" — "Para transferi yok" ile aynı yeri
  kaplıyordu. İkisi teknik olarak farklı şeyler söylüyor ama okuyan için ayrımı yok.

  ⚠️ ÖNCE BAŞKA BİR METİN İSTENMİŞTİ ve yazılmadı; kaydı burada duruyor ki aynı hataya
  bir daha düşülmesin. İstenen metin "kredi sistemi: ders aldıkça kredi harcarsın"
  diyordu. SİSTEM BUNU YAPMIYOR: CreditLedgerService yalnızca anlatana puan BASIYOR,
  öğrenciden hiçbir şey düşmüyor (tek bacaklı işlem). O cümle ekranda dursaydı kullanıcı
  var olmayan bir mekanizmaya göre karar verirdi: "kredim biterse ders alamam" diye ders
  almaktan çekinmek gibi. Bir güvence şeridinin yapabileceği en kötü şey, güvence diye
  yanlış bilgi vermek.

  YERİNE GELEN "Karşılıklı takas" istenen fikrin GERÇEK karşılığı: eşleştirme motoru,
  senin aradığın konuyu anlatanlar arasından senin anlatabildiğin konuyu arayanları
  listenin başına alıyor (GetMatchSuggestions → IsCrossMatch). Keşfet'te de aynı rozetle
  görünüyor; yani bu sayfa ürünle çelişmiyor, onu anlatıyor.
  ─────────────────────────────────────────────────────────────────────────────
*/
const GUVENCELER = [
  {
    baslik: 'Karşılıklı takas',
    metin:
      'Senin öğrenmek istediğin konuyu anlatan ve senin anlatabildiğin konuyu ' +
      'öğrenmek isteyen kişiler Keşfet’te listenin başında çıkar.',
  },
  {
    baslik: 'Para transferi yok',
    metin: 'Kimse kimseye ödeme yapmaz. Platformda para dolaşmaz.',
  },
  {
    baslik: 'Doğrulanmış dersler',
    metin: 'Her ders kanıtla kapanır; değerlendirmeler yalnızca gerçek derslerden gelir.',
  },
]

const VAATLER = ['Akran öğrenmesi', 'Puanla ilerleme', 'Doğrulanmış dersler']

export default function Hakkimizda() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <MetinSayfasi
      baslik="Hakkımızda"
      ozet={
        'dersmate, öğrencilerin birbirine ders anlattığı bir akran öğrenme platformudur. ' +
        'İyi bildiğin konuyu anlatır, eksik olduğun konuda başka bir öğrenciden ders alırsın.'
      }
      taslak={false}
    >
      {DEGERLER.map(({ Ikon, baslik, metin }) => (
        <Card key={baslik}>
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
            <Ikon boy={20} renk={brand[600]} />
          </View>
          <Text accessibilityRole="header" className="mt-4 text-lg font-semibold text-slate-900">
            {baslik}
          </Text>
          <Text className="mt-2 text-[15px] leading-relaxed text-slate-600">{metin}</Text>
        </Card>
      ))}

      <Card>
        <View className="flex-row items-center gap-2">
          <ArtanIkonu boy={16} renk={brand[600]} />
          <Text className="text-sm font-medium text-slate-600">Nasıl işliyor</Text>
        </View>
        <Text accessibilityRole="header" className="mt-2 text-xl font-bold tracking-tight text-slate-900">
          Anlat, öğren, ilerle
        </Text>

        {/* Vaat şeridi: tarayarak geçen göz için. Detay aşağıdaki üç maddede. */}
        <View className="mt-4 gap-2">
          {VAATLER.map((v) => (
            <View key={v} className="flex-row items-center gap-2">
              {/*
                Web'de OnayIkonu (emerald tik) vardı; mobilde o çizim yok. Tik yerine
                glif kullanılıyor ve ekran okuyucudan GİZLENİYOR: "onay işareti Akran
                öğrenmesi" diye okunması, listeyi anlatmak yerine gürültü olurdu.
              */}
              <Text
                importantForAccessibility="no"
                accessibilityElementsHidden
                className="text-sm text-emerald-600"
              >
                ✓
              </Text>
              <Text className="text-sm text-slate-600">{v}</Text>
            </View>
          ))}
        </View>

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
          {GUVENCELER.map(({ baslik, metin }) => (
            <View key={baslik} className="flex-row gap-3">
              <View className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
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
      <Text className="text-center text-sm italic text-slate-600">
        Bir konuyu anlatabiliyorsan, onu gerçekten öğrenmişsindir.
      </Text>
    </MetinSayfasi>
  )
}

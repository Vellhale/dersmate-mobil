import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { brand, ink } from '../lib/theme'
import { KunyeSatiri } from './Kunye'
import { Logo } from './Logo'

/*
  GİRİŞ / KAYIT ÇERÇEVESİ — web'deki AuthShell'in mobil yorumu: BÖLÜNMÜŞ TEK EKRAN.

  Web'de split soldaydı (marka paneli | form); telefonda eksen dikey döner:
  ÜSTTE marka paneli (brand-600 → brand-700 → slate-900 gradyanı — web aside'ının
  birebir renk yolu; ilk çeyreği düz brand-600, logo yayı için), ALTTA üst köşeleri yuvarlatılmış beyaz form katmanı. Beyaz
  katman gradyanın ÜZERİNE biner (-mt-6): iki panel yan yana iki kutu değil, tek
  parça bir kompozisyon okunur.

  TEK EKRAN, SAYFA KAYDIRMASI YOK — web kararının mobil hâli:
  • Marka paneli sabit yükseklikte değil, İÇERİĞİ KADAR: vaatler kısa tutuldu.
  • Form alanı flex-1 + kendi içinde ScrollView: içerik sığdığı sürece kaydırma
    çubuğu YOK (bounce dahi olsa boşa gitmez), taşarsa — küçük ekran, açık klavye —
    kaydırma FORMUN İÇİNDE olur, kompozisyon bozulmaz. Web'deki "lg altında sert
    overflow-hidden formun altını keserdi" dersi burada da geçerli: kaydırmayı
    tamamen kilitlemek gönder düğmesini erişilmez yapardı.
  • Klavye: iOS'ta padding davranışı, Android'de sistem zaten resize ediyor.

  VAATLER web'deki listenin kısaltılmışı — telefonda üç uzun paragraf formu ekrandan
  taşırır; her vaat tek satıra indi. Uzun anlatım Hakkımızda'nın işi.
*/

const VAATLER = [
  ['🎓', 'Ders almak ücretsiz — puan da harcanmaz'],
  ['⏱️', 'Anlattıkça puan kazan, seviyeni yükselt'],
  ['🛡️', 'Her ders kanıtla kapanır, değerlendirmeler gerçek'],
]

export function AuthKabuk({ title, subtitle, children, altBilgi = true }) {
  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={[brand[600], brand[700], ink]}
        /* locations: gradyanın ilk çeyreği DÜZ brand-600. Logonun bağ yayı zemin renginde
           çiziliyor (Logo.jsx → ZEMIN_MARKA = brand[600]) ve iki dairenin arasında zeminin
           ÜSTÜNDEN geçiyor. Varsayılan duraklarla (0 / 0.5 / 1) logonun altı cihaza göre
           gradyanın %14–19'unda, yani #0072AC–#0070A9 oluyordu: yay zeminden 1.07–1.10:1
           ayrışıp daireler arasında ince bir çizgi olarak görünüyordu. Bu prop'u kaldırma. */
        locations={[0.25, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1.2 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-6 pb-10 pt-4">
            <Logo boyut="lg" zemin="marka" />
            <Text className="mt-4 text-2xl font-bold leading-tight text-white">
              Bildiğini anlat,{'\n'}öğrenmek istediğini ücretsiz al.
            </Text>

            <View className="mt-4 gap-1.5">
              {VAATLER.map(([ikon, metin]) => (
                <View key={metin} className="flex-row items-center gap-2">
                  <Text className="text-sm">{ikon}</Text>
                  <Text className="text-xs leading-relaxed text-brand-100">{metin}</Text>
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Beyaz katman gradyanın üstüne biner: köşe yuvarlaklığı geçişi yumuşatır. */}
      <View className="-mt-6 flex-1 rounded-t-3xl bg-slate-50">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerClassName="flex-grow px-6 pb-8 pt-7"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-2xl font-bold tracking-tight text-slate-900">{title}</Text>
            {subtitle ? <Text className="mt-1.5 text-sm text-slate-600">{subtitle}</Text> : null}

            <View className="mt-5">{children}</View>

            {altBilgi && (
              <Text className="mt-6 text-center text-xs leading-relaxed text-slate-500">
                dersmate'te para transferi yoktur. Ders almak ücretsizdir; ders anlattığında
                puan kazanırsın ve bu puan harcanmaz — birikip seviyeni yükseltir.
              </Text>
            )}

            {/*
              KÜNYE (2026-09-21). Web'de aynı yerde (AuthShell altbilgisi) ve gerekçesi
              aynı: hesabı OLMAYAN biri de bu ürünü kimin işlettiğini görebilmeli — kayıt
              kararı tam burada veriliyor.

              `altBilgi` bayrağına BAĞLANMADI: o not yalnızca kayıt ekranında görünen bir
              ürün açıklaması, künye ise kabuğu kullanan üç ekranda da (giriş, kayıt,
              parola sıfırlama) görünmeli. Kimlik beyanını bir tanıtım cümlesinin
              varlığına bağlamak, onu tanıtımın yan ürünü yapardı.

              mt-auto: içerik kısa olduğunda (parola sıfırlama) künye ekranın ortasında
              asılı kalmasın, dibe insin. contentContainer zaten flex-grow.
            */}
            <KunyeSatiri className="mt-auto pt-8" ortala />

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  )
}

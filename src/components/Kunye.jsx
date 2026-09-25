import { Linking, Text, View } from 'react-native'
import {
  ADRES,
  ILETISIM_EPOSTA,
  ISLETMECI,
  ISLETMECI_ADRESI,
  ISLETMECI_ALAN_ADI,
  MARKA,
  MERSIS,
  TELIF_YILI,
  TESCIL_BILGISI_VAR,
  TICARI_UNVAN,
} from '../lib/kunye'
import { AltBilgiBaglantisi, MetinBaglantisi } from './MetinBaglantisi'

/*
  KÜNYE — web'deki components/Kunye.jsx'in portu.

  İki varyant, web'dekiyle aynı: KunyeSatiri (alt bilginin son kademesi) ve KunyeBlogu
  (yasal metinlerin altındaki kimlik bloğu). Değerler lib/kunye.js'ten; bu dosya
  hiçbir sabiti kendi yazmıyor.

  KunyeSatiri'yi sayfalar DOĞRUDAN çağırmıyor (2026-09-26): AltBilgi bileşeni onu sayfa
  bağlantılarının altına koyuyor ve Profil, giriş/kayıt/parola sıfırlama ve Hakkımızda
  aynı AltBilgi'yi kullanıyor. Künye her yerde aynı görünür, elle şerit yazılmaz.

  ─── WEB'DEN TEK SAPMA: BAĞLANTILAR CÜMLE DIŞINDA ───────────────────────────
  Web'de "Corventech" ve e-posta cümlenin İÇİNDE birer &lt;a&gt;. Mobilde olmaz ve gerekçe
  bu depoda zaten yazılı (MetinSayfasi → MetinBaglantisi): 15px'lik bir kelime 44px
  dokunma hedefi taşıyamaz, hitSlop komşu satırlarla çakışır. Web bu sorunu `lg`
  kırılımına bağlı koşullu bir dolgu ile çözüyordu; mobilde kural KOŞULSUZ.

  Bu yüzden her iki varyantta da cümle işletmeciyi ADIYLA söylüyor (kimlik beyanı
  cümlenin kendisinde duruyor, bağlantıya bağımlı değil) ve adres hemen altında tam boy
  bir satır olarak dokunulabiliyor. Bağlantı hiç açılmasa bile künye eksik kalmıyor —
  metin tek başına "kim işletiyor" sorusunu yanıtlıyor.

  ⚠️ rel="noopener" KARŞILIĞI GEREKMİYOR: web'de dış bağlantı window.opener ile açan
  sekmeyi yönlendirebildiği için o öznitelik şarttı. Burada Linking.openURL sistem
  tarayıcısını ayrı bir uygulamada açıyor; uygulamanın oturumuna erişimi yok.
*/

/**
 * ALT BİLGİ VARYANTI — iki kademe, her zaman ortalı.
 *
 *   A: "© 2026 dersmate · Bir Corventech ürünüdür" — DÜZ METİN. Kimlik beyanı
 *      bağlantıya bağımlı değil (dosya başındaki kural); bağlantı açılmasa da künye tam.
 *   B: "corventech.tr" — AltBilgiBaglantisi, dış bağlantı oku ve "Tarayıcıda açılır"
 *      ipucuyla. Alt bilginin sayfa bağlantılarıyla aynı biçim: eskiden burada
 *      MetinBaglantisi vardı (15px, mavi, altı çizili) ve alt bilginin en büyük, en renkli
 *      öğesi künyenin kendi bağlantısı oluyordu.
 *
 * Boyut px: cihazda rem 14 sayıldığı için text-xs 10.5dp çıkıyor, Apple'ın 11pt alt
 * sınırının altında. 12px slate-500, slate-50 zeminde 4.55:1 (AA).
 *
 * `ortala` prop'u YOK: satır her zaman ortalı.
 */
export function KunyeSatiri({ className = '' }) {
  return (
    <View className={`items-center ${className}`}>
      <Text className="text-center text-[12px] leading-[18px] text-slate-500">
        © {TELIF_YILI} {MARKA} · Bir {ISLETMECI} ürünüdür
      </Text>
      <AltBilgiBaglantisi
        etiket={ISLETMECI_ALAN_ADI}
        dis
        accessibilityLabel={`${ISLETMECI} web sitesi: ${ISLETMECI_ALAN_ADI}`}
        /* .catch: açılamayan adres (tarayıcısı kısıtlanmış cihaz) işlenmemiş bir red
           bırakmasın. Kullanıcıya gösterilecek bir şey yok; adres metinde zaten yazılı. */
        onPress={() => Linking.openURL(ISLETMECI_ADRESI).catch(() => {})}
      />
    </View>
  )
}

/**
 * YASAL METİN BLOĞU — MetinSayfasi'nın altında, her yasal metnin sonunda.
 *
 * Tescil satırları (unvan/adres/MERSIS) KOŞULLU: lib/kunye.js'te üçü de null ve
 * bilerek null. Doldurulduklarında burası kendiliğinden tamamlanır, bu dosyaya
 * dokunmak gerekmez.
 */
export function KunyeBlogu({ className = '' }) {
  return (
    <View className={className}>
      <Text accessibilityRole="header" className="text-sm font-semibold text-slate-800">
        Künye
      </Text>

      {/* KOŞULSUZ: Corventech tescilli bir tüzel kişi de olsa yalnızca marka da olsa
          "tarafından işletilmektedir" ifadesi her iki durumda da doğru. */}
      <Text className="mt-2 text-sm leading-relaxed text-slate-600">
        {MARKA}, {ISLETMECI} tarafından işletilmektedir.
      </Text>
      <MetinBaglantisi
        etiket={ISLETMECI_ALAN_ADI}
        onPress={() => Linking.openURL(ISLETMECI_ADRESI).catch(() => {})}
      />

      {TESCIL_BILGISI_VAR && (
        <View className="mt-3 gap-1.5">
          {TICARI_UNVAN && <KunyeSatir etiket="Ticari unvan" deger={TICARI_UNVAN} />}
          {ADRES && <KunyeSatir etiket="Adres" deger={ADRES} />}
          {MERSIS && <KunyeSatir etiket="MERSIS no" deger={MERSIS} />}
        </View>
      )}

      {/* "KVKK başvuruları" ifadesi bilerek: bu adres m.11 başvuru adresidir, yalnızca
          bir destek kutusu değil. Eski hâli ("Sorular ve talepler için") bunu
          söylemiyordu. */}
      <Text className="mt-3 text-sm leading-relaxed text-slate-600">
        Sorular, talepler ve KVKK başvuruları için:
      </Text>
      <MetinBaglantisi
        etiket={ILETISIM_EPOSTA}
        /* .catch: posta uygulaması olmayan bir iPhone'da mailto REDDEDİLİR. Adres
           hemen üstünde okunuyor; işlenmemiş red yerine sessiz kalmak yeter. */
        onPress={() => Linking.openURL(`mailto:${ILETISIM_EPOSTA}`).catch(() => {})}
      />
    </View>
  )
}

/**
 * Etiket-değer çifti. Web'de &lt;dl&gt;/&lt;dt&gt;/&lt;dd&gt; kullanılıyor (ekran okuyucu ilişkiyi
 * kursun diye); RN'de o semantik yok, karşılığı tek bir erişilebilirlik etiketi.
 */
function KunyeSatir({ etiket, deger }) {
  return (
    <View accessible accessibilityLabel={`${etiket}: ${deger}`} className="flex-row flex-wrap">
      <Text className="shrink-0 text-sm text-slate-500">{etiket}: </Text>
      <Text className="flex-1 text-sm text-slate-700">{deger}</Text>
    </View>
  )
}

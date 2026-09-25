import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { ink } from '../lib/theme'

/*
  Gezinme kabuğunun ikon seti — web'deki components/Ikonlar.jsx'in RN portu.

  ÇİZİMLER BİREBİR AYNI (24'lük ızgara, tek çizgi ağırlığı): tasarım dili iki
  platformda tek kalsın. NEDEN KÜTÜPHANE DEĞİL kararı da aynen taşındı — bir avuç
  ikon için @expo/vector-icons'un koca font ailesini yüklemek yerine web'in kendi
  çizgileri react-native-svg ile çiziliyor.

  RN FARKI: currentColor yok — renk, kullanıldığı yerden `renk` prop'u ile gelir
  (çekmece aktif/pasif rengi parametre olarak veriyor). `kalinlik` web'deki
  strokeWidth; çekmecede aktif satır kalın çizgiyle vurgulanır (web'deki Layout
  kararı).
*/

function Cizgi({ children, renk = ink, boy = 24, kalinlik = 2, dolgu = 'none' }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={boy}
      height={boy}
      fill={dolgu}
      stroke={renk}
      strokeWidth={kalinlik}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  )
}

/**
 * Akış (Ana Sayfa) — ev. Web'de karşılığı YOK: web kabuğu Keşfet'i açılış yapıyordu,
 * mobil ise Instagram düzeninde ayrı bir akış sekmesi taşıyor. Çizim Lucide `home`
 * geometrisi — setin geri kalanıyla aynı ızgara ve ağırlıkta.
 */
export function EvIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22v-8h6v8" />
    </Cizgi>
  )
}

/** Geri — ok değil OK UCU (Lucide `chevron-left`). Yığın ekranlarının başlığındaki GeriDugmesi
    çiziyor; eski "←" metin glifi yazı tipine göre ince ve kayık çiziliyordu. */
export function GeriIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="m15 18-6-6 6-6" />
    </Cizgi>
  )
}

/* Keşfet — pusula değil BÜYÜTEÇ (web'deki 2026-08-24 kararı): sayfanın yaptığı iş
   aramak; büyüteç, ekrandaki arama kutusuyla aynı şeyi söylüyor. */
export function AramaIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </Cizgi>
  )
}

/** İlan oluştur: artı. Orta sekmenin işareti — dolgulu marka dairesi içinde çizilir. */
/** ➕ sekmesi — daire içinde artı, setin geri kalanıyla AYNI çizgi ağırlığında.
    Referans tasarım ortadaki eylemi dolu bir daireyle ayırmıyor; hepsi tek dil. */
export function ArtiDaireIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v8" />
      <Path d="M8 12h8" />
    </Cizgi>
  )
}

export function ArtiIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Cizgi>
  )
}

/** Sohbet: tek balon — birebir konuşma (Topluluk'un iki balonuyla karşıtlık). */
export function MesajIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 1 1 16.1-3.9z" />
    </Cizgi>
  )
}

/** Profil: tek kişi silueti. Web'deki KisilerIkonu'nun (çoklu) tekil hâli —
    Arkadaşlar'ın çok kişili çiziminden ayrışsın. */
export function KisiIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="12" cy="7" r="4" />
      <Path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </Cizgi>
  )
}

export function KitapIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
      <Path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </Cizgi>
  )
}

export function KisilerIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="9" cy="7" r="4" />
      <Path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <Path d="M16 3.1a4 4 0 0 1 0 7.8" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </Cizgi>
  )
}

export function KepIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M22 10 12 5 2 10l10 5z" />
      <Path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </Cizgi>
  )
}

export function CikisIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </Cizgi>
  )
}

export function ToplulukIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M14 9a2 2 0 0 1-2 2H6l-4 3V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
      <Path d="M18 9h2a2 2 0 0 1 2 2v11l-4-3h-6a2 2 0 0 1-2-2v-1" />
    </Cizgi>
  )
}

export function YildizIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </Cizgi>
  )
}

/** Karşılıklı takas: iki zıt yönlü ok — öneri kartındaki "Karşılıklı takas" etiketi. */
export function TakasIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M4 7h16" />
      <Path d="M16 3l4 4-4 4" />
      <Path d="M20 17H4" />
      <Path d="M8 13l-4 4 4 4" />
    </Cizgi>
  )
}

export function SaatIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 6v6l4 2" />
    </Cizgi>
  )
}

export function UyariIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Cizgi>
  )
}

/** Açılır bölüm oku — aşağı chevron; "açık" durumda 180° döndürülür. */
export function OkAsagiIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="m6 9 6 6 6-6" />
    </Cizgi>
  )
}

/** Kazanç/artış: yükselen çizgi + ok — rezervasyon özetindeki puan satırı. */
export function ArtanIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M3 17l6-6 4 4 8-8" />
      <Path d="M14 7h7v7" />
    </Cizgi>
  )
}

/** Seviye: soldan sağa yükselen üç çubuk. */
export function GrafikIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M5 21v-6" />
      <Path d="M12 21V11" />
      <Path d="M19 21V5" />
    </Cizgi>
  )
}

/** Yönetim rozeti: kalkan. Resmi hesabı ayırt eden işaret. */
export function KalkanIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Cizgi>
  )
}

/**
 * Oy oku — YUKARI çizilir, aşağı oy 180° döndürülerek gösterilir.
 *
 * OkAsagiIkonu'ndan (saf chevron) AYRI ve sebebi kavramsal: chevron bir AÇILIR
 * BÖLÜMÜN durumunu söyler, bu ise bir EYLEM. Gövdeli ok basılabilir bir düğme gibi
 * okunur; çıplak chevron oy düğmesinde "aşağı kaydır" gibi durur.
 */
export function OyOkuIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M12 19V5" />
      <Path d="m5 12 7-7 7 7" />
    </Cizgi>
  )
}

/** Şikayet: bayrak. UyariIkonu bilerek kullanılmaz — o SİSTEMİN kullanıcıya verdiği
    uyarı, bayrak ise kullanıcının sisteme verdiği işaret. İkisi aynı ekranda yan yana
    görünür ve aynı çizimle gösterilseler hangisinin basılabilir olduğu anlaşılmazdı. */
export function BayrakIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Path d="M4 22v-7" />
    </Cizgi>
  )
}

/** Tartışmalı: alev. ArtanIkonu "en çok oy alan"ı anlatır; tartışmalı olan ise ÇOK
    oy alan değil, ZIT oy alan — yükseliş çizgisi bunu yanlış söylerdi. */
export function AlevIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Cizgi>
  )
}

export function BilgiIkonu(props) {
  return (
    <Cizgi {...props}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </Cizgi>
  )
}

/** Bina: üniversite/okul bilgisi. */
export function BinaIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M3 21h18" />
      <Path d="M5 21V7l7-4 7 4v14" />
      <Path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
    </Cizgi>
  )
}

export function TakvimIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 6h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M3 10h18" />
    </Cizgi>
  )
}

/*
  ── SOSYAL HESAP İKONLARI ─────────────────────────────────────────────────────
  Web'deki üçünün birebir portu (Layout.jsx → SOSYAL, çekmecenin alt kümesi).
  Marka ikonlarının RESMÎ logoları kullanılmıyor: setin geri kalanıyla tek dilde
  kalsınlar diye aynı 24'lük ızgarada, tek çizgiyle yeniden çizildiler (web kararı).
*/

/** Instagram: yuvarlatılmış kare + mercek + sağ üstte dolu nokta. */
export function InstagramIkonu(props) {
  /* Nokta DOLGULU çizilmeli; web'de `fill="currentColor"` yapıyordu. RN'de
     currentColor yok, o yüzden çağıranın rengi doğrudan alınıyor. Cizgi
     sarmalayıcısı Svg'ye fill="none" veriyor, çocuk onu ezebiliyor. */
  const dolgu = props.renk ?? ink
  return (
    <Cizgi {...props}>
      <Rect x="2" y="2" width="20" height="20" rx="5" />
      <Circle cx="12" cy="12" r="4" />
      <Circle cx="17.5" cy="6.5" r="0.5" fill={dolgu} />
    </Cizgi>
  )
}

/** TikTok: nota gövdesi + sağ üstten çıkan yay. */
export function TiktokIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M14 3v9.6a3.4 3.4 0 1 1-2.4-3.3" />
      <Path d="M14 3a5.6 5.6 0 0 0 5.6 5.6" />
    </Cizgi>
  )
}

/** X: iki çapraz. */
export function XIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M4 4l16 16" />
      <Path d="M20 4 4 20" />
    </Cizgi>
  )
}

/**
 * Menü (hamburger) — web'deki MenuIkonu'nun portu (Ikonlar.jsx:30-36, üç yatay çizgi).
 * Çekmeceyi açan düğmede kullanılır. Web'de iki ayrı hamburger var (dar ekranda
 * çekmeceyi açan, geniş ekranda rayı daraltan); mobilde tek iş yapar: çekmeceyi açar.
 */
export function MenuIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M4 6h16" />
      <Path d="M4 12h16" />
      <Path d="M4 18h16" />
    </Cizgi>
  )
}

/*
  ── PROFİL, AYARLAR VE ALT BİLGİ İKONLARI (2026-09-26) ─────────────────────────
  Aynı 24'lük ızgara ve çizgi ağırlığı; geometri Lucide'dan (settings, camera,
  chevron-right, pencil, bell, arrow-up-right), kütüphane yine eklenmedi (dosya başındaki
  gerekçe geçerli). AyarlarIkonu ve KameraIkonu web'de de AYNI çizimle var (çizimler birebir
  kuralı); diğer dördü yalnızca mobilde (EvIkonu emsali).
*/

/** Ayarlar: dişli. Profilim başlığında Ayarlar ekranını açan düğme. */
export function AyarlarIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </Cizgi>
  )
}

/** Kamera: profil fotoğrafının köşesindeki "fotoğrafı değiştir" rozeti. */
export function KameraIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <Circle cx="12" cy="13" r="3" />
    </Cizgi>
  )
}

/** Sağ ok ucu (Lucide `chevron-right`): GeriIkonu'nun aynası. Gezinen satırın sonunda
    "buradan başka ekrana geçilir" işareti; katman açan ya da anında iş yapan satırda YOK. */
export function SagOkIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="m9 18 6-6-6-6" />
    </Cizgi>
  )
}

/** Kalem: düzenleme ("Profili düzenle"). */
export function KalemIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <Path d="m15 5 4 4" />
    </Cizgi>
  )
}

/** Zil: bildirimler ("Bildirim ayarları"). */
export function ZilIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Cizgi>
  )
}

/** Dış bağlantı: sağ üste çapraz ok (Lucide `arrow-up-right`). Uygulamadan çıkıp
    tarayıcıda açılan bağlantının yanında küçük boyutta; ekran okuyucudan gizlenir, anlamı
    bağlantının erişilebilirlik ipucu taşır. */
export function DisBaglantiIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M7 7h10v10" />
      <Path d="M7 17 17 7" />
    </Cizgi>
  )
}

/*
  ── HAKKIMIZDA SAYFASININ İKONLARI ────────────────────────────────────────────
  Web'deki components/Ikonlar.jsx'ten BİREBİR taşındı (path'ler harfi harfine aynı).
  Bu sayfada ikonlar gezinme değil ANLAM taşıyor: her kutucuğun ne anlattığını metni
  okumadan önce söylüyorlar. Web'deki OnayIkonu (daire içinde tik) bilerek TAŞINMADI:
  tek çağıranı olan vaat listesi sayfadan kalkıyor, ölü ikon bırakılmaz.
*/

/** Misyon: fırlatılmış roket (Lucide `rocket`). "Yola çıktık" — duran bir hedef değil. */
export function RoketIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <Path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.9 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <Path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <Path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </Cizgi>
  )
}

/** Vizyon: göz. "Oraya bakıyoruz"; iki hattı 20px'te de net kalıyor (web gerekçesi). */
export function GozIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <Circle cx="12" cy="12" r="3" />
    </Cizgi>
  )
}

/** Güvence: para dolaşmıyor. Banknot + üzeri çizgi (cüzdan silueti 20px'te bulanıklaşıyordu). */
export function CuzdansizIkonu(props) {
  return (
    <Cizgi {...props}>
      <Rect x="2.5" y="6" width="19" height="12" rx="2" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M3 21 21 3" />
    </Cizgi>
  )
}

/** Güvence: her ders kanıtla kapanır. Kalkan içinde tik; KalkanIkonu'ndan (yönetim rozeti)
    tik ile ayrışıyor. */
export function KanitIkonu(props) {
  return (
    <Cizgi {...props}>
      <Path d="M12 3l7 3v5.5c0 4.3-2.9 8.3-7 9.5-4.1-1.2-7-5.2-7-9.5V6z" />
      <Path d="m9 12 2 2 4-4" />
    </Cizgi>
  )
}

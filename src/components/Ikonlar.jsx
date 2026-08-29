import Svg, { Circle, Path } from 'react-native-svg'
import { ink } from '../lib/theme'

/*
  Gezinme kabuğunun ikon seti — web'deki components/Ikonlar.jsx'in RN portu.

  ÇİZİMLER BİREBİR AYNI (24'lük ızgara, tek çizgi ağırlığı): tasarım dili iki
  platformda tek kalsın. NEDEN KÜTÜPHANE DEĞİL kararı da aynen taşındı — bir avuç
  ikon için @expo/vector-icons'un koca font ailesini yüklemek yerine web'in kendi
  çizgileri react-native-svg ile çiziliyor.

  RN FARKI: currentColor yok — renk, kullanıldığı yerden `renk` prop'u ile gelir
  (tab bar zaten aktif/pasif rengi parametre olarak veriyor). `kalinlik` web'deki
  strokeWidth; aktif sekme kalın çizgiyle vurgulanır (web'deki Layout kararı).
*/

function Cizgi({ children, renk = ink, boy = 24, kalinlik = 2 }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={boy}
      height={boy}
      fill="none"
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
    Eşleşmeler'in çok kişili çiziminden ayrışsın. */
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

const { platformSelect } = require('nativewind/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  /*
    'class' stratejisi WEB ÖNİZLEMESİ için: varsayılan 'media'da css-interop, ana
    sayfanın html sınıfını değiştiren her ortamda (önizleme paneli dahil) hata
    fırlatıyor. Uygulama bilinçli olarak tek (açık) temalı — dark: sınıfı hiç
    kullanılmıyor; strateji yalnızca o hatayı susturur, görünümü değiştirmez.
  */
  darkMode: 'class',
  theme: {
    extend: {
      /*
        font-mono DÜZELTMESİ: nativewind preset'i mono'yu Android'de "mono" ailesine
        çeviriyor — Android'de böyle bir aile YOK (doğrusu "monospace") ve bilinmeyen
        aile sessizce Roboto'ya düşüyor; token kutusu düz yazıyla çiziliyordu.
        iOS değeri preset'tekiyle aynı bırakıldı.
      */
      fontFamily: {
        mono: platformSelect({ android: 'monospace', ios: "'Courier New'", default: 'monospace' }),
      },
      /*
        KÖŞE YARIÇAPI — Tailwind varsayılanından BİR BASAMAK yumuşak ve PX ile (kullanıcı kararı,
        2026-09-14: "butonların kenarlarını bir tık yuvarlaklaştıralım, genel tasarımı biraz
        yumuşatalım"). Sınıf adları aynı kaldığı için yumuşatma tek yerden bütün uygulamaya
        yayılıyor: düğme, girdi ve uyarı (lg) 12 · iç kutu (xl) 16 · kart ve alt sayfa (2xl) 20 ·
        AuthKabuk paneli (3xl) 28.

        NEDEN PX: varsayılan değerler rem ve NativeWind cihazda rem'i 14 sayıyor (inlineRem);
        rounded-lg telefonda 7px, web önizlemesinde 8px çiziliyordu. px ile ikisi aynı.
        ⚠️ Yalnızca YARIÇAP px'e geçti: boşluk ve boy sınıfları (p-*, h-*, w-*) hâlâ rem, yani
        cihazda h-11 = 38.5, p-1 = 3.5. 44px dokunma hedefi h-[44px] / min-h-[44px] ile yazılır.

        İÇ İÇE YARIÇAP: dış kutu − iç boşluk = iç kutu. Segment rayı rounded-lg + p-1 (12 − 4)
        içindeki seçili sekme rounded-md (8) bu yüzden; basamaklar bu farkı koruyacak seçildi.
        KÜÇÜK KARELER: 28dp ve altındaki kutuda lg ve üstü daireye döner (bkz. Avatar boyutları).
        Web tailwind.config.js varsayılanda kalıyor — bilinçli fark (CLAUDE.md, "Web'den
        bilinçli sapmalar").
      */
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      /*
        MARKA SKALASI — web projesindeki frontend/tailwind.config.js'ten BİREBİR kopya.

        Tek kaynak web tarafında; buradaki liste onun mobil yansıması. Palet değişirse
        İKİ DOSYA BİRDEN güncellenmeli (web repo'su ayrı olduğu için import edilemiyor).

        Web'deki karar burada da geçerli:
        #0088CC bilerek 500'DE, 600'de değil — üzerine beyaz metin 3.89:1 veriyor ve
        WCAG AA eşiği 4.5:1. Buton zeminleri 600 (#0077B3 → 4.90:1) ve 700'den
        (#006699 → 6.25:1) gelir. 500 kimlik rengidir: logo, odak, büyük işaretler.
      */
      colors: {
        brand: {
          50: '#E6F4FB',
          100: '#CCE9F7',
          200: '#99D3EF',
          300: '#66BDE7',
          400: '#33A7DF',
          500: '#0088CC',
          600: '#0077B3',
          700: '#006699',
          800: '#005580',
          900: '#004466',
        },
      },
    },
  },
  plugins: [],
}

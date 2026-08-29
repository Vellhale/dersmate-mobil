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

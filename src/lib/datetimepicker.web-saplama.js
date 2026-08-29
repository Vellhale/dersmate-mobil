import { useEffect } from 'react'

/*
  WEB SAPLAMASI — @react-native-community/datetimepicker'ın web'de karşılığı yok.
  Yalnızca önizleme build'inde devreye girer (metro.config.js web çözücüsü).

  Davranış: bileşen görünür olur olmaz seçimi "yapılmış" sayar — Android'in iki adımlı
  (tarih → saat) akışı kendiliğinden tamamlanır ve BookModal'daki başlangıç değeri
  dolar. Görsel bir seçici çizmez; önizlemenin amacı akışı gezmek, tarih seçtirmek değil.
*/
export default function DateTimePickerWebSaplama({ value, onChange }) {
  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      onChange?.({ type: 'set' }, value instanceof Date ? value : new Date())
    }, 0)
    return () => clearTimeout(zamanlayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

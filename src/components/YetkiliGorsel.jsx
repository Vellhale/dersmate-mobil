import { useEffect, useState } from 'react'
import { authedImageDataUri } from '../lib/api'

/**
 * Kimlik gerektiren bir görselin URI'sini üretir.
 *
 * NEDEN BİR KANCA GEREKİYOR: RN Image, `source={{uri, headers}}` ile verilen
 * Authorization başlığını Android'de (newArchEnabled) GÖNDERMİYOR. Telefonun kendi
 * istekleri köprü günlüğünde ölçüldü — aynı oturumda, aynı saniyede:
 *
 *     GET /api/users/<id>/profile      → 200  jetonlu     (axios)
 *     GET /api/users/<id>/avatar?v=1   → 401  JETONSUZ    (RN Image)
 *
 * Bu yüzden baytlar önce axios ile indiriliyor (başlığı doğru gönderen tek yol),
 * sonra Image'a hazır veri olarak veriliyor. Web'in blob + object URL çözümünün
 * mobil karşılığı; RN'de object URL olmadığı için data URI kullanılıyor.
 *
 * @param kaynak `api.avatarImageSource` / `api.proofImageSource` çıktısı:
 *   `{ yerel }` az önce yüklenen cihazdaki dosya (istek gerekmez),
 *   `{ yol }`   sunucudaki adres.
 * @returns `{ uri, hata }` — uri null iken çağıran yer tutucusunu gösterir.
 */
export function useYetkiliGorsel(kaynak) {
  const yerel = kaynak?.yerel ?? null
  const yol = kaynak?.yol ?? null

  const [uri, setUri] = useState(yerel)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    // Yerel dosya doğrudan gösterilir: yükleme biter bitmez görünsün diye.
    if (yerel) {
      setUri(yerel)
      setHata(false)
      return undefined
    }

    if (!yol) {
      setUri(null)
      setHata(false)
      return undefined
    }

    /*
      İPTAL BAYRAĞI: liste satırları hızla geri dönüşüme giriyor ve sökülmüş bir
      bileşene setState çağırmak uyarı üretirdi. Ayrıca yol değişince (yeni ?v=)
      eski indirmenin yenisini ezmesini engelliyor.
    */
    let iptal = false
    setHata(false)
    setUri(null)

    authedImageDataUri(yol)
      .then((veri) => {
        if (!iptal) setUri(veri)
      })
      .catch(() => {
        // 404 (fotoğraf yok) burada beklenen durum: çağıran baş harflere düşer.
        if (!iptal) setHata(true)
      })

    return () => {
      iptal = true
    }
  }, [yerel, yol])

  return { uri, hata }
}

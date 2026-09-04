import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Basit veri çekme kancası: { data, error, loading, reload }.
 *
 * reload({ silent: true }) — arka plan tazelemesi: elde veri varken `loading` bayrağı
 * KALDIRILMAZ. Bu şart: sohbet listesi her gelen mesajda tazeleniyor ve `loading`
 * yükseltilseydi tüm ekran spinner'a dönüp yazma kutusunun odağını ve kaydırma
 * konumunu kaybettirirdi.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  /*
    NESİL SAYACI — geç dönen ESKİ yanıt yeniyi ezmesin.

    `cancelled` bayrağı yalnızca useEffect'in temizleyicisi çağrıldığında (bağımlılık
    değişimi / unmount) işe yarıyordu. Elle yapılan reload()'ların döndürdüğü temizleyici
    ise kimse tarafından çağrılmıyor: art arda iki tazelemede ilki geç dönerse İKİNCİNİN
    sonucunu eziyordu. Belirtisi sessiz ve kafa karıştırıcıydı — okunmamış rozeti bir
    eksik kalıyor, liste bir adım geride görünüyordu.

    Nesil, hangi çağrının en son başlatıldığını söylüyor: yalnızca o yazabilir.
  */
  const nesilRef = useRef(0)

  const run = useCallback(
    (options = {}) => {
      const nesil = ++nesilRef.current
      let cancelled = false
      const yazabilir = () => !cancelled && nesil === nesilRef.current

      setState((prev) => ({
        ...prev,
        // Sessiz tazelemede yalnızca ilk yüklemede spinner göster.
        loading: options.silent ? prev.data === null : true,
        error: null,
      }))

      loader()
        .then((data) => {
          if (yazabilir()) setState({ data, error: null, loading: false })
        })
        .catch((error) => {
          if (yazabilir()) setState((prev) => ({ data: prev.data, error, loading: false }))
        })

      return () => {
        cancelled = true
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  )

  useEffect(() => run(), [run])

  return { ...state, reload: run }
}

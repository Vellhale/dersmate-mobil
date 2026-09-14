import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'

/**
 * Ekran yeniden öne geldiğinde `tazele`yi çağırır: hem gezinme odağında hem de uygulama
 * arka plandan döndüğünde.
 *
 * İKİSİ BİRLİKTE, çünkü ikisi ayrı olaylar. Odak yalnızca uygulama İÇİ gezinmede geliyor
 * (Derslerim'den Akış'a dönüş); telefonu cebinden çıkarıp uygulamaya dönen kullanıcı için
 * tetiklenmiyor. Push bildirimi olmadığından o kullanıcıya gelen istek ya da işlem bekleyen
 * ders, başka bir ekrana gidip dönene kadar sayaçta görünmezdi (CLAUDE.md → "Başka ekranda
 * değişen veri ODAKTA tazelenir"; bu kanca ona ön plana gelmeyi ekliyor). Web önizlemesinde
 * AppState, visibilitychange ile çalışıyor.
 *
 * KURULUMUN KENDİ ODAĞI ATLANIYOR: ilk çekimi useAsync zaten yaptı. Atlama "kurulum
 * efekti koştu mu" bayrağıyla YAPILAMIYOR (ArkadaslarBolumu ve Arkadaşlar ekranındaki
 * kalıp): expo-router'ın useFocusEffect'i navigasyonu bir render sonra alıyor
 * (useOptionalNavigation), yani kurulumdaki odak çağrısı kurulum efektlerinden SONRA
 * geliyor ve bayrağı çoktan inmiş buluyor. Önizlemede ölçüldü: Arkadaşlar ekranı açılırken
 * myMatches iki kez, Akış soğuk açılışta mySessions iki kez çağrılıyordu.
 *
 * Bu yüzden karar KURULUM ANINDAKİ odaktan: ekran odakta kurulduysa gelecek ilk odak
 * çağrısı kurulumun kendisidir ve atlanır. "İlk odağı her zaman atla" DEĞİL: ekran odaksız
 * kurulursa (profil yüklenirken kullanıcı başka ekrana geçti) ilk GERÇEK dönüş atlanır ve
 * eski veri kalırdı. O ilk çağrı gelmeden ekran odağını kaybederse de atlama iptal.
 *
 * `tazele` ref'ten okunuyor: çağıran her render'da yeni ok fonksiyonu veriyor ve bağımlılık
 * olsaydı useFocusEffect her render'da yeniden koşup istek yağdırırdı.
 */
export function useOnePlanaGelince(tazele) {
  const ref = useRef(tazele)
  ref.current = tazele

  const navigation = useNavigation()
  const kurulumOdagi = useRef(null)
  if (kurulumOdagi.current === null) kurulumOdagi.current = navigation.isFocused()

  useFocusEffect(
    useCallback(() => {
      if (kurulumOdagi.current) {
        kurulumOdagi.current = false
        return
      }
      ref.current()
    }, []),
  )
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        kurulumOdagi.current = false
      }),
    [navigation],
  )

  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') ref.current()
    })
    return () => abonelik.remove()
  }, [])
}

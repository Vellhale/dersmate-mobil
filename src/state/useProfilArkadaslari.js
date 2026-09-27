import { useEffect, useRef } from 'react'
import { useNavigation } from 'expo-router'
import { api } from '../lib/api'
import { iliskiSurumuAbone } from '../lib/iliskiSurumu'
import { useAsync } from './useAsync'
import { useOnePlanaGelince } from './useOnePlanaGelince'

/**
 * Bir profilin arkadaş verisi (api.userFriends → friendCount, isSelf, friends,
 * mutualCount, mutualFriends) — TEK çekim, İKİ tüketici.
 *
 * NEDEN KANCA (2026-09-26): arkadaş sayısı artık iki yerde çiziliyor. Profil başlığında
 * (fotoğrafın altındaki "Arkadaşlarım · 12" hapı ya da "12 arkadaş · 3 ortak" satırı) ve
 * aşağıdaki Arkadaşlar bölümünde. Eskiden çekimi bölümün kendisi yapıyordu; ikinci bir
 * tüketici kendi çekimini yapsaydı aynı uç iki kez çağrılırdı. ProfilGorunumu kancayı
 * BİR kez çağırıyor ve sonucu ikisine de veriyor. Yan kazanç: çekim profil isteğiyle
 * PARALEL başlıyor (bölüm eskiden ancak profil yüklendikten sonra kuruluyordu).
 *
 * ─── ODAKTA VE ÖNE GELİŞTE SESSİZ TAZELEME ──────────────────────────────────
 * Web bu bölümü rota değişiminde yeniden kuruyor, mobilde ise Profilim ve yığında alta
 * kalan profil ekranları KURULU kalıyor. Arkadaşlar ekranında isteği kabul edip ya da
 * arkadaşlığı sonlandırıp dönen kullanıcı eski sayıyı ve "Henüz arkadaşın yok"u görüyordu;
 * ortak arkadaşı profilinden engelleyip geri dönülen profilde o kişi listede kalıyordu.
 *
 * Her odakta, sürüm sayacı yok (Keşfet'in tersine): değişikliklerin bir kısmı cihazda
 * olmuyor, karşı taraf isteği kabul edince haber her zaman gelmiyor. Bedel odak başına
 * küçük tek bir istek; bölümde biriktirilmiş sayfa ya da kaydırma yok.
 *
 * Kurulumun kendi odağı useOnePlanaGelince'de atlanıyor: ilk çekimi useAsync zaten yaptı.
 * Eski kalıp ("kuruluyor" bayrağı, bölümün içinde) bunu yapamıyordu ve önizlemede açılışta
 * userFriends İKİ kez çağrılıyordu (CLAUDE.md, 2026-09-14 ölçümü); kanca o çift çağrıyı da
 * kapatıyor.
 *
 * ─── İLİŞKİ SÜRÜMÜ ───────────────────────────────────────────────────────────
 * Profil ODAKTAYKEN ilişki değişirse (ön planda "isteğin kabul edildi" bildirimi geldi;
 * sağlayıcı sayacı artırıyor) sayı ve liste anında tazelenir: ekran zaten odakta olduğu
 * için odak tazelemesi gelmezdi. Odakta değilse bir şey yapılmaz; dönüşteki odak
 * tazelemesi zaten gelecek (iki istek olmasın).
 *
 * silent: elde veri varken başlık satırı ve bölüm boşa düşüp sayfa zıplamasın. reload
 * ref'ten okunuyor, bağımlılıktan değil: userId yerinde değişirse useAsync kendi tam
 * yüklemesini yapıyor. Burası ikinci ve SESSİZ bir istek atsaydı eski kişinin listesi
 * yükleme bayrağı olmadan ekranda kalırdı.
 *
 * @returns useAsync sonucu: { data, error, loading, reload }
 */
export function useProfilArkadaslari(userId) {
  const veri = useAsync(() => api.userFriends(userId), [userId])

  const tazele = useRef(veri.reload)
  tazele.current = veri.reload

  useOnePlanaGelince(() => tazele.current({ silent: true }))

  const navigation = useNavigation()
  useEffect(
    () =>
      iliskiSurumuAbone(() => {
        if (navigation.isFocused()) tazele.current({ silent: true })
      }),
    [navigation],
  )

  return veri
}

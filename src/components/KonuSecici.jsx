import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Girdi, Loading, Modal } from './ui'

/*
  ADIM ADIM KONU SEÇİCİ — Sınav → Seviye (TYT/AYT) → Ders → Konu.
  Web'deki components/KonuSecici.jsx'in portu (iş kuralı 3: aranabilir seçici).

  Web kararları aynen:
  • Düz arama yetmedi: hiyerarşi katalogu GEZİLEBİLİR yapar ve mantıksız eşleşmeleri
    yapısal olarak engeller (Matematik seçilmeden Matematik konusu görünmez).
  • Hiyerarşi katalogtan OKUNUR, kopya taşınmaz — müfredat her yıl güncelleniyor.
  • Arama kutusu YALNIZCA son basamakta: üst basamaklarda birkaç seçenek var, tek
    derste ise 40+ konu olabiliyor.
  • Modal her açıldığında seçim SIFIRLANIR: yarı dolu yol, yanlış derse konu ekletir.
  • Geometri ayrı ders — katalogun kendi yapısı, arayüz kararı değil.
*/

/** Katalog satırlarını Sınav → Seviye → Ders → Konu ağacına çevirir. */
function agacKur(satirlar) {
  const agac = new Map()

  for (const satir of satirlar ?? []) {
    // Alan adları CatalogController.TopicRow ile birebir: rootCategory / category /
    // subject / topic. Biri değişirse ağaç sessizce boşalır, o yüzden tek yerde okunuyor.
    const sinav = satir.rootCategory ?? '—'
    const seviye = satir.category ?? '—'
    const ders = satir.subject ?? '—'

    if (!agac.has(sinav)) agac.set(sinav, new Map())
    const seviyeler = agac.get(sinav)

    if (!seviyeler.has(seviye)) seviyeler.set(seviye, new Map())
    const dersler = seviyeler.get(seviye)

    if (!dersler.has(ders)) dersler.set(ders, [])
    dersler.get(ders).push(satir)
  }

  return agac
}

/** Tek seçenek satırı — 44px dokunma hedefi, basışta koyulaşan zemin. */
function Secenek({ children, alt, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-lg border
                 border-slate-200 bg-white px-3.5 py-2.5 active:border-brand-400 active:bg-brand-100"
    >
      <View className="min-w-0 shrink">
        <Text numberOfLines={1} className="text-sm text-slate-800">
          {children}
        </Text>
        {alt ? <Text className="mt-0.5 text-xs text-slate-500">{alt}</Text> : null}
      </View>
      <Text className="shrink-0 text-slate-400">›</Text>
    </Pressable>
  )
}

/*
  Kırıntı yolu aynı zamanda GERİ DÖNÜŞ YOLU: her basamak basılabilir — üç adım sonra
  dersi değiştirmek tek dokunuş.
*/
function Kirinti({ adimlar, onGit }) {
  if (adimlar.length === 0) return null

  return (
    <View className="mb-3 flex-row flex-wrap items-center gap-1">
      {adimlar.map((ad, i) => (
        <View key={`${ad}-${i}`} className="flex-row items-center gap-1">
          {i > 0 && <Text className="text-slate-300">›</Text>}
          <Pressable
            accessibilityRole="button"
            onPress={() => onGit(i)}
            className="min-h-[32px] justify-center rounded px-1.5"
            hitSlop={6}
          >
            <Text className="text-xs font-medium text-brand-700">{ad}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

/**
 * @param onSelect  seçilen katalog satırını döndürür ({topicId, topic, subject, category, rootCategory})
 * @param konular   api.topics() sonucu — çağıran sayfada BİR KEZ çekilir, her açılışta değil
 */
export function KonuSecici({ open, onClose, onSelect, konular, yukleniyor = false, baslik = 'Konu seç' }) {
  const [sinav, setSinav] = useState(null)
  const [seviye, setSeviye] = useState(null)
  const [ders, setDers] = useState(null)
  const [arama, setArama] = useState('')

  useEffect(() => {
    if (open) {
      setSinav(null)
      setSeviye(null)
      setDers(null)
      setArama('')
    }
  }, [open])

  const agac = useMemo(() => agacKur(konular), [konular])

  const seviyeler = sinav ? agac.get(sinav) : null
  const dersler = seviye && seviyeler ? seviyeler.get(seviye) : null
  const konuListesi = ders && dersler ? (dersler.get(ders) ?? []) : []

  const suzulmus = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    if (!q) return konuListesi
    return konuListesi.filter((k) => k.topic.toLocaleLowerCase('tr').includes(q))
  }, [konuListesi, arama])

  const kirintilar = [sinav, seviye, ders].filter(Boolean)

  const kirintiyaGit = (i) => {
    if (i === 0) {
      setSeviye(null)
      setDers(null)
    } else if (i === 1) {
      setDers(null)
    }
    setArama('')
  }

  const adimBasligi = !sinav
    ? 'Hangi sınav?'
    : !seviye
      ? 'TYT mi, AYT mi?'
      : !ders
        ? 'Hangi ders?'
        : 'Hangi konu?'

  return (
    <Modal open={open} onClose={onClose} title={baslik}>
      {yukleniyor ? (
        <Loading label="Katalog yükleniyor…" />
      ) : (
        <View className="pb-2">
          <Kirinti adimlar={kirintilar} onGit={kirintiyaGit} />

          <Text className="mb-2 text-sm font-semibold text-slate-800">{adimBasligi}</Text>

          {/* 1. SINAV */}
          {!sinav && (
            <View className="gap-2">
              {[...agac.keys()].map((ad) => (
                <Secenek key={ad} onPress={() => setSinav(ad)} alt={`${agac.get(ad).size} seviye`}>
                  {ad}
                </Secenek>
              ))}
            </View>
          )}

          {/* 2. SEVİYE (TYT / AYT) */}
          {sinav && !seviye && (
            <View className="gap-2">
              {[...(seviyeler?.keys() ?? [])].map((ad) => (
                <Secenek key={ad} onPress={() => setSeviye(ad)} alt={`${seviyeler.get(ad).size} ders`}>
                  {ad}
                </Secenek>
              ))}
            </View>
          )}

          {/* 3. DERS — Geometri burada Matematik'ten AYRI bir satır olarak çıkar. */}
          {seviye && !ders && (
            <View className="gap-2">
              {[...(dersler?.keys() ?? [])].map((ad) => (
                <Secenek key={ad} onPress={() => setDers(ad)} alt={`${dersler.get(ad).length} konu`}>
                  {ad}
                </Secenek>
              ))}
            </View>
          )}

          {/* 4. KONU — aranabilir liste (iş kuralı 3). Listenin kaydırması Modal'ın
              kendi ScrollView'unda; ayrı bir iç kaydırma kutusu jest çatışması üretirdi. */}
          {ders && (
            <View className="gap-2">
              <Girdi
                value={arama}
                onChangeText={setArama}
                placeholder={`${ders} içinde ara…`}
                accessibilityLabel={`${ders} konularında ara`}
                autoCorrect={false}
              />

              {suzulmus.length === 0 ? (
                <Text className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                  Bu aramayla eşleşen konu yok.
                </Text>
              ) : (
                <View className="gap-1.5">
                  {suzulmus.map((k) => (
                    <Secenek key={k.topicId} onPress={() => onSelect(k)}>
                      {k.topic}
                    </Secenek>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </Modal>
  )
}

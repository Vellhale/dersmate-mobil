import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../lib/api'
import { Button, ErrorBox, Field, Girdi, Modal } from './ui'

/*
  DERS SONU DEĞERLENDİRMESİ — web'deki components/ReviewModal.jsx'in portu.

  NE ZAMAN AÇILIR: yalnızca öğrenci dersi ONAYLADIKTAN hemen sonra — ürün kuralının
  görünen yüzü; sunucu aynı kuralı bağımsız uygular (tamamlanmamış derse, dersi
  almayana, ikinci kez yorum yazılamaz).

  ZORUNLU DEĞİL: değerlendirmeyi zorunlu kılmak rastgele yıldız verdirir ve veriyi
  bozar. "Şimdi değil" bilinçli olarak duruyor.
*/

const QUICK_TAGS = [
  { value: 'KnowsSubject', label: 'Konuya çok hakim' },
  { value: 'PatientAndClear', label: 'Sabırlı ve açıklayıcı' },
  { value: 'StartedOnTime', label: 'Zamanında başladı' },
  { value: 'GreatExamples', label: 'Çözümlü sorular çok iyiydi' },
  { value: 'SharedResources', label: 'Anlaşılır kaynaklar paylaştı' },
  { value: 'WouldBookAgain', label: 'Tekrar ders alırım' },
]

const SCORE_FIELDS = [
  { key: 'score', label: 'Genel deneyim', hint: 'Dersten genel memnuniyetin.' },
  { key: 'teachingScore', label: 'Anlatım becerisi', hint: 'Konuyu anlaşılır anlattı mı?' },
  { key: 'punctualityScore', label: 'Zamanlama', hint: 'Ders vaktinde başladı mı?' },
]

export function ReviewModal({ session, open, onClose, onSubmitted }) {
  const [scores, setScores] = useState({ score: 0, teachingScore: 0, punctualityScore: 0 })
  const [tags, setTags] = useState([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Üç puanın da verilmesi beklenir: eksik puanı 5 sayıp göndermek, kullanıcının
  // söylemediği bir şeyi ona söyletmek olurdu.
  const ready = SCORE_FIELDS.every((f) => scores[f.key] >= 1)

  function toggleTag(value) {
    setTags((current) =>
      current.includes(value) ? current.filter((t) => t !== value) : [...current, value],
    )
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.createReview(session.sessionId, { ...scores, tags, comment: comment.trim() || null })
      onSubmitted?.()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dersi değerlendir"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Şimdi değil
          </Button>
          <Button loading={busy} disabled={!ready} onPress={submit}>
            Gönder
          </Button>
        </>
      }
    >
      <View className="gap-5 pb-2">
        <View className="rounded-xl bg-brand-50 p-4">
          <Text className="text-sm text-slate-600">Değerlendirdiğin ders</Text>
          <Text className="mt-0.5 font-semibold text-slate-900">
            {session?.topicName} · {session?.otherDisplayName}
          </Text>
        </View>

        {SCORE_FIELDS.map((field) => (
          <YildizSatiri
            key={field.key}
            label={field.label}
            hint={field.hint}
            value={scores[field.key]}
            onChange={(v) => setScores((s) => ({ ...s, [field.key]: v }))}
          />
        ))}

        <View>
          <Text className="text-sm font-medium text-slate-700">Neler iyiydi?</Text>
          <Text className="mb-2 mt-0.5 text-xs text-slate-500">
            İstediğin kadar seçebilirsin — hiçbirini seçmemek de serbest.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => {
              const active = tags.includes(tag.value)
              return (
                <Pressable
                  key={tag.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleTag(tag.value)}
                  className={`min-h-[44px] justify-center rounded-full border px-3.5 ${
                    active ? 'border-brand-500 bg-brand-600' : 'border-slate-300 bg-white'
                  }`}
                >
                  <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-600'}`}>
                    {active ? '✓ ' : ''}
                    {tag.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Eklemek istediğin bir şey var mı? (opsiyonel)">
          <Girdi
            value={comment}
            onChangeText={setComment}
            maxLength={1000}
            multiline
            textAlignVertical="top"
            className="h-24"
            placeholder="Dersin nasıl geçtiğini birkaç cümleyle anlatabilirsin…"
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/** Yıldız satırı — radyo grubu: ekran okuyucu "5 üzerinden 4" diyebilsin. */
function YildizSatiri({ label, hint, value, onChange }) {
  return (
    <View>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-sm font-medium text-slate-700">{label}</Text>
        <Text className="text-sm font-medium text-slate-500">
          {value ? `${value}/5` : 'Seçilmedi'}
        </Text>
      </View>
      <Text className="mb-1.5 text-xs text-slate-500">{hint}</Text>

      <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === star }}
            accessibilityLabel={`${star} yıldız`}
            onPress={() => onChange(star)}
            className="h-11 w-11 items-center justify-center rounded-lg active:bg-slate-50"
          >
            <Text className={`text-2xl ${star <= value ? 'text-amber-400' : 'text-slate-300'}`}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

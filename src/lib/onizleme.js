/*
  ÖNİZLEME (DEMO) MODU — yalnızca görsel inceleme için.

  EXPO_PUBLIC_ONIZLEME=1 iken api.* yüzeyi sunucuya gitmez; buradaki temsili veriyle
  yanıtlanır ve sahte bir oturum açık başlar. Amaç, backend/emülatör olmayan bir
  makinede TÜM ekranları gerçek veri biçimleriyle gezilebilir kılmak.

  ⚠️ ÜRÜN KODU DEĞİLDİR: hiçbir iş kuralı burada YAŞAMAZ, yalnızca sunucunun
  döndürdüğü biçimlerin (DTO) temsili örnekleri vardır. Alan adları backend
  yanıtlarıyla birebir tutulmalıdır — ekranlar bu adlara bağlanıyor ve önizlemede
  çalışan bir ekran, gerçek sunucuda da aynı alanları okuyacak.

  Bayrak build anında gömülür (EXPO_PUBLIC_*): normal geliştirmede tanımsızdır ve
  bu modülün tamamı ölü koddur.
*/
export const ONIZLEME = process.env.EXPO_PUBLIC_ONIZLEME === '1'

const gecikme = (veri) => new Promise((cozul) => setTimeout(() => cozul(veri), 250))

/* ── Kişiler ─────────────────────────────────────────────────────────────── */

const BEN = {
  userId: 'u-ben',
  displayName: 'Deniz Arslan',
  accessToken: 'onizleme-token',
  role: 'Student',
  isAdmin: false,
}

export const ONIZLEME_OTURUMU = { ...BEN }

const KISILER = {
  elif: { userId: 'u-elif', displayName: 'Elif Yılmaz' },
  mert: { userId: 'u-mert', displayName: 'Mert Kaya' },
  zeynep: { userId: 'u-zeynep', displayName: 'Zeynep Demir' },
  can: { userId: 'u-can', displayName: 'Can Öztürk' },
}

/* ── Katalog ─────────────────────────────────────────────────────────────── */

const KONULAR = [
  // rootCategory / category / subject / topic — CatalogController.TopicRow ile birebir.
  { topicId: 't-turev', rootCategory: 'YKS', category: 'AYT', subject: 'Matematik', topic: 'Türev' },
  { topicId: 't-integral', rootCategory: 'YKS', category: 'AYT', subject: 'Matematik', topic: 'İntegral' },
  { topicId: 't-limit', rootCategory: 'YKS', category: 'AYT', subject: 'Matematik', topic: 'Limit ve Süreklilik' },
  { topicId: 't-cember', rootCategory: 'YKS', category: 'AYT', subject: 'Geometri', topic: 'Çemberin Analitiği' },
  { topicId: 't-katicisim', rootCategory: 'YKS', category: 'AYT', subject: 'Geometri', topic: 'Katı Cisimler' },
  { topicId: 't-elektrik', rootCategory: 'YKS', category: 'AYT', subject: 'Fizik', topic: 'Elektrik ve Manyetizma' },
  { topicId: 't-problemler', rootCategory: 'YKS', category: 'TYT', subject: 'Matematik', topic: 'Problemler' },
  { topicId: 't-oran', rootCategory: 'YKS', category: 'TYT', subject: 'Matematik', topic: 'Oran ve Orantı' },
  { topicId: 't-ucgen', rootCategory: 'YKS', category: 'TYT', subject: 'Geometri', topic: 'Üçgende Alan' },
  { topicId: 't-paragraf', rootCategory: 'YKS', category: 'TYT', subject: 'Türkçe', topic: 'Paragrafta Anlam' },
  { topicId: 't-hareket', rootCategory: 'YKS', category: 'TYT', subject: 'Fizik', topic: 'Hareket ve Kuvvet' },
  { topicId: 't-asit', rootCategory: 'YKS', category: 'AYT', subject: 'Kimya', topic: 'Asitler ve Bazlar' },
]

const KATEGORILER = [
  { categoryId: 'c-yks', parentCategoryId: null, name: 'YKS' },
  { categoryId: 'c-tyt', parentCategoryId: 'c-yks', name: 'TYT' },
  { categoryId: 'c-ayt', parentCategoryId: 'c-yks', name: 'AYT' },
]

/* ── Portföyüm ───────────────────────────────────────────────────────────── */

const PORTFOY = [
  {
    entryId: 'p-1', direction: 'Offer', topicId: 't-problemler', topicName: 'Problemler',
    subjectName: 'Matematik', categoryName: 'TYT', selfAssessedLevel: 5,
    note: 'Temelden başlayıp bol soru çözümüyle ilerliyorum.',
  },
  {
    entryId: 'p-2', direction: 'Offer', topicId: 't-ucgen', topicName: 'Üçgende Alan',
    subjectName: 'Geometri', categoryName: 'TYT', selfAssessedLevel: 4, note: null,
  },
  {
    entryId: 'p-3', direction: 'Seek', topicId: 't-turev', topicName: 'Türev',
    subjectName: 'Matematik', categoryName: 'AYT', selfAssessedLevel: 2,
    note: 'Zincir kuralında zorlanıyorum.',
  },
  {
    entryId: 'p-4', direction: 'Seek', topicId: 't-elektrik', topicName: 'Elektrik ve Manyetizma',
    subjectName: 'Fizik', categoryName: 'AYT', selfAssessedLevel: 1, note: null,
  },
]

/* ── Akış önerileri ──────────────────────────────────────────────────────── */

const ONERILER = [
  {
    userId: KISILER.elif.userId, displayName: KISILER.elif.displayName, level: 6,
    averageRating: 4.8, ratingCount: 23, isCrossMatch: true,
    bio: '12. sınıf öğrencisiyim; matematikte sayısalcı arkadaşlarıma iki yıldır destek oluyorum.',
    theyCanTeach: [
      { topicId: 't-turev', topicName: 'Türev', subjectName: 'Matematik' },
      { topicId: 't-limit', topicName: 'Limit ve Süreklilik', subjectName: 'Matematik' },
    ],
    theyWantToLearn: [{ topicId: 't-problemler', topicName: 'Problemler', subjectName: 'Matematik' }],
  },
  {
    userId: KISILER.mert.userId, displayName: KISILER.mert.displayName, level: 4,
    averageRating: 4.3, ratingCount: 9, isCrossMatch: false,
    bio: 'Fizik olimpiyatlarına hazırlanıyorum, elektrik konularını anlatmayı seviyorum.',
    theyCanTeach: [{ topicId: 't-elektrik', topicName: 'Elektrik ve Manyetizma', subjectName: 'Fizik' }],
    theyWantToLearn: [],
  },
  {
    userId: KISILER.zeynep.userId, displayName: KISILER.zeynep.displayName, level: 8,
    averageRating: 4.9, ratingCount: 41, isCrossMatch: false,
    bio: null,
    theyCanTeach: [
      { topicId: 't-cember', topicName: 'Çemberin Analitiği', subjectName: 'Geometri' },
      { topicId: 't-katicisim', topicName: 'Katı Cisimler', subjectName: 'Geometri' },
    ],
    theyWantToLearn: [],
  },
]

/* ── Keşfet ──────────────────────────────────────────────────────────────── */

const ILANLAR = [
  {
    offerId: 'o-1', tutorUserId: KISILER.elif.userId, tutorDisplayName: KISILER.elif.displayName,
    tutorAverageRating: 4.8, tutorRatingCount: 23,
    tutorBio: '12. sınıf; matematikte iki yıldır akran desteği veriyorum.',
    topicId: 't-turev', topicName: 'Türev', subjectName: 'Matematik', categoryName: 'AYT',
    selfAssessedLevel: 5, note: 'Önce kavram, sonra çıkmış sorular.',
  },
  {
    offerId: 'o-2', tutorUserId: KISILER.zeynep.userId, tutorDisplayName: KISILER.zeynep.displayName,
    tutorAverageRating: 4.9, tutorRatingCount: 41, tutorBio: null,
    topicId: 't-cember', topicName: 'Çemberin Analitiği', subjectName: 'Geometri', categoryName: 'AYT',
    selfAssessedLevel: 5, note: null,
  },
  {
    offerId: 'o-3', tutorUserId: KISILER.can.userId, tutorDisplayName: KISILER.can.displayName,
    tutorAverageRating: 0, tutorRatingCount: 0,
    tutorBio: 'Yeni başladım ama paragraf sorusu çözmeyi gerçekten seviyorum.',
    topicId: 't-paragraf', topicName: 'Paragrafta Anlam', subjectName: 'Türkçe', categoryName: 'TYT',
    selfAssessedLevel: 3, note: null,
  },
  {
    offerId: 'o-4', tutorUserId: KISILER.mert.userId, tutorDisplayName: KISILER.mert.displayName,
    tutorAverageRating: 4.3, tutorRatingCount: 9, tutorBio: null,
    topicId: 't-hareket', topicName: 'Hareket ve Kuvvet', subjectName: 'Fizik', categoryName: 'TYT',
    selfAssessedLevel: 4, note: 'Deneylerle anlatırım.',
  },
]

const UNIVERSITE_KISILERI = [
  {
    userId: KISILER.zeynep.userId, displayName: KISILER.zeynep.displayName, level: 8,
    averageRating: 4.9, ratingCount: 41,
    university: 'Boğaziçi Üniversitesi', department: 'Bilgisayar Mühendisliği',
  },
  {
    userId: KISILER.can.userId, displayName: KISILER.can.displayName, level: 2,
    averageRating: 0, ratingCount: 0,
    university: 'İstanbul Teknik Üniversitesi', department: 'Elektrik-Elektronik Mühendisliği',
  },
]

/* ── Eşleşmeler ──────────────────────────────────────────────────────────── */

const dknOnce = (dk) => new Date(Date.now() - dk * 60000).toISOString()
const dknSonra = (dk) => new Date(Date.now() + dk * 60000).toISOString()

const ESLESMELER = {
  incoming: [
    {
      matchId: 'm-in-1', otherUserId: KISILER.can.userId, otherDisplayName: KISILER.can.displayName,
      iAmInitiator: false, requestedTopicId: 't-problemler', requestedTopicName: 'Problemler',
      offeredTopicId: null, offeredTopicName: null, conversationId: null,
      createdAtUtc: dknOnce(90),
    },
  ],
  outgoing: [
    {
      matchId: 'm-out-1', otherUserId: KISILER.mert.userId, otherDisplayName: KISILER.mert.displayName,
      iAmInitiator: true, requestedTopicId: 't-elektrik', requestedTopicName: 'Elektrik ve Manyetizma',
      offeredTopicId: null, offeredTopicName: null, conversationId: null,
      createdAtUtc: dknOnce(60 * 26),
    },
  ],
  active: [
    {
      matchId: 'm-act-1', otherUserId: KISILER.elif.userId, otherDisplayName: KISILER.elif.displayName,
      iAmInitiator: true, requestedTopicId: 't-turev', requestedTopicName: 'Türev',
      offeredTopicId: 't-problemler', offeredTopicName: 'Problemler', conversationId: 'c-elif',
      createdAtUtc: dknOnce(60 * 24 * 3),
    },
    {
      // Üniversite ağı eşleşmesi: KONUSUZ — "Ders rezerve et" bu kartta çizilmemeli.
      matchId: 'm-act-2', otherUserId: KISILER.zeynep.userId, otherDisplayName: KISILER.zeynep.displayName,
      iAmInitiator: true, requestedTopicId: null, requestedTopicName: null,
      offeredTopicId: null, offeredTopicName: null, conversationId: 'c-zeynep',
      createdAtUtc: dknOnce(60 * 24),
    },
  ],
}

/* ── Sohbet ──────────────────────────────────────────────────────────────── */

const KONUSMALAR = [
  {
    conversationId: 'c-elif', otherUserId: KISILER.elif.userId,
    otherDisplayName: KISILER.elif.displayName, lastMessageAtUtc: dknOnce(12),
    unreadCount: 2, isClosed: false,
  },
  {
    conversationId: 'c-zeynep', otherUserId: KISILER.zeynep.userId,
    otherDisplayName: KISILER.zeynep.displayName, lastMessageAtUtc: dknOnce(60 * 5),
    unreadCount: 0, isClosed: false,
  },
  {
    conversationId: 'c-mert', otherUserId: KISILER.mert.userId,
    otherDisplayName: KISILER.mert.displayName, lastMessageAtUtc: dknOnce(60 * 24 * 6),
    unreadCount: 0, isClosed: true,
  },
]

const MESAJLAR = {
  'c-elif': [
    { id: 'msg-1', conversationId: 'c-elif', senderUserId: KISILER.elif.userId, content: 'Selam! Türev için yarın 19:00 uygun mu?', sentAtUtc: dknOnce(50) },
    { id: 'msg-2', conversationId: 'c-elif', senderUserId: BEN.userId, content: 'Uygun! Zoom linki sende mi?', sentAtUtc: dknOnce(40) },
    { id: 'msg-3', conversationId: 'c-elif', senderUserId: KISILER.elif.userId, content: 'Bende: https://zoom.us/j/123456789 — derste görüşürüz.', sentAtUtc: dknOnce(15) },
    { id: 'msg-4', conversationId: 'c-elif', senderUserId: KISILER.elif.userId, content: 'Doğrulama kodunu da ekran görüntüsüne almayı unutma.', sentAtUtc: dknOnce(12) },
  ],
  'c-zeynep': [
    { id: 'msg-5', conversationId: 'c-zeynep', senderUserId: BEN.userId, content: 'Merhaba, bölüm hakkında birkaç soru sorabilir miyim?', sentAtUtc: dknOnce(60 * 6) },
    { id: 'msg-6', conversationId: 'c-zeynep', senderUserId: KISILER.zeynep.userId, content: 'Tabii ki, sor!', sentAtUtc: dknOnce(60 * 5) },
  ],
  'c-mert': [],
}

/* ── Dersler ─────────────────────────────────────────────────────────────── */

const AKTIF_DERSLER = [
  {
    // Onay bekleyen: kanıt yüklendi, ben öğrenciyim → "Kanıtı incele ve onayla".
    sessionId: 's-onay', status: 'AwaitingApproval', topicName: 'Türev', subjectName: 'Matematik',
    otherUserId: KISILER.elif.userId, otherDisplayName: KISILER.elif.displayName,
    iAmTutor: false, durationMinutes: 60, mintAmount: 100,
    scheduledStartUtc: dknOnce(60 * 3), scheduledEndUtc: dknOnce(60 * 2),
    autoApproveDeadlineUtc: dknSonra(60 * 21),
    verificationCode: 'DM-4K7Q', canComplete: false, canApprove: true, canCancel: false,
  },
  {
    // Yaklaşan: yarın, ben öğrenciyim.
    sessionId: 's-yarin', status: 'Booked', topicName: 'Çemberin Analitiği', subjectName: 'Geometri',
    otherUserId: KISILER.zeynep.userId, otherDisplayName: KISILER.zeynep.displayName,
    iAmTutor: false, durationMinutes: 30, mintAmount: 50,
    scheduledStartUtc: dknSonra(60 * 26), scheduledEndUtc: dknSonra(60 * 26 + 30),
    autoApproveDeadlineUtc: null,
    verificationCode: 'DM-9X2P', canComplete: false, canApprove: false, canCancel: true,
  },
  {
    // Saati geçmiş ama açık: ben eğitmenim, Time-Lock doldu → "Dersi tamamladım" açık.
    sessionId: 's-acik', status: 'Booked', topicName: 'Problemler', subjectName: 'Matematik',
    otherUserId: KISILER.can.userId, otherDisplayName: KISILER.can.displayName,
    iAmTutor: true, durationMinutes: 30, mintAmount: 50,
    scheduledStartUtc: dknOnce(60 * 5), scheduledEndUtc: dknOnce(60 * 5 - 30),
    autoApproveDeadlineUtc: null,
    verificationCode: 'DM-7T1N', canComplete: true, canApprove: false, canCancel: false,
  },
]

const GECMIS_DERSLER = Array.from({ length: 12 }, (_, i) => {
  const konu = KONULAR[i % KONULAR.length]
  const kisiler = [KISILER.elif, KISILER.mert, KISILER.zeynep, KISILER.can]
  const kisi = kisiler[i % kisiler.length]
  const iAmTutor = i % 3 === 0
  const sure = i % 2 === 0 ? 60 : 30
  return {
    sessionId: `s-gecmis-${i + 1}`,
    status: i === 4 ? 'Cancelled' : i === 9 ? 'Expired' : 'Completed',
    topicName: konu.topic, subjectName: konu.subject,
    otherUserId: kisi.userId, otherDisplayName: kisi.displayName,
    iAmTutor, durationMinutes: sure, mintAmount: sure === 60 ? 100 : 50,
    scheduledStartUtc: dknOnce(60 * 24 * (i + 2)),
    scheduledEndUtc: dknOnce(60 * 24 * (i + 2) - sure),
    autoApproveDeadlineUtc: null, verificationCode: null,
    canComplete: false, canApprove: false, canCancel: false,
  }
})

/* Küçük gri kare — kanıt görseli yer tutucusu (yalnızca önizlemede). */
const KANIT_GORSELI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8fPnyfwAIggN1cJPXHAAAAABJRU5ErkJggg=='

/* ── Profil / cüzdan / değerlendirme ─────────────────────────────────────── */

const CUZDAN = { balance: 1850, totalEarnedCredits: 1850, level: 4, nextLevelAt: 2500 }

const PROFILLER = {
  [BEN.userId]: {
    userId: BEN.userId, displayName: BEN.displayName,
    bio: 'TYT matematikte iyiyim; AYT türev ve fizikte desteğe ihtiyacım var. Akşamları müsaitim.',
    university: 'Ankara Fen Lisesi', department: 'Sayısal',
    taughtSessionCount: 14, averageRating: 4.6, ratingCount: 11,
    level: 4, nextLevelAt: 2500, totalEarnedCredits: 1850,
    joinedAtUtc: '2025-11-08T10:00:00Z',
    canTeach: [
      { topicId: 't-problemler', topicName: 'Problemler', subjectName: 'Matematik' },
      { topicId: 't-ucgen', topicName: 'Üçgende Alan', subjectName: 'Geometri' },
    ],
    wantsToLearn: [
      { topicId: 't-turev', topicName: 'Türev', subjectName: 'Matematik' },
      { topicId: 't-elektrik', topicName: 'Elektrik ve Manyetizma', subjectName: 'Fizik' },
    ],
  },
  [KISILER.elif.userId]: {
    userId: KISILER.elif.userId, displayName: KISILER.elif.displayName,
    bio: '12. sınıf öğrencisiyim; matematikte sayısalcı arkadaşlarıma iki yıldır destek oluyorum.',
    university: 'İzmir Atatürk Lisesi', department: 'Sayısal',
    taughtSessionCount: 38, averageRating: 4.8, ratingCount: 23,
    level: 6, nextLevelAt: 5000, totalEarnedCredits: 3900,
    joinedAtUtc: '2025-09-14T10:00:00Z',
    canTeach: [
      { topicId: 't-turev', topicName: 'Türev', subjectName: 'Matematik' },
      { topicId: 't-limit', topicName: 'Limit ve Süreklilik', subjectName: 'Matematik' },
    ],
    wantsToLearn: [{ topicId: 't-problemler', topicName: 'Problemler', subjectName: 'Matematik' }],
  },
}

const VARSAYILAN_PROFIL = (userId) => ({
  userId, displayName: 'dersmate Kullanıcısı', bio: null, university: null, department: null,
  taughtSessionCount: 0, averageRating: 0, ratingCount: 0,
  level: 1, nextLevelAt: 100, totalEarnedCredits: 0,
  joinedAtUtc: '2026-01-01T10:00:00Z', canTeach: [], wantsToLearn: [],
})

const ROZETLER = {
  [BEN.userId]: {
    badges: [{ branch: 'Matematik', level: 'Ogretici', title: 'Matematik Öğretici', hours: 9 }],
    progress: [
      { branch: 'Matematik', subject: 'Matematik', hours: 9 },
      { branch: 'Geometri', subject: 'Geometri', hours: 3 },
    ],
  },
  [KISILER.elif.userId]: {
    badges: [
      { branch: 'Matematik', level: 'Ustad', title: 'Matematik Üstadı', hours: 17 },
      { branch: 'Matematik', level: 'Ogretici', title: 'Matematik Öğretici', hours: 17 },
    ],
    progress: [{ branch: 'Fizik', subject: 'Fizik', hours: 2 }],
  },
}

const DEGERLENDIRMELER = {
  reviewCount: 11, averageScore: 4.6, averageTeachingScore: 4.7, averagePunctualityScore: 4.2,
  scoreDistribution: [0, 0, 1, 3, 7],
  reviews: {
    page: 1, totalPages: 2, hasNextPage: true,
    items: [
      {
        reviewId: 'r-1', reviewerDisplayName: 'Elif Yılmaz', score: 5,
        comment: 'Problemleri adım adım, hiç sıkmadan anlattı. Kesinlikle tekrar ders alırım.',
        topicName: 'Problemler', createdAtUtc: dknOnce(60 * 24 * 4),
      },
      {
        reviewId: 'r-2', reviewerDisplayName: 'Can Öztürk', score: 4,
        comment: 'Anlatım çok iyiydi, başlangıç 10 dakika gecikti.',
        topicName: 'Üçgende Alan', createdAtUtc: dknOnce(60 * 24 * 12),
      },
      {
        reviewId: 'r-3', reviewerDisplayName: 'Mert Kaya', score: 5, comment: null,
        topicName: 'Problemler', createdAtUtc: dknOnce(60 * 24 * 20),
      },
    ],
  },
}

const PUAN_HAREKETLERI = Array.from({ length: 27 }, (_, i) => ({
  type: i === 26 ? 'WelcomeBonus' : 'LessonEarning',
  amount: i === 26 ? 100 : i % 2 === 0 ? 100 : 50,
  topicName: i === 26 ? null : KONULAR[i % KONULAR.length].topic,
  counterpartDisplayName: i === 26 ? null : Object.values(KISILER)[i % 4].displayName,
  createdAtUtc: dknOnce(60 * 24 * (i + 1)),
}))

/* ── Sahte api yüzeyi ────────────────────────────────────────────────────── */

const sayfala = (dizi, page, pageSize) => ({
  items: dizi.slice((page - 1) * pageSize, page * pageSize),
  totalCount: dizi.length,
  page,
  totalPages: Math.max(1, Math.ceil(dizi.length / pageSize)),
  hasNextPage: page * pageSize < dizi.length,
})

const tr = (s) => String(s ?? '').toLocaleLowerCase('tr')

export const onizlemeApi = {
  login: () => gecikme({ ...ONIZLEME_OTURUMU }),
  register: () => gecikme({ verificationToken: 'onizleme-dogrulama-tokeni' }),
  verifyEmail: () => gecikme({}),
  resendVerification: () => gecikme({}),

  topics: () => gecikme(KONULAR),
  categories: () => gecikme(KATEGORILER),

  searchOffers: (filters) => {
    const q = tr(filters.search)
    let liste = ILANLAR.filter(
      (o) => !q || tr(o.topicName).includes(q) || tr(o.subjectName).includes(q) || tr(o.tutorDisplayName).includes(q),
    )
    if (filters.categoryId === 'c-tyt') liste = liste.filter((o) => o.categoryName === 'TYT')
    if (filters.categoryId === 'c-ayt') liste = liste.filter((o) => o.categoryName === 'AYT')
    if (filters.minLevel) liste = liste.filter((o) => o.selfAssessedLevel >= filters.minLevel)
    if (filters.minRating) liste = liste.filter((o) => o.tutorAverageRating >= filters.minRating)
    return gecikme(sayfala(liste, Number(filters.page) || 1, Number(filters.pageSize) || 20))
  },

  searchUniversityPeers: (filters) => {
    const u = tr(filters.university)
    const d = tr(filters.department)
    const liste = UNIVERSITE_KISILERI.filter(
      (k) => (!u || tr(k.university).includes(u)) && (!d || tr(k.department).includes(d)),
    )
    return gecikme(sayfala(liste, Number(filters.page) || 1, Number(filters.pageSize) || 20))
  },

  myPortfolio: () => gecikme(PORTFOY),
  addPortfolioEntry: () => gecikme({}),
  removePortfolioEntry: () => gecikme(null),
  suggestions: () => gecikme(ONERILER),

  myMatches: () => gecikme(ESLESMELER),
  createMatch: () => gecikme({}),
  respondMatch: () => gecikme({}),
  closeMatch: () => gecikme({}),

  conversations: () => gecikme(KONUSMALAR),
  messages: (conversationId) => gecikme([...(MESAJLAR[conversationId] ?? [])].reverse()),
  sendMessage: (conversationId, content) =>
    gecikme({
      id: `msg-yeni-${Date.now()}`, conversationId, senderUserId: BEN.userId,
      content, sentAtUtc: new Date().toISOString(),
    }),
  markRead: () => gecikme(null),

  mySessions: (pastPage = 1, pastPageSize = 5) =>
    gecikme({
      active: AKTIF_DERSLER,
      activeTotal: AKTIF_DERSLER.length,
      past: sayfala(GECMIS_DERSLER, pastPage, pastPageSize),
    }),
  sessionProofs: () =>
    gecikme([{ proofId: 'pr-1', uploadedAtUtc: dknOnce(110), isDuplicateHash: false }]),
  proofImageSource: () => ({ uri: KANIT_GORSELI }),
  bookSession: (payload) =>
    gecikme({ verificationCode: 'DM-YENI1', mintAmount: (payload.durationMinutes / 30) * 50 }),
  completeSession: () => gecikme({}),
  approveSession: () => gecikme({ creditsMinted: 100 }),
  cancelSession: () => gecikme(null),
  reportSession: () => gecikme(null),

  wallet: () => gecikme(CUZDAN),
  statement: (page = 1, pageSize = 20) => gecikme(sayfala(PUAN_HAREKETLERI, page, pageSize)),

  userProfile: (userId) => gecikme(PROFILLER[userId] ?? VARSAYILAN_PROFIL(userId)),
  myProfile: () => gecikme(PROFILLER[BEN.userId]),
  updateProfile: () => gecikme({}),
  uploadAvatar: () => gecikme({}),
  uploadTeacherDocument: () => gecikme({}),
  declareTeacherCandidate: () => gecikme({}),
  /*
    Avatar YOK muamelesi: bileşen onError ile baş harflere düşsün diye kasıtlı olarak
    çözülemeyen bir kaynak veriliyor. 'about:blank' de işi görüyordu ama tarayıcı
    konsoluna ERR_UNKNOWN_URL_SCHEME yazıyor ve gerçek hataların arasına karışıyordu;
    boş bir data URI aynı sonucu sessizce veriyor.
  */
  avatarImageSource: () => ({ uri: 'data:image/png;base64,' }),
  forgetAvatar: () => {},
  userReviews: (userId, page = 1) =>
    gecikme({ ...DEGERLENDIRMELER, reviews: { ...DEGERLENDIRMELER.reviews, page } }),
  userSubjectBadges: (userId) => gecikme(ROZETLER[userId] ?? { badges: [], progress: [] }),
  createReview: () => gecikme({}),

  myPreferences: () => gecikme({}),
  saveOnboarding: () => gecikme(null),
  saveCookieConsent: () => gecikme(null),

  // Parola sıfırlama: iki uç da 204 döner ve yanıt adres kayıtlı olsun olmasın AYNIDIR
  // (gerçek uçların sözleşmesi de bu).
  forgotPassword: () => gecikme(null),
  resetPassword: () => gecikme(null),

  reportUser: () => gecikme({}),

  /* ── Forum ────────────────────────────────────────────────────────────────
     Oy ve sayaçlar bellekte tutulur ki önizlemede oy verme gerçekten çalışsın:
     sunucu davranışı (üç durumlu oy + son sayaçların dönmesi) taklit ediliyor. */
  forumFeed: ({ sort = 'Newest', tag = null, page = 1, pageSize = 20 } = {}) => {
    let liste = FORUM_GONDERILERI.filter((g) => !tag || g.tag === tag)
    if (sort === 'Top') liste = [...liste].sort((a, b) => b.upvoteCount - a.upvoteCount)
    else if (sort === 'Discussed') liste = [...liste].sort((a, b) => b.commentCount - a.commentCount)
    return gecikme(sayfala(liste, page, pageSize))
  },
  createForumPost: () => gecikme('yeni-gonderi'),
  forumComments: (postId) => gecikme(FORUM_YORUMLARI[postId] ?? []),
  createForumComment: () => gecikme('yeni-yorum'),
  voteForumPost: (postId, value) => gecikme(oyUygula(FORUM_GONDERILERI, 'postId', postId, value)),
  voteForumComment: (commentId, value) =>
    gecikme(oyUygula(Object.values(FORUM_YORUMLARI).flat(), 'commentId', commentId, value)),
  reportForumPost: () => gecikme({}),
  reportForumComment: () => gecikme({}),

  /* ── Yönetim ──────────────────────────────────────────────────────────── */
  disputes: () => gecikme([]),
  disputeDetail: () => gecikme(null),
  resolveDispute: () => gecikme({}),
  reports: () => gecikme(YONETIM_SIKAYETLERI),
  resolveReport: () => gecikme({}),
  moderateForumContent: () => gecikme({}),
  adminSessionProofs: () => gecikme([]),
  adminProofImageSource: () => ({ uri: KANIT_GORSELI }),
  banUser: () => gecikme({}),
  unbanUser: () => gecikme({}),
  sanctionUser: () => gecikme({}),
  teacherCandidates: () => gecikme(sayfala([], 1, 25)),
  reviewTeacherCandidate: () => gecikme({}),
  economyMetrics: () => gecikme({ openReports: YONETIM_SIKAYETLERI.length, openDisputes: 0, pendingTeacherCandidates: 0 }),
  adjustCredits: () => gecikme({}),
  auditLog: () => gecikme(sayfala([], 1, 25)),
}

/* ── Forum verisi ─────────────────────────────────────────────────────────── */

const FORUM_GONDERILERI = [
  {
    postId: 'f-1', tag: 'ExamStress', title: 'Deneme sonuçlarım düştü, nasıl toparlanırım?',
    body: 'Son üç denemede netlerim ciddi düştü. Çalışma düzenim aynı ama motivasyonum kalmadı. Benzer şeyi yaşayan var mı, nasıl çıktınız?',
    author: { userId: KISILER.can.userId, displayName: KISILER.can.displayName, level: 2, isStaff: false },
    createdAtUtc: dknOnce(45), upvoteCount: 24, downvoteCount: 1, commentCount: 2,
    myVote: 0, underReview: false, reportCount: 0,
  },
  {
    postId: 'f-2', tag: 'StudyTips', title: 'Türev çalışırken işe yarayan üç alışkanlık',
    body: 'Bir yıldır türev anlatıyorum ve öğrencilerde en çok işe yarayan üç şeyi yazayım: (1) önce grafik sezgisi, (2) zincir kuralını ayrı bir güne bırakmak, (3) her konu sonunda 10 çıkmış soru.',
    author: { userId: KISILER.elif.userId, displayName: KISILER.elif.displayName, level: 6, isStaff: false },
    createdAtUtc: dknOnce(60 * 8), upvoteCount: 87, downvoteCount: 3, commentCount: 1,
    myVote: 1, underReview: false, reportCount: 0,
  },
  {
    postId: 'f-3', tag: 'Announcement', title: 'Topluluk kuralları ve moderasyon hakkında',
    body: 'Merhaba! Forumda kişisel bilgi paylaşımı ve telifli materyal yasak. Üç şikayet alan içerik otomatik olarak incelemeye alınır — silinmez, perdelenir.',
    author: { userId: 'u-yonetim', displayName: 'dersmate ekibi', level: 10, isStaff: true },
    createdAtUtc: dknOnce(60 * 24 * 2), upvoteCount: 142, downvoteCount: 0, commentCount: 0,
    myVote: 0, underReview: false, reportCount: 0,
  },
  {
    postId: 'f-4', tag: 'Motivation', title: 'Bu paylaşım incelemede',
    body: 'Üç şikayet alan içeriğin akışta nasıl perdelendiğini göstermek için duruyor.',
    author: { userId: KISILER.mert.userId, displayName: KISILER.mert.displayName, level: 4, isStaff: false },
    createdAtUtc: dknOnce(60 * 30), upvoteCount: 3, downvoteCount: 9, commentCount: 0,
    myVote: 0, underReview: true, reportCount: 3,
  },
]

const FORUM_YORUMLARI = {
  'f-1': [
    {
      commentId: 'y-1', body: 'Aynısını geçen yıl yaşadım. Bir hafta deneme çözmeyi bırakıp konu tekrarına dönmek işe yaramıştı.',
      author: { userId: KISILER.elif.userId, displayName: KISILER.elif.displayName, level: 6, isStaff: false },
      createdAtUtc: dknOnce(30), upvoteCount: 12, downvoteCount: 0, myVote: 0, underReview: false,
    },
    {
      commentId: 'y-2', body: 'Uyku düzenine de bak — netlerimdeki düşüşün yarısı oradan geliyormuş.',
      author: { userId: KISILER.zeynep.userId, displayName: KISILER.zeynep.displayName, level: 8, isStaff: false },
      createdAtUtc: dknOnce(20), upvoteCount: 5, downvoteCount: 0, myVote: 0, underReview: false,
    },
  ],
  'f-2': [
    {
      commentId: 'y-3', body: 'Grafik sezgisi kısmı gerçekten fark yaratıyor, teşekkürler!',
      author: { userId: BEN.userId, displayName: BEN.displayName, level: 4, isStaff: false },
      createdAtUtc: dknOnce(60 * 6), upvoteCount: 3, downvoteCount: 0, myVote: 0, underReview: false,
    },
  ],
}

/* Sunucunun üç durumlu oy davranışını taklit eder ve SON sayaçları döndürür —
   gerçek uçla aynı sözleşme, böylece optimistik güncelleme mantığı önizlemede de sınanır. */
function oyUygula(liste, anahtar, id, value) {
  const kayit = liste.find((x) => x[anahtar] === id)
  if (!kayit) return { upvoteCount: 0, downvoteCount: 0, myVote: 0 }

  const onceki = kayit.myVote ?? 0
  if (onceki === 1) kayit.upvoteCount -= 1
  if (onceki === -1) kayit.downvoteCount -= 1

  kayit.myVote = onceki === value ? 0 : value // aynı yöne ikinci oy = geri alma
  if (kayit.myVote === 1) kayit.upvoteCount += 1
  if (kayit.myVote === -1) kayit.downvoteCount += 1

  return { upvoteCount: kayit.upvoteCount, downvoteCount: kayit.downvoteCount, myVote: kayit.myVote }
}

const YONETIM_SIKAYETLERI = [
  {
    reportId: 'r-1', reason: 'Abuse',
    description: 'Sohbette ısrarla telefon numaramı istedi, reddedince hakaret etti.',
    reporterDisplayName: 'Deniz Arslan', reportedUserId: KISILER.mert.userId,
    reportedDisplayName: KISILER.mert.displayName, createdAtUtc: dknOnce(120),
    status: 'Open', sessionId: null, postId: null, commentId: null,
  },
  {
    reportId: 'r-2', reason: 'Copyright',
    description: 'Forum gönderisinde izinsiz yayınevi PDF bağlantısı paylaşılmış.',
    reporterDisplayName: 'Elif Yılmaz', reportedUserId: KISILER.can.userId,
    reportedDisplayName: KISILER.can.displayName, createdAtUtc: dknOnce(300),
    status: 'Open', sessionId: null, postId: 'f-4', commentId: null,
  },
]

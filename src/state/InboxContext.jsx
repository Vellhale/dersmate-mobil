import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { api } from '../lib/api'
import { useAsync } from './useAsync'
import { useChatHub } from '../hooks/useChatHub'

const InboxContext = createContext(null)

/**
 * Gelen kutusu için TEK kaynak: konuşma listesi + SignalR bağlantısı.
 * Web'deki InboxContext'in birebir portu.
 *
 * NEDEN UYGULAMA DÜZEYİNDE (kök kabukta): sunucu, mesaj alındığında alıcıya kişisel
 * bir "ConversationUpdated" olayı gönderiyor — kullanıcı Topluluk'ta ya da Keşfet'teyken
 * de hamburgerdeki ve çekmecedeki rozet güncellenebilsin. Hub yalnızca sohbet ekranında
 * kurulsaydı
 * olayı sadece zaten gelen kutusuna bakan kullanıcı duyardı.
 *
 * TEK BAĞLANTI: sohbet ekranı da kendi hub'ını kurmaz, buradakini kullanır. İki bağlantı
 * olsaydı aynı kullanıcı sunucuda iki oturum açar, gruba katılma/ayrılma iki bağlantı
 * arasında bölünür ve mesajlar bir bağlantıya gelip diğerinde beklenirdi.
 */
export function InboxProvider({ children }) {
  const conversations = useAsync(() => api.conversations(), [])

  // Ekranlar (bugün yalnızca sohbet) canlı mesajlara buradan abone olur.
  const listeners = useRef(new Set())

  const reloadConversations = useCallback(
    () => conversations.reload({ silent: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations.reload],
  )

  const hub = useChatHub({
    // ReceiveMessage yalnızca DAĞITILIR, burada listeyi tazelemez: aynı olay için hem
    // burada hem sohbette tazeleme yapmak iki eşzamanlı GET açar ve geç dönen eski yanıt
    // yeni rozeti ezebilir.
    onMessage: (message) => listeners.current.forEach((l) => l.onMessage?.(message)),

    // Rozetin asıl kaynağı bu: kullanıcı sohbete bakmıyorken de gelir.
    onConversationUpdated: (id) => {
      reloadConversations()
      listeners.current.forEach((l) => l.onConversationUpdated?.(id))
    },

    onMessagesRead: (id, byUserId) =>
      listeners.current.forEach((l) => l.onMessagesRead?.(id, byUserId)),
  })

  /*
    KAÇIRILAN OLAYLAR — liste iki anda da sessizce yeniden çekiliyor:
    • Uygulama öne gelince: arka plandayken işletim sistemi bağlantıyı askıya alıyor ya da
      koparıyor; o arada gelen ConversationUpdated olayları hiç ulaşmadı. Push bildirimi
      mesajın geldiğini söyledi ama rozet ve liste eski kalırdı.
    • Hub YENİDEN bağlanınca: kopukluk süresince kaçan olaylar tekrar gönderilmiyor.
      İlk bağlantı sayılmıyor: liste kurulumda zaten çekildi.
    Tazeleme sessiz (spinner yok); üst üste gelirse useAsync'in nesil sayacı eskiyi atar.
  */
  const tazeleRef = useRef(reloadConversations)
  tazeleRef.current = reloadConversations

  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') tazeleRef.current()
    })
    return () => abonelik.remove()
  }, [])

  const ilkBaglantiGecti = useRef(false)
  useEffect(() => {
    if (hub.status !== 'connected') return
    if (ilkBaglantiGecti.current) tazeleRef.current()
    ilkBaglantiGecti.current = true
  }, [hub.status])

  const subscribe = useCallback((handlers) => {
    listeners.current.add(handlers)
    return () => listeners.current.delete(handlers)
  }, [])

  const value = useMemo(() => {
    const list = conversations.data ?? []
    return {
      conversations: list,
      loading: conversations.loading,
      error: conversations.error,
      reloadConversations,
      unreadTotal: list.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
      hub,
      subscribe,
    }
  }, [conversations.data, conversations.loading, conversations.error, reloadConversations, hub, subscribe])

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const context = useContext(InboxContext)
  if (!context) throw new Error('useInbox, InboxProvider içinde kullanılmalı.')
  return context
}

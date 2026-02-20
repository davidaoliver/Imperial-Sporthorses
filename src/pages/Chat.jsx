import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Send, RefreshCw, MessageSquare } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

export default function Chat() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:users!messages_user_id_fkey(display_name)')
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        console.error('Error fetching messages:', error)
        const { data: fallback } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(200)
        setMessages(fallback || [])
      } else {
        setMessages(data || [])
      }
    } catch (err) {
      console.error('fetchMessages exception:', err)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchMessages()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = newMessage.trim()
    if (!trimmed || !profile) return

    setSending(true)
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      user_id: profile.id,
      content: trimmed,
    })

    if (error) {
      console.error('Error sending message:', error)
      setNewMessage(trimmed)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function formatTimestamp(dateStr) {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a')
    return format(date, 'MMM d, h:mm a')
  }

  function getSenderName(msg) {
    if (msg.sender?.display_name) return msg.sender.display_name
    return 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-amber-400">Barn Chat</h1>
        <p className="text-xs text-neutral-400">Team group chat</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.user_id === profile?.id
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                      isOwn
                        ? 'bg-amber-500 text-black rounded-br-md'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-bl-md'
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-[10px] font-semibold text-amber-400 mb-0.5">
                        {getSenderName(msg)}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                    <p
                      className={`text-[9px] mt-1 ${
                        isOwn ? 'text-amber-800' : 'text-neutral-500'
                      }`}
                    >
                      {formatTimestamp(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-neutral-900 border-t border-neutral-800">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-amber-500 text-black p-2.5 rounded-xl hover:bg-amber-400 active:bg-amber-600 transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

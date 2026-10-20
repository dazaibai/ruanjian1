import request from './request'
import { activityText, presentActivityData } from '../utils/activityPresentation'

export const listAIConversations = () => request.get('/ai/conversations')
export const createAIConversation = () => request.post('/ai/conversations')
export const deleteAIConversation = (id) => request.delete(`/ai/conversations/${id}`)
export const listAIMessages = (id) => request.get(`/ai/conversations/${id}/messages`)

export async function streamAIChat(payload, onEvent, signal) {
  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`
    },
    body: JSON.stringify(payload),
    signal
  })
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}))
    throw new Error(activityText(body.message || 'AI 暂时不可用'))
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) {
        const parsed = JSON.parse(data)
        // Translate complete cards; streamed text is translated after chunks are joined.
        onEvent(event, event === 'delta' ? parsed : presentActivityData(parsed))
      }
    }
    if (done) break
  }
}

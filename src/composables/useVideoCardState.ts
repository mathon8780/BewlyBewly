import type { InjectionKey } from 'vue'
import { computed, inject, provide, reactive } from 'vue'

export interface VideoCardState {
  removed: boolean
  isInWatchLater: boolean
  selectedDislikeOpt?: { dislikeReasonId: number }
}
export type VideoCardStates = Map<string, VideoCardState>

const stateKey: InjectionKey<Map<string, VideoCardState>> = Symbol('video-card-actions')
const createState = (): VideoCardState => reactive({ removed: false, isInWatchLater: false })

/** The owning bounded feed releases its action state together with its browse window. */
export function provideVideoCardState(states: VideoCardStates = new Map()) {
  provide(stateKey, states)
  return { clear: () => states.clear() }
}

export function useVideoCardState(video: () => { bvid?: string, aid?: number, id?: number, cid?: number, roomid?: number, epid?: number } | undefined) {
  const states = inject(stateKey, undefined)
  let local = createState()
  let localKey = ''
  return computed(() => {
    const item = video()
    if (!item)
      return local
    const identity = item.bvid ? `bv:${item.bvid}` : item.aid ? `av:${item.aid}` : item.roomid ? `room:${item.roomid}` : item.epid ? `ep:${item.epid}` : `id:${item.id}`
    const key = `${identity}:${item.cid || ''}`
    if (!states) {
      if (localKey !== key) {
        localKey = key
        local = createState()
      }
      return local
    }
    let state = states.get(key)
    if (!state) {
      state = createState()
      states.set(key, state)
    }
    return state
  })
}

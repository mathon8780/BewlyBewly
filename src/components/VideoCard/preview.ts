import type { VideoInfo } from '~/models/video/videoInfo'
import type { VideoPreviewResult } from '~/models/video/videoPreview'
import api from '~/utils/api'
import { createInflightRequests } from '~/utils/inflightRequest'

const pendingPreview = createInflightRequests()

export function getPreviewUrl(video: { aid?: number, bvid?: string, cid?: number }): Promise<string> {
  return pendingPreview(`${video.bvid || video.aid}:${video.cid || ''}`, async (signal) => {
    let cid = video.cid
    let bvid = video.bvid
    if (!cid || !bvid) {
      const info: VideoInfo = await api.video.getVideoInfo({ bvid, aid: video.aid ? String(video.aid) : undefined })
      if (info.code !== 0)
        throw new Error(info.message)
      cid = info.data.cid
      bvid = info.data.bvid
    }
    if (signal.aborted)
      throw new Error('Preview request expired')
    const result: VideoPreviewResult = await api.video.getVideoPreview({ bvid, cid })
    if (result.code !== 0 || !result.data?.durl?.[0]?.url)
      throw new Error(result.message)
    return result.data.durl[0].url
  })
}

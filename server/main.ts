import type { RegisterServerOptions, MVideoFullLight, VideoDetails } from '@peertube/peertube-types'
import { tableOfContentsField, parseTableOfContents, toWebVtt, Chapters } from '../shared/common'

export async function register ({ peertubeHelpers, registerHook, storageManager, getRouter }: RegisterServerOptions) {
  registerHook({
    target: 'action:api.video.updated',
    handler: ({ video, body }: { video: MVideoFullLight, body: any }) => {
      if (!body.pluginData) {
        return
      }

      var tocText = body.pluginData[tableOfContentsField]
      if (!tocText) {
        return
      }

      if (tocText === '') {
        tocText = null
      }
      storageManager.storeData(tableOfContentsField + '_v-' + video.id, tocText)

      var parsed = parseTableOfContents(tocText)
      if (!parsed.hasOwnProperty('error')) {
        parsed = parsed as Chapters
        storageManager.storeData(tableOfContentsField + '_parsed' + '_v-' + video.id, parsed)
        if (parsed.chapters.length === 0) {
          storageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, null)
        } else {
          const webVtt = toWebVtt(parsed)
          storageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, webVtt)
        }
      } else {
        storageManager.storeData(tableOfContentsField + '_parsed' + '_v-' + video.id, null)
        storageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, null)
      }
    }
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: async (video: VideoDetails) => {
      if (!video) {
        return video
      }
      if (!video.pluginData) {
        video.pluginData = {}
      }

      video.pluginData[tableOfContentsField] = await storageManager.getData(tableOfContentsField + '_v-' + video.id)
      video.pluginData[tableOfContentsField + '_parsed'] = await storageManager.getData(tableOfContentsField + '_parsed' + '_v-' + video.id)
      return video
    }
  })

  const router = getRouter()
  router.get('/videos/*', async (req, res) => {
    const file = req.path.slice(req.path.lastIndexOf('/') + 1)
    const extensionIndex = file.indexOf('.')
    var extension = 'vtt'
    var videoIdOrUUID = file
    if (extensionIndex !== -1) {
      videoIdOrUUID = file.slice(0, extensionIndex)
      extension = file.slice(extensionIndex + 1)
    }
    var videoId = videoIdOrUUID
    // the short UUIDs appear to be 22, so use 20 to be safe
    if (videoIdOrUUID.length >= 20) {
      try {
        const video = await peertubeHelpers.videos.loadByIdOrUUID(videoIdOrUUID)
        if (video == null) {
          res.status(404).send('404 Not Found')
          return
        }
        videoId = video.id
      } catch (e) {
        console.error('chapters: /videos/: Failed to video loadByIdOrUUID: ' + e)
        res.status(500).send('500 Internal Server Error')
        return
      }
    }

    switch (extension) {
      case 'vtt':
        var webVtt = await storageManager.getData(tableOfContentsField + '_vtt' + '_v-' + videoId)

        if (webVtt == null) {
          res.status(404).send('404 Not Found')
        } else {
          res.append('content-type', 'text/vtt')
          res.send(webVtt)
        }
        break
      case 'json':
        var json = await storageManager.getData(tableOfContentsField + '_parsed' + '_v-' + videoId)

        if (json == null) {
          res.status(404).send('404 Not Found')
        } else {
          res.append('content-type', 'application/json')
          res.send(json)
        }
        break
      default:
        res.status(404).send('404 Not Found')
    }
  })
}

export async function unregister () {
}

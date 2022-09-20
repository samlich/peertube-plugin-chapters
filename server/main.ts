import type { RegisterServerOptions, MVideoFullLight, VideoDetails, PluginStorageManager } from '@peertube/peertube-types'
import { Request, Response } from 'express'
import short from 'short-uuid'
import { tableOfContentsField, parseTableOfContents, toWebVtt, Chapters, migrateTags, tagsCompatibility } from '../shared/common'

const shortUuidTranslator = short()

export async function register ({ peertubeHelpers, registerHook, storageManager: storageManager_, getRouter }: RegisterServerOptions) {
  const log = peertubeHelpers.logger;
  const storageManager = new StorageManagerTypeFix(storageManager_)
  
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
      storageManager.storeDataString(tocTextStore(video.id), tocText)

      var parsed = parseTableOfContents(tocText)
      if (!parsed.hasOwnProperty('error')) {
        parsed = parsed as Chapters
        storageManager.storeDataObjectRaw(tocParsedStore(video.id), parsed)
        if (parsed.chapters.length === 0) {
          storageManager.storeDataRemove(tocWebVttStore(video.id))
        } else {
          const webVtt = toWebVtt(parsed)
          storageManager.storeDataString(tocWebVttStore(video.id), webVtt)
        }
      } else {
        storageManager.storeDataRemove(tocParsedStore(video.id))
        storageManager.storeDataRemove(tocWebVttStore(video.id))
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

      video.pluginData[tableOfContentsField] = await storageManager.getDataString(tocTextStore('' + video.id))
      var chaptersUnconverted = await storageManager.getDataObjectRaw(tocParsedStore('' + video.id))
      if (chaptersUnconverted != undefined) {
        var [chapters, _modified] = migrateTags(chaptersUnconverted)
        if (chapters != null) {
          tagsCompatibility(chapters)
          video.pluginData[tableOfContentsField + '_parsed'] = chapters
        }
      }
      return video
    }
  })

  const router = getRouter()
  router.get('/videos/*', getVideo)
  router.get('/api/v1/videos/*', getVideo)
  
  async function getVideo(req: Request, res: Response) {
    const file = req.path.slice(req.path.lastIndexOf('/') + 1)
    const extensionIndex = file.indexOf('.')
    var extension = 'vtt'
    var videoIdOrUUID = file
    if (extensionIndex !== -1) {
      videoIdOrUUID = file.slice(0, extensionIndex)
      extension = file.slice(extensionIndex + 1)
    }
    var videoId = videoIdOrUUID
    // the short UUIDs appear to be 22, but are allowed to be shorter, so use 13 to be safe
    if (videoIdOrUUID.length >= 13) {
      try {
        if (!videoIdOrUUID.includes('-')) {
          videoIdOrUUID = shortUuidTranslator.toUUID(videoIdOrUUID)
        }
        const video = await peertubeHelpers.videos.loadByIdOrUUID(videoIdOrUUID)
        if (video == null) {
          res.status(404).send('404 Not Found')
          return
        }
        videoId = video.id
      } catch (e) {
        log.error('chapters: /videos/: Failed to video loadByIdOrUUID: ' + e)
        res.status(500).send('500 Internal Server Error')
        return
      }
    }

    switch (extension) {
      case 'vtt':
        var webVtt = await storageManager.getDataString(tocWebVttStore(videoId))

        if (webVtt == null) {
          res.status(404).send('404 Not Found')
        } else {
          res.append('content-type', 'text/vtt')
          res.send(webVtt)
        }
        break
      case 'json':
        var json = await storageManager.getDataObjectRaw(tocParsedStore(videoId))

        if (json == null) {
          res.status(404).send('404 Not Found')
        } else {
          var [chapters, _modified] = migrateTags(json)
          res.append('content-type', 'application/json')
          res.send(chapters)
        }
        break
      default:
        res.status(404).send('404 Not Found')
    }
  }
}

export async function unregister () {
}



interface StoreKey<T> {
  k: string
}
interface StoreObjectKey<T> {
  k: string,
  validate: (x: object) => T | null
}

function tocTextStore(videoId: string): StoreKey<string> {
  return { k: tableOfContentsField + '_v-' + videoId }
}
// may store older `Chapters` objects. `migrateTags` handles validation and conversion
function tocParsedStore(videoId: string): StoreKey<object> {
  return { k: tableOfContentsField + '_parsed' + '_v-' + videoId }
}
function tocWebVttStore(videoId: string): StoreKey<string> {
  return { k: tableOfContentsField + '_vtt' + '_v-' + videoId }
}

class StorageManagerTypeFix {
  storageManager: PluginStorageManager
  
  constructor (storageManager: PluginStorageManager) {
    this.storageManager = storageManager
  }
  
  // PeerTube lies and says it will always return a string, when it actually
  // returns undefined when no value exists, and returns an object, number, string, boolean, or null
  // if it's able to parse as json
  async getDataUnknown (key: string): Promise<object | number | string | boolean | null | undefined> {
    // PeerTube spec specifies: async getData (key: string): Promise<string> {
    return await this.storageManager.getData(key) as any
  }
  
  async getDataString (key: StoreKey<string>): Promise<string | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val == 'string') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    return JSON.stringify(val)
  }
  
  async getDataObjectRaw (key: StoreKey<object>): Promise<object | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || (typeof val == 'object' && val != null)) {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected object for stored value '+key.k+', but got '+typeof val)
  }
  
  async getDataObject<T> (key: StoreObjectKey<T>): Promise<T | null | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined) {
      return val
    }
    if (typeof val == 'object' && val != null) {
      return key.validate(val)
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected object for stored value '+key.k+', but got '+typeof val+' with nullness:'+(val === null))
  }
  async getDataNumber (key: StoreKey<number>): Promise<number | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val == 'number') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected number for stored value '+key.k+', but got '+typeof val)
  }
  
  async getDataBoolean (key: StoreKey<boolean>): Promise<boolean | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val == 'boolean') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected boolean for stored value '+key.k+', but got '+typeof val)
  }
  
  /*async storeData (key: string, data: any): Promise<any> {
    return await this.storageManager.storeData(key, data)
  }*/
  
  async storeDataRemove<T> (key: StoreKey<T>): Promise<any> {
    return await this.storageManager.storeData(key.k, undefined)
  }
  
  async storeDataString (key: StoreKey<string>, data: string): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
  
  async storeDataObjectRaw (key: StoreKey<object>, data: object): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
  
  async storeDataObject<T> (key: StoreObjectKey<T>, data: T): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
  
  async storeDataNumber (key: StoreKey<number>, data: number): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
  
  async storeDataBoolean (key: StoreKey<boolean>, data: boolean): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
}


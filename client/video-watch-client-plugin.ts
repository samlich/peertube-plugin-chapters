import { VideoDetails } from '@peertube/peertube-types'
import type { RegisterClientOptions } from '@peertube/peertube-types/client'
import { tableOfContentsField } from 'shared/common'
import type videojs from 'video.js'

type videojsPackage = typeof videojs

export function register ({ registerHook, peertubeHelpers }: RegisterClientOptions): void {
  registerHook({
    target: 'action:video-watch.player.loaded',
    handler: ({ player, video, videojs }: { player: videojs.Player, video: VideoDetails, videojs: videojsPackage }) => {
      // `getBaseRouterRoute` doesn't seem to actually exist? So, use `getBaseStaticRoute`
      const baseStatic = peertubeHelpers.getBaseStaticRoute()
      setup(player, video, videojs, baseStatic.slice(0, baseStatic.lastIndexOf('/') + 1) + 'router')
    }
  })
  registerHook({
    target: 'action:embed.player.loaded',
    handler: ({ player, video, videojs }: { player: videojs.Player, video: VideoDetails, videojs: videojsPackage }) => {
      // `peertubeHelpers` is not available for embed, make best attemp at getting base route
      // var baseRoute = video.originInstanceUrl + '/plugins/chapters/router'
      let baseRoute = video.channel.url
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute += '/plugins/chapters/router'
      setup(player, video, videojs, baseRoute)
    }
  })

  function setup (player: videojs.Player, video: VideoDetails, videojs: videojsPackage, baseRoute: string): void {
    if (video.pluginData == null || video.pluginData[tableOfContentsField] == null) {
      console.log('chapters: No table of contents provided for this video')
      return
    }
    // const tocText = video.pluginData[tableOfContentsField]

    let chaptersButton = player.controlBar.getChild('ChaptersButton')
    if (chaptersButton == null) {
      // must be added before text track is loaded
      chaptersButton = player.controlBar.addChild('ChaptersButton', {})
      // re-order chapters button; it is placed at the end by default
      let nextEl = player.controlBar.getChild('VolumeControl')
      if (nextEl == null) {
        nextEl = player.controlBar.getChild('P2PInfoButton')
      }
      if (nextEl != null) {
        player.controlBar.el().insertBefore(chaptersButton.el(), nextEl.el())
      }
      const menus = chaptersButton.el().getElementsByClassName('vjs-menu-content')
      if (menus != null && menus.length > 0) {
        const menu = menus[0]
        // used by `assets/style.css`
        menu.id = 'peertube-plugin-chapters-menu'
      }
    }

    const vttUrl = baseRoute + '/videos/' + video.id.toString() + '.vtt'
    const track = player.addRemoteTextTrack({
      kind: 'chapters',
      src: vttUrl
    },
    // `manualCleanup`, when true, `TextTrack` will be removed on source change
    false)

    // no `onload` event it seems
    function waitTrackReady (): void {
      if (track.readyState === 0 || track.readyState === 1) {
        // not ready
        window.setTimeout(waitTrackReady, 50)
      } else if (track.readyState === 3 || (track.track.cues ?? []).length === 0) {
        console.log('chapters: Failed to load video text track from "' + vttUrl + '"')
      } else if (track.readyState === 2) {
        console.log('chapters: loaded successfully')
        if (chaptersButton == null) {
          console.error('chapters: no chapters button')
        } else {
          const menus = chaptersButton.el().getElementsByClassName('vjs-menu-content')
          if (menus != null && menus.length > 0) {
            const menu = menus[0]
            // used by `assets/style.css`
            menu.id = 'peertube-plugin-chapters-menu'
          }
        }
      } else {
        console.log('chapters: Unexpected HTMLTrackElement readyState of ' + track.readyState.toString() + ' while loading video text track from "' + vttUrl + '"')
      }
    }
    window.setTimeout(waitTrackReady, 50)
  }
}

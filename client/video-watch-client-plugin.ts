import { VideoDetails } from '@peertube/peertube-types'
import type { RegisterClientOptions } from '@peertube/peertube-types/client'
import { tableOfContentsField } from 'shared/common'
import type videojs from 'video.js'

type videojsPackage = typeof videojs

export function register ({ registerHook, peertubeHelpers }: RegisterClientOptions) {
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
      var baseRoute = video.channel.url
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute += '/plugins/chapters/router'
      setup(player, video, videojs, baseRoute)
    }
  })

  function setup (player: videojs.Player, video: VideoDetails, videojs: videojsPackage, baseRoute: string) {
    if (!video.pluginData || !video.pluginData[tableOfContentsField]) {
      console.log('chapters: No table of contents provided for this video')
      return
    }
    // const tocText = video.pluginData[tableOfContentsField]

    const vttUrl = baseRoute + '/videos/' + video.id + '.vtt'
    var track = player.addRemoteTextTrack({
      kind: 'chapters',
      src: vttUrl,
    },
    // `manualCleanup`, when true, `TextTrack` will be removed on source change
    false)
    // no `onload` event it seems
    function waitTrackReady () {
      if (track.readyState === 0 || track.readyState === 1) {
        // not ready
        window.setTimeout(waitTrackReady, 50)
      } else if (track.readyState === 3 || (track.track.cues ?? []).length === 0) {
        console.log('chapters: Failed to load video text track from "' + vttUrl + '"')
      } else if (track.readyState === 2) {
        if (player.controlBar.getChild('ChaptersButton') == null) {
          const ChaptersButton = videojs.getComponent('ChaptersButton')
          const chaptersButton = new ChaptersButton(player)
          player.controlBar.addChild(chaptersButton)
          const nextEl = player.controlBar.getChild('VolumeControl') || player.controlBar.getChild('P2PInfoButton')
          if (nextEl != null) {
            player.controlBar.el().insertBefore(chaptersButton.el(), nextEl.el())
          }
          var menus = chaptersButton.el().getElementsByClassName('vjs-menu-content')
          if (menus != null && menus.length > 0) {
            var menu = menus[0]
            // used by `assets/style.css`
            menu.id = 'peertube-plugin-chapters-menu'
          }
        }
      } else {
        console.log('chapters: Unexpected HTMLTrackElement readyState of ' + track.readyState + ' while loading video text track from "' + vttUrl + '"')
      }
    }
    window.setTimeout(waitTrackReady, 50)
  }
}

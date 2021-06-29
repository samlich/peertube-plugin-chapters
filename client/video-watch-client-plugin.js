import { version, tableOfContentsField, parseTableOfContents } from './common.js'

function register ({ registerHook, peertubeHelpers }) {
  registerHook({
    target: 'action:video-watch.player.loaded',
    handler: ({ player, video, videojs }) => {
      // `getBaseRouterRoute` doesn't seem to actually exist? So, use `getBaseStaticRoute`
      const baseStatic = peertubeHelpers.getBaseStaticRoute()
      setup(player, video, videojs, baseStatic.slice(0, baseStatic.lastIndexOf('/') + 1) + 'router')
    }
  })
  registerHook({
    target: 'action:embed.player.loaded',
    handler: ({ player, video, videojs }) => {
      // `peertubeHelpers` is not available for embed, make best attemp at getting base route
      // var baseRoute = video.originInstanceUrl + '/plugins/chapters/' + version + '/router'
      var baseRoute = video.channel.url
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute = baseRoute.slice(0, baseRoute.lastIndexOf('/'))
      baseRoute += '/plugins/chapters/' + version + '/router'
      setup(player, video, videojs, baseRoute)
    }
  })

  function setup (player, video, videojs, baseRoute) {
    if (!video.pluginData || !video.pluginData[tableOfContentsField]) {
      console.log('chapters: No table of contents provided for this video')
      return
    }
    const tocText = video.pluginData[tableOfContentsField]

    const vttUrl = baseRoute + '/videos/' + video.id
    var track = player.addRemoteTextTrack({
      kind: 'chapters',
      src: vttUrl,
      manualCleanup: true
    })
    // no `onload` event it seems
    function waitTrackReady () {
      if (track.readyState == 0 || track.readyState == 1) {
        // not ready
        window.setTimeout(waitTrackReady, 50)
      }else if (track.readyState == 3 || track.track.cues.length == 0) {
        console.log('chapters: Failed to load video text track from "' + vttUrl + '"')
      }else if (track.readyState == 2) {
        if (player.controlBar.getChild('ChaptersButton') == null) {
          const ChaptersButton = videojs.getComponent('ChaptersButton')
          const chaptersButton = new ChaptersButton(player, { name: 'ChaptersButton' })
          player.controlBar.addChild(chaptersButton)
          const nextEl = player.controlBar.getChild('VolumeControl') || player.controlBar.getChild('P2PInfoButton')
          if (nextEl != null) {
            player.controlBar.el().insertBefore(chaptersButton.el(), nextEl.el())
          }
          var menu = chaptersButton.el().getElementsByClassName('vjs-menu-content')
          if (menu != null && 0 < menu.length) {
            menu = menu[0]
            // Some part of the theme sets
            // .video-js.vjs-peertube-skin .vjs-control-bar .vjs-menu-button-popup .vjs-menu .vjs-menu-content
            // to have width: 50px
            menu.style.width = 'auto'
          }
        }
      }else {
        console.log('chapters: Unexpected HTMLTrackElement readyState of ' + track.readyState + ' while loading video text track from "' + vttUrl + '"')
      }
    }
    window.setTimeout(waitTrackReady, 50)
  }
}

export { register }

# PeerTube Chapter Plugin

![Chapters menu on a video](https://milesdewitt.com/peertube-chapters/chapters-menu.png)

This plugin adds support for listing chapters when uploading a video. They will then be shown in the chapter menu button when users play a video, and will be available to other plugins. Chapters are specified under the "Plugin settings" tab when editing a video.

They can be specified in a format such as:

0:00 (Intro)\
0:05 The first chapter\
0:30 The second part

Any hyphens, colons, and spaces after the timestamp and before the text are ignored, so "0:05 - The first chapter" is equivalent to the above.

Or using markdown lists of links.

1. \[(Intro)\](#0:00)
1. \[The first chapter](#0:05)
1. \[The second part\](#0m30s)

Where the timestamps can be of the form 1:02:30 or 1h02m30s.

The resulting WebVTT data can be previewed by hovering over the input box until the mouseover text appears.

![WebVTT preview when editing video](https://milesdewitt.com/peertube-chapters/video-edit-small.png)

Tags can be added to chapters by prefixing them in parenthesis. The supported tags are similar to SponsorBlock and include "Sponsor", "Self-promotion", "Interaction reminder" (like, comment, subscribe), "Intro", "Intermission", "Outro", "Credits", or "Non-music" (segment of music). These tags are added to chapter data available to other plugins.

Chapters can be accessed by other plugins using the text track added to the video (`player.remoteTextTracks()`), and through `video.pluginData['table-of-contents_parsed']`.
They can be accessed externally (or internally) at `/plugins/chapters/router/videos/<uuid>.json`, or `<uuid>.vtt` for a WebVTT.
For example:

- [https://peertube-demo.samli.ch/plugins/chapters/router/videos/2Sf37VnzwF9biJ9LTTmQbx.json](https://peertube-demo.samli.ch/plugins/chapters/router/videos/2Sf37VnzwF9biJ9LTTmQbx.json)
- [https://peertube-demo.samli.ch/plugins/chapters/router/videos/2Sf37VnzwF9biJ9LTTmQbx.vtt](https://peertube-demo.samli.ch/plugins/chapters/router/videos/2Sf37VnzwF9biJ9LTTmQbx.vtt)

The JavaScript and JSON objects are of the form:

    export type Chapters = {
      chapters: Chapter[],
      description: string | null,
      end: null,
    }
    export type Chapter = {
      start: number,
      end?: number,
      name: string,
      tag: Tag,
    }
    export type Tag = null |
     'sponsor' |
     'self_promotion' |
     'interaction_reminder' |
     'intro' |
     'intermission' |
     'outro' |
     'credits' |
     'non_music'

## Contributing

From the `client` directory run `npx ts-standard --fix`, likewise from the `server` directory. And then from either run `npx ts-standard ../shared/common.ts --fix`. Correct any issues it doesn't fix automatically.

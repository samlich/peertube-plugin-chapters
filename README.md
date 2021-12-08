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

Chapters can be accessed by other plugins using the text track added to the video (`player.remoteTextTracks()`), and through `video.pluginData['table-of-contents_parsed']`. It contains an object of the form:

    {
      chapters: [
        // chapter
        {
          start: float,
          end: float,
          name: String,
          tags: {
            sponsor: bool,
            selfPromotion: bool,
            interactionReminder: bool,
            intro: bool,
            intermission: bool,
            outro: bool,
            credits: bool,
            nonMusic: bool,
          },
        }
      ],
    }

## Contributing

Code is run through `npx standard --fix`. Some of the changes it makes are wrong, but at least it's consistent.

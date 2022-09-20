import type { RegisterClientHelpers } from '@peertube/peertube-types/client'
import { marked } from 'marked'

export const tableOfContentsField = 'table-of-contents'

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
  tags?: TagsDeprecated,
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

type TagsDeprecated = {
  sponsor?: boolean,
  selfPromotion?: boolean,
  interactionReminder?: boolean,
  intro?: boolean,
  intermission?: boolean,
  outro?: boolean,
  credits?: boolean,
  nonMusic?: boolean,
}

export type ChaptersError = {
  error: ChaptersErrorInner,
}
type ChaptersErrorInner = {
  kind: string,
  errorString?: string,
  item?: string,
  lineText?: string,
  timestampError?: TimestampErrorInner,
  timestampValid?: string,
  timestamp?: string,
}

export function parseTableOfContents (unparsed: string): Chapters | ChaptersError {
  var ret: Chapters = {
    chapters: [],
    description: null,
    end: null
  }

  if (unparsed.trim().length === 0) {
    return ret
  }

  const markdownTokens = marked.lexer(unparsed)
  if (markdownTokens && markdownTokens.length >= 1 && markdownTokens[0].type === 'list') {
    var list = markdownTokens[0]
    var items = list.items
    for (const item of items) {
      if (item.type !== 'list_item') {
        return { error: { kind: 'non_list_item', item: item.text } }
      }
      if (0 < item.tokens.length &&
        item.tokens[0].type === 'text' &&
        ((item.tokens[0] as marked.Tokens.Text).tokens ?? []).length > 0 &&
        (item.tokens[0] as marked.Tokens.Text).tokens![0].type === 'link') {
        var link = (item.tokens[0] as marked.Tokens.Text).tokens![0] as marked.Tokens.Link
        if (!link.href.startsWith('#')) {
          return { error: { kind: 'timestamp_not_fragment' } }
        } else {
          const timestampText = link.href.slice(1) // == #1m1s
          var timestamp = parseTimestamp(timestampText)
          if (timestamp.hasOwnProperty('error')) {
            timestamp = timestamp as TimestampError
            return { error: { kind: 'bad_timestamp', item: item.tokens[0].text, timestampError: timestamp.error } }
          }
          timestamp = timestamp as TimestampParsed
          if (timestamp.length !== timestampText.trim().length) {
            return { error: { kind: 'bad_timestamp_partial', item: item.tokens[0].text, timestampValid: timestampText.slice(0, timestamp.length), timestamp: timestampText } }
          }
          var chapterText = link.text
          // var chapter_markdown = link.tokens

          pushChapter(ret, chapterText, timestamp)
        }
      } else {
        return { error: { kind: 'non_link', item: item.text } }
      }
    }
  } else {
    const lines = unparsed.split('\n')
    for (const idx in lines) {
      const line = lines[idx]
      if (line.trim().length === 0) {
        continue
      }
      var timestamp = parseTimestamp(line)
      if (timestamp.hasOwnProperty('error')) {
        timestamp = timestamp as TimestampError
        return { error: { kind: 'bad_timestamp_starting_line', lineText: line, timestampError: timestamp.error } }
      }
      timestamp = timestamp as TimestampParsed
      var text = line.slice(timestamp.length).trim()
      var limit = 0
      while (limit < 10000) {
        limit += 1
        if (text.startsWith('-') || text.startsWith(':')) {
          text = text.slice(1).trim()
        }
      }
      pushChapter(ret, text, timestamp)
    }
  }

  ret.chapters.sort(function (a: Chapter, b: Chapter): number { return a.start - b.start })
  for (var i = 0; i < ret.chapters.length; i++) {
    var chapter = ret.chapters[i]
    if (chapter.end == null) {
      if (i + 1 < ret.chapters.length) {
        chapter.end = ret.chapters[i + 1].start
      } else if (ret.end != null) {
        chapter.end = ret.end
      } else {
        // Giveup, use end of video, if known
      }
    }
  }

  return ret
}

export async function fillParseTableOfContentsErrorString (peertubeHelpers: RegisterClientHelpers, error: ChaptersErrorInner) {
  try {
    switch (error.kind) {
      case 'non_list_item':
        error.errorString = await peertubeHelpers.translate('Non-list item') + ': ' + error.item
        break
      case 'timestamp_not_fragment':
        error.errorString = await peertubeHelpers.translate('Timestamp does not start with "#"')
        break
      case 'bad_timestamp':
        await fillParseTimestampErrorString(peertubeHelpers, error.timestampError!)
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp for') + '" ' + error.item + '": ' + error.timestampError!.errorString
        break
      case 'bad_timestamp_partial':
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp for') + ' "' + error.item + '"' + await peertubeHelpers.translate(', only ') + '"' + error.timestampValid + '"' + await peertubeHelpers.translate(' of ') + '"' + error.timestamp + '"' + await peertubeHelpers.translate(' is valid.')
        break
      case 'bad_timestamp_starting_line':
        await fillParseTimestampErrorString(peertubeHelpers, error.timestampError!)
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp at start of') + ' "' + error.lineText + '": ' + error.timestampError!.errorString
        break
      case 'non_link':
        error.errorString = await peertubeHelpers.translate('Encountered non-link item') + ', "' + error.item + '"'
        break
      default:
        if (error.errorString === null || error.errorString === undefined) {
          error.errorString = await peertubeHelpers.translate('Unknown error.')
        }
        break
    }
  } catch (e) {
    if (error.errorString === null) {
      error.errorString = error.kind + ' (unable to access translation service)'
    }
    console.error('chapters: Failed getting translation for table of contents parsing error message:')
    console.error(e)
  }
}

async function fillParseTimestampErrorString (peertubeHelpers: RegisterClientHelpers, error: TimestampErrorInner) {
  try {
    switch (error.kind) {
      case 'frame_number_and_fractional_seconds':
        error.errorString = await peertubeHelpers.translate('Frame number not allowed with fractional seconds')
        break
      case 'unknown_format':
        error.errorString = await peertubeHelpers.translate('Unknown timestamp format')
        break
      default:
        if (error.errorString == null) {
          error.errorString = await peertubeHelpers.translate('Unknown error.')
        }
        break
    }
  } catch (e) {
    if (error.errorString == null) {
      error.errorString = error.kind + ' (unable to access translation service)'
    }
    console.error('chapters: Failed getting translation for timestamp parsing error message:')
    console.error(e)
  }
}

export function toWebVtt (obj: Chapters, json: boolean = false): string {
  function webVttTimestamp (instant: number): string {
    var second = instant % 60
    const minute = Math.round((instant - second) / 60 % 60)
    const hour = Math.round((instant - 60 * minute - second) / 3600)

    // `toFixed` rounds the binary representation, e.g. 0.5595 rounds to 0.559
    // https://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function toFixed2 (value: number, precision: number): string {
      var power = Math.pow(10, precision || 0)
      // use regular `toFixed` to always have 3 decimals including trailing zeroes
      return (Math.round(value * power) / power).toFixed(precision)
    }

    return ('' + hour).padStart(2, '0') + ':' + ('' + minute).padStart(2, '0') + ':' + toFixed2(second, 3).padStart(6, '0')
  }

  var ret = 'WEBVTT\n\n'
  if (obj.description !== null && obj.description.length !== 0) {
    ret += 'NOTE\n' + obj.description + '\n\n'
  }

  if (obj.chapters.length === 0) {
    return ret
  }

  var chapterNumber = 1
  for (const chapter of obj.chapters) {
    var end = null
    if (chapter.end != null) {
      end = chapter.end
    } else {
      // Giveup and use placeholder
      end = chapter.start + 60
    }

    ret += 'Chapter ' + chapterNumber + '\n'
    chapterNumber += 1

    ret += webVttTimestamp(chapter.start)
    ret += ' --> '
    ret += webVttTimestamp(end)
    ret += '\n'
    if (json) {
      const jsonObj = { title: chapter.name }
      ret += JSON.stringify(jsonObj)
    } else {
      ret += chapter.name
    }
    ret += '\n\n'
  }

  return ret
}

function pushChapter (obj: Chapters, text: string, start: TimestampParsed) {
  var tagMatch = text.match(/\((.+)\)/)
  var tag: Tag = null
  if (tagMatch) {
    var tagText = tagMatch[1].toLowerCase()
    if (tagText === 'sponsor') {
      tag = 'sponsor'
    } else if (tagText === 'self-promotion' || tagText === 'self promotion') {
      tag = 'self_promotion'
    } else if (tagText === 'interaction reminder') {
      tag = 'interaction_reminder'
    } else if (tagText === 'intro' || tagText === 'introduction') {
      tag = 'intro'
    } else if (tagText === 'intermission') {
      tag = 'intermission'
    } else if (tagText === 'outro') {
      tag = 'outro'
    } else if (tagText === 'credits') {
      tag = 'credits'
    } else if (tagText === 'non-music' || tagText === 'non music' || tagText === 'nonmusic') {
      tag = 'non_music'
    }
  }

  obj.chapters.push({
    start: start.instant + start.frame / 30,
    name: text,
    tag
  })
}

type TimestampParsed = {
  instant: number,
  frame: number,
  length: number,
}

type TimestampError = {
  error: TimestampErrorInner,
  }
type TimestampErrorInner = {
  kind: string,
  errorString?: string,
}

function parseTimestamp (unparsed: string): TimestampParsed | TimestampError {
  const unit = unparsed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:\+(\d+))?/)
  const sexagesimal = unparsed.match(/^(?:(\d+):)?(\d{1,2}):(\d\d(?:\.\d+)?)(?:\+(\d+))?/)

  if (sexagesimal) {
    const sg = sexagesimal
    var s = 0
    if (sg[1]) {
      s += 3600 * parseInt(sg[1])
    }
    s += 60 * parseInt(sg[2])
    const secondsDigit = parseFloat(sg[3])
    s += secondsDigit

    var frame = 0
    if (sg[4]) {
      if (secondsDigit !== Math.floor(secondsDigit)) {
        return { error: { kind: 'frame_number_and_fractional_seconds' } }
      }
      frame = parseInt(sg[4])
    }

    return {
      instant: s,
      frame: frame,
      length: sg[0].length
    }
  }

  if (unit && unit[0].length !== 0) {
    var s = 0
    if (unit[1]) {
      s += 3600 * parseInt(unit[1])
    }
    if (unit[2]) {
      s += 60 * parseInt(unit[2])
    }
    var secondsSpecified = 0
    if (unit[3]) {
      secondsSpecified = parseFloat(unit[3])
      s += secondsSpecified
    }

    var frame = 0
    if (unit[4]) {
      if (secondsSpecified !== Math.floor(secondsSpecified)) {
        return { error: { kind: 'frame_number_and_fractional_seconds' } }
      }
      frame = parseInt(unit[4])
    }

    return {
      instant: s,
      frame,
      length: unit[0].length
    }
  }

  return { error: { kind: 'unknown_format' } }
}

// convert deprecated `tags` field to replacement `tag` field
export function migrateTags(x: object): [Chapters | null, boolean] {
  var y = x as any
  var modified = false
  
  var description = null
  if (x.hasOwnProperty('description')) {
    description = y.description
  }
  
  var chapters: Chapter[] = []
  if (!x.hasOwnProperty('chapters')) {
    return [null, false]
  } else {
    for (var i = 0; i < y.chapters.length; i++) {
      var start = y.chapters[i].start
      var end = y.chapters[i].end
      var name = y.chapters[i].name
      var tag: Tag
      if (y.chapters[i].hasOwnProperty('tag')) {
        tag = y.chapters[i].tag
      } else if (y.chapters[i].hasOwnProperty('tags')) {
        modified = true
        var tags = y.chapters[i].tags
        if (tags.sponsor) {
          tag = 'sponsor'
        } else if (tags.selfPromotion) {
          tag = 'self_promotion'
        } else if (tags.interactionReminder) {
          tag = 'interaction_reminder'
        } else if (tags.intro) {
          tag = 'intro'
        } else if (tags.intermission) {
          tag = 'intermission'
        } else if (tags.outro) {
          tag = 'outro'
        } else if (tags.credits) {
          tag = 'credits'
        } else if (tags.nonMusic) {
          tag = 'non_music'
        } else {
          tag = null
        }
      } else {
        tag = null
      }
      
      chapters.push({ start, end, name, tag })
    }
  }
  
  const obj = { chapters, description, end: null }
  return [obj, modified]
}

// fill deprecated `tags` field from replacement `tag` field
export function tagsCompatibility(x: Chapters) {
  for (var i = 0; i < x.chapters.length; i++) {
    var tag = x.chapters[i].tag
    var tags: TagsDeprecated = {}
    if (tag == 'sponsor') {
      tags.sponsor = true
    }else if (tag == 'self_promotion') {
      tags.selfPromotion = true
    }else if (tag == 'interaction_reminder') {
      tags.interactionReminder = true
    }else if (tag == 'intro') {
      tags.intro = true
    }else if (tag == 'intermission') {
      tags.intermission = true
    }else if (tag == 'outro') {
      tags.outro = true
    }else if (tag == 'credits') {
      tags.credits = true
    }else if (tag == 'non_music') {
      tags.nonMusic = true
    }
    x.chapters[i].tags = tags
  }
}

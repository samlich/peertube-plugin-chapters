import type { RegisterClientHelpers } from '@peertube/peertube-types/client'
import { marked } from 'marked'

export const tableOfContentsField: string = 'table-of-contents'

export interface Chapters {
  chapters: Chapter[]
  description: string | null
  end: null
}
export interface Chapter {
  start: number
  end?: number
  name: string
  tag: Tag
  tags?: TagsDeprecated
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

interface TagsDeprecated {
  sponsor?: boolean
  selfPromotion?: boolean
  interactionReminder?: boolean
  intro?: boolean
  intermission?: boolean
  outro?: boolean
  credits?: boolean
  nonMusic?: boolean
}

export interface ChaptersError {
  error: ChaptersErrorInner
}
interface ChaptersErrorInner {
  kind: ChaptersErrNonListItem |
  ChaptersErrTimestampNotFragment |
  ChaptersErrBadTimestamp |
  ChaptersErrBadTimestampPartial |
  ChaptersErrBadTimestampStartingLine |
  ChaptersErrNonLink
  errorString?: string
}
interface ChaptersErrNonListItem {
  name: 'non_list_item'
  item: string
}
interface ChaptersErrTimestampNotFragment {
  name: 'timestamp_not_fragment'
}
interface ChaptersErrBadTimestamp {
  name: 'bad_timestamp'
  item: string
  timestampError: TimestampErrorInner
}
interface ChaptersErrBadTimestampPartial {
  name: 'bad_timestamp_partial'
  item: string
  timestampValid: string
  timestamp: string
}
interface ChaptersErrBadTimestampStartingLine {
  name: 'bad_timestamp_starting_line'
  lineText: string
  timestampError: TimestampErrorInner
}
interface ChaptersErrNonLink {
  name: 'non_link'
  item: string
}

export function parseTableOfContents (unparsed: string): Chapters | ChaptersError {
  const ret: Chapters = {
    chapters: [],
    description: null,
    end: null
  }

  if (unparsed.trim().length === 0) {
    return ret
  }

  const markdownTokens = marked.lexer(unparsed)
  if (markdownTokens != null && markdownTokens.length >= 1 && markdownTokens[0].type === 'list') {
    const list = markdownTokens[0]
    const items = list.items
    for (const item of items) {
      if (item.type !== 'list_item') {
        return { error: { kind: { name: 'non_list_item', item: item.text } } }
      }

      if (item.tokens.length > 0 &&
        item.tokens[0].type === 'text') {
        const tokens = (item.tokens[0] as marked.Tokens.Text).tokens
        if (tokens != null &&
        tokens.length > 0 &&
        tokens[0].type === 'link') {
          const link = tokens[0]
          if (!link.href.startsWith('#')) {
            return { error: { kind: { name: 'timestamp_not_fragment' } } }
          } else {
            const timestampText = link.href.slice(1) // == #1m1s
            let timestamp = parseTimestamp(timestampText)
            if (hasOwn(timestamp, 'error')) {
              timestamp = timestamp as TimestampError
              return { error: { kind: { name: 'bad_timestamp', item: item.tokens[0].text, timestampError: timestamp.error } } }
            }
            timestamp = timestamp as TimestampParsed
            if (timestamp.length !== timestampText.trim().length) {
              return { error: { kind: { name: 'bad_timestamp_partial', item: item.tokens[0].text, timestampValid: timestampText.slice(0, timestamp.length), timestamp: timestampText } } }
            }
            const chapterText = link.text
            // var chapter_markdown = link.tokens

            pushChapter(ret, chapterText, timestamp)
          }
        } else {
          return { error: { kind: { name: 'non_link', item: item.text } } }
        }
      } else {
        return { error: { kind: { name: 'non_link', item: item.text } } }
      }
    }
  } else {
    const lines = unparsed.split('\n')
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue
      }
      let timestamp = parseTimestamp(line)
      if (hasOwn(timestamp, 'error')) {
        timestamp = timestamp as TimestampError
        return { error: { kind: { name: 'bad_timestamp_starting_line', lineText: line, timestampError: timestamp.error } } }
      }
      timestamp = timestamp as TimestampParsed
      let text = line.slice(timestamp.length).trim()
      let limit = 0
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
  for (let i = 0; i < ret.chapters.length; i++) {
    const chapter = ret.chapters[i]
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

export async function fillParseTableOfContentsErrorString (peertubeHelpers: RegisterClientHelpers, error: ChaptersErrorInner): Promise<void> {
  try {
    switch (error.kind.name) {
      case 'non_list_item':
        error.errorString = await peertubeHelpers.translate('Non-list item') + ': ' + error.kind.item
        break
      case 'timestamp_not_fragment':
        error.errorString = await peertubeHelpers.translate('Timestamp does not start with "#"')
        break
      case 'bad_timestamp':
        await fillParseTimestampErrorString(peertubeHelpers, error.kind.timestampError)
        if (error.kind.timestampError.errorString == null) {
          error.kind.timestampError.errorString = error.kind.timestampError.kind + ' (unable to access translation service)'
        }
        error.errorString = `${await peertubeHelpers.translate('Failed to parse timestamp for')}" ${error.kind.item}": ${error.kind.timestampError.errorString}`
        break
      case 'bad_timestamp_partial':
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp for') + ' "' + error.kind.item + '"' + await peertubeHelpers.translate(', only ') + '"' + error.kind.timestampValid + '"' + await peertubeHelpers.translate(' of ') + '"' + error.kind.timestamp + '"' + await peertubeHelpers.translate(' is valid.')
        break
      case 'bad_timestamp_starting_line':
        await fillParseTimestampErrorString(peertubeHelpers, error.kind.timestampError)
        if (error.kind.timestampError.errorString == null) {
          error.kind.timestampError.errorString = error.kind.timestampError.kind + ' (unable to access translation service)'
        }
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp at start of') + ' "' + error.kind.lineText + '": ' + error.kind.timestampError.errorString
        break
      case 'non_link':
        error.errorString = await peertubeHelpers.translate('Encountered non-link item') + ', "' + error.kind.item + '"'
        break
      default:
        if (error.errorString === null || error.errorString === undefined) {
          error.errorString = await peertubeHelpers.translate('Unknown error.')
        }
        break
    }
  } catch (e) {
    if (error.errorString === null) {
      error.errorString = error.kind.name + ' (unable to access translation service)'
    }
    console.error('chapters: Failed getting translation for table of contents parsing error message:')
    console.error(e)
  }
}

async function fillParseTimestampErrorString (peertubeHelpers: RegisterClientHelpers, error: TimestampErrorInner): Promise<void> {
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
    const second = instant % 60
    const minute = Math.round((instant - second) / 60 % 60)
    const hour = Math.round((instant - 60 * minute - second) / 3600)

    // `toFixed` rounds the binary representation, e.g. 0.5595 rounds to 0.559
    // https://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function toFixed2 (value: number, precision: number): string {
      const power = Math.pow(10, precision)
      // use regular `toFixed` to always have 3 decimals including trailing zeroes
      return (Math.round(value * power) / power).toFixed(precision)
    }

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${toFixed2(second, 3).padStart(6, '0')}`
  }

  let ret = 'WEBVTT\n\n'
  if (obj.description !== null && obj.description.length !== 0) {
    ret += 'NOTE\n' + obj.description + '\n\n'
  }

  if (obj.chapters.length === 0) {
    return ret
  }

  let chapterNumber = 1
  for (const chapter of obj.chapters) {
    let end = null
    if (chapter.end != null) {
      end = chapter.end
    } else {
      // Giveup and use placeholder
      end = chapter.start + 60
    }

    ret += 'Chapter ' + chapterNumber.toString() + '\n'
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

function pushChapter (obj: Chapters, text: string, start: TimestampParsed): void {
  const tagMatch = text.match(/\((.+)\)/)
  let tag: Tag = null
  if (tagMatch != null) {
    const tagText = tagMatch[1].toLowerCase()
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

interface TimestampParsed {
  instant: number
  frame: number
  length: number
}

interface TimestampError {
  error: TimestampErrorInner
}
interface TimestampErrorInner {
  kind: string
  errorString?: string
}

function parseTimestamp (unparsed: string): TimestampParsed | TimestampError {
  const unit = unparsed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:\+(\d+))?/)
  const sexagesimal = unparsed.match(/^(?:(\d+):)?(\d{1,2}):(\d\d(?:\.\d+)?)(?:\+(\d+))?/)

  if (sexagesimal != null) {
    const sg = sexagesimal
    let s = 0
    if (sg[1] != null) {
      s += 3600 * parseInt(sg[1])
    }
    s += 60 * parseInt(sg[2])
    const secondsDigit = parseFloat(sg[3])
    s += secondsDigit

    let frame = 0
    if (sg[4] != null) {
      if (secondsDigit !== Math.floor(secondsDigit)) {
        return { error: { kind: 'frame_number_and_fractional_seconds' } }
      }
      frame = parseInt(sg[4])
    }

    return {
      instant: s,
      frame,
      length: sg[0].length
    }
  }

  if ((unit != null) && unit[0].length !== 0) {
    let s = 0
    if (unit[1] != null) {
      s += 3600 * parseInt(unit[1])
    }
    if (unit[2] != null) {
      s += 60 * parseInt(unit[2])
    }
    let secondsSpecified = 0
    if (unit[3] != null) {
      secondsSpecified = parseFloat(unit[3])
      s += secondsSpecified
    }

    let frame = 0
    if (unit[4] != null) {
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
export function migrateTags (x: object): [Chapters | null, boolean] {
  const y = x as any
  let modified = false

  let description = null
  if (hasOwn(x, 'description')) {
    description = y.description
  }

  const chapters: Chapter[] = []
  if (!hasOwn(x, 'chapters')) {
    return [null, false]
  } else {
    for (let i = 0; i < y.chapters.length; i++) {
      const start = y.chapters[i].start
      const end = y.chapters[i].end
      const name = y.chapters[i].name
      let tag: Tag
      if (hasOwn(y.chapters[i], 'tag')) {
        tag = y.chapters[i].tag
      } else if (hasOwn(y.chapters[i], 'tags')) {
        modified = true
        const tags = y.chapters[i].tags
        if (tags.sponsor === true) {
          tag = 'sponsor'
        } else if (tags.selfPromotion === true) {
          tag = 'self_promotion'
        } else if (tags.interactionReminder === true) {
          tag = 'interaction_reminder'
        } else if (tags.intro === true) {
          tag = 'intro'
        } else if (tags.intermission === true) {
          tag = 'intermission'
        } else if (tags.outro === true) {
          tag = 'outro'
        } else if (tags.credits === true) {
          tag = 'credits'
        } else if (tags.nonMusic === true) {
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
export function tagsCompatibility (x: Chapters): void {
  for (let i = 0; i < x.chapters.length; i++) {
    const tag = x.chapters[i].tag
    const tags: TagsDeprecated = {}
    if (tag === 'sponsor') {
      tags.sponsor = true
    } else if (tag === 'self_promotion') {
      tags.selfPromotion = true
    } else if (tag === 'interaction_reminder') {
      tags.interactionReminder = true
    } else if (tag === 'intro') {
      tags.intro = true
    } else if (tag === 'intermission') {
      tags.intermission = true
    } else if (tag === 'outro') {
      tags.outro = true
    } else if (tag === 'credits') {
      tags.credits = true
    } else if (tag === 'non_music') {
      tags.nonMusic = true
    }
    x.chapters[i].tags = tags
  }
}

export function hasOwn (x: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(x, property)
}

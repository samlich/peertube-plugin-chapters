// import marked from 'marked' - doesn't work in main.js
const marked = require('marked')

const version = '1.0.2'
const tableOfContentsField = 'table-of-contents'

/*
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

*/
function parseTableOfContents (unparsed) {
  var ret = {
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
      if (item.tokens.length > 0 &&
        item.tokens[0].type === 'text' &&
        item.tokens[0].tokens.length > 0 &&
        item.tokens[0].tokens[0].type === 'link') {
        var link = item.tokens[0].tokens[0]
        if (!link.href.startsWith('#')) {
          return { error: { kind: 'timestamp_not_fragment' } }
        } else {
          const timestampText = link.href.slice(1) // == #1m1s
          var timestamp = parseTimestamp(timestampText)
          if (timestamp.error != null) {
            return { error: { kind: 'bad_timestamp', item: item.tokens[0].text, timestampError: timestamp.error } }
          }
          if (timestamp.length !== timestampText.trim().length) {
            return { error: { kind: 'bad_timestamp_partial', item: item.tokens[0].text, timestampValid: timestampText.slice(0, timestamp.length), timestamp: timestampText } }
          }
          var chapterText = link.text
          // var chapter_markdown = link.tokens

          const result = pushChapter(ret, chapterText, timestamp)
          if (result !== true) {
            // never happens at the moment, so no handling for translation
            return { error: { kind: 'push_chapter', errorString: result } }
          }
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
      const timestamp = parseTimestamp(line)
      if (timestamp.error != null) {
        return { error: { kind: 'bad_timestamp_starting_line', lineText: line, timestampError: timestamp.error } }
      }
      var text = line.slice(timestamp.length).trim()
      var limit = 0
      while (limit < 10000) {
        limit += 1
        if (text.startsWith('-') || text.startsWith(':')) {
          text = text.slice(1).trim()
        }
      }
      const result = pushChapter(ret, text, timestamp)
      if (result !== true) {
        // never happens at the moment, so no handling for translation
        return { error: { kind: 'push_chapter', errorString: result } }
      }
    }
  }

  ret.chapters.sort(function (a, b) { return a.start - b.start })
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

async function fillParseTableOfContentsErrorString (peertubeHelpers, error) {
  try {
    switch (error.kind) {
      case 'non_list_item':
        error.errorString = await peertubeHelpers.translate('Non-list item') + ': ' + error.item
        break
      case 'timestamp_not_fragment':
        error.errorString = await peertubeHelpers.translate('Timestamp does not start with "#"')
        break
      case 'bad_timestamp':
        await fillParseTimestampErrorString(peertubeHelpers, error.timestampError)
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp for') + '" ' + error.item + '": ' + error.timestampError.errorString
        break
      case 'bad_timestamp_partial':
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp for') + ' "' + error.item + '"' + await peertubeHelpers.translate(', only ') + '"' + error.timestampValid + '"' + await peertubeHelpers.translate(' of ') + '"' + error.timestamp + '"' + await peertubeHelpers.translate(' is valid.')
        break
      case 'bad_timestamp_starting_line':
        await fillParseTimestampErrorString(peertubeHelpers, error.timestampError)
        error.errorString = await peertubeHelpers.translate('Failed to parse timestamp at start of') + ' "' + error.lineText + '": ' + error.timestampError.errorString
        break
      case 'non_link':
        error.errorString = await peertubeHelpers.translate('Encountered non-link item') + ', "' + error.item + '"'
        break
      default:
        if (error.errorString === null) {
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

async function fillParseTimestampErrorString (peertubeHelpers, error) {
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

function toWebVtt (obj, json) {
  function webVttTimestamp (instant) {
    var second = instant % 60
    const minute = Math.round((instant - second) / 60 % 60)
    const hour = Math.round((instant - 60 * minute - second) / 3600)

    // `toFixed` rounds the binary representation, e.g. 0.5595 rounds to 0.559
    // https://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function toFixed2 (value, precision) {
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

function pushChapter (obj, text, start) {
  var tag = text.match(/\((.+)\)/)
  var tags = {}
  if (tag) {
    tag = tag[1].toLowerCase()
    if (tag === 'sponsor') {
      tags.sponsor = true
    } else if (tag === 'self-promotion' || tag === 'self promotion') {
      tags.selfPromotion = true
    } else if (tag === 'interaction reminder') {
      tags.interactionReminder = true
    } else if (tag === 'intro' || tag === 'introduction') {
      tags.intro = true
    } else if (tag === 'intermission') {
      tags.intermission = true
    } else if (tag === 'outro') {
      tags.outro = true
    } else if (tag === 'credits') {
      tags.credits = true
    } else if (tag === 'non-music' || tag === 'non music' || tag === 'nonmusic') {
      tags.nonMusic = true
    }
  }

  obj.chapters.push({
    start: start.instant + start.frame / 30,
    name: text,
    tags: tags
  })
  return true
}

function parseTimestamp (unparsed) {
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
      s += 3600 * unit[1]
    }
    if (unit[2]) {
      s += 60 * unit[2]
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

module.exports = {
  version,
  tableOfContentsField,
  parseTableOfContents,
  fillParseTableOfContentsErrorString,
  toWebVtt
}

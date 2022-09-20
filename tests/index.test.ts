import { Chapters, migrateTags, parseTableOfContents, tagsCompatibility, toWebVtt } from '../shared/common'

describe('parsing', () => {
  test('empty', () => {
    expect(parseTableOfContents('')).toStrictEqual({
      chapters: [],
      description: null,
      end: null
    })
  })

  test('list', () => {
    expect(parseTableOfContents(
`0:00 One
0:05.3 Two
0:11.34 Three`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('list_separated', () => {
    expect(parseTableOfContents(
`0:00: One
0:05.3: Two
0:11.34: Three
0h12.34s: Four
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          end: 12.34,
          tag: null
        },
        {
          name: 'Four',
          start: 12.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('list_separated_2', () => {
    expect(parseTableOfContents(
`0:00 - One
0:05.3 - Two
0:11.34 - Three
0h12.34s - Four
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          end: 12.34,
          tag: null
        },
        {
          name: 'Four',
          start: 12.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('list_separated_mixed', () => {
    expect(parseTableOfContents(
`0:00: One
0:05.3 - Two
0:11.34 Three
0h12.34s: Four
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          end: 12.34,
          tag: null
        },
        {
          name: 'Four',
          start: 12.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('markdown', () => {
    expect(parseTableOfContents(
`1. [One](#0:00)
1. [Two](#0:05.3)
1. [Three](#0:11.34)
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('markdown_unordered', () => {
    expect(parseTableOfContents(
`- [One](#0:00)
- [Two](#0:05.3)
- [Three](#0:11.34)
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          start: 0,
          end: 5.3,
          tag: null
        },
        {
          name: 'Two',
          start: 5.3,
          end: 11.34,
          tag: null
        },
        {
          name: 'Three',
          start: 11.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('list tag', () => {
    expect(parseTableOfContents(
`0:00 One (Intro)
0:05.3 Two (Sponsor)
0:11.34 Three`)).toStrictEqual({
      chapters: [
        {
          name: 'One (Intro)',
          start: 0,
          end: 5.3,
          tag: 'intro'
        },
        {
          name: 'Two (Sponsor)',
          start: 5.3,
          end: 11.34,
          tag: 'sponsor'
        },
        {
          name: 'Three',
          start: 11.34,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('markdown tag', () => {
    expect(parseTableOfContents(
`1. [One (Intro)](#0:00)
1. [Two (Sponsor)](#0:05.3)
1. [Three](#0:11.34)
1. [Four (Self-promotion)](#0:14)
1. [Five (Self promotion)](#0:15)
1. [VI (Interaction reminder)](#0:16)
1. [Sieben (Introduction)](#0:17)
1. [Ate (Intermission)](#0:18)
1. [Nein (Outro)](#0:19)
1. [Dies (Credits)](#0:20)
1. [Elves (Non-music)](#0:21)
1. [Dwarves underground (Non music)](#0:22)
1. [Pandas with bamboo (Nonmusic)](#0:23)
`)).toStrictEqual({
      chapters: [
        {
          name: 'One (Intro)',
          start: 0,
          end: 5.3,
          tag: 'intro'
        },
        {
          name: 'Two (Sponsor)',
          start: 5.3,
          end: 11.34,
          tag: 'sponsor'
        },
        {
          name: 'Three',
          start: 11.34,
          end: 14,
          tag: null
        },
        {
          name: 'Four (Self-promotion)',
          start: 14,
          end: 15,
          tag: 'self_promotion'
        },
        {
          name: 'Five (Self promotion)',
          start: 15,
          end: 16,
          tag: 'self_promotion'
        },
        {
          name: 'VI (Interaction reminder)',
          start: 16,
          end: 17,
          tag: 'interaction_reminder'
        },
        {
          name: 'Sieben (Introduction)',
          start: 17,
          end: 18,
          tag: 'intro'
        },
        {
          name: 'Ate (Intermission)',
          start: 18,
          end: 19,
          tag: 'intermission'
        },
        {
          name: 'Nein (Outro)',
          start: 19,
          end: 20,
          tag: 'outro'
        },
        {
          name: 'Dies (Credits)',
          start: 20,
          end: 21,
          tag: 'credits'
        },
        {
          name: 'Elves (Non-music)',
          start: 21,
          end: 22,
          tag: 'non_music'
        },
        {
          name: 'Dwarves underground (Non music)',
          start: 22,
          end: 23,
          tag: 'non_music'
        },
        {
          name: 'Pandas with bamboo (Nonmusic)',
          start: 23,
          tag: 'non_music'
        }
      ],
      description: null,
      end: null
    })
  })

  test('list timestamp', () => {
    expect(parseTableOfContents(
`0:00+5 One
2:00+23 Two
3:03 Three
3:04.5 Four
3:04.55555 Five
6m5s Six
6m7.77s Seven
8h6m7.77s Eight
9:53:20 Nine
10:53:20.3 Ten
11h7s Eleven
12h Twelve
00:01:20.3 Out of order
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          // we don't actually know the framerate, but whatever
          start: 5 / 30,
          end: 1 * 60 + 20.3,
          tag: null
        },
        {
          name: 'Out of order',
          start: 1 * 60 + 20.3,
          end: 2 * 60 + 23 / 30,
          tag: null
        },
        {
          name: 'Two',
          start: 2 * 60 + 23 / 30,
          end: 3 * 60 + 3,
          tag: null
        },
        {
          name: 'Three',
          start: 3 * 60 + 3,
          end: 3 * 60 + 4.5,
          tag: null
        },
        {
          name: 'Four',
          start: 3 * 60 + 4.5,
          end: 3 * 60 + 4.55555,
          tag: null
        },
        {
          name: 'Five',
          start: 3 * 60 + 4.55555,
          end: 6 * 60 + 5,
          tag: null
        },
        {
          name: 'Six',
          start: 6 * 60 + 5,
          end: 6 * 60 + 7.77,
          tag: null
        },
        {
          name: 'Seven',
          start: 6 * 60 + 7.77,
          end: 8 * 3600 + 6 * 60 + 7.77,
          tag: null
        },
        {
          name: 'Eight',
          start: 8 * 3600 + 6 * 60 + 7.77,
          end: 9 * 3600 + 53 * 60 + 20,
          tag: null
        },
        {
          name: 'Nine',
          start: 9 * 3600 + 53 * 60 + 20,
          end: 10 * 3600 + 53 * 60 + 20.3,
          tag: null
        },
        {
          name: 'Ten',
          start: 10 * 3600 + 53 * 60 + 20.3,
          end: 11 * 3600 + 7,
          tag: null
        },
        {
          name: 'Eleven',
          start: 11 * 3600 + 7,
          end: 12 * 3600,
          tag: null
        },
        {
          name: 'Twelve',
          start: 12 * 3600,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('markdown_timestamp', () => {
    expect(parseTableOfContents(
`1. [One](#0:00+5)
1. [Two](#2:00+23)
1. [Three](#3:03)
1. [Four](#3:04.5)
1. [Five](#3:04.55555)
1. [Six](#6m5s)
1. [Seven](#6m7.77s)
1. [Eight](#8h6m7.77s)
1. [Nine](#9:53:20)
1. [Ten](#10:53:20.3)
1. [Eleven](#11h7s)
1. [Twelve](#12h)
1. [Out of order](#00:01:20.3)
`)).toStrictEqual({
      chapters: [
        {
          name: 'One',
          // we don't actually know the framerate, but whatever
          start: 5 / 30,
          end: 1 * 60 + 20.3,
          tag: null
        },
        {
          name: 'Out of order',
          start: 1 * 60 + 20.3,
          end: 2 * 60 + 23 / 30,
          tag: null
        },
        {
          name: 'Two',
          start: 2 * 60 + 23 / 30,
          end: 3 * 60 + 3,
          tag: null
        },
        {
          name: 'Three',
          start: 3 * 60 + 3,
          end: 3 * 60 + 4.5,
          tag: null
        },
        {
          name: 'Four',
          start: 3 * 60 + 4.5,
          end: 3 * 60 + 4.55555,
          tag: null
        },
        {
          name: 'Five',
          start: 3 * 60 + 4.55555,
          end: 6 * 60 + 5,
          tag: null
        },
        {
          name: 'Six',
          start: 6 * 60 + 5,
          end: 6 * 60 + 7.77,
          tag: null
        },
        {
          name: 'Seven',
          start: 6 * 60 + 7.77,
          end: 8 * 3600 + 6 * 60 + 7.77,
          tag: null
        },
        {
          name: 'Eight',
          start: 8 * 3600 + 6 * 60 + 7.77,
          end: 9 * 3600 + 53 * 60 + 20,
          tag: null
        },
        {
          name: 'Nine',
          start: 9 * 3600 + 53 * 60 + 20,
          end: 10 * 3600 + 53 * 60 + 20.3,
          tag: null
        },
        {
          name: 'Ten',
          start: 10 * 3600 + 53 * 60 + 20.3,
          end: 11 * 3600 + 7,
          tag: null
        },
        {
          name: 'Eleven',
          start: 11 * 3600 + 7,
          end: 12 * 3600,
          tag: null
        },
        {
          name: 'Twelve',
          start: 12 * 3600,
          tag: null
        }
      ],
      description: null,
      end: null
    })
  })

  test('garbage', () => {
    expect(parseTableOfContents('a')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp_starting_line',
          lineText: 'a',
          timestampError: {
            kind: 'unknown_format'
          }
        }
      }
    })
  })

  test('short_seconds', () => {
    expect(parseTableOfContents('0:1 a')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp_starting_line',
          lineText: '0:1 a',
          timestampError: {
            kind: 'unknown_format'
          }
        }
      }
    })
  })

  test('missing_seconds', () => {
    expect(parseTableOfContents('0: a')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp_starting_line',
          lineText: '0: a',
          timestampError: {
            kind: 'unknown_format'
          }
        }
      }
    })
  })

  test('markdown_non_link', () => {
    expect(parseTableOfContents(
`- [a](#0:00)
- Wat`)).toStrictEqual({
      error: {
        kind: {
          name: 'non_link',
          item: 'Wat'
        }
      }
    })
  })

  test('markdown_timestamp_not_fragment', () => {
    expect(parseTableOfContents(
      '- [a](0:00)')).toStrictEqual({
      error: {
        kind: {
          name: 'timestamp_not_fragment'
        }
      }
    })
  })

  test('markdown_timestamp_not_fragment_2', () => {
    expect(parseTableOfContents(
      '- [a](/things#0:00)')).toStrictEqual({
      error: {
        kind: {
          name: 'timestamp_not_fragment'
        }
      }
    })
  })

  test('markdown_bad_timestamp', () => {
    expect(parseTableOfContents(
      '- [a](#0:0)')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp',
          item: '[a](#0:0)',
          timestampError: {
            kind: 'unknown_format'
          }
        }
      }
    })
  })

  test('markdown_bad_timestamp_partial', () => {
    expect(parseTableOfContents(
      '- [a](#0:123)')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp_partial',
          item: '[a](#0:123)',
          timestamp: '0:123',
          timestampValid: '0:12'
        }
      }
    })
  })

  test('markdown_bad_timestamp_partial_hms', () => {
    expect(parseTableOfContents(
      '- [a](#1h3m4d)')).toStrictEqual({
      error: {
        kind: {
          name: 'bad_timestamp_partial',
          item: '[a](#1h3m4d)',
          timestamp: '1h3m4d',
          timestampValid: '1h3m'
        }
      }
    })
  })
})

describe('to_webvtt', () => {
  test('markdown_timestamp', () => {
    expect(toWebVtt(parseTableOfContents(
`1. [One](#0:00+5)
1. [Two](#2:00+23)
1. [Three](#3:03)
1. [Four](#3:04.5)
1. [Five](#3:04.55555)
1. [Six](#6m5s)
1. [Seven](#6m7.77s)
1. [Eight](#8h6m7.77s)
1. [Nine](#9:53:20)
1. [Ten](#10:53:20.3)
1. [Eleven](#11h7s)
1. [Twelve](#12h)
1. [Out of order](#00:01:20.3)
`) as Chapters)).toStrictEqual(
`WEBVTT

Chapter 1
00:00:00.167 --> 00:01:20.300
One

Chapter 2
00:01:20.300 --> 00:02:00.767
Out of order

Chapter 3
00:02:00.767 --> 00:03:03.000
Two

Chapter 4
00:03:03.000 --> 00:03:04.500
Three

Chapter 5
00:03:04.500 --> 00:03:04.556
Four

Chapter 6
00:03:04.556 --> 00:06:05.000
Five

Chapter 7
00:06:05.000 --> 00:06:07.770
Six

Chapter 8
00:06:07.770 --> 08:06:07.770
Seven

Chapter 9
08:06:07.770 --> 09:53:20.000
Eight

Chapter 10
09:53:20.000 --> 10:53:20.300
Nine

Chapter 11
10:53:20.300 --> 11:00:07.000
Ten

Chapter 12
11:00:07.000 --> 12:00:00.000
Eleven

Chapter 13
12:00:00.000 --> 12:01:00.000
Twelve

`)
  })
})

describe('migrate', () => {
  test('migrate_tags', () => {
    expect(migrateTags({
      chapters: [
        {
          end: 2,
          name: '(Intro)',
          start: 0,
          tags: {
            intro: true
          }
        }, {
          end: 4,
          name: 'The First Bit',
          start: 2,
          tags: {}
        }, {
          end: 20,
          name: 'Start',
          start: 4,
          tags: {}
        }, {
          end: 30,
          name: '(Sponsor) Bird',
          start: 20,
          tags: { sponsor: true }
        }, {
          end: 50,
          name: 'The Dwelling',
          start: 30,
          tags: {}
        }, {
          end: 55,
          name: '(Sponsor) Second sponsor',
          start: 50,
          tags: { sponsor: true }
        }, {
          end: 108,
          name: '(Sponsor) Another sponsor',
          start: 55,
          tags: { sponsor: true }
        }, {
          end: 113,
          name: 'Butterfly',
          start: 108,
          tags: {}
        }, {
          end: 157,
          name: '(Sponsor)',
          start: 113,
          tags: { sponsor: true }
        }, {
          end: 495,
          name: 'Squirrels',
          start: 157,
          tags: {}
        }, {
          name: '(Credits)',
          start: 495,
          tags: { credits: true }
        }],
      description: 'Very cool',
      end: null
    })).toStrictEqual(
      [
        {
          chapters:
          [
            { end: 2, name: '(Intro)', start: 0, tag: 'intro' },
            { end: 4, name: 'The First Bit', start: 2, tag: null },
            { end: 20, name: 'Start', start: 4, tag: null },
            { end: 30, name: '(Sponsor) Bird', start: 20, tag: 'sponsor' },
            { end: 50, name: 'The Dwelling', start: 30, tag: null },
            { end: 55, name: '(Sponsor) Second sponsor', start: 50, tag: 'sponsor' },
            { end: 108, name: '(Sponsor) Another sponsor', start: 55, tag: 'sponsor' },
            { end: 113, name: 'Butterfly', start: 108, tag: null },
            { end: 157, name: '(Sponsor)', start: 113, tag: 'sponsor' },
            { end: 495, name: 'Squirrels', start: 157, tag: null },
            { end: undefined, name: '(Credits)', start: 495, tag: 'credits' }
          ],
          description: 'Very cool',
          end: null
        }, true])
  })

  test('migrate_unchanged', () => {
    expect(migrateTags({
      chapters:
          [
            { end: 2, name: '(Intro)', start: 0, tag: 'intro' },
            { end: 4, name: 'The First Bit', start: 2, tag: null },
            { end: 20, name: 'Start', start: 4, tag: null },
            { end: 30, name: '(Sponsor) Bird', start: 20, tag: 'sponsor' },
            { end: 50, name: 'The Dwelling', start: 30, tag: null },
            { end: 55, name: '(Sponsor) Second sponsor', start: 50, tag: 'sponsor' },
            { end: 108, name: '(Sponsor) Another sponsor', start: 55, tag: 'sponsor' },
            { end: 113, name: 'Butterfly', start: 108, tag: null },
            { end: 157, name: '(Sponsor)', start: 113, tag: 'sponsor' },
            { end: 495, name: 'Squirrels', start: 157, tag: null },
            { name: '(Credits)', start: 495, tag: 'credits' }
          ],
      description: 'Very cool',
      end: null
    })).toStrictEqual(
      [
        {
          chapters:
          [
            { end: 2, name: '(Intro)', start: 0, tag: 'intro' },
            { end: 4, name: 'The First Bit', start: 2, tag: null },
            { end: 20, name: 'Start', start: 4, tag: null },
            { end: 30, name: '(Sponsor) Bird', start: 20, tag: 'sponsor' },
            { end: 50, name: 'The Dwelling', start: 30, tag: null },
            { end: 55, name: '(Sponsor) Second sponsor', start: 50, tag: 'sponsor' },
            { end: 108, name: '(Sponsor) Another sponsor', start: 55, tag: 'sponsor' },
            { end: 113, name: 'Butterfly', start: 108, tag: null },
            { end: 157, name: '(Sponsor)', start: 113, tag: 'sponsor' },
            { end: 495, name: 'Squirrels', start: 157, tag: null },
            { end: undefined, name: '(Credits)', start: 495, tag: 'credits' }
          ],
          description: 'Very cool',
          end: null
        }, false])
  })

  test('migrate_malformed', () => {
    expect(migrateTags({
      description: 'Very cool',
      end: null
    })).toStrictEqual([null, false])
  })

  test('compatibility', () => {
    const chapters: Chapters = {
      chapters:
          [
            { end: 2, name: '(Intro)', start: 0, tag: 'intro' },
            { end: 4, name: 'The First Bit', start: 2, tag: null },
            { end: 20, name: 'Start', start: 4, tag: null },
            { end: 30, name: '(Sponsor) Bird', start: 20, tag: 'sponsor' },
            { end: 50, name: 'The Dwelling', start: 30, tag: null },
            { end: 55, name: '(Sponsor) Second sponsor', start: 50, tag: 'sponsor' },
            { end: 108, name: '(Sponsor) Another sponsor', start: 55, tag: 'sponsor' },
            { end: 113, name: 'Butterfly', start: 108, tag: null },
            { end: 157, name: '(Sponsor)', start: 113, tag: 'sponsor' },
            { end: 495, name: 'Squirrels', start: 157, tag: null },
            { name: '(Credits)', start: 495, tag: 'credits' }
          ],
      description: 'Very cool',
      end: null
    }
    tagsCompatibility(chapters)
    expect(chapters).toStrictEqual(
      {
        chapters:
          [
            { end: 2, name: '(Intro)', start: 0, tag: 'intro', tags: { intro: true } },
            { end: 4, name: 'The First Bit', start: 2, tag: null, tags: {} },
            { end: 20, name: 'Start', start: 4, tag: null, tags: {} },
            { end: 30, name: '(Sponsor) Bird', start: 20, tag: 'sponsor', tags: { sponsor: true } },
            { end: 50, name: 'The Dwelling', start: 30, tag: null, tags: {} },
            { end: 55, name: '(Sponsor) Second sponsor', start: 50, tag: 'sponsor', tags: { sponsor: true } },
            { end: 108, name: '(Sponsor) Another sponsor', start: 55, tag: 'sponsor', tags: { sponsor: true } },
            { end: 113, name: 'Butterfly', start: 108, tag: null, tags: {} },
            { end: 157, name: '(Sponsor)', start: 113, tag: 'sponsor', tags: { sponsor: true } },
            { end: 495, name: 'Squirrels', start: 157, tag: null, tags: {} },
            { name: '(Credits)', start: 495, tag: 'credits', tags: { credits: true } }
          ],
        description: 'Very cool',
        end: null
      })
  })
})

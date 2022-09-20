import type { RegisterClientFormFieldOptions } from '@peertube/peertube-types'
import type { RegisterClientHelpers, RegisterClientOptions } from '@peertube/peertube-types/client'
import { tableOfContentsField, parseTableOfContents, fillParseTableOfContentsErrorString, toWebVtt, Chapters, ChaptersError, hasOwn } from 'shared/common'

const types: Array<'upload' | 'import-url' | 'import-torrent' | 'update' | 'go-live'> = ['upload', 'import-url', 'import-torrent', 'update']

export async function register ({ registerVideoField, peertubeHelpers }: RegisterClientOptions): Promise<void> {
  // Add table of contents option
  const commonOptions: RegisterClientFormFieldOptions = {
    name: tableOfContentsField,
    label: await peertubeHelpers.translate('Table of contents'),
    descriptionHTML: await peertubeHelpers.translate(
      'You can use a Markdown format, e.g. "20. [Tim the Enchanter](#1h3m44.7s)", or a simple text format such as "1:03:44 Tim the Enchanter".<br/><br/>' +
      'A chapter that doesn\'t provide unique information and may want to be skipped can be marked with a special category including "Sponsor", "Self-promotion", "Interaction reminder", "Intro", "Intermission", "Outro", "Credits", or "Non-music". These tags are recognized when they are placed in parenthesis at the start of a title, e.g. "13. [(Sponsor) About Bob\'s Beans](#1m3s)".<br/><br/>' +
      'In the simple text case, separators will be removed, such as "1:03:44 - Tim the Enchanter" being equivalent to the above. The Markdown format allows specifying subchapters with a four space indent, the simple text format recognizes indents before the timestamp.<br/><br/>' +
        'Timestamps can be colon-separated, e.g. 0:00.00, where the smallest unit is a second, or unit-separated such as 0h0m0.0s.<br/><br/>' +
        'Thumbnails can be specified in the markdown format by writing the timestamp like "?thumbnail=1m5s+3#1m3s".'
    ),
    type: 'input-textarea',
    default: ''
  }
  for (const type of types) {
    const videoFormOptions = { type }
    registerVideoField(commonOptions, videoFormOptions)
  }
  setTimeout(() => {
    finishAddTableOfContentsField(peertubeHelpers).catch(err => console.error('chapter: ' + String(err)))
  }, 50)
}

async function sleep (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function finishAddTableOfContentsField (peertubeHelpers: RegisterClientHelpers): Promise<void> {
  let element: HTMLTextAreaElement | null = null
  while (element == null) {
    element = document.getElementById(tableOfContentsField) as HTMLTextAreaElement | null
    // The element is not added until the user switches to the "Plugin settings" tab
    if (element == null) {
      await sleep(3000)
    }
  }

  // var previewEl = document.createElement('div')
  // previewEl.id = tableOfContentsField + '-preview'
  // element.parentNode.appendChild(previewEl)

  let valid = true

  async function update (): Promise<void> {
    if (element == null) {
      throw new Error('typescript unreachable')
    }

    let parsed = parseTableOfContents(element.value)
    if (!hasOwn(parsed, 'error')) {
      parsed = parsed as Chapters
      if (!valid) {
        valid = true

        element.classList.remove('ng-invalid')
        element.classList.add('ng-valid')

        const errorElRemove = document.getElementById(tableOfContentsField + '-error')
        if (errorElRemove != null) {
          if (errorElRemove.parentNode == null) {
            throw new Error('errorEl is root')
          }
          errorElRemove.parentNode.removeChild(errorElRemove)
        }
      }

      if (parsed.chapters.length === 0) {
        element.title = ''
      // previewEl.innerText = ''
      } else {
        element.title = toWebVtt(parsed)
      // previewEl.innerText = toWebVtt(parsed)
      }
    } else {
      parsed = parsed as ChaptersError
      if (valid) {
        valid = false

        element.classList.remove('ng-valid')
        element.classList.add('ng-invalid')

        element.title = ''
      // previewEl.innerText = ''
      }

      let errorEl = document.getElementById(tableOfContentsField + '-error')
      if (errorEl == null) {
        errorEl = document.createElement('div')
        errorEl.id = tableOfContentsField + '-error'
        errorEl.classList.add('form-error')
        if (element.parentNode == null) {
          throw new Error('unreachable element is root')
        }
        element.parentNode.appendChild(errorEl)
      }

      await fillParseTableOfContentsErrorString(peertubeHelpers, parsed.error)
      if (parsed.error.errorString == null) {
        throw new Error('parsed.error.errorString null')
      }
      errorEl.innerText = parsed.error.errorString
    }
  }

  element.addEventListener('input', () => {
    update().catch(err => console.error('chapters: ' + String(err)))
  })

  await update()
}

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
      'Specify chapters in the form "1:03:44 Tim the Enchanter".<br/><br/>' +
      'A chapter that doesn\'t provide unique information, and may want to be skipped, can be marked with a special category, including "Sponsor", "Self-promotion", "Interaction reminder", "Intro", "Intermission", "Outro", "Credits", or "Non-music". These tags are recognized when they are placed in parenthesis at the start of a title, e.g. "5:03 (Sponsor) About Bob\'s Beans".<br/><br/>' +
      'See <a href="https://samli.ch/projects/peertube-chapters/#usage">more details here</a>.'
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

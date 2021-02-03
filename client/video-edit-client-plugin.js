import { version, tableOfContentsField, parseTableOfContents, toWebVtt } from './common.js'

async function register ({ registerVideoField, peertubeHelpers }) {
  // Add table of contents option
  const commonOptions = {
    name: tableOfContentsField,
    label: await peertubeHelpers.translate('Table of contents'),
    descriptionHTML: await peertubeHelpers.translate(
      'You can use a Markdown format, e.g. "20. [Tim the Enchanter](#1h3m44.7s)", or a simple text format such as "1:03:44 Tim the Enchanter".<br/><br/>' +
      'A chapter that doesn\'t provide unique information and may want to be skipped can be marked with a special category including "Sponsor", "Self-promotion", "Interaction reminder", "Intro", "Intermission", "Outro", "Credits", or "Non-music". These tags are recognized when they are placed in parenthesis at the start of a title, e.g. "13. [(Sponsor) About Bob\'s Beans](#1m3s)".<br/><br/>' +
      'In the simple text case, separators will be removed, such as "1:03:44 - Tim the Enchanter" being equivalent to the above. The Markdown format allows specifying subchapters with a four space indent, the simple text format recognizes indents before the timestamp.<br/><br/>' +
      'Timestamps can be colon-separated, e.g. 0:00.00, where the smallest unit is a second, or unit-separated such as 0h0m0.0s.'
    ),
    type: 'input-textarea',
    default: ''
  }
  for (const type of ['upload', 'import-url', 'import-torrent', 'update']) {
    const videoFormOptions = { type}
    registerVideoField(commonOptions, videoFormOptions)
  }
  finishAddTableOfContentsField()
}

function finishAddTableOfContentsField () {
  var element = document.getElementById(tableOfContentsField)
  // The element is not added until the user switches to the "Plugin settings" tab
  if (element == null) {
    setTimeout(() => {
      finishAddTableOfContentsField()}, 3000)
    return
  }

  // var previewEl = document.createElement('div')
  // previewEl.id = tableOfContentsField + '-preview'
  // element.parentNode.appendChild(previewEl)

  var valid = true

  function update () {
    const parsed = parseTableOfContents(element.value)
    if (parsed.errorString == null) {
      if (!valid) {
        valid = true

        element.classList.remove('ng-invalid')
        element.classList.add('ng-valid')

        var errorElRemove = document.getElementById(tableOfContentsField + '-error')
        if (errorElRemove != null) {
          errorElRemove.parentNode.removeChild(errorElRemove)
        }
      }

      if (parsed.chapters.length == 0) {
        element.title = ''
      // previewEl.innerText = ''
      }else {
        element.title = toWebVtt(parsed)
      // previewEl.innerText = toWebVtt(parsed)
      }
    }else {
      if (valid) {
        valid = false

        element.classList.remove('ng-valid')
        element.classList.add('ng-invalid')

        element.title = ''
      // previewEl.innerText = ''
      }

      var errorEl = document.getElementById(tableOfContentsField + '-error')
      if (errorEl == null) {
        errorEl = document.createElement('div')
        errorEl.id = tableOfContentsField + '-error'
        errorEl.classList.add('form-error')
        element.parentNode.appendChild(errorEl)
      }
      errorEl.innerText = parsed.errorString
    }
  }

  element.addEventListener('input', (event) => {
    update()})
  update()
}

export { register}

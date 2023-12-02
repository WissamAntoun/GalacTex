class CustomEndpoint {

  constructor(endpoint, temperature, maxTokens, topP, topK) {
    this.endpoint = endpoint
    this.temperature = temperature
    this.maxTokens = maxTokens
    this.topP = topP
    this.topK = topK
  }

  query(data) {
    return new Promise((resolve, reject) => {
      const url = `${this.endpoint}`

      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      // TODO: add authorization header
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return
        if (xhr.status !== 200) return reject('Failed to query Custom Endpoint.')

        const jsonResponse = JSON.parse(xhr.responseText)

        if (!jsonResponse) return reject('Failed to query Custom Endpoint.')
        return resolve(jsonResponse)
      }
      xhr.send(JSON.stringify(data))
    })
  }

  async completeText(text) {
    const data = {
      inputs: text,
      parameters: {
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        top_p: this.topP,
        top_k: this.topK,
      },
    }

    log(`Sending request to ${this.endpoint}`)
    log(`Parameters: ${JSON.stringify(data['parameters'])}`)

    const startTime = performance.now();

    const result = await this.query(data);

    const endTime = performance.now();
    const elapsedTime = endTime - startTime;

    log(`Result: ${JSON.stringify(result)}`)
    log(`Response Time: ${elapsedTime}ms`)

    return result.generated_text;
  }

}

function replaceSelectedText(replacementText, selection) {
  const sel = selection === undefined ? window.getSelection() : selection

  if (sel.rangeCount) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(replacementText))
    // Move the caret immediately after the inserted text
    range.setStartAfter(range.endContainer, range.endOffset)
  }
}

function insertTextAtCursor(text) {
  const sel = window.getSelection()
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(document.createTextNode(text))
  // Move the caret immediately after the inserted text
  range.setStartAfter(range.endContainer, range.endOffset)
}

async function settingIsEnabled(key) {
  return chrome.storage.local.get(key)
    .then(setting => 'enabled' === setting[key].status)
    .catch(() => false)
}

function commentText(text) {
  const regexPattern = /\n/g
  const replacementString = '\n%'
  let comment = text.replace(regexPattern, replacementString)
  if (!comment.startsWith('%')) {
    comment = '%' + comment
  }
  return comment
}


function getActiveLineIndex() {
  var gutter = document.querySelector('.cm-lineNumbers');
  var lines = Array.from(gutter.querySelectorAll('.cm-gutterElement'));
  var activeLineNumber = lines.findIndex(function (line) {
    return line.classList.contains('cm-activeLineGutter');
  });
  return activeLineNumber;
}

function getTextBeforeCursor() {
  var editorElement = document.querySelector('.cm-content');
  log(`Editor element: ${editorElement}`)
  var activeLineIndex = getActiveLineIndex();
  log(`Active line: ${activeLineIndex}`)
  if (!activeLineIndex) {
    log('No active line found.')
    return ''; // No active line found
  }

  // Get all lines before the active line
  var lines = Array.from(editorElement.querySelectorAll('.cm-line'));
  var linesBeforeCursor = lines.slice(0, activeLineIndex);

  // Extract text from each line
  var textArray = linesBeforeCursor.map(function (line) {
    return line.textContent;
  });

  return textArray.join('\n');
}

async function autoCompleteTextHandler(customEndpoint) {
  if (!(await settingIsEnabled('AutoComplete'))) throw new Error('Text Auto-Complete is not enabled.')
  const text = getTextBeforeCursor()
  log(`Prompt:\n${text}`)
  if (!text) return
  const newText = await customEndpoint.completeText(text)
  log(`New text:\n${newText}`)
  insertTextAtCursor(newText)
}

async function autoCompleteSelectedTextHandler(customEndpoint) {
  if (!(await settingIsEnabled('AutoCompleteSelected'))) throw new Error('Selected Text Auto-Complete is not enabled.')
  const selection = window.getSelection()
  const selectedText = selection.toString()
  if (!selectedText) return
  const newText = await customEndpoint.completeText(selectedText)
  replaceSelectedText(selectedText + '\n' + newText, selection)
}

let endpointUrl
let customEndpoint = undefined

function cleanup() {
}




function setEndpoint(url, temperature, max_tokens, top_p, top_k) {
  cleanup()
  if (url) {
    customEndpoint = new CustomEndpoint(url, temperature, max_tokens, top_p, top_k)
    log('Custom Endpoint set, enabling GalacTex features.')
  } else {
    customEndpoint = undefined
    log('Custom Endpoint is not set, GalacTex features are disabled.')
  }
}

function handleCommand(command) {
  if (command === 'AutoComplete') {
    autoCompleteTextHandler(customEndpoint).catch(e => error(`Failed to execute the '${command}' command.`, e))
  } else if (command === 'AutoCompleteSelected') {
    autoCompleteSelectedTextHandler(customEndpoint).catch(e => error(`Failed to execute the '${command}' command.`, e))
  }
}

function error(msg, error) {
  if (error) {
    msg += ` Error message: ${error.message}`
    if (error.cause) {
      console.error(`\nCause: ${JSON.stringify(error.cause)}`)
    }
  }
  customAlert(msg)
  console.error(`GalacTex: ${msg}`)
}

function log(msg) {
  console.log(`GalacTex: ${msg}`)
}

function customAlert(msg, duration) {
  if (!duration) duration = 4000;
  var styler = document.createElement("div");
  styler.setAttribute("class", "system-message-content alert");
  styler.setAttribute("style", "z-index:10000;position:absolute;top:20%;left:50%;border: solid 5px Red;background-color:#444;color:Silver");
  styler.innerHTML = msg;
  setTimeout(function () {
    styler.parentNode.removeChild(styler);
  }, duration);
  document.body.appendChild(styler);
}

var serverEndpoint = undefined
var temperature = undefined
var max_tokens = undefined
var top_p = undefined
var top_k = undefined

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    log(`Received request: ${JSON.stringify(request)}`)
    if (request.command === 'setup') {
      // setAPIKey(request.apiKey)
      setEndpoint(request.endpointUrl)
    } else {
      if (!customEndpoint) {
        chrome.storage.local.get('serverEndpoint').then(function (result) {
          serverEndpoint = result.serverEndpoint;
        });
        chrome.storage.local.get('temperature').then(function (result) {
          temperature = result.temperature;
        });
        chrome.storage.local.get('maxTokens').then(function (result) {
          max_tokens = result.maxTokens;
        });
        chrome.storage.local.get('topP').then(function (result) {
          top_p = result.topP;
        });
        chrome.storage.local.get('topK').then(function (result) {
          top_k = result.topK;
        });
        temperature = parseFloat(temperature);
        max_tokens = parseInt(max_tokens);
        top_p = parseFloat(top_p);
        top_k = parseInt(top_k);

        // if temperature is not set, set it to 0.7
        temperature = temperature ? temperature : 0.7;
        // if max_tokens is not set, set it to 100
        max_tokens = max_tokens ? max_tokens : 10;
        // if top_p is not set, set it to 1
        top_p = top_p ? top_p : 1;
        // if top_k is not set, set it to 40
        top_k = top_k ? top_k : 40;
        log(`Setting up custom endpoint with url ${serverEndpoint}\ntemperature: ${temperature}\n max_tokens: ${max_tokens}\n top_p: ${top_p}\n top_k: ${top_k}`);
        setEndpoint(serverEndpoint, temperature, max_tokens, top_p, top_k);
        if (serverEndpoint) {
          handleCommand(request.command);
        }
      } else {
        handleCommand(request.command);
      }
    }
  }
)


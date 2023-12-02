const apiKeyRegex = /sk-[a-zA-Z0-9]{48}/

function log(msg) {
  console.log(`GalacTex: ${msg}`)
}

function addMessage(message) {
  $('#message-box').append(`<div class="message">${message}</div>`)
}

function addErrorMessage(message) {
  $('#message-box').append(`<div class="error">${message}</div>`)
}

function clearMessages() {
  $('#message-box').empty()
}

async function refreshStorage() {

  chrome.storage.local.get('serverEndpoint').then(({ serverEndpoint }) => {
    $('#server-endpoint-form .server-endpoint-status').text(chrome.runtime.lastError || !serverEndpoint ? 'not set' : `set`)
  })
  chrome.storage.local.get('serverEndpoint').then(({ serverEndpoint }) => {
    $('#server-endpoint-form .server-endpoint-input').val(serverEndpoint)
  })

  chrome.storage.local.get('temperature').then(({ temperature }) => {
    $('#settings-form .temperature-input').val(!temperature ? 0.9 : temperature)
  })

  chrome.storage.local.get('maxTokens').then(({ maxTokens }) => {
    $('#settings-form .max-tokens-input').val(!maxTokens ? 10 : maxTokens)
  })

  chrome.storage.local.get('topP').then(({ topP }) => {
    $('#settings-form .top-p-input').val(!topP ? 0.95 : topP)
  })

  chrome.storage.local.get('topK').then(({ topK }) => {
    $('#settings-form .top-k-input').val(!topK ? 40 : topK)
  })

  const commands = await chrome.commands.getAll();

  chrome.storage.local.get(['AutoComplete', 'AutoCompleteSelected']).then((settings) => {
    Object.values(settings).forEach(setting => {
      let command = commands.filter(({ name }) => name === setting.key)[0]
      if (command.shortcut !== setting.shortcut) {
        setting.shortcut = command.shortcut;
        if (setting.status === 'enabled' && setting.shortcut === '') {
          setting.status = 'error'
        }
        chrome.storage.local.set({ [setting.key]: setting });
      } else if (setting.status === 'enabled' && setting.shortcut === '') {
        setting.status = 'error'
        chrome.storage.local.set({ [setting.key]: setting })
      }
    })
    let bindingFailures = Object.values(settings)
      .filter(({ status }) => status === 'error')
      .map(({ key }) => `${key}`)
      .join(', ');
    if (bindingFailures.length > 0) {
      addErrorMessage(`Could not bind the following shortcuts:\n${bindingFailures}.\nYou can set it manually at <a href="chrome://extensions/shortcuts">chrome://extensions/shortcuts</a>.`)
    }
    Object.values(settings).forEach(({ key, status, shortcut }) => {
      $(`#settings-form input[name='text-${key}']:checkbox`).prop('checked', status === 'enabled')
      let shortcut2 = shortcut === '' ? 'not set' : shortcut
      $(`#shortcut-${key}`).html(`<span>${shortcut2}</span>`)
    })
  })
}

async function handleServerEndpointSet(event) {
  event.preventDefault()
  event.stopPropagation()

  clearMessages()

  const input = $('#server-endpoint-form').find('input[name=\'server-endpoint\']')
  const serverEndpoint = input.val()

  if (!serverEndpoint) {
    addErrorMessage('Invalid Server Endpoint.')
    return
  }

  chrome.storage.local.set({ serverEndpoint })
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove Server Endpoint. Error: ${error}`))

  const temperature = $('#server-endpoint-form').find('input[name=\'temperature\']').val()
  // temperature should be between 0 and 100
  if (temperature < 0 || temperature > 100) {
    addErrorMessage('Invalid temperature.')
    return
  }
  const maxTokens = $('#server-endpoint-form').find('input[name=\'max-new-length\']').val()
  // maxTokens should be between 1 and 2048
  if (maxTokens < 1 || maxTokens > 2048) {
    addErrorMessage('Invalid maxTokens.')
    return
  }
  const topP = $('#server-endpoint-form').find('input[name=\'top-p\']').val()
  // topP should be between 0 and 1
  if (topP < 0 || topP > 1) {
    addErrorMessage('Invalid topP.')
    return
  }
  const topK = $('#server-endpoint-form').find('input[name=\'top-k\']').val()
  // topK should be between 1 and 50000
  if (topK < -1 || topK > 50000) {
    addErrorMessage('Invalid topK.')
    return
  }

  chrome.storage.local.set({ temperature })
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to set temperature. Error: ${error}`))

  chrome.storage.local.set({ maxTokens })
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to set maxTokens. Error: ${error}`))

  chrome.storage.local.set({ topP })
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to set topP. Error: ${error}`))

  chrome.storage.local.set({ topK })
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to set topK. Error: ${error}`))

  log('Server Endpoint set to: ' + serverEndpoint + '\n Temperature set to: ' + temperature + '\n Max Tokens set to: ' + maxTokens + '\n Top P set to: ' + topP + '\n Top K set to: ' + topK)
  return refreshStorage()
}

async function handleServerEndpointClear(event) {
  event.preventDefault()
  event.stopPropagation()

  clearMessages()

  chrome.storage.local.remove('serverEndpoint')
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove Server Endpoint. Error: ${error}`))

  chrome.storage.local.remove('temperature')
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove temperature. Error: ${error}`))

  chrome.storage.local.remove('maxTokens')
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove maxTokens. Error: ${error}`))

  chrome.storage.local.remove('topP')
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove topP. Error: ${error}`))

  chrome.storage.local.remove('topK')
    .then(refreshStorage)
    .catch((error) => addErrorMessage(`Failed to remove topK. Error: ${error}`))

  log('Server Endpoint cleared.')
}

function makeHandleSettingChange(key) {
  return async (event) => {
    event.preventDefault()
    event.stopPropagation()
    clearMessages()

    const value = event.target.checked
    const setting = await chrome.storage.local.get(key)
    /*    let commandKey = await chrome.commands.getAll()
        commandKey = commandKey.filter(({ name }) => name === key)[0]*/
    // if (setting[key].status !== 'error') {
    setting[key].status = value ? 'enabled' : 'disabled'
    await chrome.storage.local.set({ [key]: setting[key] })
    // }
    return refreshStorage()
  }
}

$(document).ready(async function () {
  $('#server-endpoint-form .submit').on('click', handleServerEndpointSet)
  $('#server-endpoint-form .clear').on('click', handleServerEndpointClear)

  let commands = ['AutoComplete', 'AutoCompleteSelected']
  commands.forEach((key) => {
    $(`#settings-form input[name='text-${key}']:checkbox`).on('change', makeHandleSettingChange(key))
  })

  $('body').on('click', 'a', function () {
    chrome.tabs.create({ url: $(this).attr('href') });
    return false;
  });
  return refreshStorage()
})

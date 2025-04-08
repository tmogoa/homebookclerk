
// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openPopup') {
      // Open the popup in a new tab since it's more complex than a typical popup
      chrome.tabs.create({ url: 'popup.html' });
    }
  });
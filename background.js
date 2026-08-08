// Open the side panel when the extension is clicked
chrome.sidePanel
  .setPanelBehavior({
    openPanelOnActionClick: true
  })
  .catch(console.error);
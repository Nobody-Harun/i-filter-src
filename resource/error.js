function setFunctions() {
  document
    .getElementById("go_to_options")
    .addEventListener("click", open_options);
}

function open_options() {
  if (chrome.runtime.openOptionsPage) {
    console.log("error.js chrome.runtime.openOptionsPage()");
    chrome.runtime.openOptionsPage();
  } else {
    console.log("error.js window.open options.html");
    window.open(chrome.runtime.getURL("options.html"));
  }
}

document.addEventListener("DOMContentLoaded", setFunctions);

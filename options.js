const ENTRY_TAEGET_DEFINED = 0;
const STATUS_MESSAGE_NOT_REGISTERED = "未アクティベーション";
const STATUS_MESSAGE_TEMPORARY_ENTRY =
  "一時的に有効な試用アカウントで利用されています";
const STATUS_MESSAGE_VALID = "有効";
const STATUS_MESSAGE_OVER_DATE = "無効(期限切れ)";
const STATUS_MESSAGE_OVER_LICENSE = "無効(ライセンス数超過)";
const STATUS_MESSAGE_INVLAID = "無効";
const STATUS_MESSAGE_NO_CID_AVAILABLE = "無効(契約IDへの紐づけが行えません)";

// Saves options to chrome.storage
function set_account() {
  console.log("options.js set_account()");

  var elm_ifurl = document.getElementById("id_txt_if_url");
  var eml_cid = document.getElementById("id_txt_cid");
  var elm_account = document.getElementById("id_txt_account_id");

  console.log("options.js set_account() if=" + elm_ifurl.value);
  console.log("options.js set_account() cid=" + eml_cid.value);
  console.log("options.js set_account() account=" + elm_account.value);

  // registed
  chrome.storage.sync.set(
    {
      IFILTER_URL: elm_ifurl.value,
      CID: eml_cid.value,
      ACCOUNT: elm_account.value,
      LICENSE_STATUS: 1,
    },
    function (items) {
      var bg = chrome.extension.getBackgroundPage();
      bg.is_registered = true;
      bg.ReloadSetting();
      console.log("getBackgroundPage.ReloadSetting()");
      restore_options();
    }
  );
}

function set_debug_mode() {
  var radio = document.getElementById("entry_target");
  var radioNodeList = radio.mode;
  var target = 0;
  switch (radioNodeList.value) {
    default:
    case "product":
      target = 0;
      var entry_url = "https://chapi.digitalartscloud.com/command";
      break;
    case "public":
      target = 1;
      var entry_url =
        "https://chapi-daj-cloud-public.digitalartscloud.com/command";
      break;
    case "trunk":
      target = 2;
      var entry_url =
        "https://chapi-daj-cloud-trunk.digitalartscloud.com/command";
      // "https://chapi.daj-cloud-trunk.digitalartscloud.com/command";
      // "https://chapi-daj-cloud-trunk-sub10.digitalartscloud.com/command";
      break;
  }

  chrome.storage.sync.set(
    {
      ENTRY_TAEGET: target,
      ENTRY_URL: entry_url,
    },
    function () {
      var eml_entry = document.getElementById("entry_url");
      eml_entry.textContent = entry_url;

      var bg = chrome.extension.getBackgroundPage();
      bg.GetAccountAndRegisterService();
      console.log("getBackgroundPage.RegisterService()");

      setTimeout(function () {
        restore_options();
      }, 750);
    }
  );
}

function activation() {
  console.log("options.js activation()");

  var bg = chrome.extension.getBackgroundPage();
  bg.GetAccountAndRegisterService();
  console.log("getBackgroundPage.RegisterService()");

  setTimeout(function () {
    restore_options();
  }, 750);
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  console.log("options.js restore_options()");
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get(
    {
      LICENSE_STATUS: 0,
      IFILTER_URL: "-",
      CID: "-",
      ACCOUNT: "-",
      ENTRY_TAEGET: ENTRY_TAEGET_DEFINED,
      ENTRY_URL: "-",
    },
    function (items) {
      //var elm_ifurl = document.getElementById("id_txt_if_url");
      //elm_ifurl.value = items.IFILTER_URL;
      var elm_ifurl2 = document.getElementById("if_url");
      elm_ifurl2.textContent = items.IFILTER_URL;

      //var eml_cid = document.getElementById("id_txt_cid");
      //eml_cid.value = items.CID;
      var eml_cid2 = document.getElementById("cid");
      eml_cid2.textContent = items.CID;

      //var elm_account = document.getElementById("id_txt_account_id");
      //elm_account.value = items.ACCOUNT;
      var elm_account2 = document.getElementById("account_id");
      elm_account2.textContent = items.ACCOUNT;
      console.log("options.js restore_options() account=" + items.ACCOUNT);

      var elm_status = document.getElementById("account_status");
      console.log(
        "options.js restore_options() status=" + items.LICENSE_STATUS
      );
      switch (items.LICENSE_STATUS) {
        case 0:
          elm_status.textContent = STATUS_MESSAGE_NOT_REGISTERED;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_NOT_REGISTERED
          );
          break;
        case 1:
          elm_status.textContent = STATUS_MESSAGE_TEMPORARY_ENTRY;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_TEMPORARY_ENTRY
          );
          break;
        case 2:
          elm_status.textContent = STATUS_MESSAGE_VALID;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_VALID
          );
          break;
        case 3:
          elm_status.textContent = STATUS_MESSAGE_OVER_DATE;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_OVER_DATE
          );
          break;
        case 4:
          elm_status.textContent = STATUS_MESSAGE_OVER_LICENSE;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_OVER_LICENSE
          );
          break;
        case 5:
          elm_status.textContent = STATUS_MESSAGE_INVLAID;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_INVLAID
          );
          break;
        case 6:
          elm_status.textContent = STATUS_MESSAGE_NO_CID_AVAILABLE;
          console.log(
            "options.js restore_options() msg=" + STATUS_MESSAGE_NO_CID_AVAILABLE
          );
          break;
      }

      var radio = document.getElementById("entry_target");
      var radioNodeList = radio.mode;
      switch (items.ENTRY_TAEGET) {
        default:
        case 0:
          radioNodeList[0].checked = true;
          break;
        case 1:
          radioNodeList[1].checked = true;
          break;
        case 2:
          radioNodeList[2].checked = true;
          break;
      }
      var eml_entry = document.getElementById("entry_url");
      eml_entry.textContent = items.ENTRY_URL;
    }
  );

  chrome.storage.managed.get(
    {
      SUPPORT_ID: "managed parameter",
    },
    function (items) {
      var elm_supportid = document.getElementById("support_id");
      elm_supportid.textContent = items.SUPPORT_ID;
    }
  );
}

function block_test() {
  console.log("options.js block_test()");
  var bg = chrome.extension.getBackgroundPage();
  bg.openRatingBlockPage();
}

function allow_test() {
  console.log("options.js allow_test()");
  var bg = chrome.extension.getBackgroundPage();
  bg.openRatingAllowPage();
}

function initialization() {
  console.log("options.js initialization()");
  var bg = chrome.extension.getBackgroundPage();
  bg.Initialization();
  restore_options();
}

document.addEventListener("DOMContentLoaded", restore_options);
document
  .getElementById("btn_set_account")
  .addEventListener("click", set_account);
document.getElementById("block_test").addEventListener("click", block_test);
document.getElementById("allow_test").addEventListener("click", allow_test);
document.getElementById("btn_activation").addEventListener("click", activation);
document
  .getElementById("btn_set_mode")
  .addEventListener("click", set_debug_mode);
document.getElementById("btn_clear").addEventListener("click", initialization);

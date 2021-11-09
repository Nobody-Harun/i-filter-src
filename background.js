///////////////////////////////////////////////////////////////////////////////
// Param
///////////////////////////////////////////////////////////////////////////////
// ENTRY_URL
const ENTRY_URL_DEFINED = "https://chapi.digitalartscloud.com/command";
const ENTRY_TAEGET_DEFINED = 0;
// PUBLIC
//const ENTRY_URL_DEFINED = "https://sub1-daj-cloud-public.digitalartscloud.com/command";
// const ENTRY_TAEGET_DEFINED = 1;
// TRUNK
//const ENTRY_URL_DEFINED =
//"https://chapi-daj-cloud-trunk.digitalartscloud.com/command";
//"https://chapi.daj-cloud-trunk.digitalartscloud.com/command";
//"https://chapi-daj-cloud-trunk-sub10.digitalartscloud.com/command";
//const ENTRY_TAEGET_DEFINED = 2;

// UserData
const CID = -1;
const RATING_URL = "https://undefined/rating";
const D_LOGIN_URL = "https://undefined/dportal";

// ConstParam
const REGIST_ERR_URL = "resource/error.html";
const REQ_ERR_URL = "resource/req_error.html";
const networkFilters = {
  urls: ["<all_urls>"],
  types:[
    "main_frame",
    "sub_frame",
    "xmlhttprequest",
    "other"
  ]
};
const DC_URL = "https://dcontents.daj.co.jp/guest/";
const EX_EXTENSION = [".ico", ".png", ".jpg",  ".jpeg", ".gif", ".tiff", ".bmp", ".srf", ".css", ".json", ".otf", ".ttf", ".svg", ".eot", ".woff", ".woff2"];

const BLOCK_TEST_URL = "http://download.daj.co.jp/webfilteringdb_category_block_check/ifb10/43/";
const ALLOW_TEST_URL = "https://www.daj.jp/";

var is_registered = false;
var is_valid_license = false;
var is_loaded = false;
var is_loaded_db = false;
var if_url;
var favicon_url;
var is_chromeOS;
var is_filtering = true;

var ratingSystem = new RatingSystem(CID, RATING_URL, "", D_LOGIN_URL);

var requireHeaders = {}
var ratingRetMap = {};
var requestBodyMap = {};

// 初回設定読み込み
console.log("background.js start");

chrome.runtime.getPlatformInfo(function(info) {
  is_chromeOS = info.os.indexOf("cros") == 0;
  console.log("is_chromeOS: " + info.os);
  checkFilteringState();
});

chrome.storage.onChanged.addListener(function(changes, eventArea){
  if(eventArea == "managed"){
    checkFilteringState();
  }
});

function checkFilteringState(){
  chrome.storage.managed.get({OnlyChromeOS:0}, function(policies){
    if(policies.OnlyChromeOS == 1){
      if(is_chromeOS){
        is_filtering = true;
      } else {
        is_filtering = false;
      }
    } else {
      is_filtering = true;
    }
    console.log("is_filtering: " + is_filtering);
  });
}

isRegistered(true);

chrome.storage.sync.get(
  {
    LICENSE_STATUS: 0,
    previus_cid:-1
  },
  function (items) {
    if(items.LICENSE_STATUS != 0){
      chrome.storage.managed.get({cid:-1}, function(policies) {
        console.log("start policy.cid=" + policies.cid);
        console.log("start previus_cid=" + items.previus_cid);
        if(items.previus_cid != policies.cid){
          GetAccountAndRegisterService(false);
        }
      });    
    } else {
      GetAccountAndRegisterService(true);
    }
  }
);

// 初期化
function Initialization() {
  console.log("background.js Initialization()");
  chrome.storage.sync.set(
    {
      LICENSE_STATUS: 0,
      IFILTER_URL: "undefined",
      ACCOUNT: "temporary@daj.co.jp",
      CID: "-1",
      ENTRY_URL: ENTRY_URL_DEFINED,
      ENTRY_TAEGET: ENTRY_TAEGET_DEFINED,
    },
    function (items) {
      ReloadSetting();
      is_registered = false;
      is_loaded = false;
    }
  );
  return;
}

// 設定再読み込み
function ReloadSetting() {
  console.log("background.js ReloadSetting()");
  chrome.storage.local.get(
    {
      DB_VERSION: "-1",
      DATABASE: [],
      CONF: {},
      SYS_CONF: {},
      RATING_STATE: {
        skip: false,
        errDate: [],
        disableDate: [],
        returnDate: null,
      },
    },
    function (items) {
      ratingSystem.dbVersion = items.DB_VERSION;
      ratingSystem.ratingDB = items.DATABASE;
      ratingSystem.conf = items.CONF;
      if (items.CONF[confKey.version]) {
        ratingSystem.confVersion = items.CONF[confKey.version];
      }
      ratingSystem.sysConf = items.SYS_CONF;
      if (items.SYS_CONF[confKey.version]) {
        ratingSystem.sysVersion = items.SYS_CONF[confKey.version];
      }
      ratingSystem.ratingState = items.RATING_STATE;
    }
  );

  chrome.storage.sync.get(
    {
      IFILTER_URL: "undefined",
      ACCOUNT: "dummy@example.com",
      CID: "-1",
      LICENSE_STATUS: 0,
    },
    function (items) {
      if_url = items.IFILTER_URL;
      favicon_url = if_url + "/favicon.ico";
      ratingSystem.cid = items.CID;
      ratingSystem.ratingUrl = if_url + "/rating";
      ratingSystem.DportalLoginUrl = if_url + "/dportal";
      ratingSystem.account = items.ACCOUNT;
      switch (items.LICENSE_STATUS) {
        case 0:
        case 3:
        case 4:
        case 5:
        case 6:
          is_valid_license = false;
          break;
        default:
          is_valid_license = true;
          break;
      }

      if (!is_loaded_db && is_registered) {
        is_loaded_db = true;
        ratingSystem.initRatingDB(if_url + "/ratingdb");
      }

      is_loaded = true;
    }
  );
  return;
}

function isCancel(url) {
  var ret = false;
  if (url == favicon_url) {
    ret = true;
  }
  return ret;
}

function isRating(url, type) {
  if(!is_filtering){
    return false;
  }
  // Rating不要
  if (!is_valid_license) {
    return false;
  }

  if (url.href.indexOf(if_url) == 0 || url.href.indexOf(ENTRY_URL_DEFINED) == 0) {
    return false;
  }

  // extension check
  if (type != 'main_frame' && type != 'sub_frame') {
    if (url.pathname != null && url.pathname.length > 0) {
      var filepath = url.pathname.substring(url.pathname.lastIndexOf("/"));
      var pos = filepath.lastIndexOf(".");
      if (pos !== -1) {
        var ext = filepath.substring(pos);
        if (EX_EXTENSION.indexOf(ext) !== -1) {
          return false;
        }
      }
    }
  }

  if (url.protocol == "https:" && url.hostname.endsWith(".digitalartscloud.com")) {
    return false;
  }

  if (url.href === BLOCK_TEST_URL || url.href === ALLOW_TEST_URL) {
    return true;
  }

  if (ratingSystem.isInExclusionList(url)) {
    return false;
  }

  return true;
}

function beRedirectEntryPage(url, type) {
  if (url.indexOf(if_url) == 0 || url.indexOf(ENTRY_URL_DEFINED) == 0) {
    return false;
  }

  if (type != "main_frame" && type != "sub_frame" && type != "xmlhttprequest") {
    return false;
  }

  // https://*.google.com
  var regex = /^https:\/\/.*\.google\.com.*/;
  if (regex.test(url)) {
    return false;
  }

  return true;
}

function onBeforeRequest(details) {
  const { requestId, url, method, type, requestBody } = details;
  if (url.indexOf("http") != 0) {
    return;
  }

  // 申込完了してなかったら、スルー
  if (!isRegistered(false)) {
    // if (beRedirectEntryPage(url, type)) {
    //   RegisterService();
    //   return { redirectUrl: chrome.extension.getURL(REGIST_ERR_URL) };
    // }
    return;
  }

  // 設定読み込み
  if (!is_loaded) {
    ReloadSetting();
  }

  if (isCancel(url)) {
    return { cancel: true };
  }

  var location = new URL(url);
  if (!isRating(location, type)) {
    return;
  }
  if (ratingSystem.isHeaderRequired(url, method)) {
    // onBeforeSendHeadersでratingする
    requireHeaders[requestId] = true;
    requestBodyMap[requestId] = requestBody;
    return;
  }

  var ret = ratingSystem.filterRequest(method, url, requestId, null, requestBody, location, type);
  if (ret.status == 200) {
    // http status ok
    if (ret.redirectUrl != null) {
      // block
      return { redirectUrl: ret.redirectUrl };
    }
  } else if (ret.status == 407) {
    // http status proxy-auth
    return;
  } else {
    // iFとの通信エラー時 エラー画面表示
    return { redirectUrl: chrome.extension.getURL(REQ_ERR_URL) };
  }
}

function onBeforeSendHeaders(details) {
  var { requestId, url, method, type, requestHeaders, } = details;

  if (requireHeaders[requestId]) {
    var ret = ratingSystem.filterRequest(
      method, url, requestId, requestHeaders, requestBodyMap[requestId], null, type
    );
    delete requireHeaders[requestId];
    delete requestBodyMap[requestId];
    if (ret.status == 200) {
      // http status ok
      if (ret.redirectUrl != null) {
        // block
        if (method.toLowerCase() == "post" || method.toLowerCase() == "put") {
          return {cancel : true};
        } else {
          // onHeadersReceivedで使用
          ratingRetMap[requestId] = ret;
          return {requestHeaders: requestHeaders};
        }
      }
    } else if (ret.status == 407) {
      // http status proxy-auth
      return;
    } else {
      return {cancel : true};
    }
  }

  requestHeaders = ratingSystem.modifyReqHeaders(requestHeaders, requestId);

  return { requestHeaders: requestHeaders };
}

function onHeadersReceived(details) {
  const { statusCode, url, method, requestId } = details;

  var ret = ratingRetMap[requestId]
  if (ret != null) {
    delete ratingRetMap[requestId];
    if (ret.redirectUrl != null) {
      return {redirectUrl : ret.redirectUrl};
    }
  }

  // Dコンテンツアクセス時、OK でなければログイン処理
  if (url.indexOf(DC_URL) === 0 && statusCode != 200) {
    var ret = ratingSystem.loginDPortal(details.responseHeaders, url, method);
    details.responseHeaders = ret.responseHeaders;
    if (ret.redirect === true) {
      return {responseHeaders: details.responseHeaders, redirectUrl: details.url};
    }
  }

  return;
}

function onErrorOccured(details) {
  const { requestId } = details;

  ratingSystem.termSessionMng(requestId);

  return;
}

function onCompleted(details) {
  const { requestId } = details;

  ratingSystem.termSessionMng(requestId);

  return;
}

chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, networkFilters, [
  "blocking",
  "requestBody",
  "extraHeaders",
]);

chrome.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders,
  networkFilters,
  ["blocking", "requestHeaders", "extraHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceived,
  networkFilters,
  ["blocking", "responseHeaders", "extraHeaders"]
);

chrome.webRequest.onErrorOccurred.addListener(
  onErrorOccured,
  networkFilters,
  []
);

chrome.webRequest.onCompleted.addListener(
  onCompleted,
  networkFilters,
  []
);

/*
chrome.runtime.onInstalled.addListener(function () {
  console.log("background.js onInstalled.addListener()");

  if (is_registered) {
    // 登録済
    console.log("background.js onInstalled.addListener() already registered.");
    if (!is_loaded) {
      ReloadSetting();
    }
    return;
  }

  // 未登録
  GetAccountAndRegisterService(true);
});
*/

function GetAccountAndRegisterService(open_option_window) {
  chrome.identity.getProfileUserInfo(function (obj) {
    console.log("background.js GetAccountAndRegisterService = " + obj.email);
    RegisterService(obj.email, open_option_window);
  });
}

function RegisterService(account_id, open_option_window) {
  console.log("background.js RegisterService()");

  chrome.storage.managed.get({cid:-1}, function(policies) {

    console.log("policy.cid=" + policies.cid);

    chrome.storage.sync.get(
      {
        ENTRY_URL: ENTRY_URL_DEFINED,
        ENTRY_TAEGET: ENTRY_TAEGET_DEFINED,
        LICENSE_STATUS: 0,
        ACCOUNT: "",
      },
      function (items) {
        console.log("entry entry_url=" + items.ENTRY_URL);
        console.log("entry pre license " + items.LICENSE_STATUS);
        console.log("entry account=" + account_id);
  
        if ("" == account_id) {
          // アカウント指定が無い場合は 保存されたアカウントを利用
          account_id = items.ACCOUNT;
          console.log("entry account_saved=" + items.ACCOUNT);
        }
  
        //  保存されたアカウントもない
        if ("" == account_id) {
          console.log("entry account empty.");
  
          // LICENSE_STATUS が 0 / 1以外の時はエラーで終了
          if (items.LICENSE_STATUS != 0 && items.LICENSE_STATUS != 1) {
            // エラー画面
            window.open(
              chrome.extension.getURL(REGIST_ERR_URL),
              "entry_error_page"
            );
            return;
          }
  
          // 一時利用ユーザーで登録
          var date = new Date();
          var strYM =
            date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2);
          account_id = "temporary" + strYM + "@daj.co.jp";
        }
  
        // リクエスト/レスポンスパラメーターを決める
        var postdata = "mode=register&entrydata=" + account_id;

        if (items.LICENSE_STATUS == 0 || items.LICENSE_STATUS == 1 || items.LICENSE_STATUS == 6) {
          postdata += "&temporary=1";
        }
        
        if(policies.cid != -1)
        {
          postdata += "&cid=" + policies.cid;
        }

        postdata += "&agent_version=" + chrome.runtime.getManifest().version;

        var res = ratingSystem.sendFunc(items.ENTRY_URL, postdata);
        if ((res.status = 200 && res.data != null)) {
          console.log("entry status=" + res.status);
          console.log("entry cid=" + res.data.cid);
          console.log("entry host=" + res.data.host);
          console.log("entry license=" + res.data.license);
          console.log("entry result=" + res.result);
          //localStorage.setItem("REGIST", "1");
          var res_license = Number(res.data.license);
          console.log("license typeof " + typeof res.data.license);
          console.log("license typeof " + typeof res_license);
  
          if (items.LICENSE_STATUS == 0 && res_license == 5) {
            //「未アクティベート」の場合⇒変化なし
            res_license = 0;
          }
  
          if (undefined == res.data.host || undefined == res.data.cid) {
            console.log("entry failed." + res.result);
            console.log("entry failed." + res.result);
            // 無効の場合はhost無くても上書き
            if (res_license == 5) {
              chrome.storage.sync.set(
                {
                  LICENSE_STATUS: res_license,
                },
                function (items) {
                  is_registered = true;
                  ReloadSetting();
                  if (open_option_window) {
                    open_options();
                  }
                }
              );
            } else {
              ReloadSetting();
              if (open_option_window) {
                open_options();
              } else {
                // Error エラー画面表示
                window.open(
                  chrome.extension.getURL(REGIST_ERR_URL),
                  "entry_error_page"
                );
              }
            }
            return;
          }
  
          var if_url = "";
          switch (items.ENTRY_TAEGET) {
            default:
            case 0:
              if_url = "https://" + res.data.host + ".digitalartscloud.com";
              break;
            case 1:
              if_url = "https://" + res.data.host + ".digitalartscloud.com";
              break;
            case 2:
              if_url =
                "https://" +
                res.data.host +
                ".daj-cloud-trunk.digitalartscloud.com";
              break;
          }
  
          // registed
          chrome.storage.sync.set(
            {
              LICENSE_STATUS: res_license,
              IFILTER_URL: if_url,
              CID: res.data.cid,
              ACCOUNT: account_id,
              previus_cid: policies.cid,
            },
            function (items) {
              is_registered = true;
              ReloadSetting();
              if (open_option_window) {
                open_options();
              }
            }
          );
        } else {
          // Error エラー画面表示
          window.open(
            chrome.extension.getURL(REGIST_ERR_URL),
            "entry_error_page"
          );
          return;
        }
      }
    );
  });
}

function isRegistered(with_load_setting) {
  if (is_registered) {
    if (with_load_setting) {
      ReloadSetting();
    }
    return true;
  }

  chrome.storage.sync.get(
    {
      LICENSE_STATUS: 0,
    },
    function (items) {
      is_registered = 0 != items.LICENSE_STATUS;
      console.log(
        "background.js isRegistered() LICENSE_STATUS " + items.LICENSE_STATUS
      );
      console.log(
        "background.js isRegistered() is_registered " + is_registered
      );

      if (with_load_setting) {
        ReloadSetting();
      }
    }
  );

  console.log("background.js isRegistered() " + is_registered);
  return is_registered;
}

// Window開く
function openRatingBlockPage() {
  console.log("background.js openRatingBlockPage()");
  window.open(BLOCK_TEST_URL, "_blank");
}

function openRatingAllowPage() {
  console.log("background.js openRatingAllowPage()");
  window.open(ALLOW_TEST_URL, "_blank");
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

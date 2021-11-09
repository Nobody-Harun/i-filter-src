const headerController = "header_controller";
const safeSearch = "safe_search";
const dbVersion = "version";
const database = "data";
const maxPOSTSize = 80*1024;
const maxDateListLength = 1000;

const wapHdrType = { URL_PATH: "0", FULL_HOST: "1", BACKWARD_HOST: "2" };

const exListType = { PART_HOST: "0", FULL_HOST: "1", REGEX_HOST: "2", URL_PATH: "3" };

const confKey = {
  version: "version",
  enableExHost: "enable_ex_host",
  exHostList: "ex_host_list",
  enableExIp: "enable_ex_ip",
  exIpList: "ex_ip_list",
  enableWebOnRatingErr: "enable_web_on_rating_err",
  enableNoRatingOnErr: "enable_no_rating_on_err",
  connectErrTime: "connect_err_time",
  connectErrCount: "connect_err_count",
  ratingReturnTime: "rating_return_time",
};

class RatingSystem {
  constructor(cid, ratingUrl, account, DportalLoginUrl) {
    this.sessionMng = {};
    this.redirectSafeSrch = {};
    this.cid = cid;
    this.ratingUrl = ratingUrl;
    this.account = account;
    this.ratingheadlen = 0;
    this.ratingbodylen = 0;
    this.sendingbody = false;
    this.DportalLoginUrl = DportalLoginUrl;
    this.dbVersion = "-1";
    this.ratingDB = [];
    this.confVersion = "-1";
    this.conf = {};
    this.sysVersion = "-1";
    this.sysConf = {};
    this.ratingState = {
      skip: false,
      errDate: [],
      disableDate: [],
      returnDate: null,
    };
  }

  sendFunc(url, postData, type) {
    var json_data = "";
    var status = -1;
    var headers = {
      "Content-Type" : 'application/x-www-form-urlencoded',
      "cid" : this.cid,
      "x-rating-header": this.ratingheadlen,
      "x-rating-dbver": this.dbVersion,
      "x-rating-body": this.ratingbodylen,
      "x-rating-confver": this.confVersion,
      "x-rating-sysver": this.sysVersion
    };
    if (type != null){
      headers['x-rating-info-type'] = type;
    }
    var dateList = this.makeDateListData();
    if (dateList.length > 0) {
      headers['x-rating-datelist'] = dateList;
    }
    try {
      $.ajax({
        url: url,
        type: "POST",
        headers: headers,
        data: postData,
        dataType: "text",
        async: false,
      }).done(function(data, textStatus, jqXHR){ 
        status = jqXHR.status;
        if (status == 200) {
          json_data = JSON.parse(data);
        }
      }).fail(function(jqXHR, textStatus, errorThrown){
        status = jqXHR.status;
      });

    } catch (e) {}

    return {status: status, data: json_data};
  }

  makeDateListData() {
    var data = "";

    if (this.ratingState.disableDate.length > 0) {
      data = this.ratingState.disableDate.join(',');
    }

    if (this.ratingState.returnDate != null) {
      data += "|" + this.ratingState.returnDate;
    }

    return data;
  }

  getTextByByteLength(body, targetlength){
    var currentLength = 0;
    var returnbuffer = "";
    var currentChar;
    var charbytelen = 0;
    for (var index = 0; index < body.length; index++) {
      currentChar = body.charAt(index);
      charbytelen = encodeURI(currentChar).length;
      if (charbytelen < 4){
        charbytelen = 1;
      } else {
        charbytelen = Math.floor(charbytelen / 3);
      }
      if (currentLength + charbytelen >= targetlength){
        break;
      }
      currentLength += charbytelen;
      returnbuffer += currentChar;
    }
    return returnbuffer;
  }

  getPostBody(requestBody) {
    var temppostdata = "";
    if(requestBody){
      if (requestBody.formData) {
        let formData = requestBody.formData;
        Object.keys(formData).forEach((key, index, array) => {
          temppostdata += key + "=";
          formData[key].forEach(value => {
            temppostdata += value;
          });
          if(index < array.length - 1){
            temppostdata += "&";
          }
        });
      }
      else if (requestBody.raw) {
        for (var rawindex = 0; rawindex < requestBody.raw.length; rawindex++){
          if(requestBody.raw[rawindex].bytes){
            let utf8decoder = new TextDecoder();
            temppostdata += utf8decoder.decode(requestBody.raw[rawindex].bytes);
          }
          else if(requestBody.raw[rawindex].file){
            let filecontent = requestBody.raw[rawindex].file;
            if (filecontent){
              temppostdata += filecontent;
            }
          }
          else{
            //do nothing. only bytes and file allowed in raw
          }
        }
      } else {
        //do nothing. only form and raw allowed. possble zero body.
      }
    }
    return temppostdata;
  }

  makeHeaderData(requestHeaders) {
    if (requestHeaders == null) { return ""; }

    var data = "";
    for (var i = 0; i < requestHeaders.length; i++) {
      data += "req_header=" + requestHeaders[i].name + ":" + requestHeaders[i].value + "\n";
    }
    return data;
  }

  makePostData(method, url, account, requestHeaders, requestBody, location) {
    var data = "";
    if (location == null) {
      location = new URL(url);
    }
    data = "method=" + method + "\n";
    if(method.toLowerCase() == "post" || method.toLowerCase() == "put"){
      this.sendingbody = true;
    } else {
      this.sendingbody = false;
    }
    data += "proto=" + location.protocol.replace(':', '') + "\n";
    data += "host=" + location.hostname + "\n";
    if (location.port.length > 0) {
      data += "port=" + location.port + "\n";
    }
    if (location.pathname.length > 0) {
      data += "path=" + location.pathname + "\n";
    }
    if (location.search.length > 0) {
      data += "query=" + location.search + "\n";
    }
    data += "user=" + account + "\n";
    data += this.makeHeaderData(requestHeaders);

    this.ratingheadlen = data.length;
    this.ratingbodylen = 0;

    // postdata
    var postbody = this.getPostBody(requestBody);
    var postsize = 0;
    if(typeof postbody != "undefined" && typeof postbody == "string"){
      var postBlob = new Blob([postbody]);
      postsize = postBlob.size;
      if(postsize > 0){
        if(postsize > maxPOSTSize){
          postbody = this.getTextByByteLength(postbody, maxPOSTSize);
          var slicedBlob = new Blob([postbody]);
          postsize = slicedBlob.size;
        }
        this.sendingbody = true;
        this.ratingbodylen = postsize;
        data += postbody
      }
    }
    return data;
  }

  filterRequest(method, url, requestId, requestHeaders, requestBody, location, type) {
    if (this.redirectSafeSrch[requestId]) {
      delete this.redirectSafeSrch[requestId];
      return { status: 200 };
    }

    if (this.isNoRatingMode(url)) {
      return { status: 200 };
    }

    this.sessionMng[requestId] = {};
    var ret = this.sendFunc(
      this.ratingUrl,
      this.makePostData(method, url, this.account, requestHeaders, requestBody, location),
      type
    );
    if (ret.data == "" || ret.data.result == null) {
      if (ret.status == 407) {
        return { status: ret.status };
      } else {
        if (this.conf[confKey.enableNoRatingOnErr] === "true") {
          this.countRatingError();
        }

        if (this.conf[confKey.enableWebOnRatingErr] === "true") {
          return { status: 200 };
        }

        return { status: -1 };
      }
    } else if (ret.data.result == "allow") {
      this.saveRatingDB(ret.data);
      this.saveConf(ret.data);
      this.saveSysConf(ret.data);
      this.clearDateList();

      if (ret.data.header_controller) {
        this.sessionMng[requestId][headerController] =
          ret.data.header_controller;
      }

      if (ret.data.safe_search) {
        this.sessionMng[requestId][safeSearch] = ret.data.safe_search;

        if (ret.data.safe_search.type == "url") {
          this.redirectSafeSrch[requestId] = true;
          return {
            status: ret.status,
            redirectUrl: ret.data.safe_search.value,
            safeSearch: true
          };
        }
      }
    } else if (ret.data.result == "block") {
      this.saveRatingDB(ret.data);
      this.saveConf(ret.data);
      this.saveSysConf(ret.data);
      this.clearDateList();

      var blockUrl = this.ratingUrl + "?" + ret.data.blkinfo;
      return { status: ret.status, redirectUrl: blockUrl };
    }

    return { status: ret.status };
  }

  applyHeaderController(requestHeaders, requestId) {
    var { header_controller } = this.sessionMng[requestId];
    if (!header_controller) {
      return requestHeaders;
    }

    for (var i = 0; i < header_controller.length; ++i) {
      if (header_controller[i].length < 3) continue;

      var action = header_controller[i][0];
      if (action === "add") {
        var key = header_controller[i][1];
        var united = false;
        var deli = ", ";
        if (key.toLowerCase() == "cookie") {
          deli = "; ";
        }
        // uniteHeadLineButting
        for (var j = 0; j < requestHeaders.length; ++j) {
          if (key.toLowerCase() == requestHeaders[j].name.toLowerCase()) {
            requestHeaders[j].value =
              requestHeaders[j].value + deli + header_controller[i][2];

            united = true;
          }
        }

        if (!united) {
          var tmp = {
            name: header_controller[i][1],
            value: header_controller[i][2],
          };
          requestHeaders.push(tmp);
        }
      } else {
        var key = header_controller[i][1];
        for (var j = 0; j < requestHeaders.length; ++j) {
          if (key.toLowerCase() == requestHeaders[j].name.toLowerCase()) {
            if (action === "replace") {
              requestHeaders[j].value = header_controller[i][2];
            } else if (action === "delete") {
              requestHeaders.splice(j, 1);
            }
          }
        }
      }
    }

    return requestHeaders;
  }

  applySafeSearch(requestHeaders, requestId) {
    var { safe_search } = this.sessionMng[requestId];
    if (!safe_search) {
      return requestHeaders;
    }

    if (safe_search.type != "cookie" && safe_search.type != "cookie_ex") {
      return requestHeaders;
    }

    var cookieExists = false;
    for (var i = 0; i < requestHeaders.length; ++i) {
      if ("cookie" != requestHeaders[i].name.toLowerCase()) continue;

      cookieExists = true;
      var cookies = requestHeaders[i].value.split(";");
      var replaced = false;
      var replaceStr = "";
      for (var j = 0; j < cookies.length; ++j) {
        var equalPos = cookies[j].indexOf("=");
        var cookieKey = "";
        var cookieVal = "";
        if (equalPos == -1) {
          cookieKey = cookies[j];
        } else {
          cookieKey = cookies[j].substring(0, equalPos);
          cookieVal = cookies[j].substring(equalPos + 1);
        }
        cookieKey = cookieKey.trim();
        cookieVal = cookieVal.trim();

        var flg = false;
        if (safe_search.nocase == "true")
          flg = cookieKey.toLowerCase() == safe_search.key.toLowerCase();
        else flg = cookieKey == safe_search.key;
        // target key found
        if (flg) {
          // type: cookie_ex
          if (safe_search.type == "cookie_ex") {
            var replaced_sub = false;
            var valuesEx = cookieVal.split("&");
            var repVal = "";
            for (var k = 0; k < valuesEx.length; ++k) {
              if (valuesEx[k] == "") continue;
              var deliPos = valuesEx[k].indexOf(safe_search.deli_ex);
              var exKey = "";
              var exVal = "";
              if (deliPos == -1) {
                exKey = valuesEx[k];
              } else {
                exKey = valuesEx[k].substring(0, deliPos);
                exVal = valuesEx[k].substring(deliPos + 1);
              }
              exKey = exKey.trim();
              exVal = exVal.trim();

              if (exKey == safe_search.sub_key) {
                replaced_sub = true;
                exVal = safe_search.sub_val;
                if (repVal != "") repVal += "&";
                repVal += exKey + safe_search.deli_ex + exVal;
              } else {
                if (repVal != "") repVal += "&";
                if (deliPos == -1) {
                  repVal += exKey;
                } else {
                  repVal += exKey + safe_search.deli_ex + exVal;
                }
              }
            }
            if (!replaced_sub) {
              if (repVal != "") repVal += "&";
              repVal +=
                safe_search.sub_key + safe_search.deli_ex + safe_search.sub_val;
            }

            cookieVal = repVal;
          }
          // type: cookie
          else {
            // replace value
            cookieVal = safe_search.value;
          }

          replaced = true;

          if (replaceStr != "") replaceStr += ";";
          replaceStr += cookieKey + "=" + cookieVal;
        } else {
          if (replaceStr != "") replaceStr += ";";
          if (equalPos == -1) {
            replaceStr += cookieKey;
          } else {
            replaceStr += cookieKey + "=" + cookieVal;
          }
        }
      }
      if (false == replaced) {
        if (safe_search.type == "cookie_ex") {
          if (replaceStr != "") replaceStr += ";";
          replaceStr +=
            safe_search.key +
            "=" +
            safe_search.sub_key +
            safe_search.deli_ex +
            safe_search.sub_val;
        } else {
          if (replaceStr != "") replaceStr += ";";
          replaceStr += safe_search.key + "=" + safe_search.value;
        }
      }

      requestHeaders[i].value = replaceStr;
    }

    if (!cookieExists) {
      if (safe_search.type == "cookie") {
        var tmp = {
          name: "Cookie",
          value: safe_search.key + "=" + safe_search.value,
        };
        requestHeaders.push(tmp);
      } else if (safe_search.type == "cookie_ex") {
        var tmp = {
          name: "Cookie",
          value:
            safe_search.key +
            "=" +
            safe_search.sub_key +
            safe_search.deli_ex +
            safe_search.sub_val,
        };
        requestHeaders.push(tmp);
      }
    }

    return requestHeaders;
  }

  modifyReqHeaders(requestHeaders, requestId) {
    if (!this.sessionMng.hasOwnProperty(requestId)) {
      return requestHeaders;
    }

    // header-controller
    requestHeaders = this.applyHeaderController(requestHeaders, requestId);

    // safe_search
    requestHeaders = this.applySafeSearch(requestHeaders, requestId);

    delete this.sessionMng[requestId];

    return requestHeaders;
  }

  loginDPortal(responseHeaders, url, method) {
    // login flow
    var ret = this.sendFunc(this.DportalLoginUrl, this.makePostData(method, url, this.account, null, null, null), null);

    if (ret.data.result != "ok") {
      return {responseHeaders: responseHeaders, redirect: false};
    }
    this.clearDateList();

    // add Set-Cookie
    for (var i = 0; i < responseHeaders.length; i++) {
      if (responseHeaders[i].name == "Set-Cookie") {
        responseHeaders.splice(i, 1);
      }
    }

    var setCookies = ret.data.value;
    for (var i = 0; i < setCookies.length; i++) {
      var tmp = {
        name: "Set-Cookie",
        value: setCookies[i]
      }
      responseHeaders.push(tmp);
    }

    return {responseHeaders: responseHeaders, redirect: true};
  }

  isHeaderRequired(url, method) {
    if (!this.ratingDB) {
      return false;
    }

    var location = new URL(url);
    for (var i = 0; i < this.ratingDB.length; i++) {
      if (this.ratingDB[i].length != 2) continue;

      var type = this.ratingDB[i][0];
      var value = this.ratingDB[i][1];
      switch (type) {
        case wapHdrType.URL_PATH:
          var urlpath = location.host + location.pathname;
          if (urlpath.includes(value)) {
            return true;
          }
          break;
        case wapHdrType.FULL_HOST:
          if (location.hostname === value) {
            return true;
          }
          break;
        case wapHdrType.BACKWARD_HOST:
          if (location.hostname.endsWith(value)) {
            return true;
          }
          break;
        default:
          break;
      }
    }
    return false;
  }

  compareIPv4Addr(ipA, ipB) {
    var arrayA = ipA.split('.');
    var arrayB = ipB.split('.');

    for (var i = 0; i < 4; i++) {
      var numA = parseInt(arrayA[i], 10);
      var numB = parseInt(arrayB[i], 10);
      if (numA < numB) {
        return -1;
      }
      if (numA > numB) {
        return 1;
      }
    }
    return 0;
  }

  compareIPv6Addr(ipA, ipB) {
    if (ipA.startsWith("[") && ipA.endsWith("]")) {
      ipA = ipA.substring(1, ipA.length-1);
    }
    if (ipB.startsWith("[") && ipB.endsWith("]")) {
      ipB = ipB.substring(1, ipB.length-1);
    }
    // 2001:0:0:1::1 -> 2001:0:0:1:0:0:0:1 として返す
    var getAt = function (array, idx) {
      if (array[idx] === "") {
        // ::の場合、後ろに省略された0を追加する
        for (var i = idx + 1; array.length < 8; i++) {
          array.splice(i, 0, 0);
        }
        return 0;
      }
      return array[idx];
    }
    var arrayA = ipA.split(':');
    var arrayB = ipB.split(':');

    for (var i = 0; i < 8; i++) {
      var numA = parseInt(getAt(arrayA, i), 16);
      var numB = parseInt(getAt(arrayB, i), 16);
      if (numA < numB) {
        return -1;
      }
      if (numA > numB) {
        return 1;
      }
    }
    return 0;
  }

  compareIpAddr(ipA, ipB, version) {
    if (version == 4) {
      return this.compareIPv4Addr(ipA, ipB);
    } else if (version == 6) {
      return this.compareIPv6Addr(ipA, ipB);
    }
  }

  getIpAddrVersion(hostname) {
    var strIPv6 = hostname;
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      strIPv6 = hostname.substring(1, hostname.length-1);
    }
    var ipv6 = strIPv6.split(':');
    if (ipv6.length >= 2 && ipv6.length <= 8) {
      for (var i = 0; i < ipv6.length; i++) {
        if (ipv6[i] === "") { continue; }

        var parsed = parseInt(ipv6[i], 16);
        if (isNaN(parsed)) {
          return null;
        }
      }
      return 6; // IPv6
    }

    var ipv4 = hostname.split('.');
    if (ipv4.length == 4) {
      for (var i = 0; i < ipv4.length; i++) {
        var parsed = parseInt(ipv4[i], 10);
        if (isNaN(parsed)) {
          return null;
        }
      }
      return 4; // IPv4
    }

    return null;
  }

  isInExIpList(exlist, url) {
    var hostname = url.hostname;
    for (var i = 0; i < exlist.length; i++) {
      var ip = exlist[i].split("-");
      if (ip.length == 1) {
        // 単体
        var ipVer = this.getIpAddrVersion(hostname);
        if (typeof ipVer === 'number') {
          if (ipVer === 4) {
            if (ip[0] === hostname) {
              return true;
            }
          } else if (ipVer == 6 && ipVer === this.getIpAddrVersion(ip[0])) {
            if (this.compareIPv6Addr(hostname, ip[0]) == 0) {
              return true;
            }
          }
        }
      } else if (ip.length == 2) {
        // 範囲指定
        var ipVer = this.getIpAddrVersion(hostname);
        if (typeof ipVer === 'number' && ipVer === this.getIpAddrVersion(ip[0])) {
          if (this.compareIpAddr(hostname, ip[0], ipVer) >= 0 &&
            this.compareIpAddr(hostname, ip[1], ipVer) <= 0) {
            return true;
          }
        }
      }
    }
  }

  isInExHostList(exlist, url) {
    var hostname = url.hostname; // 小文字化済み

    for (var i = 0; i < exlist.length; i++) {
      if (exlist[i].length != 2) continue;

      var type = exlist[i][0];
      var value = exlist[i][1].toLowerCase();
      switch (type) {
        case exListType.PART_HOST:
          if (hostname.includes(value)) {
            return true;
          }
          break;
        case exListType.FULL_HOST:
          if (hostname === value) {
            return true;
          }
          break;
        case exListType.REGEX_HOST:
          var regex = new RegExp(value);
          if (regex.test(hostname)) {
            return true;
          }
          break;
        case exListType.URL_PATH:
          var urlpath = url.host + url.pathname;
          if (urlpath.includes(value)) {
            return true;
          }
          break;
        default:
          break;
      }
    }
  }

  isInExclusionList(url) {
    if (this.conf[confKey.enableExHost] === "true" && this.conf[confKey.exHostList]) {
      if (this.isInExHostList(this.conf[confKey.exHostList], url)) {
        return true;
      }
    }
    if (this.conf[confKey.enableExIp] === "true" && this.conf[confKey.exIpList]) {
      if (this.isInExIpList(this.conf[confKey.exIpList], url)) {
        return true;
      }
    }

    if (this.sysConf[confKey.enableExHost] === "true" && this.sysConf[confKey.exHostList]) {
      if (this.isInExHostList(this.sysConf[confKey.exHostList], url)) {
        return true;
      }
    }
    if (this.sysConf[confKey.enableExIp] === "true" && this.sysConf[confKey.exIpList]) {
      if (this.isInExIpList(this.sysConf[confKey.exIpList], url)) {
        return true;
      }
    }

    return false;
  }

  isNoRatingMode(url) {
    if (this.conf[confKey.enableNoRatingOnErr] !== "true") {
      return false;
    }

    if (url === BLOCK_TEST_URL || url === ALLOW_TEST_URL) {
      return false;
    }

    if (!this.ratingState.skip) {
      return false;
    }

    var disableDate = this.ratingState.disableDate;
    if (disableDate.length < 1) {
      this.ratingState.skip = false;
      return false;
    }

    var now = Math.floor(Date.now() / 1000); // unix timestamp
    var lastDisableDate = disableDate[disableDate.length - 1];
    if (now - lastDisableDate > this.conf[confKey.ratingReturnTime]) {
      this.ratingState.skip = false;
      this.ratingState.returnDate = now;
      chrome.storage.local.set(
        {
          RATING_STATE: this.ratingState,
        },
        function () {}
      );
      return false;
    }

    return true;
  }

  countRatingError() {
    var errCount = 1;
    var now = Math.floor(Date.now() / 1000); // unix timestamp
    var startDate = now - this.conf[confKey.connectErrTime];
    for (var i = this.ratingState.errDate.length - 1; i >= 0; i--) {
      if (this.ratingState.errDate[i] >= startDate) {
        errCount += 1;
      } else {
        this.ratingState.errDate.splice(i, 1);
      }
    }
    this.ratingState.errDate.push(now);

    if (errCount >= this.conf[confKey.connectErrCount]) {
      this.ratingState.skip = true;
      this.ratingState.errDate = [];
      this.ratingState.disableDate.push(now);
      if (this.ratingState.disableDate.length > maxDateListLength) {
        this.ratingState.disableDate.shift();
      }
    }

    chrome.storage.local.set(
      {
        RATING_STATE: this.ratingState,
      },
      function () {}
    );
  }

  initRatingDB(url) {
    try {
      var req = new XMLHttpRequest();
      req.open("GET", url, false);
      req.setRequestHeader('x-rating-dbver', this.dbVersion);
      req.send();

      if (req.status == 200) {
        this.saveRatingDB(JSON.parse(req.responseText));
      }
    } catch(e){
    }
  }

  saveRatingDB(data) {
    if (!data.ratingdb) {
      return;
    }

    var dbVer = data.ratingdb[dbVersion];
    if (!dbVer || dbVer === "-1" || dbVer === this.dbVersion) {
      return;
    }

    var db = data.ratingdb[database];
    if (!db) {
      return;
    }

    this.dbVersion = dbVer;
    this.ratingDB = db;

    chrome.storage.local.set(
      {
        DB_VERSION: this.dbVersion,
        DATABASE: this.ratingDB,
      },
      function () {}
    );
  }

  saveConf(data) {
    if (!data.conf) {
      return;
    }

    var confVer = data.conf[confKey.version];
    if (!confVer || confVer === "-1" || confVer === this.confVersion) {
      return;
    }

    this.conf = data.conf;
    this.confVersion = confVer;

    chrome.storage.local.set(
      {
        CONF: this.conf,
      },
      function () {}
    );
  }

  saveSysConf(data) {
    if (!data.system) {
      return;
    }

    var confVer = data.system[confKey.version];
    if (!confVer || confVer === "-1" || confVer === this.sysVersion) {
      return;
    }

    this.sysConf = data.system;
    this.sysVersion = confVer;

    chrome.storage.local.set(
      {
        SYS_CONF: this.sysConf,
      },
      function () {}
    );
  }

  clearDateList() {
    this.ratingState.disableDate = [];
    this.ratingState.returnDate = null;

    chrome.storage.local.set(
      {
        RATING_STATE: this.ratingState,
      },
      function () {}
    );
  }

  termSessionMng(requestId) {
    if (!this.sessionMng.hasOwnProperty(requestId)) {
      return;
    }

    delete this.sessionMng[requestId];
    return;
  }
}

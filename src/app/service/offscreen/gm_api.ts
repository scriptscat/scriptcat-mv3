import { GetSender, Group, MessageConnect } from "@Packages/message/server";

export default class GMApi {
  constructor(private group: Group) {}

  dealXhrResponse(con: MessageConnect, details: GMSend.XHRDetails, event: string, xhr: XMLHttpRequest, data?: any) {
    const finalUrl = xhr.responseURL || details.url;
    // 判断是否有headerFlag-final-url,有则替换finalUrl
    let response: GMTypes.XHRResponse = {
      finalUrl,
      readyState: <any>xhr.readyState,
      status: xhr.status,
      statusText: xhr.statusText,
      // responseHeaders: xhr.getAllResponseHeaders().replace(removeXCat, ""),
      responseType: details.responseType,
    };
    if (data) {
      response = Object.assign(response, data);
    }
    con.sendMessage({
      action: event,
      data: response,
    });
    return response;
  }

  xmlHttpRequest(details: GMSend.XHRDetails, sender: GetSender) {
    const xhr = new XMLHttpRequest();
    const con = sender.getConnect();
    xhr.open(details.method || "GET", details.url);
    // 添加header
    if (details.headers) {
      for (const key in details.headers) {
        xhr.setRequestHeader(key, details.headers[key]);
      }
    }
    xhr.onload = () => {
      this.dealXhrResponse(con, details, "onload", xhr);
    };
    xhr.onloadstart = () => {
      this.dealXhrResponse(con!, details, "onloadstart", xhr);
    };
    xhr.onloadend = () => {
      this.dealXhrResponse(con!, details, "onloadend", xhr);
    };
    xhr.onabort = () => {
      this.dealXhrResponse(con!, details, "onabort", xhr);
    };
    xhr.onerror = () => {
      this.dealXhrResponse(con!, details, "onerror", xhr);
    };
    xhr.onprogress = (event) => {
      const respond: GMTypes.XHRProgress = {
        done: xhr.DONE,
        lengthComputable: event.lengthComputable,
        loaded: event.loaded,
        total: event.total,
        totalSize: event.total,
      };
      this.dealXhrResponse(con!, details, "onprogress", xhr, respond);
    };
    xhr.onreadystatechange = () => {
      this.dealXhrResponse(con!, details, "onreadystatechange", xhr);
    };
    xhr.ontimeout = () => {
      con?.sendMessage({ action: "ontimeout", data: {} });
    };

    if (details.timeout) {
      xhr.timeout = details.timeout;
    }
    if (details.overrideMimeType) {
      xhr.overrideMimeType(details.overrideMimeType);
    }
    xhr.send();
    con?.onDisconnect(() => {
      xhr.abort();
    });
  }

  init() {
    this.group.on("xmlHttpRequest", this.xmlHttpRequest.bind(this));
  }
}

import { Group, MessageConnect } from "@Packages/message/server";

export default class GMApi {
  constructor(private group: Group) {}

  xmlHttpRequest(params: GMSend.XHRDetails, con: MessageConnect | null) {
    const xhr = new XMLHttpRequest();
    xhr.open(params.method || "GET", params.url);
    // 添加header
    if (params.headers) {
      for (const key in params.headers) {
        xhr.setRequestHeader(key, params.headers[key]);
      }
    }
    xhr.onload = function () {
      console.log(xhr.getAllResponseHeaders());
      con?.sendMessage({
        action: "onload",
        data: {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
        },
      });
    };
    xhr.send();
  }

  init() {
    this.group.on("xmlHttpRequest", this.xmlHttpRequest.bind(this));
  }
}

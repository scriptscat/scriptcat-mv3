import { Group } from "@Packages/message/server";

export class GMApi {
  constructor(private group: Group) {}

  xmlHttpRequest(params: GMSend.XHRDetails) {
    console.log(params);
    const xhr = new XMLHttpRequest();
    xhr.open(params.method || "GET", params.url);
    xhr.onload = function () {
      console.log(xhr, xhr.getAllResponseHeaders());
    };
    xhr.send();
  }

  init() {
    this.group.on("xmlHttpRequest", this.xmlHttpRequest.bind(this));
  }
}

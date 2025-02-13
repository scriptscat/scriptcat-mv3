import { Group } from "@Packages/message/server";

export class GMApi {
  constructor(private group: Group) {}

  xmlHttpRequest(){

  }

  init() {
    this.group.on("xmlHttpRequest", async (data) => {
      console.log(data);
    });
  }
}

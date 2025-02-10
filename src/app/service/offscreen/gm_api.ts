import { Group } from "@Packages/message/server";

export class GMApi {
  constructor(private group: Group) {}

  init() {
    this.group.on("requestXhr", async (data) => {
      console.log(data);
    });
  }
}

import { Repo } from "./repo";

export type Metadata = { [key: string]: string[] };

export type SUBSCRIBE_STATUS = 1 | 2 | 3 | 4;
export const SUBSCRIBE_STATUS_ENABLE: SUBSCRIBE_STATUS = 1;
export const SUBSCRIBE_STATUS_DISABLE: SUBSCRIBE_STATUS = 2;

export interface SubscribeScript {
  uuid: string;
  url: string;
}

export interface Subscribe {
  id: number;
  url: string;
  name: string;
  code: string;
  author: string;
  scripts: { [key: string]: SubscribeScript };
  metadata: Metadata;
  status: SUBSCRIBE_STATUS;
  createtime: number;
  updatetime?: number;
  checktime: number;
}

export class SubscribeDAO extends Repo<Subscribe> {
  constructor() {
    super("subscribe");
  }

  public findByUrl(url: string) {
    return this.findOne((key, value) => value.url === url);
  }
}

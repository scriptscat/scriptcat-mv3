import { Repo } from "./repo";

export interface OldValue {
  id: number;
  scriptId: number;
  storageName?: string;
  key: string;
  value: any;
  createtime: number;
  updatetime: number;
}

export interface Value {
  uuid: string;
  storageName?: string;
  data: { [key: string]: any };
  createtime: number;
  updatetime: number;
}

export class ValueDAO extends Repo<Value> {
  constructor() {
    super("value");
  }
}

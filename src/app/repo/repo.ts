export abstract class Repo<T> {
  constructor(private prefix: string) {
    if (!prefix.endsWith(":")) {
      prefix += ":";
    }
  }

  private joinKey(key: string) {
    return this.prefix + key;
  }

  public async _save(key: string, val: T) {
    return new Promise((resolve) => {
      const data = {
        [this.joinKey(key)]: val,
      };
      chrome.storage.local.set(data, () => {
        resolve(val);
      });
    });
  }

  public get(key: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      key = this.joinKey(key);
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  public find(filters?: (key: string, value: T) => boolean): Promise<T[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get((result) => {
        const ret = [];
        for (const key in result) {
          if (key.startsWith(this.prefix) && (!filters || filters(key, result[key]))) {
            ret.push(result[key]);
          }
        }
        resolve(ret);
      });
    });
  }

  findOne(filters?: (key: string, value: T) => boolean): Promise<T | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get((result) => {
        for (const key in result) {
          if (key.startsWith(this.prefix) && (!filters || filters(key, result[key]))) {
            return resolve(result[key]);
          }
        }
        resolve(undefined);
      });
    });
  }
}

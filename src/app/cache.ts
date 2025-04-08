export interface CacheStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  has(key: string): Promise<boolean>;
  del(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export class ExtCache implements CacheStorage {
  get(key: string): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.session.get(key, (value) => {
        resolve(value[key]);
      });
    });
  }

  set(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.session.set(
        {
          [key]: value,
        },
        () => {
          resolve();
        }
      );
    });
  }

  has(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.session.get(key, (value) => {
        resolve(value[key] !== undefined);
      });
    });
  }

  del(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.session.remove(key, () => {
        resolve();
      });
    });
  }

  list(): Promise<string[]> {
    return new Promise((resolve) => {
      chrome.storage.session.get(null, (value) => {
        resolve(Object.keys(value));
      });
    });
  }
}

export class MapCache {
  private map: Map<string, any> = new Map();

  get(key: string): Promise<any> {
    return new Promise((resolve) => {
      resolve(this.map.get(key));
    });
  }

  set(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      this.map.set(key, value);
      resolve();
    });
  }

  has(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      resolve(this.map.has(key));
    });
  }

  del(key: string): Promise<void> {
    return new Promise((resolve) => {
      this.map.delete(key);
      resolve();
    });
  }

  list(): Promise<string[]> {
    return new Promise((resolve) => {
      resolve(Array.from(this.map.keys()));
    });
  }
}

export async function incr(cache: Cache, key: string, increase: number): Promise<number> {
  const value = await cache.get(key);
  let num = value || 0;
  num += increase;
  await cache.set(key, num);
  return num;
}

export default class Cache {
  static instance: Cache = new Cache(new ExtCache());

  static getInstance(): Cache {
    return Cache.instance;
  }

  private constructor(private storage: CacheStorage) {}

  public get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  public async getOrSet(key: string, set: () => Promise<any>): Promise<any> {
    let ret = await this.get(key);
    if (!ret) {
      ret = await set();
      this.set(key, ret);
    }
    return Promise.resolve(ret);
  }

  public set(key: string, value: any): Promise<void> {
    return this.storage.set(key, value);
  }

  public has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  public del(key: string): Promise<void> {
    return this.storage.del(key);
  }

  public list(): Promise<string[]> {
    return this.storage.list();
  }

  private txPromise: Map<string, Promise<any>> = new Map();

  // 事务处理,如果有事务正在进行,则等待
  public async tx(key: string, set: (result: any) => Promise<any>): Promise<void> {
    let promise = this.txPromise.get(key);
    if (promise) {
      await promise;
    }

    promise = this.get(key)
      .then((result) => set(result))
      .then((value) => {
        console.log("tx", key, value);
        if (value) {
          return this.set(key, value);
        }
        return Promise.resolve();
      });
    this.txPromise.set(key, promise);
    await promise;
    this.txPromise.delete(key);
  }
}

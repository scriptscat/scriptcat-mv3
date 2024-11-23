export default class Cache {
  static instance: Cache = new Cache();

  static getInstance(): Cache {
    return Cache.instance;
  }

  map: Map<string, unknown>;

  private constructor() {
    this.map = new Map<string, unknown>();
  }

  public get(key: string): unknown {
    return this.map.get(key);
  }

  public async getOrSet(key: string, set: () => Promise<unknown>): Promise<unknown> {
    let ret = this.get(key);
    if (!ret) {
      ret = await set();
      this.set(key, ret);
    }
    return Promise.resolve(ret);
  }

  public set(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  public has(key: string): boolean {
    return this.map.has(key);
  }

  public del(key: string): void {
    this.map.delete(key);
  }

  public list(): string[] {
    return Array.from(this.map.keys());
  }
}

import {ClearCallback, FetchCallback, InitStorageCallback} from './libraryTypes';

interface ConstructorArgs<ACTION, STORAGE> {
    name: string;
    initStorage: InitStorageCallback<STORAGE>;
    fetch: FetchCallback<ACTION, STORAGE>;
    clear: ClearCallback<ACTION, STORAGE> | null;
    maximumStalenessMs: number;
    maximumRejectedStalenessMs: number;
    cacheMaxAgeMs: number;
    refreshIntervalMs: number;
}

export class Resource<ACTION, STORAGE> {
    public name: string;
    public initStorage: InitStorageCallback<STORAGE>;
    public fetch: FetchCallback<ACTION, STORAGE>;
    public clear: ClearCallback<ACTION, STORAGE> | null;
    public maximumStalenessMs: number;
    public maximumRejectedStalenessMs: number;
    public cacheMaxAgeMs: number;
    public refreshIntervalMs: number;

    public constructor(args: ConstructorArgs<ACTION, STORAGE>) {
        this.name = args.name;
        this.initStorage = args.initStorage;
        this.fetch = args.fetch;
        this.clear = args.clear;
        this.maximumStalenessMs = args.maximumStalenessMs;
        this.maximumRejectedStalenessMs = args.maximumRejectedStalenessMs;
        this.cacheMaxAgeMs = args.cacheMaxAgeMs;
        this.refreshIntervalMs = args.refreshIntervalMs;
        Object.freeze(this);
    }

    public hasMaximumStaleness(): boolean {
        return this.maximumStalenessMs > 0;
    }

    public hasMaximumRejectedStaleness(): boolean {
        return this.maximumRejectedStalenessMs > 0;
    }

    public isCacheable(): boolean {
        return this.cacheMaxAgeMs > 0;
    }

    public hasRefreshInterval(): boolean {
        return this.refreshIntervalMs > 0;
    }
}

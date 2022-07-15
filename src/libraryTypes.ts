// All of the types that are relevant for users of this library
/* istanbul ignore next */

import * as Immutable from 'immutable';

export type TransactionRequest<DISPATCHED> = (resourceName: string, params: ActionParams) => DISPATCHED;
export type TransactionCallback<DISPATCHED> = (request: TransactionRequest<DISPATCHED>) => any;

export type Dispatcher<DISPATCHED, ACTION> = (action: ACTION) => DISPATCHED;

export type ActionParams = Record<string, any> | Immutable.Map<string, any> | Immutable.Record<any>;
export type InitStorageCallback<STORAGE> = (params: ActionParams) => STORAGE;

export interface FetchCallbackMeta<STORAGE> {
    storage: STORAGE;
    invalidate: () => number;
    onCancel: (callback: () => void) => void;
}
export type FetchCallback<ACTION, STORAGE> = (params: ActionParams, meta: FetchCallbackMeta<STORAGE>) => ACTION;

export interface ClearCallbackMeta<STORAGE> {
    storage: STORAGE;
}
export type ClearCallback<ACTION, STORAGE> = (params: ActionParams, meta: ClearCallbackMeta<STORAGE>) => ACTION;

export interface ResourceDefinition<ACTION, STORAGE> {
    name: string;
    initStorage?: InitStorageCallback<STORAGE>;
    fetch: FetchCallback<ACTION, STORAGE>;
    clear: ClearCallback<ACTION, STORAGE> | null;
    maximumStaleness?: number | string;
    maximumRejectedStaleness?: number | string;
    cacheMaxAge?: number | string;
    refreshInterval?: number | string;
}

export interface SessionOptions {
    allowTransactionAbort?: boolean;
}

export interface ManagerOptions {
    periodicWorkInterval?: number;
    allowTransactionAbort?: boolean;
}

// The public API, which hides internal functions and avoids users having to worry about `this`:
export interface MeridviaSession<DISPATCHED>{
    (callback: TransactionCallback<DISPATCHED>): any;
    destroy: () => boolean;
    allowTransactionAbort: boolean;
}

export interface MeridviaManager<DISPATCHED, ACTION> {
    destroy(): void;
    createSession(options?: SessionOptions): MeridviaSession<DISPATCHED>;
    resource(resource: ResourceDefinition<ACTION, any>): void;
    resources(resource: ResourceDefinition<ACTION, any>[]): void;
    cleanupResources(): void;
    invalidate(resourceName?: string, params?: ActionParams): number;
    refresh(resourceName?: string, params?: ActionParams): number;
}

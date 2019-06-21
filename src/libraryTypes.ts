// All of the types that are relevant for users of this library
/* istanbul ignore next */

import * as Immutable from 'immutable';

export type TransactionRequest<DISPATCHED> = (resourceName: string, params: ActionParams) => DISPATCHED;
export type TransactionCallback<DISPATCHED> = (request: TransactionRequest<DISPATCHED>) => any;

export type Dispatcher<DISPATCHED, ACTION> = (action: ACTION) => DISPATCHED;

export type UserStorage = object;
export type ActionParams = object | Immutable.Map<string, any> | Immutable.Record.Class;
export type InitStorageCallback = (params: ActionParams) => UserStorage;

export interface FetchCallbackMeta {
    storage: UserStorage;
    invalidate: () => number;
    onCancel: (callback: () => void) => void;
}
export type FetchCallback<ACTION> = (params: ActionParams, meta: FetchCallbackMeta) => ACTION;

export interface ClearCallbackMeta {
    storage: UserStorage;
}
export type ClearCallback<ACTION> = (params: ActionParams, meta: ClearCallbackMeta) => ACTION;


export interface ResourceDefinition<ACTION> {
    name: string;
    initStorage?: InitStorageCallback;
    fetch: FetchCallback<ACTION>;
    clear: ClearCallback<ACTION> | null;
    maximumStaleness?: number | string;
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
    resource(resource: ResourceDefinition<ACTION>): void;
    resources(resource: ResourceDefinition<ACTION>[]): void;
    cleanupResources(): void;
    invalidate(resourceName?: string, params?: ActionParams): number;
    refresh(resourceName?: string, params?: ActionParams): number;
}

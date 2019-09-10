import {isPromise} from './typing';
import {createDeferred, Deferred} from './deferred';
import {ResourceInstanceKey} from './ResourceInstanceKey';
import {Resource} from './Resource';
import {Session} from './Session';
import {UserStorage} from './libraryTypes';
import {error} from './error';

type ReturnValue<T> = {value: T} | {error: any};

export class ResourceInstance<DISPATCHED, ACTION> {
    public readonly resourceInstanceKey: ResourceInstanceKey;
    public readonly resource: Resource<ACTION>;
    public fetchReturnValue: ReturnValue<DISPATCHED> | null;
    public readonly activeForSessions: Set<Session<DISPATCHED, ACTION>>;
    public lastUsageMs: number;
    public lastFetchAttemptMs: number;
    public lastFetchCompletedMs: number;
    public lastFetchRejected: boolean;
    public activeFetchIdentifier: symbol;
    public forceInvalidated: boolean;
    public readonly userStorage: UserStorage;
    public readonly deferredCleanupFetch: Deferred;

    public constructor(resourceInstanceKey: ResourceInstanceKey, resource: Resource<ACTION>, userStorage: UserStorage) {
        this.resourceInstanceKey = resourceInstanceKey;
        this.resource = resource;
        // the return value of dispatch(resource.fetch(...)) (including rejected promises and thrown errors):
        this.fetchReturnValue = null;
        // The `Session`s that this resource instance is currently active for
        this.activeForSessions = new Set();
        // Date.now() value; The last time this resource was requested:
        this.lastUsageMs = 0;
        // Date.now() value; The last time the fetch action was attempted:
        this.lastFetchAttemptMs = 0;
        // Date.now() value; The last time the dispatched fetch action completed (after resolving promises):
        this.lastFetchCompletedMs = 0;
        // If true, the last dispatched fetch action ended up with a thrown error or a rejected promise
        this.lastFetchRejected = false;
        // Reset during every fetch action so that we can track if it is still the latest one
        this.activeFetchIdentifier = Symbol();
        // Manually invalidated by the user:
        this.forceInvalidated = false;
        // Passed to actions so that the user can store values with the same lifecycle as the resource instance:
        this.userStorage = userStorage;
        // Invoked whenever a new action supersedes the old one; Can be used to cancel asynchronous tasks such as an api call for example.
        this.deferredCleanupFetch = createDeferred();
        Object.seal(this);
    }

    public setActiveForSession(session: Session<DISPATCHED, ACTION>): void {
        this.activeForSessions.add(session);
    }

    public clearActiveForSession(session: Session<DISPATCHED, ACTION>): void {
        this.activeForSessions.delete(session);
    }

    public isActive(): boolean {
        return this.activeForSessions.size > 0;
    }

    public isStale(now: number): boolean {
        if (this.forceInvalidated) {
            return true;
        }

        const lastFetchAgoMs = now - this.lastFetchAttemptMs;

        if (this.lastFetchRejected) {
            return this.resource.hasMaximumRejectedStaleness() && lastFetchAgoMs > this.resource.maximumRejectedStalenessMs;
        }
        else {
            return this.resource.hasMaximumStaleness() && lastFetchAgoMs > this.resource.maximumStalenessMs;
        }
    }

    public isCacheable(now: number): boolean {
        return !this.forceInvalidated &&
               this.resource.isCacheable() &&
               now - this.lastFetchAttemptMs <= this.resource.cacheMaxAgeMs;
    }

    public shouldBeCleared(now: number): boolean {
        return !this.isActive() && !this.isCacheable(now);
    }

    public shouldRefresh(now: number): boolean {
        return this.isActive() &&
            this.resource.hasRefreshInterval() &&
            now - this.lastFetchAttemptMs >= this.resource.refreshIntervalMs &&
            now - this.lastFetchCompletedMs >= this.resource.refreshIntervalMs;
    }

    public returnLastValue(): DISPATCHED | null {
        /* istanbul ignore if */
        if (!this.fetchReturnValue) {
            throw error('AssertionError', 'ResourceInstance#returnLastValue() called without ever having attempted a fetch');
        }
        if ('error' in this.fetchReturnValue) {
            throw this.fetchReturnValue.error;
        }
        return this.fetchReturnValue.value;
    }

    public performFetchAction(dispatcher: (action: ACTION) => DISPATCHED, now: number, {logErrors = false} = {}): void {
        this.deferredCleanupFetch.invoke();

        const fetchIdentifier = Symbol();
        this.activeFetchIdentifier = fetchIdentifier;
        this.forceInvalidated = false;
        this.lastFetchAttemptMs = now;

        const invalidate = (): number => {
            if (this.activeFetchIdentifier === fetchIdentifier) {
                this.forceInvalidated = true;
                return 1;
            }
            return 0;
        };

        const params = this.resourceInstanceKey.toParams();
        const meta = {
            storage: this.userStorage,
            invalidate,
            onCancel: this.deferredCleanupFetch.defer,
        };

        try {
            const action = this.resource.fetch(params, meta);
            let returnValue = dispatcher(action);

            if (isPromise(returnValue)) {
                const promise = returnValue.then(async (value: any): Promise<any> => {
                    this.lastFetchRejected = false;
                    this.lastFetchCompletedMs = Date.now();
                    return value;
                }, async (err: any): Promise<any> => {
                    this.lastFetchRejected = true;
                    this.lastFetchCompletedMs = Date.now();
                    return Promise.reject(err);
                });

                // if we end up here that means DISPATCHED allows for Promise, that means casting is okay
                returnValue = promise as any as DISPATCHED;
            }
            else {
                this.lastFetchRejected = false;
                this.lastFetchCompletedMs = Date.now();
            }

            this.fetchReturnValue = {value: returnValue};
        }
        catch (err) {
            this.lastFetchRejected = true;
            this.lastFetchCompletedMs = Date.now();
            this.fetchReturnValue = {error: err};

            if (logErrors) {
                /* istanbul ignore else */
                // eslint-disable-next-line no-console
                if (typeof console === 'object' && typeof console.error === 'function')  {
                    // eslint-disable-next-line no-console
                    console.error('Error while dispatching fetch action for', this.resource.name, 'resource:', err, err.stack);
                }
            }
        }
    }

    public performClearAction(dispatcher: (action: ACTION) => DISPATCHED): void {
        // this method should never throw; otherwise we might be skipping subsequent cleanup actions
        try {
            this.deferredCleanupFetch.invoke();

            if (this.resource.clear) {
                const action = this.resource.clear(this.resourceInstanceKey.toParams(), {storage: this.userStorage});
                dispatcher(action);
            }
        }
        catch (err) {
            /* istanbul ignore else */
            // eslint-disable-next-line no-console
            if (typeof console === 'object' && typeof console.error === 'function')  {
                // eslint-disable-next-line no-console
                console.error('Error while dispatching clear action for', this.resource.name, 'resource:', err, err.stack);
            }
        }
    }
}

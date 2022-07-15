import * as Immutable from 'immutable';

import {error, assert} from './error';
import {Manager} from './Manager';
import {Session} from './Session';
import {ResourceInstanceKey} from './ResourceInstanceKey';
import {ResourceInstance} from './ResourceInstance';
import {isPromise, iterateImmutable} from './typing';
import {ActionParams} from './libraryTypes';
import {ExplicitPromise, createExplicitPromise} from './explicitPromise';

export class Transaction<DISPATCHED, ACTION> {
    private readonly _manager: Manager<DISPATCHED, ACTION>;
    private readonly _session: Session<DISPATCHED, ACTION>;
    private readonly _transactionBeginMs: number;
    private _aborted: Error | null;
    private _abortionPromise: ExplicitPromise<void, Error> | null;
    private _ended: boolean;
    private _resourceInstances: Immutable.Set<ResourceInstance<DISPATCHED, ACTION, any>>;

    public constructor(manager: Manager<DISPATCHED, ACTION>, session: Session<DISPATCHED, ACTION>, transactionBeginMs: number) {
        this._manager = manager;
        this._session = session;
        this._transactionBeginMs = transactionBeginMs;
        this._aborted = null;
        // This value is not set so that we avoid rejecting if a promise is not returned at
        // all, to avoid UnhandledPromiseRejectionWarning
        this._abortionPromise = null;
        this._ended = false;
        this._resourceInstances = Immutable.Set();
        Object.seal(this);
    }

    public request(resourceName: string, params: ActionParams): DISPATCHED {
        if (this._aborted) {
            throw this._aborted;
        }

        if (this._ended) {
            throw error(
                'IllegalStateError',
                'This request function is no longer valid. The transaction request() function should only be called during ' +
                'a session transaction. For example: `mySession(request => { request("something") })`',
            );
        }

        assert(typeof resourceName === 'string', 'TypeError', '`name` must be a string');
        const resource = this._manager.getResource(resourceName);
        if (!resource) {
            throw error('ValueError', 'The given resourceName has not been registered');
        }

        // Find or create a new ResourceInstance
        const resourceInstanceKey = ResourceInstanceKey.create(resourceName, params);
        let resourceInstance = this._manager.getResourceInstance(resourceInstanceKey);
        // The fetch action should be performed if there was no ResourceInstance yet, or
        // if its data is too old.
        const shouldFetch = !resourceInstance || resourceInstance.isStale(this._transactionBeginMs);
        if (!resourceInstance) {
            const storage = resource.initStorage(resourceInstanceKey.toParams());
            resourceInstance = new ResourceInstance(resourceInstanceKey, resource, storage);
        }

        if (shouldFetch) {
            resourceInstance.performFetchAction(this._manager.dispatcher, this._transactionBeginMs);
            if (resource.isCacheable() || resource.hasRefreshInterval()) {
                this._manager.schedulePeriodicWork();
            }
        }

        // Register the resource instance (no-op if it already was registered)
        // Do this _after_ performing the fetch action, which might throw, in which case
        // we should not register it.
        this._manager.setResourceInstance(resourceInstanceKey, resourceInstance);

        // Mark that the ResourceInstance is used by this session, this value is potentially
        // cleared after a newer transaction completed. If all sessions are cleared, the clear
        // action will be called by the Manager (unless caching has been set)
        resourceInstance.setActiveForSession(this._session);
        resourceInstance.lastUsageMs = this._transactionBeginMs;
        this._resourceInstances = this._resourceInstances.add(resourceInstance);

        // Pass through the return value of the action, this is often useful to pass a promise.
        // For example:
        //     await mySession(async request => {
        //         const userId = await request('session/active-user-id')
        //         await request('session/user', {userId})
        //     })
        // this value is always DISPATCHED if performFetchAction has been successful
        const returnValue = resourceInstance.returnLastValue() as DISPATCHED;

        if (isPromise(returnValue)) {
            if (!this._abortionPromise) {
                this._abortionPromise = createExplicitPromise();
            }

            return Promise.race([
                this._abortionPromise.promise,
                returnValue,
            ]) as any as DISPATCHED;
        }
        else {
            return returnValue;
        }
    }

    // reached the end of the transaction callback
    public end(transactionsToCleanUp: Immutable.Set<Transaction<DISPATCHED, ACTION>>): void {
        assert(!this._ended, 'Transaction already ended');
        this._ended = true;

        // For all ResourceInstance that are no longer in use by this session,
        // clear our session on it
        // If all sessions are cleared, the clear action will be called by the
        // Manager (unless caching has been set)
        const previousInstancesSets = [];
        for (const transaction of iterateImmutable(transactionsToCleanUp)) {
            previousInstancesSets.push(transaction._resourceInstances);
        }
        const previousInstances = Immutable.Set().union(
            ...previousInstancesSets,
        ) as Immutable.Set<ResourceInstance<DISPATCHED, ACTION, any>>;

        const removedInstances = previousInstances.subtract(this._resourceInstances);
        for (const resourceInstance of iterateImmutable(removedInstances)) {
            resourceInstance.clearActiveForSession(this._session);
        }

    }

    public abort(reason: Error): void {
        this._aborted = reason;

        if (this._abortionPromise) {
            this._abortionPromise.reject(reason);
        }
    }

    public destroyedSession(reason: Error): void {
        this.abort(reason);
        for (const resourceInstance of iterateImmutable(this._resourceInstances)) {
            resourceInstance.clearActiveForSession(this._session);
        }
    }
}

import * as Immutable from 'immutable';

import {createSession} from './Session';
import {Resource} from './Resource';
import {Timer} from './Timer';
import {parseTimeInterval} from './parseTimeInterval';
import {ResourceInstanceKey} from './ResourceInstanceKey';
import {assert} from './error';
import {createCompositeError} from './compositeError';
import {ResourceInstance} from './ResourceInstance';
import {ImmutableMap, ImmutableSet} from './typing';
import {
    ActionParams,
    UserStorage,
    Dispatcher,
    ResourceDefinition,
    ManagerOptions,
    MeridviaManager,
    MeridviaSession,
    SessionOptions,
} from './libraryTypes';

const DEFAULT_DISPATCHER = <DISPATCHED, ACTION>(value: ACTION): DISPATCHED => value as any as DISPATCHED;
const DEFAULT_PERIODIC_WORK_INTERVAL = 10000;
const DEFAULT_INIT_STORAGE = (): UserStorage => ({});

type ResourceInstances<DISPATCHED, ACTION> = ImmutableMap<ResourceInstanceKey, ResourceInstance<DISPATCHED, ACTION>>;

export class Manager<DISPATCHED, ACTION> {
    public readonly dispatcher: Dispatcher<DISPATCHED, ACTION>;
    public readonly allowTransactionAbort: boolean;
    private _destroyed: boolean;
    private _sessions: ImmutableSet<MeridviaSession<DISPATCHED>>;
    private _resources: ImmutableMap<string, Resource<ACTION>>;
    private _resourceInstances: ResourceInstances<DISPATCHED, ACTION>;
    private readonly _periodicWorkTimer: Timer;

    public constructor(dispatcher: Dispatcher<DISPATCHED, ACTION>, options: ManagerOptions) {
        const {
            periodicWorkInterval = DEFAULT_PERIODIC_WORK_INTERVAL,
        } = options;
        const allowTransactionAbort = options.allowTransactionAbort === true;

        assert(typeof dispatcher === 'function', 'TypeError', '`dispatcher` must be a function');
        assert(
            typeof periodicWorkInterval === 'number' && Number.isFinite(periodicWorkInterval),
            'TypeError',
            '`periodicWorkInterval` must be a finite number'
        );
        this.dispatcher = dispatcher;
        this.allowTransactionAbort = allowTransactionAbort;
        this._destroyed = false;
        this._sessions = Immutable.Set() as ImmutableSet<MeridviaSession<DISPATCHED>>;
        this._resources = Immutable.Map() as ImmutableMap<string, Resource<ACTION>>;
        this._resourceInstances = Immutable.Map() as ResourceInstances<DISPATCHED, ACTION>;
        // A single timer is used so that actions are batched together as much as possible (as opposed to setting a precisely
        // accurate timer for each resource instance), this is more performant if the user is using something like
        // redux-batched-subscribe
        this._periodicWorkTimer = new Timer(periodicWorkInterval, (): void => this.periodicWork());
        Object.seal(this);
    }

    public destroy(): void {
        this._destroyed = true;

        for (const session of this._sessions) {
            session.destroy();
        }
        assert(this._sessions.size === 0, 'AssertionError', 'this._sessions should be empty');
        this.invalidate(undefined, undefined);
        assert(this._resourceInstances.size === 0, 'AssertionError', 'this._resourceInstances should be empty');
        this._periodicWorkTimer.cancel();

    }

    public createSession(options: SessionOptions): MeridviaSession<DISPATCHED> {
        assert(!this._destroyed, 'IllegalStateError', 'This manager has been destroyed');
        const allowTransactionAbort = typeof options.allowTransactionAbort === 'boolean'
            ? options.allowTransactionAbort
            : this.allowTransactionAbort;
        const session = createSession<DISPATCHED, ACTION>(this, {allowTransactionAbort});
        this._sessions = this._sessions.add(session);
        return session;
    }

    public sessionDeleted(session: MeridviaSession<DISPATCHED>): void {
        this._sessions = this._sessions.delete(session);
    }

    public registerResource(options: ResourceDefinition<ACTION>): void {
        assert(!this._destroyed, 'IllegalStateError', 'This manager has been destroyed');
        const {
            name,
            initStorage = DEFAULT_INIT_STORAGE,
            fetch,
            clear = null,
            maximumStaleness = 0,
            cacheMaxAge = 0,
            refreshInterval = 0,
        } = options;
        assert(typeof name === 'string', 'TypeError', '`name` must be a string');
        assert(typeof fetch === 'function', 'TypeError', '`fetch` must be a function');
        assert(typeof clear === 'function' || clear === null, 'TypeError', '`clear` must be a function or null');
        assert(!this._resources.has(name), 'ValueError', 'The given `name` is already in use');
        const maximumStalenessMs = parseTimeInterval(maximumStaleness, 'maximumStaleness');
        const cacheMaxAgeMs = parseTimeInterval(cacheMaxAge, 'cacheMaxAge');
        const refreshIntervalMs = parseTimeInterval(refreshInterval, 'refreshInterval');
        const resource = new Resource({name, initStorage, fetch, clear, maximumStalenessMs, cacheMaxAgeMs, refreshIntervalMs});
        this._resources = this._resources.set(name, resource);
    }

    public getResource(name: string): Resource<ACTION> | null {
        assert(typeof name === 'string', 'TypeError', '`name` must be a string');
        return this._resources.get(name);
    }

    public getResourceInstance(resourceInstanceKey: ResourceInstanceKey): ResourceInstance<DISPATCHED, ACTION> {
        return this._resourceInstances.get(resourceInstanceKey);
    }

    public setResourceInstance(resourceInstanceKey: ResourceInstanceKey, resourceInstance: ResourceInstance<DISPATCHED, ACTION>): void {
        this._resourceInstances = this._resourceInstances.set(resourceInstanceKey, resourceInstance);
    }

    public cleanupResources(): {cachedResources: number} {
        const now = Date.now();
        let cachedResources = 0;

        const resourceInstances = this._resourceInstances.asMutable();
        const dispatchClearTodo = [];

        for (const [resourceInstanceKey, resourceInstance] of  this._resourceInstances) {
            if (resourceInstance.shouldBeCleared(now)) {
                resourceInstances.delete(resourceInstanceKey);
                dispatchClearTodo.push(resourceInstance);
            }
            else if (!resourceInstance.isActive()) {
                ++cachedResources;
            }
        }

        this._resourceInstances = resourceInstances.asImmutable();

        // dispatch the actual actions in a second step. In case the clear action ends up back here (e.g. for sub-sessions)
        for (const resourceInstance of dispatchClearTodo) {
            resourceInstance.performClearAction(this.dispatcher);
        }

        return {cachedResources};
    }

    public refreshPendingResources(): {refreshableResources: number} {
        let refreshableResources = 0;
        const now = Date.now();

        for (const resourceInstance of this._resourceInstances.values()) {
            if (resourceInstance.resource.hasRefreshInterval()) {
                ++refreshableResources;

                if (resourceInstance.shouldRefresh(now)) {
                    resourceInstance.performFetchAction(this.dispatcher, now, {eatErrors: true});
                }
            }
        }

        return {refreshableResources};
    }

    public periodicWork(): void {
        const {cachedResources} = this.cleanupResources();
        const {refreshableResources} = this.refreshPendingResources();

        if (cachedResources > 0 || refreshableResources > 0) {
            this._periodicWorkTimer.reschedule();
        }
    }

    public schedulePeriodicWork(): void {
        // does nothing if already scheduled:
        this._periodicWorkTimer.schedule();
    }

    public* findInstances(resourceName: string | undefined, params: ActionParams | undefined):
    IterableIterator<ResourceInstance<DISPATCHED, ACTION>> {
        if (resourceName === undefined) {
            yield * this._resourceInstances.values();
        }
        else if (params === undefined) {
            for (const [resourceInstanceKey, resourceInstance] of this._resourceInstances) {
                if (resourceInstanceKey.resourceName === resourceName) {
                    yield resourceInstance;
                }
            }
        }
        else {
            const resourceInstanceKey = ResourceInstanceKey.create(resourceName, params);
            const resourceInstance = this.getResourceInstance(resourceInstanceKey);
            if (resourceInstance) {
                yield resourceInstance;
            }
        }
    }

    public invalidate(resourceName?: string, params?: ActionParams): number {
        let matches = 0;
        for (const resourceInstance of this.findInstances(resourceName, params)) {
            resourceInstance.forceInvalidated = true;
            ++matches;
        }
        this.cleanupResources();
        return matches;
    }

    public refresh(resourceName?: string, params?: ActionParams): number {
        assert(!this._destroyed, 'IllegalStateError', 'This manager has been destroyed');
        const now = Date.now();
        let matches = 0;
        const compositeError = createCompositeError();

        for (const resourceInstance of this.findInstances(resourceName, params)) {
            if (resourceInstance.isActive()) {
                compositeError.try((): void => {
                    resourceInstance.performFetchAction(this.dispatcher, now);
                });
                ++matches;
            }
            else {
                // this resource is not in use by any session, however the user has indicated that it should be refreshed
                // (by calling refresh()), so invalidate the resource so that a new version is fetched when it is used in a new
                // transaction.
                resourceInstance.forceInvalidated = true;
            }
        }

        this.cleanupResources();
        compositeError.maybeThrow('CompositeError', 'refresh(): One or more fetch actions has thrown an error');
        return matches;
    }
}

export const createManager = <DISPATCHED, ACTION> (
    dispatcher: Dispatcher<DISPATCHED, ACTION> = DEFAULT_DISPATCHER,
    options: ManagerOptions = {}
): MeridviaManager<DISPATCHED, ACTION> => {
    const manager = new Manager(dispatcher, options);

    // The public API, which hides internal functions and avoids users having to worry about `this`:
    return {
        destroy: (): void => manager.destroy(),
        createSession: (options: SessionOptions = {}): MeridviaSession<DISPATCHED> => manager.createSession(options),
        resource: (resource: ResourceDefinition<ACTION>): void => manager.registerResource(resource),
        resources: (resources: ResourceDefinition<ACTION>[]): void => {
            for (const resource of resources) {
                manager.registerResource(resource);
            }
        },
        cleanupResources: (): void => {
            manager.cleanupResources();
        },
        invalidate: (resourceName?: string, params?: ActionParams): number =>
            manager.invalidate(resourceName, params),
        refresh: (resourceName?: string, params?: ActionParams): number =>
            manager.refresh(resourceName, params),
    };
};

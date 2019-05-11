import * as Immutable from 'immutable';

// todo switch to `value is Record<any>` in immutable 4
let isRecord_ = (Immutable.Record as any).isRecord as ((value: any) => value is Immutable.Map<string, any>);

/* istanbul ignore else */
if (!isRecord_) {
    isRecord_ = (value: any): value is Immutable.Map<string, any> => {
        // immutable v3
        return value &&
            typeof value === 'object' &&
            typeof value.get === 'function' &&
            Immutable.Map.isMap(value._map);
    };
}

export const isImmutableRecord = isRecord_;
export const isImmutableMap = (value: any): value is Immutable.Map<any, any> => Immutable.Map.isMap(value);
// eslint-disable-next-line @typescript-eslint/ban-types
export const isObject = (value: any): value is Object => typeof value === 'object' && value !== null;
export const isPromise = (value: any): value is Promise<any> => isObject(value) && typeof value.then === 'function';

// Fix missing [Symbol.iterator] type information in immutable v3:
// (add additional methods as we start using them)
export interface ImmutableMap<K, V> extends Immutable.Map<K, V> {
    [Symbol.iterator]: () => IterableIterator<[K, V]>;
    set(key: K, value: V): ImmutableMap<K, V>;
    asMutable(): ImmutableMap<K, V>;
    asImmutable(): ImmutableMap<K, V>;
    values(): IterableIterator<V>;
}
export interface ImmutableSet<T> extends Immutable.Set<T> {
    [Symbol.iterator]: () => IterableIterator<T>;
    add(value: T): ImmutableSet<T>;
    delete(value: T): ImmutableSet<T>;
    clear(): ImmutableSet<T>;
    subtract(...iterables: Immutable.Iterable<any, T>[]): ImmutableSet<T>;
    subtract(...iterables: T[][]): ImmutableSet<T>;
}


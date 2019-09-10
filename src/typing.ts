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
export interface IterateImmutable {
    <K, V>(value: Immutable.Map<K, V>): IterableIterator<[K, V]>;
    <T>(value: Immutable.List<T>): IterableIterator<T>;
    <T>(value: Immutable.Set<T>): IterableIterator<T>;
}
export interface IterateImmutableValues {
    <K, V>(value: Immutable.Map<K, V>): IterableIterator<V>;
}
export const iterateImmutable: IterateImmutable = ((value: any): any => value);
export const iterateImmutableValues: IterateImmutableValues = ((value: any): any => value.values());

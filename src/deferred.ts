import {createCompositeError} from './compositeError';

type DeferredFunc<T extends any[]> =  (...args: T) => void;

export interface Deferred<T extends any[]> {
    defer: (callback: DeferredFunc<T>) => void;
    invoke: (...args: T) => void;
}

export const createDeferred = <T extends any[]>(): Deferred<T> => {
    const stack: DeferredFunc<T>[] = []; // last in, first out
    const defer = (callback: DeferredFunc<T>): void => {
        stack.push(callback);
    };
    const invoke = (...args: T): void => {
        const compositeError = createCompositeError();
        while (1) {
            const callback = stack.pop();
            if (!callback) {
                break;
            }

            compositeError.try((): void => {
                callback(...args);
            });
        }
        compositeError.maybeThrow('CompositeError', 'One or more errors occurred while invoking deferred callbacks');
    };

    return {defer, invoke};
};

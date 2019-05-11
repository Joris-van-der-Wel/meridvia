import {createCompositeError} from './compositeError';

export interface Deferred {
    defer: (callback: Function) => void;
    invoke: (...args: any[]) => void;
}

export const createDeferred = (): Deferred => {
    const stack: Function[] = []; // last in, first out
    const defer = (callback: Function): void => {
        stack.push(callback);
    };
    const invoke = (...args: any[]): void => {
        const compositeError = createCompositeError();
        while (stack.length) {
            const callback = stack.pop() as Function;
            compositeError.try((): void => {
                callback(...args);
            });
        }
        compositeError.maybeThrow('CompositeError', 'One more more errors occurred while invoking deferred callbacks');
    };

    return {defer, invoke};
};

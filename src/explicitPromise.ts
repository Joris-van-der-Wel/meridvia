export interface ExplicitPromise<T, E> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: E) => void;
}

export const createExplicitPromise = <T, E> (): ExplicitPromise<T, E> => {
    let resolve;
    let reject;
    const promise = new Promise<T>((_resolve, _reject): void => {
        resolve = _resolve;
        reject = _reject;
    });
    return {
        promise,
        resolve: resolve as any as (value: T) => void,
        reject: reject  as any as (reason: E) => void,
    };
};

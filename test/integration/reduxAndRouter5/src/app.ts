import {createStore, applyMiddleware, Store} from 'redux';
import reduxThunkMiddleware from 'redux-thunk';
import {State} from 'router5';

import {create as createManager} from './resources';
import {create as createRouter} from './routing';
import {rootReducer} from './reducers';

const fromCallback = async <R, E> (resolver: (callback: (error: E, result: R) => void) => void): Promise<R> => {
    return new Promise((resolve, reject): void => {
        resolver((error: E, result: R): void => {
            if (error) {
                reject(error);
            }
            else {
                resolve(result);
            }
        });
    });
};

interface Router5Error {
    code: string;
    name?: string;
    message?: string;
    path?: string;
}

interface CreateResult {
    stop: () => void;
    store: Store;
    navigate: (routeName: string, params: Record<string, any>) => Promise<State | undefined>;
}

export const create = async (): Promise<CreateResult> => {
    const store = createStore(
        rootReducer,
        applyMiddleware(reduxThunkMiddleware),
    );

    // we need "as any" because redux's type definition for dispatch does not take middleware such as redux-thunk into
    // account
    const dispatcher = store.dispatch as any;
    const manager = createManager(dispatcher);
    const routerSession = manager.createSession();
    const router = createRouter(routerSession);

    await fromCallback<State | undefined, Router5Error>((callback): void => { router.start(callback); });

    return {
        stop: (): void => {
            router.stop();
            manager.destroy();
        },
        store,
        navigate: async (routeName, params): Promise<State | undefined> => {
            return await fromCallback<State | undefined, Router5Error>((callback): void => {
                router.navigate(routeName, params, {}, callback);
            });
        },
    };
};

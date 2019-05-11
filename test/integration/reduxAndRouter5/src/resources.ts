import {createManager, MeridviaManager, Dispatcher} from '../../../..';
import {ApiResult} from './api';
import {AsyncAction, AsyncActionThunk, clearPosts, fetchPosts, fetchComments, clearComments} from './actions';

export type Dispatched = Promise<ApiResult>;
export type Action = AsyncAction<ApiResult> | AsyncActionThunk<ApiResult>;

export const create = (dispatcher: Dispatcher<Dispatched, Action>): MeridviaManager<Dispatched, Action> => {
    const manager = createManager<Dispatched, Action>(dispatcher, {allowTransactionAbort: true});

    manager.resource({
        name: 'posts',
        fetch: fetchPosts,
        clear: clearPosts,
        maximumStaleness: '30s',
    });

    manager.resource({
        name: 'comments',
        fetch: fetchComments,
        clear: clearComments,
        maximumStaleness: '1m',
        cacheMaxAge: '1m',
    });

    return manager;
};

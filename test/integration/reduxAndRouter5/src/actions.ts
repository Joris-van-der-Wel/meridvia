import * as api from './api';
import {ApiResult} from './api';

export interface Action {
    type: string;
    isAsyncAction?: boolean;
}

export interface AsyncActionPending extends Action {
    isAsyncAction: true;
    params: object;
    status: 'pending';
}

export interface AsyncActionSuccess<T> extends Action {
    params: object;
    status: 'success';
    response: T;
}

export interface AsyncActionError extends Action {
    params: object;
    status: 'error';
    error: {
        name: string;
        message: string;
    };
}

export interface AsyncActionClear extends Action {
    params: object;
    status: 'clear';
}

export type AsyncAction<T> = AsyncActionPending | AsyncActionSuccess<T> | AsyncActionError | AsyncActionClear;

export const isAsyncAction = <T>(action: Action): action is AsyncAction<T> => action.isAsyncAction === true;

export const isAsyncActionPending = (action: Action): action is AsyncActionPending =>
    isAsyncAction(action) && action.status === 'pending';

export const isAsyncActionSuccess = <T>(action: Action): action is AsyncActionSuccess<T> =>
    isAsyncAction(action) && action.status === 'success';

export const isAsyncActionError = (action: Action): action is AsyncActionError =>
    isAsyncAction(action) && action.status === 'error';

export const asyncActionPending = (type: string, params: object): AsyncActionPending => ({
    type,
    isAsyncAction: true,
    params,
    status: 'pending',
});

export const asyncActionSuccess = <T>(type: string, params: object, response: T): AsyncActionSuccess<T> => ({
    type,
    isAsyncAction: true,
    params,
    status: 'success',
    response,
});

export const asyncActionError = (type: string, params: object, error: {name: string; message: string}): AsyncActionError => ({
    type,
    isAsyncAction: true,
    params,
    status: 'error',
    error,
});


export const asyncActionClear = (type: string, params: object): AsyncActionClear => ({
    type,
    isAsyncAction: true,
    params,
    status: 'clear',
});

// redux-thunk
export type AsyncActionThunkDispatch<T> = (action: AsyncAction<T>) => AsyncAction<T>;
export type AsyncActionThunk<T> = (dispatch: AsyncActionThunkDispatch<T>) => Promise<T>;

export const fetchPosts = (params: object): AsyncActionThunk<ApiResult> => {
    const {subreddit} = params as {subreddit: string};

    return async (dispatch: AsyncActionThunkDispatch<ApiResult>): Promise<ApiResult> => {
        dispatch(asyncActionPending('FETCH_POSTS', params));

        try {
            const response = await api.fetchPosts(subreddit); // e.g. a fetch()
            dispatch(asyncActionSuccess('FETCH_POSTS', params, response));
            return response;
        }
        catch (error: any) {
            dispatch(asyncActionError('FETCH_POSTS', params, error));
            throw error;
        }
    };
};

export const clearPosts = (params: object): AsyncActionClear => asyncActionClear('FETCH_POSTS', params);

export const fetchComments = (params: object): AsyncActionThunk<ApiResult> => {
    const {postId} = params as {postId: number};

    return async (dispatch: AsyncActionThunkDispatch<ApiResult>): Promise<ApiResult> => {
        dispatch(asyncActionPending('FETCH_COMMENTS', params));

        try {
            const response = await api.fetchComments(postId); // e.g. a fetch()
            dispatch(asyncActionSuccess('FETCH_COMMENTS', params, response));
            return response;
        }
        catch (error: any) {
            dispatch(asyncActionError('FETCH_COMMENTS', params, error));
            throw error;
        }
    };
};

export const clearComments = (params: object): AsyncActionClear => asyncActionClear('FETCH_COMMENTS', params);

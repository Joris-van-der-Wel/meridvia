import {combineReducers} from 'redux';

import {
    AsyncAction,
    isAsyncActionError,
    isAsyncActionPending,
    isAsyncActionSuccess,
} from './actions';
import {FetchCommentsResponse, FetchPostsResponse} from './api';

export interface AsyncState {
    status: 'pending' | 'success' | 'error';
    result?: object;
    error?: {
        name: string;
        message: string;
    };
}

interface PostsBySubredditState extends AsyncState {
    result?: {
        posts: {
            id: number;
            title: string;
        }[];
    };
}

interface CommentsByPostsState extends AsyncState {
    result?: {
        comments: {
            id: number;
            body: string;
        }[];
    };
}

const postsReducer = (
    state: PostsBySubredditState = {status: 'pending'},
    action: AsyncAction<FetchPostsResponse>,
): PostsBySubredditState => {
    if (isAsyncActionPending(action)) {
        return {
            // keep the old value if it was present so that we can display the old data during a refresh
            ...state,
            status: 'pending',
        };
    }
    else if (isAsyncActionSuccess(action)) {
        return {
            status: 'success',
            result: {posts: action.response.posts},
            error: undefined,
        };
    }
    else if (isAsyncActionError(action)) {
        return {
            status: 'error',
            result: undefined,
            error: action.error,
        };
    }
    else {
        return state;
    }
};

const commentsReducer = (
    state: CommentsByPostsState = {status: 'pending'},
    action: AsyncAction<FetchCommentsResponse>,
): CommentsByPostsState => {
    if (isAsyncActionPending(action)) {
        return {
            // keep the old value if it was present so that we can display the old data during a refresh
            ...state,
            status: 'pending',
        };
    }
    else if (isAsyncActionSuccess(action)) {
        return {
            status: 'success',
            result: {comments: action.response.comments},
            error: undefined,
        };
    }
    else if (isAsyncActionError(action)) {
        return {
            status: 'error',
            result: undefined,
            error: action.error,
        };
    }
    else {
        return state;
    }
};

export const rootReducer = combineReducers({
    postsBySubreddit: (state: Record<string, PostsBySubredditState> = {}, action): Record<string, PostsBySubredditState> => {
        if (action.type === 'FETCH_POSTS') {
            const key = action.params.subreddit;
            const newState = {...state};
            if (action.status === 'clear') {
                delete newState[key];
            }
            else {
                newState[key] = postsReducer(state[key], action);
            }
            return newState;
        }
        return state;
    },
    commentsByPost: (state: Record<string, CommentsByPostsState> = {}, action): Record<string, CommentsByPostsState> => {
        if (action.type === 'FETCH_COMMENTS') {
            const key = action.params.postId;
            const newState = {...state};
            if (action.status === 'clear') {
                delete newState[key];
            }
            else {
                newState[key] = commentsReducer(state[key], action);
            }
            return newState;
        }
        return state;
    },
});

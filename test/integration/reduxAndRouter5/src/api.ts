export type ApiResult = object;

export interface FetchPostsResponse {
    subreddit: string;
    posts: {
        id: number;
        title: string;
    }[];
}

export const fetchPosts = async (subreddit: string): Promise<FetchPostsResponse> => {
    await new Promise((resolve): void => { setTimeout(resolve, 10); });

    if (subreddit === 'aww') {
        return {
            subreddit,
            posts: [
                {id: 1, title: 'Hello world'},
                {id: 2, title: 'Foo bar'},
            ],
        };
    }

    if (subreddit === 'Eyebleach') {
        return {
            subreddit,
            posts: [
                {id: 35, title: 'A quick brown fox jumps over the lazy dog'},
                {id: 37, title: 'good boy'},
            ],
        };
    }

    if (subreddit === 'rarepuppers') {
        return {
            subreddit,
            posts: [
                {id: 50, title: 'Hello fren'},
                {id: 51, title: 'woofer'},
            ],
        };
    }

    throw Error(`Unknown subreddit ${subreddit}`);
};

export interface FetchCommentsResponse {
    postId: number;
    comments: {
        id: number;
        body: string;
    }[];
}

export const fetchComments = async (postId: number): Promise<FetchCommentsResponse> => {
    await new Promise((resolve): void => { setTimeout(resolve, 10); });

    if (postId === 1) {
        return {
            postId: 1,
            comments: [
                {id: 100, body: 'frist'},
                {id: 101, body: '+1'},
            ],
        };
    }

    if (postId === 2) {
        return {
            postId: 2,
            comments: [
                {id: 134, body: 'want word, such layout. much design, much text. plz full. need full. much design, plz ipsum'},
                {id: 135, body: 'Doggo ipsum long water shoob shooberino wow very biscit big ol noodle horse ur givin me a spook'},
            ],
        };
    }

    throw Error(`Unknown postId ${postId}`);
};

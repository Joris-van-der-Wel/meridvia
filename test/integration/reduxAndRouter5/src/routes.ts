import {Dispatched} from './resources';
import {TransactionRequest} from '../../../..';

export const routes = [
    {
        name: 'home',
        path: '/',
    },
    {
        name: 'subreddit',
        path: '/r/:subreddit',
        async resources(routeParams: Record<string, any>, request: TransactionRequest<Dispatched>): Promise<void> {
            const {subreddit} = routeParams;
            await request('posts', {subreddit});
        },
        children: [
            {
                name: 'post',
                path: '/:postId',
                async resources(routeParams: Record<string, any>, request: TransactionRequest<Dispatched>): Promise<void> {
                    const {subreddit, postId} = routeParams;
                    await Promise.all([
                        request('posts', {subreddit}),
                        request('comments', {postId}),
                    ]);
                },
            },
        ],
    },
];

import {Dispatched} from './resources';
import {TransactionFetch} from '../../../..';

export const routes = [
    {
        name: 'home',
        path: '/',
    },
    {
        name: 'subreddit',
        path: '/r/:subreddit',
        async resources(routeParams: Record<string, any>, fetch: TransactionFetch<Dispatched>): Promise<void> {
            const {subreddit} = routeParams;
            await fetch('posts', {subreddit});
        },
        children: [
            {
                name: 'post',
                path: '/:postId',
                async resources(routeParams: Record<string, any>, fetch: TransactionFetch<Dispatched>): Promise<void> {
                    const {subreddit, postId} = routeParams;
                    await Promise.all([
                        fetch('posts', {subreddit}),
                        fetch('comments', {postId}),
                    ]);
                },
            },
        ],
    },
];

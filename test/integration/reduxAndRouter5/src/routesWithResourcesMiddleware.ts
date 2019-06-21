import {Dependencies, Middleware, Route, Router, State} from 'router5';

import {MeridviaSession, TransactionRequest} from '../../../..';

type MiddlewareFactory = (
    router: Router,
    dependencies: Dependencies
) => Middleware;

export interface RouteWithResources<DISPATCHED> extends Route {
    resources?: (routeParams: Record<string, any>, request: TransactionRequest<DISPATCHED>) => any;
    children?: RouteWithResources<DISPATCHED>[];
}

export const findRoute = <R extends Route> (routes: R[], routeName: string): R | null => {
    const routeParts = routeName.split('.');
    return routeParts.reduce(
        (prevRoute: R | null, pathPart: string): R | null => {
            if (prevRoute && Array.isArray(prevRoute.children)) {
                for (const route of prevRoute.children) {
                    if (route.name === pathPart) {
                        return route as R;
                    }
                }
            }
            return null;
        },
        {children: routes} as any as R,
    );
};

export const routesWithResourcesMiddleware =
<DISPATCHED>(routes: RouteWithResources<DISPATCHED>[], session: MeridviaSession<DISPATCHED>): MiddlewareFactory => {
    return (): Middleware => {
        return async (toState: State): Promise<boolean> => {
            const toRoute = findRoute(routes, toState.name);
            const resourcesCallback = (toRoute && toRoute.resources) || (async (): Promise<void> => {});
            await session((request): void | Promise<void> => resourcesCallback(toState.params, request));
            return true;
        };
    };
};

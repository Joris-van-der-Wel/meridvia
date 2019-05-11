import createRouter, {Router} from 'router5';

import {MeridviaSession} from '../../../..';
import {routes} from './routes';
import {Dispatched} from './resources';
import {routesWithResourcesMiddleware} from './routesWithResourcesMiddleware';

export const create = (session: MeridviaSession<Dispatched>): Router => {
    const router = createRouter(routes, {defaultRoute: 'home'});
    router.useMiddleware(routesWithResourcesMiddleware<Dispatched>(routes, session));
    return router;
};

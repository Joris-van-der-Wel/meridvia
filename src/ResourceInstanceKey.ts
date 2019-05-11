import * as Immutable from 'immutable';

import {isImmutableMap, isImmutableRecord} from './typing';
import {ActionParams} from './libraryTypes';

const properties = {
    resourceName: '',
    params: Immutable.Map(),
    paramsFromPojo: false,
};

export class ResourceInstanceKey extends Immutable.Record(properties) {
    public readonly resourceName!: string;
    public readonly params!: Immutable.Map<any, any>;
    public readonly paramsFromPojo!: boolean;

    public constructor(properties: {resourceName: string; params: Immutable.Map<any, any>; paramsFromPojo: boolean}) {
        super(properties);
    }

    public static create(resourceName: string, params: ActionParams): ResourceInstanceKey {
        if (isImmutableMap(params) || isImmutableRecord(params)) {
            return new ResourceInstanceKey({
                resourceName: String(resourceName),
                params: params.asImmutable(),
                paramsFromPojo: false,
            });
        }

        if (params && typeof params === 'object') {
            return new ResourceInstanceKey({
                resourceName: String(resourceName),
                params: Immutable.OrderedMap(params),
                paramsFromPojo: true,
            });
        }

        throw new TypeError('`params` must be an Immutable Map, Record or plain javascript object');
    }

    public toParams(): ActionParams {
        if (this.paramsFromPojo) {
            return this.params.toObject();
        }

        return this.params;
    }
}

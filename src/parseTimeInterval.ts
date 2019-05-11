import {assert, error} from './error';

export const parseTimeInterval = (expression: string | number, validationAttribute: string): number => {
    if (typeof expression === 'number') {
        // milliseconds
        assert(Number.isFinite(expression), 'TypeError', validationAttribute, ': Time interval expression must be finite');
        return expression;
    }

    assert(typeof expression === 'string', 'TypeError', validationAttribute, ': Time interval expression must be a number or string');

    const parts = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(expression);
    if (!parts) {
        throw error(
            'TypeError',
            validationAttribute,
            ': Time interval expression (',
            expression,
            ') is in an incorrect format. Valid examples include: 100ms, 0.1s, 30m, 1h, 2d'
        );
    }

    const number = parseFloat(parts[1]);
    switch (parts[2]) {
        case 'ms': return number;
        case 's': return number * 1000;
        case 'm': return number * 60 * 1000;
        case 'h': return number * 60 * 60 * 1000;
        case 'd': return number * 24 * 60 * 60 * 1000;
    }
    /* istanbul ignore next */
    throw Error('Unreachable');
};

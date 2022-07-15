const ERROR_MESSAGE_MAX_CHILD_ERRORS = 5;

export interface CompositeErrorTracker {
    try: <T>(callback: () => T) => T | void;
    maybeThrow: (name: string, ...message: any[]) => void;
}

export interface CompositeError extends Error {
    errors: unknown[];
}

export const createCompositeError = (): CompositeErrorTracker => {
    const errors: unknown[] = [];
    return {
        try: <T>(callback: () => T): T | void => {
            try {
                return callback();
            }
            catch (error) {
                errors.push(error);
                return undefined;
            }
        },
        maybeThrow: (name: string, ...message: any[]): void => {
            if (errors.length) {
                let fullMessage = message.join('');

                let i = 0;
                for (const childError of errors) {
                    fullMessage += '\n  ' + String(childError);
                    if (++i >= ERROR_MESSAGE_MAX_CHILD_ERRORS) {
                        break;
                    }
                }

                if (errors.length > ERROR_MESSAGE_MAX_CHILD_ERRORS) {
                    fullMessage += '\n  ...';
                }

                const error = Error(fullMessage) as CompositeError;
                error.name = name;
                error.errors = errors;
                throw error;
            }
        },
    };
};

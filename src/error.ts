// A tiny assert() implementation
export const error = (name: string, ...message: any[]): Error => {
    const err = new Error(message.join(''));
    err.name = name;
    return err;
};

export const assert = (condition: any, name: string, ...message: any[]): void => {
    if (!condition) {
        throw error(name, ...message);
    }
};

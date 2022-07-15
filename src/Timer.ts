type TimerHandle = any;

export class Timer {
    private _id: TimerHandle;
    public delay: number;
    public callback: () => void;
    public setTimeout: (handler: () => void, timeout: number) => TimerHandle;
    public clearTimeout: (handle: TimerHandle) => void;
    private readonly _timerCallback: () => void;

    public constructor(delay: number, callback: () => void) {
        this._id = null;
        this.delay = delay;
        this.callback = callback;
        this.setTimeout = (handler: () => void, delay: number): TimerHandle => setTimeout(handler, delay);
        this.clearTimeout = (handler: TimerHandle): void => clearTimeout(handler);
        this._timerCallback = (): void => {
            this._id = 0;
            this.callback.call(null);
        };
        Object.seal(this);
    }

    public get isScheduled(): boolean {
        return Boolean(this._id);
    }

    public schedule(): void {
        if (!this._id) {
            this._id = this.setTimeout(this._timerCallback, this.delay);
        }
    }

    public cancel(): void {
        if (this.isScheduled) {
            this.clearTimeout(this._id);
            this._id = 0;
        }
    }

    public reschedule(): void {
        this.cancel();
        this.schedule();
    }
}

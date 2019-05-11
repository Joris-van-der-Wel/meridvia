import * as Immutable from 'immutable';

import {assert, error} from './error';
import {Manager} from './Manager';
import {Transaction} from './Transaction';
import {ImmutableSet, isPromise} from './typing';
import {ActionParams, MeridviaSession, TransactionCallback} from './libraryTypes';

export class Session<DISPATCHED, ACTION> {
    private readonly _manager: Manager<DISPATCHED, ACTION>;
    private _destroyed: boolean;
    private _activeTransaction: Transaction<DISPATCHED, ACTION> | null;
    private _transactionsToCleanUp: ImmutableSet<Transaction<DISPATCHED, ACTION>>;

    public constructor(manager: Manager<DISPATCHED, ACTION>) {
        this._manager = manager;
        this._destroyed = false;
        this._activeTransaction = null;
        this._transactionsToCleanUp = Immutable.Set() as ImmutableSet<Transaction<DISPATCHED, ACTION>>;
        Object.seal(this);
    }

    private addTransactionToCleanup(transaction: Transaction<DISPATCHED, ACTION>): void {
        this._transactionsToCleanUp = this._transactionsToCleanUp.add(transaction);
    }

    private resetTransactionToCleanup(): void {
        this._transactionsToCleanUp = this._transactionsToCleanUp.clear();
    }

    public execute(callback: TransactionCallback<DISPATCHED>): any {
        assert(!this._destroyed, 'IllegalState', 'This session has been destroyed');
        assert(typeof callback === 'function', 'IllegalState', 'callback must be a function');

        if (this._activeTransaction) {
            if (this._manager.allowTransactionAbort) {
                const abortedTransaction = this._activeTransaction;
                abortedTransaction.abort(error(
                    'IllegalState',
                    'The session transaction has been aborted because a new session transaction has been started.'
                ));

                // This transaction was incomplete, so we can not yet perform an accurate clean up of resources because
                // we do not know which resources would have followed. So the cleanup of this transaction is deferred
                // until the next transaction completes 100%
                this.addTransactionToCleanup(abortedTransaction);
                this._activeTransaction = null;
            }
            else {
                throw error('IllegalState', 'A previous transaction is still in progress');
            }
        }

        const transactionBeginMs = Date.now();
        const transaction = new Transaction<DISPATCHED, ACTION>(this._manager, this, transactionBeginMs);
        this._activeTransaction = transaction;

        const fetch = (resourceName: string, params: ActionParams = {}): DISPATCHED => {
            assert(!this._destroyed, 'IllegalState', 'This session has been destroyed');
            return transaction.fetch(resourceName, params);
        };

        const endTransaction = (): void => {
            if (this._destroyed || this._activeTransaction !== transaction) {
                return;
            }

            try {
                const transactionsToCleanUp = this._transactionsToCleanUp;
                this.resetTransactionToCleanup();
                transaction.end(transactionsToCleanUp);
            }
            finally {
                this.addTransactionToCleanup(transaction);
                this._activeTransaction = null;
            }
            this._manager.cleanupResources();
        };

        let returnValue;
        try {
            returnValue = callback(fetch);
        }
        catch (err) {
            endTransaction();
            throw err;
        }

        if (isPromise(returnValue)) {
            // it's a promise, do not expire fetch() until the promise resolves/rejects
            return returnValue.then(
                async (result: any): Promise<any> => { endTransaction(); return result; },
                async (result: any): Promise<any> => { endTransaction(); throw result; }
            );
        }

        // assume it is a synchronous function, end the transaction immediately
        endTransaction();
        return returnValue;
    }

    public destroy(publicSession: MeridviaSession<DISPATCHED>): boolean {
        if (this._destroyed) {
            return false;
        }

        for (const transaction of this._transactionsToCleanUp) {
            transaction.destroyedSession();
        }
        if (this._activeTransaction) {
            this._activeTransaction.destroyedSession();
        }

        this._activeTransaction = null;
        this.resetTransactionToCleanup();

        this._destroyed = true;
        this._manager.sessionDeleted(publicSession);
        this._manager.cleanupResources();

        return true;
    }
}

export const createSession = <DISPATCHED, ACTION> (manager: Manager<DISPATCHED, ACTION>): MeridviaSession<DISPATCHED> => {
    const sessionInstance = new Session<DISPATCHED, ACTION>(manager);

    const session = (callback: TransactionCallback<DISPATCHED>): any => sessionInstance.execute(callback);
    session.destroy = (): boolean => sessionInstance.destroy(session);
    return session;
};
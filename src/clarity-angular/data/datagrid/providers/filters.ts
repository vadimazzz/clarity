/*
 * Copyright (c) 2016-2017 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {Subject} from "rxjs/Subject";

import {Filter} from "../interfaces/filter";

@Injectable()
export class FiltersProvider {
    /**
     * This subject is the list of filters that changed last, not the whole list.
     * We emit a list rather than just one filter to allow batch changes to several at once.
     */
    private _change = new Subject<Filter<any>[]>();
    // We do not want to expose the Subject itself, but the Observable which is read-only
    public get change(): Observable<Filter<any>[]> {
        return this._change.asObservable();
    }

    /**
     * List of all filters, whether they're active or not
     */
    private _all: RegisteredFilter<any>[] = [];

    /**
     * Tests if at least one filter is currently active
     */
    public hasActiveFilters(): boolean {
        // We do not use getActiveFilters() because this function will be called much more often
        // and stopping the loop early might be relevant.
        for (const {filter} of this._all) {
            if (filter && filter.isActive()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns a list of all currently active filters
     */
    public getActiveFilters(): Filter<any>[] {
        const ret: Filter<any>[] = [];
        for (const {filter} of this._all) {
            if (filter && filter.isActive()) {
                ret.push(filter);
            }
        }
        return ret;
    }

    /**
     * Registers a filter, and returns a deregistration function
     */
    public add<F extends Filter<any>>(filter: F): RegisteredFilter<F> {
        const index = this._all.length;
        const subscription = filter.changes.subscribe(() => this._change.next([filter]));
        let hasUnregistered = false;
        const registered = new RegisteredFilter(filter, () => {
            if (hasUnregistered) {
                return;
            }
            subscription.unsubscribe();
            this._all.splice(index, 1);
            if (filter.isActive()) {
                this._change.next([]);
            }
            hasUnregistered = true;
        });
        this._all.push(registered);
        if (filter.isActive()) {
            this._change.next([filter]);
        }
        return registered;
    }

    /**
     * Accepts an item if it is accepted by all currently active filters
     */
    public accepts(item: any): boolean {
        for (const {filter} of this._all) {
            if (filter && filter.isActive() && !filter.accepts(item)) {
                return false;
            }
        }
        return true;
    }
}

export class RegisteredFilter<F extends Filter<any>> {
    constructor(public filter: F, public unregister: () => void) {}
}

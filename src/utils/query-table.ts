import {QuickBase, type QuickBaseRequestRunQuery} from 'quickbase'

interface IQueryTableOptions {
    quickbase: QuickBase,
    tableId: string,
    select?: number[] | undefined,
    where?: string,
}

export default async function queryTable({quickbase, tableId, select, where}: IQueryTableOptions) {
    const queryOptions: (QuickBaseRequestRunQuery & {returnAxios?: false}) = {
        tableId,
        select,
    }

    if (where) {
        // get records based on a 'where' clause passed in via query params
        queryOptions.where = where
    } else {
        // get all Quickbase records
        queryOptions.where = `{3.GT.'0'}`
    }

    const response = await quickbase
        .runQuery(queryOptions)
        .catch(err => err)

    // console.log(response)

    if (response.data) {
        return response.data
    }

    response.error
}

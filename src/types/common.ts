import type {FeatureCollection} from 'geojson'

export type QuickbaseRecord = Record<string, {
    value: any | { name: string };
}>

export interface KoopCollection extends FeatureCollection {
    metadata: Record<string, any>,
}

export interface ILocalParams {
    realm: string,
    appId: string,
    tableId: string,
    select: number[] | undefined,
    coordinatesFID: string,
    isQuery: boolean,
}
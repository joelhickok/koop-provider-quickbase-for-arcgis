export default async function (quickbase, tableId) {

    return await quickbase.getFields({
        tableId,
    }).then((fields) => {
        // filter QB field formula types
        const filtered = fields.filter((f) => f.mode !== 'formula')
        return filtered
    })

}
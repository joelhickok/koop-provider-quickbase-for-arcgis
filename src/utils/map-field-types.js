export default (type) => {
    switch (type) {
        case 'text-multi-line':
            return 'String'
        case 'text':
            return 'String'
        case 'numeric':
            return 'Double'
        case 'recordid':
            return 'Integer'
        case 'date':
            return 'Date'
        default:
            return 'String'
    }
}
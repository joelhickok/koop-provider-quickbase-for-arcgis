import packageJson from './package.json' with {type: 'json'}
import Model from './model/index.ts'

export default {
    name: 'quickbase',
    type: 'provider',
    version: packageJson.version,
    Model,
    hosts: true,
    disableIdParam: false,
    // routes: require('<path-to-routes-array-module>'),
    // Controller: require('<path-to-controller-module>'),
}
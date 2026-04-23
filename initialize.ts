// const providerQuickbase = require('./index.ts');
import providerQuickbase from './index.ts' 

function initialize() {
  return {
    instance: providerQuickbase
  };
}

// module.exports = initialize;
export default initialize
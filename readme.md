# Total.js Flowboard

[![Support](https://www.totaljs.com/img/button-support.png?v=2)](https://www.totaljs.com/support/)

__Total.js Flowboard__ is a visual designer interface for __IoT__ and [Total.js Flow](https://www.totaljs.com/flow/).

## Installation

- Total.js `+v2.5.0`
- download and copy `flowboard.package` into the `/packages/` directory __or create a definition file with:__

```javascript
var options = {};

// ====================================
// COMMON (OPTIONAL)
// ====================================

// options.url = '/$flowboard/';

// A maximum length of request:
// options.limit = 50;

// Predefined set of components (default value):
// options.templates = 'https://raw.githubusercontent.com/totaljs/flowcomponents/master/templates.json';

// ====================================
// Security (OPTIONAL)
// ====================================

// HTTP Basic auth:
// options.auth = ['admin:admin', 'name:password'];

// IP restrictions:
// options.restrictions = ['127.0.0.1', '138.201', '172.31.33'];

// options.token = ['OUR_COMPANY_TOKEN'];
// you can open flow using : /$flowboard/?token=OUR_COMPANY_TOKEN

INSTALL('package', 'https://cdn.totaljs.com/2017xc9db052e/flowboard.package', options);
```

- __IMPORTANT__: it doesn't support `UPTODATE` mechanism
- URL address `http://127.0.0.1:8000/$flowboard/` (default, can be changed in config)

## Components

- https://github.com/totaljs/flowboardcomponents

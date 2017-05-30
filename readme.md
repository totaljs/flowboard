# Total.js Flowboard (BETA VERSION)

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

// Standard "authorize" flag
// options.auth = true;

// IP restrictions:
// options.restrictions = ['127.0.0.1', '138.201', '172.31.33'];

// options.token = ['OUR_COMPANY_TOKEN'];
// you can open flow using : /$flowboard/?token=OUR_COMPANY_TOKEN

INSTALL('package', 'https://cdn.totaljs.com/2017xc9db052e/flowboard.package', options);
```

- __IMPORTANT__: it doesn't support `UPTODATE` mechanism
- URL address `http://127.0.0.1:8000/$flowboard/` (default, can be changed in config)

## How to create own component?

### Flowboard (client-side)

```html
<!-- (OPTIONAL) SETTINGS FORM -->
<script type="text/html" settings>
<div class="padding npb">
    <div class="m" data-jc="dropdown" data-jc-path="id" data-required="true" data-source="common.instances" data-source-condition="n => n.component === 'flowboardsocket'" data-empty="">@(Flow instance)</div>
</div>
</script>

<!-- (OPTIONAL) ELEMENT IN DESIGNER -->
<script type="text/html" body>
    <div class="click"><i class="fa fa-plug"></i></div>
</script>

<!-- (OPTIONAL) CUSTOM STYLES -->
<style>
    .fb-component { background-color: #E33733; color: white; text-align: center; font-size: 16px; }
</style>

<!-- (OPTIONAL) CODE -->
<script>
// {String}, IMPORTANT (lower case without diacritics)
exports.name = 'component';

// {String}, optional (default: "component name")
exports.title = 'Component';

// {String}, optional (default: "")
// Font-Awesome icon without "fa-"
exports.icon = 'plug';

// {String}, optional (default: "Unknown")
exports.author = 'Peter Širka';

// {String}, optional (default: "Common")
exports.group = 'Common';

// {Object}, optional (default "undefined")
// Default options for new and existing instances
exports.options = { id: null };

// {String}, optional (default: "")
exports.version = '1.0.0';

// Installation
exports.install = function(instance) {

    // =======================================
    // PROPERTIES
    // =======================================

    instance.id;
    // {String} current instance ID

    instance.element;
    // {jQuery Element} current element

    instance.name;
    // {String} component name

    insntace.options;
    // {Object} custom options

    // =======================================
    // METHODS
    // =======================================

    instance.emit(name, [argA], [argN]);
    // Emits an event for this component

    instance.on(name, fn);
    // Registers a listener for the event

    instance.menu(items, [element], [callback(item)], [offsetX]);
    // Shows a context-menu
    // items [{ name: String, icon: String }, { name: String, icon: String, url: String }, 'DIVIDER']

    instance.send(id, data);
    // Sends a message to specified instance by instance id

    instance.find(selector);
    // Returns jQuery (alias for instance.element.find())

    instance.append(html);
    // Appends HTML (alias for instance.element.append())

    instance.html(html);
    // Rewrites content (alias for instance.element.html())    

    instance.event(html);
    // Registers a listener for the event (alias for instance.element.on())

    instance.settings();
    // Shows settings form

    // =======================================
    // EVENTS
    // =======================================
        
    instance.on('destroy', function() {
        // instance is destroying
    });

    instance.on('options', function(options_new, options_old) {
        // options were changed
    });

    instance.on('resize', function(element, width, height, rotation) {
        // an element has been resized
    });

    instance.on('data', function(response) {
        response.id;
        // {String} Flow: instance.id

        response.name;
        // {String} Flow: instance.name

        response.component;
        // {String} Flow: instance.component

        response.component;
        // {String} Flow: instance.component

        response.category;
        // {String} category (optional)

        response.body;
        // {Object} data
    });
};

// (OPTIONAL) Uninstallation
exports.uninstall = function() {
    // This method is executed when the component is uninstalled from the Flowboard
};
</script>
```

__Common variables (client-side)__:

```javascript
common.instances;
// {Object Array} All Flow instances
```

__Good to know__:

- each Flowboard element is wrapped to `data-jc-scope=""` (generated randomly)
- if some element will contain `.resizable` class then the designer shows `resizable` form

### Flow (server-side)

Each Flow component connected to Flowboard component can define this code:

```javascript
// (Optional) This code sends data to Flowboard component (server-side to client-side)
instance.flowboard_send = function(data, category) {
    // This code sends data to client-side
    global.FLOWBOARD && global.FLOWBOARD.send(instance, data, category);
};

// (Optional) This code processes data from Flowboard (client-side to server-side)
instance.flowboard_process = function(data) {

};

// (Optional) This code has to return last state/data from the Flow component
instance.flowboard_laststate = function() {
    return null;
};
```

## Components

- https://github.com/totaljs/flowboardcomponents

## Contributing

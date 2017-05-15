const Fs = require('fs');
const WS_COMPONENT = { type: 'component' };
const WS_LOADED = { type: 'loaded' };
const WS_INIT = { type: 'init' };
const WS_INSTANCES = { type: 'instances' };
const WS_DATA = { type: 'data' };
const PATH = '/flowboard/';
const FILEDESIGNER = '/flowboard/designer.json';
const FLAGS = ['get', 'dnscache'];
const WS_ERROR = { type: 'error' };
var WS = null;

global.FLOWBOARD = {};
global.FLOWBOARD.send = function(instance, data, category) {
	WS_DATA.id = instance.id;
	WS_DATA.name = instance.name;
	WS_DATA.component = instance.component;
	WS_DATA.body = data;
	WS_DATA.category = category;
	WS && WS.send(WS_DATA);
};

exports.install = function() {

	try {
		Fs.mkdirSync(F.path.root(PATH));
	} catch(e) {}

	F.websocket('/', websocket, ['json'], 30);
};

function websocket() {
	var self = WS = this;

	self.autodestroy(() => WS = null);

	self.on('open', function(client) {
		client.send(WS_INIT);
		send_instances(client, () => send_components(client, () => send_settings(client, function() {
			self.send(WS_LOADED);
			setImmediate(() => send_laststate(client));
		})));
	});

	self.on('message', function(client, message) {

		// message.id
		// message.type
		// message.body

		switch (message.type) {
			case 'send':
				var instance = FLOW.findById(message.id);
				instance && instance.custom.process(message.body);
				break;
			case 'install':
				component_install(self, message);
				break;
			case 'uninstall':
				component_uninstall(self, message.body);
				break;
			case 'save':
				save(message.body);
				break;
		}
	});
}

ON('flow.save', function() {
	WS && send_instances(WS);
});

function component_install(controller, response, callback) {

	var u = response.body.substring(0, 6);
	if (u === 'http:/' || u === 'https:') {
		U.download(response.body, FLAGS, function(err, response) {

			if (err) {
				WS_ERROR.body = err.toString();
				FLOW.send(WS_ERROR);
				return callback(err);
			}

			var filename = F.path.root(PATH + U.getName(response.body));
			var writer = Fs.createWriteStream(filename);
			response.pipe(writer);
			writer.on('finish', function() {
				callback && callback();
				controller && send_component(filename, controller);
			});
		});
		return;
	}

	var filename = F.path.root(PATH + response.filename);
	Fs.writeFile(filename, response.body, function() {
		callback && callback();
		controller && send_component(filename, controller);
	});
}

function component_uninstall(controller, name, callback) {
	Fs.unlink(F.path.root(PATH + name + '.html'), function() {
		callback && callback();
		controller && send_components(controller);
	});
}

function save(body, callback) {
	var path = F.path.root(FILEDESIGNER);
	Fs.writeFile(path, JSON.stringify(body), callback || NOOP);
}

function send_settings(client, callback) {
	var path = F.path.root(FILEDESIGNER);
	Fs.readFile(path, function(err, data) {
		data && client.send(data.toString('utf8'), true);
		callback && callback();
	});
}

function send_instances(client, callback) {
	WS_INSTANCES.body = [];

	if (!global.FLOW) {
		callback && callback();
		return;
	}

	var arr = global.FLOW.findByComponent(/^flowboard\w+/i);

	for (var i = 0, length = arr.length; i < length; i++) {
		var instance = arr[i];
		WS_INSTANCES.body.push({ id: instance.id, name: instance.name || instance.title, component: instance.component, reference: instance.reference });
	}

	client.send(WS_INSTANCES);
	callback && callback();
}

function send_laststate(client, callback) {

	if (!global.FLOW) {
		callback && callback();
		return;
	}

	global.FLOW.findByComponent(/^flowboard/i).wait(function(item, next) {
		WS_DATA.id = item.id;
		WS_DATA.component = item.component;
		WS_DATA.name = item.name;
		WS_DATA.body = item.custom.current();
		WS_DATA.category = null;
		client.send(WS_DATA);
		setImmediate(next);
	}, callback);
}

function send_component(filename, client, callback) {
	Fs.stat(filename, function(err, stats) {

		if (err) {
			callback && callback(err);
			return;
		}

		Fs.readFile(filename, function(err, data) {
			if (data) {
				WS_COMPONENT.body = U.minifyHTML(TRANSLATOR('default', data.toString('utf8')));
				WS_COMPONENT.name = U.getName(filename);
				WS_COMPONENT.dateupdated = stats.mtime;
				client.send(WS_COMPONENT);
			}
			callback && callback();
		});
	});
}

function send_components(client, callback) {
	var path = F.path.root(PATH);
	U.ls(path, function(files) {
		files.wait(function(item, next) {
			Fs.stat(item, function(err, stats) {
				if (err)
					return next();
				Fs.readFile(item, function(err, data) {
					if (data) {
						WS_COMPONENT.body = U.minifyHTML(TRANSLATOR('default', data.toString('utf8')));
						WS_COMPONENT.name = U.getName(item);
						WS_COMPONENT.dateupdated = stats.mtime;
						client.send(WS_COMPONENT);
					}
					next();
				});
			});
		}, callback);
	}, (filename) => filename.endsWith('.html'));
}
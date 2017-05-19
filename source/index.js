// MIT License
// Copyright Peter Širka <petersirka@gmail.com>

const Fs = require('fs');
const WS_COMPONENT = { type: 'component' };
const WS_LOADED = { type: 'loaded' };
const WS_INIT = { type: 'init' };
const WS_INSTANCES = { type: 'instances' };
const WS_DATA = { type: 'data' };
const PATH = '/flowboard/';
const NOSQLDB = 'flowboard';
const FILEDESIGNER = '/flowboard/designer.json';
const FLAGS = ['get', 'dnscache'];
const WS_ERROR = { type: 'error' };
const WS_TEMPLATES = { type: 'templates' };

var OPT;
var DDOS = {};
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

exports.install = function(options) {

	OPT = options;
	!OPT && (OPT = {});

	if (OPT.auth instanceof Array) {
		OPT.baa = {};
		OPT.auth.forEach(function(user) {
			var hash = user.hash().toString();
			OPT.baa[hash] = user;
		});
	}

	OPT.url = U.path(OPT.url || '/$flowboard/');

	!OPT.limit && (OPT.limit = 50);
	!OPT.templates && (OPT.templates = 'https://raw.githubusercontent.com/totaljs/flowboardcomponents/master/templates.json');

	try {
		Fs.mkdirSync(F.path.root(PATH));
	} catch(e) {}

	// Routes
	F.route(OPT.url, view_index);
	F.route(OPT.url + 'api/upload/', upload, ['post', 'upload', 10000], 3084); // 3 MB
	F.route(OPT.url + 'api/components/', json_components);
	F.route(OPT.url + 'api/component/', json_components_save, ['post']);
	F.websocket(OPT.url, websocket, ['json'], OPT.limit);

	// Files
	F.file(OPT.url + 'download/*.*', download);
	F.localize(OPT.url + 'templates/*.html', ['compress']);

	// Merging & Mapping
	F.merge(OPT.url + 'default.css', '@flowboard/css/dep.min.css', '@flowboard/css/default.css', '@flowboard/css/ui.css');
	F.merge(OPT.url + 'default.js', '@flowboard/js/dep.min.js', '@flowboard/js/default.js', '@flowboard/js/ui.js');
	F.map(OPT.url + 'templates/', '@flowboard/templates/');
	F.map(OPT.url + 'fonts/', '@flowboard/fonts/');
	F.map(OPT.url + 'img/', '@flowboard/img/');

	// Service
	ON('service', service);
};

function service(counter) {
	counter % 5 === 0 && (DDOS = {});
}

function view_index() {
	auth(this) && this.view('@flowboard/index', OPT);
}

// Upload (multiple) pictures
function upload() {

	var self = this;

	if (!auth(self))
		return;

	var id = [];

	self.files.wait(function(file, next) {
		file.read(function(err, data) {

			// Store current file into the HDD
			file.extension = U.getExtension(file.filename);
			id.push(NOSQL(NOSQLDB).binary.insert(file.filename, data) + '.' + file.extension);

			// Next file
			setTimeout(next, 100);
		});

	}, () => self.json(id));
}

function download(req, res) {
	var filename = req.split[req.split.length - 1];
	var id = filename.substring(0, filename.lastIndexOf('.'));
	NOSQL(NOSQLDB).binary.read(id, function(err, stream, header) {
		if (err)
			res.throw404();
		else
			res.stream(header.type, stream);
	});
}

function json_components() {

	var self = this;
	if (!auth(self))
		return;

	var path = F.path.root(PATH);

	if (self.query.filename) {
		Fs.readFile(path + U.getName(self.query.filename), function(err, data) {
			data && self.binary(data, 'text/html', 'binary');
		});
	} else {
		U.ls(path, function(files) {
			files = files.map(n => U.getName(n));
			self.json(files);
		}, (filename) => filename.endsWith('.html'));
	}
}

function json_components_save() {
	var self = this;
	if (!auth(self))
		return;
	var path = F.path.root(PATH);
	Fs.writeFile(path + 'designer.json', JSON.stringify(self.body));
	self.json(SUCCESS(true));
}

function websocket() {
	var self = WS = this;

	self.autodestroy(() => WS = null);

	self.on('open', function(client) {

		// Security
		if ((OPT.token && OPT.token.indexOf(client.query.token) === -1) || (OPT.baa && !OPT.baa[client.query.baa]) || (OPT.restrictions && OPT.restrictions[self.ip] === -1)) {
			setImmediate(() => client.close('Unauthorized'));
			return;
		}

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
			case 'templates':
				OPT.templates && U.request(OPT.templates, FLAGS, function(err, response) {
					if (!err) {
						WS_TEMPLATES.body = response.parseJSON();
						WS_TEMPLATES.body && client.send(WS_TEMPLATES);
					}
				});
				break;
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
		U.download(response.body, FLAGS, function(err, res) {

			if (err) {
				WS_ERROR.body = err.toString();
				FLOW.send(WS_ERROR);
				return callback(err);
			}

			var filename = F.path.root(PATH + U.getName(response.body));
			var writer = Fs.createWriteStream(filename);
			res.pipe(writer);
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

ON('flow.save', function() {
	WS && send_instances(WS);
});

function auth(controller) {

	if (OPT.auth instanceof Array) {
		var user = controller.baa();
		if (OPT.auth.indexOf(user.user + ':' + user.password) === -1) {
			if (DDOS[controller.ip])
				DDOS[controller.ip]++;
			else
				DDOS[controller.ip] = 1;
			if (DDOS[controller.ip] > 4)
				controller.throw401();
			else
				controller.baa('Secured area, please add sign-in');
			return false;
		}
		controller.repository.baa = (user.user + ':' + user.password).hash();
	}

	if (OPT.restrictions && OPT.restrictions[controller.ip] === -1) {
		controller.throw401();
		return false;
	}

	if (OPT.token && OPT.token.indexOf(controller.query.token) === -1) {
		if (DDOS[controller.ip])
			DDOS[controller.ip]++;
		else
			DDOS[controller.ip] = 1;

		if (DDOS[controller.ip] > 4) {
			controller.throw401();
			return false;
		}
	}

	return true;
}
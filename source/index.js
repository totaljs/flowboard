// MIT License
// Copyright Peter Širka <petersirka@gmail.com>

const Fs = require('fs');
const WS_COMPONENT = { TYPE: 'component' };
const WS_LOADED = { TYPE: 'loaded' };
const WS_INIT = { TYPE: 'init' };
const WS_INSTANCES = { TYPE: 'instances' };
const WS_DATA = { TYPE: 'data' };
const WS_ERROR = { TYPE: 'error' };
const WS_TEMPLATES = { TYPE: 'templates' };
const PATH = '/flowboard/';
const NOSQLDB = 'flowboard';
const FILEDESIGNER = '/flowboard/designer.json';
const FLAGS = ['get', 'dnscache'];
const REG_INSTANCES = /^flowboard\w+/i;

var OPT;
var DDOS = {};
var WS = null;

global.FLOWBOARD = {};
global.FLOWBOARD.send = function(instance, type, data) {
	WS_DATA.id = instance.id;
	WS_DATA.name = instance.name;
	WS_DATA.component = instance.component;
	WS_DATA.body = data;
	WS_DATA.type = type;
	WS && WS.send(WS_DATA);
};

global.FLOWBOARD.online = function() {
	return WS ? true : false;
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

	global.FLOWBOARD.url = OPT.url = U.path(OPT.url || '/$flowboard/');
	!OPT.limit && (OPT.limit = 50);
	!OPT.templates && (OPT.templates = 'https://rawgit.com/totaljs/flowboardcomponents/master/templates.json');

	try {
		Fs.mkdirSync(F.path.root(PATH));
	} catch(e) {}

	var flags = [];

	// Routes
	if (OPT.auth === true)
		flags.push('authorize');

	F.group(flags, function() {
		F.route(OPT.url, view_index);
		F.route(OPT.url + 'api/upload/', upload, ['post', 'upload', 10000], 3084); // 3 MB
		F.websocket(OPT.url, websocket, ['json'], OPT.limit);
	});

	// Files
	F.file(OPT.url + 'download/*.*', download);
	F.localize(OPT.url + 'templates/*.html', ['compress']);

	// Merging & Mapping
	F.merge(OPT.url + 'default.css', '@flowboard/css/dep.min.css', '@flowboard/css/default.css', '@flowboard/css/ui.css');
	F.merge(OPT.url + 'default.js', '@flowboard/js/dep.min.js', '@flowboard/js/default.js', '@flowboard/js/ui.js');
	F.map(OPT.url + 'templates/', '@flowboard/templates/');
	F.map(OPT.url + 'fonts/', '@flowboard/fonts/');
	F.map(OPT.url + 'img/', '@flowboard/img/');

	F.helpers.FLOWBOARD = global.FLOWBOARD;

	// Service
	ON('service', service);

	WAIT(function() {
		return global.FLOW;
	}, function() {
		FLOW.prototypes(function(proto) {
			proto.Component.flowboard = function(type, data) {
				FLOWBOARD.send(this, type, data);
				return this;
			};
		});
	});
};

function service(counter) {
	counter % 5 === 0 && (DDOS = {});
}

function view_index() {
	if (this.uri.pathname !== OPT.url)
		this.redirect(OPT.url, true);
	else {
		if (auth(this)) {
			this.theme('');
			this.view('@flowboard/index', OPT);
		}
	}
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
		})));
	});

	self.on('message', function(client, message) {

		// message.id
		// message.TYPE
		// message.body

		switch (message.TYPE) {
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
				instance && instance.emit('flowboard', message.type, message.body);
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
				Fs.readFile(filename, function(err, response) {
					if (response)
						response = U.minifyHTML(response.toString('utf8'));
					Fs.writeFile(filename, response, function() {
						callback && callback();
						controller && send_component(filename, controller);
					});
				});
			});
		});
		return;
	}

	var filename = F.path.root(PATH + response.filename);
	Fs.writeFile(filename, U.minifyHTML(response.body), function() {
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

	var keys = Object.keys(FLOW.instances);

	for (var i = 0, length = keys.length; i < length; i++) {
		var instance = FLOW.instances[keys[i]];
		var declaration = FLOW.components[instance.component];
		if (declaration.flowboard || REG_INSTANCES.test(instance.component))
			WS_INSTANCES.body.push({ id: instance.id, name: instance.name || instance.title, component: instance.component, reference: instance.reference });
	}

	client.send(WS_INSTANCES);
	callback && callback();
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
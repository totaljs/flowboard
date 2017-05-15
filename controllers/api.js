const Fs = require('fs');

exports.install = function() {
	// Routes
	F.route('/api/upload/', upload, ['post', 'upload', 10000], 3084); // 3 MB
	F.route('/api/components/', json_components);
	F.route('/api/component/', json_components_save, ['post']);

	// Handling uploaded files
	F.file('/download/*.*', download);
};

// Upload (multiple) pictures
function upload() {

	var self = this;
	var id = [];

	self.files.wait(function(file, next) {
		file.read(function(err, data) {

			// Store current file into the HDD
			file.extension = U.getExtension(file.filename);
			id.push(NOSQL('flowboard').binary.insert(file.filename, data) + '.' + file.extension);

			// Next file
			setTimeout(next, 100);
		});

	}, () => self.json(id));
}

function download(req, res) {
	var filename = req.split[1];
	var id = filename.substring(0, filename.lastIndexOf('.'));
	NOSQL('flowboard').binary.read(id, function(err, stream, header) {
		if (err)
			res.throw404();
		else
			res.stream(header.type, stream);
	});
}

function json_components() {
	var self = this;
	var path = F.path.root('/flowboard/');

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
	var path = F.path.root('/flowboard/');
	var self = this;
	Fs.writeFile(path + 'designer.json', JSON.stringify(self.body));
	self.json(SUCCESS(true));
}
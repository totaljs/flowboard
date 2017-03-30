exports.install = function() {
	F.route('/');
	F.localize('/templates/*.html', ['compress']);
};
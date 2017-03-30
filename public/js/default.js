var MESSAGE_TRIGGER = { type: 'trigger' };
var EMPTYTRANSLATE = { x: 0, y: 0 };
var flowtriggers = {};

function diagonal(x1, y1, x2, y2) {
	return 'M' + x1 + ',' + y1 + 'C' + ((x1 + x2 ) / 2) + ',' + y1 + ' ' + ((x1 + x2) / 2) + ',' + y2 + ' ' + x2 + ',' + y2;
}

ON('ready', function() {
	SETTER('loading', 'hide', 1000);
	EMIT('resize', $(window));
});

$(window).on('resize', function() {
	EMIT('resize', $(window));
});

function getSize(el) {
	var size = SINGLETON('size');
	el = $(el);
	size.width = el.width();
	size.height = el.height();
	return size;
}

function success() {
	var el = $('#success');
	el.show();
	el.addClass('success-animation');
	setTimeout(function() {
		el.removeClass('success-animation');
		setTimeout(function() {
			el.hide();
		}, 1000);
	}, 1500);
	FIND('loading').hide(500);
}

String.prototype.parseTransform = function() {
	var prop = ['translate', 'matrix', 'rotate', 'skewX', 'skewY', 'scale'];
	var val = this.match(/(translate|matrix|rotate|skewX|skewY|scale)\(.*?\)/g);
	var obj = {};
	if (val) {
		for (var i = 0, length = val.length; i < length; i++) {
			var item = val[i];
			var index = item.indexOf('(');
			var v = item.substring(index + 1, item.length - 1).split(/\,|\s/);
			var n = item.substring(0, index);
			obj[n] = {};
			switch (n) {
				case 'translate':
				case 'scale':
					obj[n].x = +v[0] || 0;
					obj[n].y = +v[1] || 0;
					break;
				case 'rotate':
					obj[n].a = +v[0] || 0;
					obj[n].x = +v[1] || 0;
					obj[n].y = +v[2] || 0;
					break;
				case 'skewX':
				case 'skewY':
					obj[n].a = +v[0];
					break;
				case 'matrix':
					obj[n].a = +v[0] || 0;
					obj[n].b = +v[1] || 0;
					obj[n].c = +v[2] || 0;
					obj[n].d = +v[3] || 0;
					obj[n].e = +v[4] || 0;
					obj[n].f = +v[5] || 0;
					break;
			}
		}
	}

	obj.toString = function() {
		var builder = [];
		for (var i = 0, length = prop.length; i < length; i++) {
			var n = prop[i];
			var o = this[n];
			if (!o)
				continue;
			switch (n) {
				case 'translate':
				case 'scale':
					builder.push(n + '(' + o.x + ',' + o.y + ')');
					break;
				case 'rotate':
					builder.push(n + '(' + o.a + ' ' + o.x + ' ' + o.y + ')');
					break;
				case 'skewX':
				case 'skewY':
					builder.push(n + '(' + o.a + ')');
					break;
				case 'matrix':
					builder.push(n + '(' + o.a + ',' + o.b + ',' + o.c + ',' + o.d + ',' + o.e + ',' + o.f + ')');
					break;
			}
		}
		return builder.join(' ');
	};

	return obj;
};

// A simple SVG animation
$.fn.transform = function(obj, duration, easing, complete) {

	var REG_TRANSFORM = /\}(?=\w)/g;
	var REG_ROTATE = /[-0-9\.\s]+/;
	var REG_TRANSLATE = /[-0-9\.]+(\,|\s)?[-0-9\.]+/;
	var REG_SCALE = /[0-9\.]+/;
	var REG_SKEW = /[-0-9\.]+/;

	if (typeof(easing) === 'function') {
		complete = easing;
		easing = undefined;
	}

	this.each(function() {

		var self = $(this);
		var t = self.attr('transform');
		var transform = t;
		var afrom = {};
		var ato = {};
		var aindex = {};
		var index = -1;

		for (var m in obj) {

			var reg = new RegExp(m + '\\([-0-9\\.\\,\\s]+\\)', 'g');
			var val = t.match(reg);

			!val && (val = '');
			index++;

			switch (m) {
				case 'rotate':
					var arr = val.toString().match(REG_ROTATE);
					!arr && (arr = '0 0 0');
					arr = arr.toString().split(' ');
					afrom.rotateA = parseFloat(arr[0]);
					afrom.rotateB = parseFloat(arr[1]);
					isNaN(afrom.rotateB) && (afrom.rotateB = 0);
					afrom.rotateC = parseFloat(arr[2]);
					isNaN(afrom.rotateC) && (afrom.rotateC = 0);

					arr = obj[m].toString().split(' ');
					ato.rotateA = parseFloat(arr[0]);
					ato.rotateB = parseFloat(arr[1]);
					ato.rotateC = parseFloat(arr[2]);

					if (isNaN(ato.rotateB)) {
						if (afrom.rotateB !== undefined)
							ato.rotateB = afrom.rotateB;
						else
							ato.rotateB = 0;
					}

					if (isNaN(ato.rotateC)) {
						if (afrom.rotateC !== undefined)
							ato.rotateC = afrom.rotateC;
						else
							ato.rotateC = 0;
					}

					aindex.rotate = index;
					transform = transform.replace(val, '{' + index + '}');
					break;

				case 'translate':
					var arr = val.toString().match(REG_TRANSLATE);
					!arr && (arr = '0 0');
					arr = arr.toString().replace(/,/g, ' ').split(' ');
					afrom.translateX = parseFloat(arr[0]);
					afrom.translateY = parseFloat(arr[1]);
					arr = obj[m].toString().replace(/,/g, ' ').split(' ');
					ato.translateX = parseFloat(arr[0]);
					ato.translateY = parseFloat(arr[1]);
					isNaN(ato.translateX) && (ato.translateX = afrom.translateX);
					isNaN(ato.translateY) && (ato.translateY = afrom.translateY);
					aindex.translate = index;
					transform = transform.replace(val, '{' + index + '}');
					break;

				case 'scale':
					var scale = val.toString().match(REG_SCALE);
					!scale && (scale = '1');
					ato.scale = parseFloat(obj[m].toString());
					afrom.scale = parseFloat(scale.toString().replace(',', '.'));
					aindex.scale = index;
					transform = transform.replace(val, '{' + index + '}');
					break;

				case 'skewX':
					var skewX = val.toString().match(REG_SKEW);
					!skewX && (skewX = '0');
					ato.skewX = parseFloat(obj[m].toString());
					afrom.skewX = parseFloat(skewX.toString().replace(',', '.'));
					aindex.skewX = index;
					transform = transform.replace(val, '{' + index + '}');
					break;

				case 'skewY':
					var skewY = val.toString().match(REG_SKEW);
					!skewY && (skewY = '0');
					ato.skewY = parseFloat(obj[m].toString());
					afrom.skewY = parseFloat(skewY.toString().replace(',', '.'));
					aindex.skewY = index;
					transform = transform.replace(val, '{' + index + '}');
					break;
			}
		}

		transform = transform.replace(REG_TRANSFORM, '} ');

		if (!duration) {
			var attr = transform;
			aindex.translate >= 0 && (attr = attr.replace('{' + aindex.translate + '}', 'translate(' + ato.translateX + ' ' + ato.translateY + ')'));
			aindex.scale >= 0 && (attr = attr.replace('{' + aindex.scale + '}', 'scale(' + ato.scale + ')'));
			aindex.rotate >= 0 && (attr = attr.replace('{' + aindex.rotate + '}', 'rotate(' + ato.rotateA + (ato.rotateB !== undefined ? ' ' + ato.rotateB : '') + (ato.rotateC !== undefined ? ' ' + ato.rotateC : '') + ')'));
			aindex.skewX >= 0 && (attr = attr.replace('{' + aindex.skewX + '}', 'skewX(' + ato.skewX + ')'));
			aindex.skewY >= 0 && (attr = attr.replace('{' + aindex.skewY + '}', 'skewY(' + ato.skewY + ')'));
			self.attr('transform', attr);
			return;
		}

		$(afrom).animate(ato, { duration: duration, easing: easing, step: function() {
			var attr = transform;
			aindex.translate >= 0 && (attr = attr.replace('{' + aindex.translate + '}', 'translate(' + this.translateX + ' ' + this.translateY + ')'));
			aindex.scale >= 0 && (attr = attr.replace('{' + aindex.scale + '}', 'scale(' + this.scale + ')'));
			aindex.skewX >= 0 && (attr = attr.replace('{' + aindex.skewX + '}', 'skewX(' + this.skewX + ')'));
			aindex.skewX >= 0 && (attr = attr.replace('{' + aindex.skewX + '}', 'skewX(' + this.skewX + ')'));
			aindex.rotate >= 0 && (attr = attr.replace('{' + aindex.rotate + '}', 'rotate(' + this.rotateA + (this.rotateB !== undefined ? ' ' + this.rotateB : '') + (this.rotateC !== undefined ? ' ' + this.rotateC : '') + ')'));
			self.attr('transform', attr);
		}, done: complete });
	});

	return this;
};
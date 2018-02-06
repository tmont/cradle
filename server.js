const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');

const server = http.createServer((req, res) => {
	let filename = path.join(__dirname, url.parse(req.url).pathname);

	try {
		const stat = fs.statSync(filename);
		if (!stat.isFile()) {
			filename = './test.html';
		}
	} catch (e) {
		filename = './test.html';
	}

	fs.createReadStream(filename).pipe(res);
});

server.listen(9009, () => {
	console.log('listening on port 9009');
});

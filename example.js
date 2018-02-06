(function() {
	const cradle = new window.Cradle(document.getElementById('mount'));

	class PhotoCarousel {
		render() {
			return `
<p data-cradle-view="clock"></p>
<ol>
	<li><a href="${cradle.getViewUrl('photoDetails', {photoId: 1})}">Photo #1</a></li>
	<li><a href="${cradle.getViewUrl('photoDetails', {photoId: 2})}">Photo #2</a></li>
	<li><a href="${cradle.getViewUrl('photoDetails', {photoId: 3})}">Photo #3</a></li>
</ol>
`;
		}
	}

	class PhotoInfo {
		render(params) {
			return `<p>Details for photo: ${params.photoId}</p>`;
		}
	}

	class MainLayout {
		render() {
			return `
<div class="main-layout">
	<h1>Hello world</h1>
	<div data-cradle-view="userInfo"></div>
	<div data-cradle-view="clickCounter"></div>
	<ul>
		<li><a href="${cradle.getViewUrl('photos')}">Click here for photos</a></li>
		<li><a href="${cradle.getViewUrl('about')}">About</a></li>
	</ul>
	<div data-cradle-view="content"></div>
</div>`;
		}
	}

	class Clock {
		constructor() {
			this.intervalId = null;
			this.timeNode = null;
		}

		destroy() {
			clearInterval(this.intervalId);
			this.timeNode = null;
		}

		render() {
			const pad = (value, num = 2) => '0'.repeat(Math.max(0, num - value.toString().length)) + value;
			const setTime = () => {
				const date = new Date();
				this.timeNode.nodeValue = `${date.getHours()}:${pad(date.getMinutes())}:` +
					`${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
			};

			const parent = document.createElement('span');
			this.timeNode = document.createTextNode('');
			parent.appendChild(this.timeNode);
			clearInterval(this.intervalId);
			setTime();
			this.intervalId = setInterval(setTime, 47);

			return parent;
		}
	}

	class LoggedInUserInfo {
		constructor() {
			this.usernameNode = document.createTextNode('');
		}

		receiveData(data) {
			console.log('LoggedInUserInfo.receiveData');
			this.usernameNode.nodeValue = data.loggedInUser.username;
		}

		hydrate(mount) {
			const parent = mount.querySelector('p');
			this.usernameNode.nodeValue = parent.innerHTML;
			parent.replaceChild(this.usernameNode, parent.firstChild);
		}

		render(params, bindings) {
			const p = document.createElement('p');
			p.appendChild(this.usernameNode);
			this.usernameNode.nodeValue = bindings.loggedInUser.username;
			return p;
		}
	}

	class ClickCounter {
		constructor() {
			this.countNode = document.createTextNode('0');
		}

		receiveData(data) {
			console.log('ClickCounter.receiveData');
			this.countNode.nodeValue = data.clickCount;
		}

		hydrate(mount) {
			this.setEvents(mount.querySelector('button'));
			const parent = mount.querySelector('span');
			parent.replaceChild(this.countNode, parent.firstChild);
		}

		setEvents(button) {
			button.addEventListener('click', () => {
				cradle.setData('clickCount', cradle.getData('clickCount') + 1);
				cradle.propagate('clickCount');
			});
		}

		render() {
			const p = document.createElement('p');
			p.appendChild(document.createTextNode('Num clicks: '));
			p.appendChild(this.countNode);

			const button = document.createElement('button');
			button.appendChild(document.createTextNode('Click me'));
			this.setEvents(button);
			p.appendChild(button);
			return p;
		}
	}

	class PhotoView {
		render() {
			return `
<h2>Photo view</h2>
<div data-cradle-view="carousel"></div>
<div data-cradle-view="details">
	<p>Photo details go here</p>
</div>
`;
		}
	}

	cradle
		.setViews({
			main: {
				path: '/',
				component: new MainLayout(),
				views: {
					userInfo: {
						targetView: 'userInfo',
						component: new LoggedInUserInfo(),
						bindings: ['loggedInUser']
					},
					clickCounter: {
						targetView: 'clickCounter',
						component: new ClickCounter(),
						bindings: ['clickCount']
					},
				},
				subRoutes: {
					about: {
						path: '/about',
						targetView: 'content',
						component: {render: () => '<p>About!</p>'},
					},
					photos: {
						path: '/photos',
						targetView: 'content',
						component: new PhotoView(),
						views: {
							photoCarousel: {
								targetView: 'carousel',
								component: new PhotoCarousel(),
								views: {
									clock: {
										targetView: 'clock',
										component: new Clock()
									}
								},
							}
						},
						subRoutes: {
							photoDetails: {
								path: '/:photoId',
								targetView: 'details',
								component: new PhotoInfo()
							}
						}
					}
				}
			}
		});

	const loggedInUser = cradle.decorate('loggedInUser', {
		username: 'tmont'
	});

	cradle.setData('clickCount', 0);
	const hydrate = window.location.pathname === '/about';
	cradle.start({ hydrate });

	setTimeout(() => loggedInUser.username = 'hello', 1000);
}());

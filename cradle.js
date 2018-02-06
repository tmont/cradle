(function(window, document, exports) {
	const quote = (str) => {
		return str.replace(/[.\\_*?[\]${}()=!<>|-]/g, '\\$&');
	};

	const setChild = (parent, child) => {
		if (typeof(child) === 'string') {
			parent.innerHTML = child.trim();
		} else {
			parent.innerHTML = '';
			parent.appendChild(child);
		}
	};

	const findMount = (mount, view) => {
		const targetView = view.targetView;
		const childMount = mount.querySelector(`[data-cradle-view="${targetView}"]`);
		if (!childMount) {
			throw new Error(`could not find view mount for "${targetView}"`);
		}
		return childMount;
	};

	const replaceValues = (subject, values) => {
		if (subject && values) {
			Object.keys(values).forEach((name) => {
				subject = subject.replace(
					new RegExp(':' + quote(name), 'gi'),
					values[name]
				);
			});
		}

		return subject || '';
	};

	const buildUrl = (url, values) => {
		if (typeof(url) !== 'string') {
			return null;
		}

		let realUrl = replaceValues(url, values).replace(/\/+$/, '');

		if (!realUrl) {
			realUrl = '/';
		}

		return realUrl;
	};

	const isEqual = (obj, other) => {
		if (obj === other) {
			return true;
		}

		if (!obj || !other) {
			return false;
		}

		if (typeof(obj) !== 'object' || typeof(other) !== 'object') {
			return false;
		}

		const keys1 = Object.keys(obj);
		const keys2 = Object.keys(other);

		if (keys1.length !== keys2.length) {
			return false;
		}

		keys1.sort();
		keys2.sort();

		if (keys1.join(',') !== keys2.join(',')) {
			return false;
		}

		for (let i = 0; i < keys1.length; i++) {
			const value1 = obj[keys1[i]];
			const value2 = other[keys1[i]];

			if (!isEqual(value1, value2)) {
				return false;
			}
		}

		return true;
	};

	// http://stackoverflow.com/a/10651028
	let popped = 'state' in window.history && window.history.state !== null;
	let currentPath = window.location.pathname;
	let initialUrl = window.location.href;

	class View {
		constructor(slug, {path, parent, isNavigable, component, params, targetView, subViews, bindings}) {
			this.slug = slug;
			this.component = component;
			this.path = path || null;
			this.fullPath = this.path ? ((parent ? parent.fullPath : '') + this.path).replace(/^\/+/, '/') : null;
			this.pathRegex = this.path ?
				new RegExp('^' + quote(this.fullPath).replace(/:\w+/g, () => '([-\\w]+)') + '$', 'i') :
				null;
			this.parent = parent;
			this.isNavigable = !!isNavigable;
			this.targetView = targetView;
			this.subViews = subViews;
			this.bindings = bindings;

			if (!params) {
				params = [];
				const regex = /:(\w+)/g;
				let match;
				while (match = regex.exec(path)) {
					params.push(match[1]);
				}
			} else if (!Array.isArray(params)) {
				throw new Error(`"params" must be an array or null in route "${slug}"`);
			}

			this.params = params.concat(parent ? parent.params : []);
		}

		getParamsForUrl(url) {
			return this.match(url);
		}

		match(url) {
			if (!this.pathRegex) {
				return null;
			}

			const match = this.pathRegex.exec(url);
			if (!match) {
				return null;
			}

			// map array of parameters to named parameters
			return this.params.reduce((params, name, i) => {
				params[name] = match[i + 1] || null;
				return params;
			}, {});
		}

		render(mount, params, globalBindings, cache, options = {}) {
			const cached = cache[this.slug];

			const routeParams = this.params
				.reduce((obj, key) => {
					if (key in params) {
						obj[key] = params[key];
					}

					return obj;
				}, {});

			if (cached && isEqual(cached.params, routeParams)) {
				console.log(`rendering view "${this.slug}" (cached)`);
				return;
			}

			if (cache[this.slug]) {
				// if it's currently in the cache, but being rendered again, destroy it first before rendering it again
				console.log(`destroying cached view "${this.slug}"`);

				if (typeof(cache[this.slug].view.component.destroy) === 'function') {
					cache[this.slug].view.component.destroy();
				}
			}

			if (options.hydrate) {
				console.log(`hydrating view "${this.slug}"`);
				if (typeof(this.component.hydrate) === 'function') {
					this.component.hydrate(mount, routeParams, globalBindings);
				}
			} else  {
				console.log(`rendering view "${this.slug}"`);
				const value = this.component.render(routeParams, globalBindings);
				setChild(mount, value);
			}

			cache[this.slug] = {
				params,
				rootNode: mount,
				view: this,
			};
		}

		hydrate(mount, params, globalBindings, cache) {
			this.render(mount, params, globalBindings, cache, true);
		}
	}

	class Cradle {
		constructor(mount) {
			this.mount = mount;
			this.views = {};
			this.viewCache = {};
			this.renderState = [];
			this.bindings = {};
		}

		decorate(dataKey, obj) {
			if (!obj || typeof(obj) !== 'object') {
				throw new Error('Can only decorate objects');
			}

			const metaKey = '__cradle';

			if (obj[metaKey]) {
				return;
			}

			Object.defineProperty(obj, metaKey, {
				enumerable: false,
				configurable: false,
				value: {
					props: {},
				}
			});

			const meta = obj[metaKey];

			Object.keys(obj).forEach((key) => {
				if (meta.props[key]) {
					return;
				}

				const descriptor = Object.getOwnPropertyDescriptor(obj, key);
				if (!descriptor.configurable) {
					return;
				}

				let value = obj[key];
				Object.defineProperty(obj, key, {
					get: () => value,
					set: (newValue) => {
						value = newValue;
						this.propagate(dataKey);
					}
				});

				meta.props[key] = true;
			});

			this.setData(dataKey, obj);

			return obj;
		}

		setData(key, value) {
			this.bindings[key] = value;
			return this;
		}

		getData(key) {
			return key in this.bindings ? this.bindings[key] : null;
		}

		propagate(dataKey) {
			// find views that have bindings to each key and update them
			const views = Object.keys(this.viewCache).map(slug => this.viewCache[slug].view);
			const dataKeys = dataKey ? [dataKey] : Object.keys(this.bindings);
			for (let i = 0; i < views.length; i++) {
				const view = views[i];
				if (!view.bindings.length) {
					continue;
				}

				if (typeof(view.component.receiveData) !== 'function') {
					continue;
				}

				for (let j = 0; j < dataKeys.length; j++) {
					const key = dataKeys[j];
					if (view.bindings.indexOf(key) !== -1) {
						view.component.receiveData(this.bindings);
						break;
					}
				}
			}
		}

		setViews(routes) {
			const setView = (obj, parent) => {
				if (!obj) {
					return;
				}

				const createView = (name, config, parent) => {
					const slug = config.slug || name;
					return new View(slug, {
						path: config.path,
						parent,
						isNavigable: config.isNavigable !== false,
						component: config.component,
						params: config.params,
						targetView: config.targetView,
						bindings: config.bindings || [],
						subViews: Object.keys(config.views || {})
							.map(viewName => createView(viewName, config.views[viewName]))
							.reduce((obj, view) => {
								obj[view.slug] = view;
								return obj;
							}, {})
					});
				};

				Object.keys(obj).forEach((routeName) => {
					const config = obj[routeName];
					const slug = config.slug || routeName;

					if (slug in this.views) {
						throw new Error(`route "${slug}" is already defined`);
					}

					const route = this.views[slug] = createView(routeName, config, parent);
					setView(config.subRoutes, route);
				});
			};

			setView(routes);
		}

		renderSubView(parentMount, currentSubView, params, options) {
			const childMount = findMount(parentMount, currentSubView);
			this.doRender(currentSubView, childMount, params, options);

			Object.keys(currentSubView.subViews).forEach((name) => {
				// find the mount for this particular sub view
				const subView = currentSubView.subViews[name];
				this.renderSubView(parentMount, subView, params, options);
			});
		}

		doRender(view, mount, params, options) {
			this.renderState.push(view);
			view.render(mount, params, this.bindings, this.viewCache, options);
		}

		renderView(view, params, options) {
			const ancestry = [view];
			let parent = view;
			while (parent = parent.parent) {
				ancestry.push(parent);
			}

			// renderState is top -> down
			// ancestry is bottom -> up

			const willBeRenderedRecursive = (view, slug) => {
				if (view.slug === slug) {
					return true;
				}

				return Object.keys(view.subViews)
					.some(subViewName => willBeRenderedRecursive(view.subViews[subViewName], slug));
			};

			for (let i = this.renderState.length - 1; i >= 0; i--) {
				const renderedView = this.renderState[i];

				const willBeRendered = ancestry.some(view => willBeRenderedRecursive(view, renderedView.slug));
				if (!willBeRendered) {
					console.log(`destroying ${renderedView.slug}`);
					if (typeof(renderedView.destroy) === 'function') {
						renderedView.destroy();
					}

					this.viewCache[renderedView.slug].rootNode.innerHTML = '';
				}
			}

			this.renderState = [];

			let current;
			let prev;
			let mount = this.mount;
			while (current = ancestry.pop()) {
				if (prev) {
					mount = findMount(mount, current);
				}

				this.doRender(current, mount, params, options);

				// render sub views, if applicable
				Object.keys(current.subViews).forEach((name) => {
					this.renderSubView(mount, current.subViews[name], params, options);
				});

				prev = current;
			}

			// clear view cache of views that weren't just rendered
			Object.keys(this.viewCache).forEach(slug => {
				const isRendered = this.renderState.some(view => view.slug === slug);
				if (!isRendered) {
					delete this.viewCache[slug];
				}
			});
		}

		navigate(name, params, options) {
			const view = this.views[name];
			if (!view) {
				throw new Error(`Unknown view: "${name}"`);
			}

			if (!view.isNavigable) {
				throw new Error(`view "${name}" is not navigable`);
			}

			params = params || {};

			this.renderView(view, params, options);
		}

		navigateToUrl(url, extraParams, options) {
			const view = this.getViewForUrl(url);
			if (!view) {
				throw new Error(`No view found that matches URL "${url}"`);
			}

			const params = {
				...view.getParamsForUrl(url),
				...extraParams
			};

			console.log(`navigating to URL ${url}`, params);
			const fullUrl = window.location.pathname + window.location.search + window.location.hash;

			if (url !== fullUrl) {
				window.history.pushState(null, null, url);
			}

			popped = true;
			currentPath = window.location.pathname;

			this.navigate(view.slug, params, options);
		}

		getViewForUrl(url) {
			return Object.keys(this.views)
				.map(key => this.views[key])
				.find(view => !!view.match(url));
		}

		getViewUrl(slug, params) {
			const view = this.views[slug];
			if (!view) {
				throw new Error(`No view found with slug "${slug}"`);
			}

			if (!view.isNavigable) {
				throw new Error(`View "${slug}" is not navigable`);
			}

			if (!view.fullPath) {
				throw new Error(`View "${slug}" has no path`);
			}

			return buildUrl(view.fullPath, params);
		}

		start(options = {}) {
			this.bindLinks();

			window.addEventListener('popstate', () => {
				const location = window.location;
				const initialPop = !popped && location.href === initialUrl;
				popped = true;
				const pathname = location.pathname;
				if (currentPath === pathname && location.hash) {
					return;
				}

				currentPath = pathname;

				if (initialPop) {
					return;
				}

				this.navigateToUrl(pathname);
			});

			this.navigateToUrl(window.location.pathname, null, options);
		}

		bindLinks() {
			document.addEventListener('click', (e) => {
				if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
					return;
				}

				const anchor = e.target;
				const href = anchor.hasAttribute('href') ? anchor.getAttribute('href') : null;
				if (href === null || anchor.hasAttribute('target') || /^(#|\w+:|\/\/)/.test(href)) {
					return;
				}

				e.preventDefault();
				anchor.blur();
				this.navigateToUrl(href);
			});
		}
	}

	exports.Cradle = Cradle;

}(window, document, typeof(module) !== 'undefined' ? module.exports : window));

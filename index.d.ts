interface CradleComponent<TParams, TBindings> {
	render: (params: TParams, globalBindings: TBindings) => void;
	hydrate?: (mount: HTMLElement, params: TParams, globalBindings: TBindings) => void;
	destroy?: () => void;
	receiveData?: (globalBindings: TBindings) => void;
}

interface CradleViewDefinition<TParams, TBindings> {
	component: CradleComponent<TParams, TBindings>;
	slug?: string;
	path?: string;
	isNavigable?: boolean;
	params?: Array<keyof TParams>;
	targetView?: string;
	bindings?: Array<keyof TBindings>;
	views?: ViewDefinitions<TBindings>;
	subRoutes?: ViewDefinitions<TBindings>;
}

interface ViewDefinitions<TBindings> {
	[key: string]: CradleViewDefinition<any, TBindings>;
}

interface CradleViewCacheValue<TBindings> {
	params: any;
	rootNode: HTMLElement;
	view: CradleView<any, TBindings>;
}
type CradleViewCache<TBindings> = {
	[slug: string]: CradleViewCacheValue<TBindings>;
};

interface CradleRenderOptions {
	hydrate?: boolean;
}

interface CradleView<TParams, TBindings> {
	getParamsForUrl(url: string): TParams | null;
	match(url: string): TParams | null;
	render(mount: HTMLElement, params: TParams, globalBindings: TBindings, cache: CradleViewCache<TBindings>, options?: CradleRenderOptions);
	hydrate(mount: HTMLElement, params: TParams, globalBindings: TBindings, cache: CradleViewCache<TBindings>);
}

export class Cradle<TBindings, TViews> {
	constructor(mount: HTMLElement);
	decorate<K extends keyof TBindings>(dataKey: K, obj: TBindings[K]): TBindings[K];
	setData<K extends keyof TBindings>(key: K, value: TBindings[K]): this;
	getData<K extends keyof TBindings>(key: K): TBindings[K] | null;
	propagate(dataKey: keyof TBindings): void;
	setViews(views: ViewDefinitions<TBindings>): void;
	navigate<K extends keyof TViews>(viewName: K, params: TViews[K]): void;
	navigateToUrl(url: string, extraParams: any): void;
	getViewForUrl(url: string): CradleView<any, TBindings>;
	getViewUrl<K extends keyof TViews>(slug: K, params?: TViews[K]): CradleView<TViews[K], TBindings>;
	start(options?: CradleRenderOptions);
	bindLinks();
}

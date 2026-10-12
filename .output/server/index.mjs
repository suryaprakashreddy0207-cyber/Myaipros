globalThis.__nitro_main__ = import.meta.url;
import { a as defineLazyEventHandler, c as serve, i as defineHandler, n as HTTPError, o as toEventHandler, s as NodeResponse, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"15f61-j9NEW3mJXxKrRcAq+fCoY9CzrRk\"",
		"mtime": "2026-10-04T07:58:23.858Z",
		"size": 89953,
		"path": "../public/favicon.ico"
	},
	"/assets/__vite-browser-external-8Lh2pky1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"67-xLEcSIC/DT8xQSMK+DHwJFD/mEE\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 103,
		"path": "../public/assets/__vite-browser-external-8Lh2pky1.js"
	},
	"/assets/auth-BlgrmcRd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128e-/+76QzjowJyl/Gne3D9vu1I55go\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 4750,
		"path": "../public/assets/auth-BlgrmcRd.js"
	},
	"/assets/builder.functions-Cn9nBz3K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"41a-HDv7A/+SgoqBeoOyMF+ka7iBcMA\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 1050,
		"path": "../public/assets/builder.functions-Cn9nBz3K.js"
	},
	"/assets/chat-CgoZdTSV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15af-hMvBRJQ58VeJAdRkro30eI+8GN8\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 5551,
		"path": "../public/assets/chat-CgoZdTSV.js"
	},
	"/assets/chat._threadId-56v9hF1f.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"523b-RIuy3oLcW7yHYkdIdskN97g7w4E\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 21051,
		"path": "../public/assets/chat._threadId-56v9hF1f.js"
	},
	"/assets/build-BXzhENjB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c66b-udtUvJwePj4l5LmZ3zuJCG9fEJA\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 50795,
		"path": "../public/assets/build-BXzhENjB.js"
	},
	"/assets/chat.functions-1WdavNYk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"406-C/db8Mosv3MqCdIkjEyPxU4fGIo\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 1030,
		"path": "../public/assets/chat.functions-1WdavNYk.js"
	},
	"/assets/cowork-DeR9uV8s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47-uKwhTPx2W9VCLk2Mh90/mbHpDBg\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 71,
		"path": "../public/assets/cowork-DeR9uV8s.js"
	},
	"/assets/jszip.min-Co3Xwuww.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"17718-BCuY1OpYRlrJfx4rw8yhX2XloDw\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 96024,
		"path": "../public/assets/jszip.min-Co3Xwuww.js"
	},
	"/assets/matchContext-CIoOWDLl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cc-uusDvC6XASoV0qC4UYH+SCgHdv8\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 204,
		"path": "../public/assets/matchContext-CIoOWDLl.js"
	},
	"/assets/palette-BBsGTiZc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24a-WgnQhxYXziKgDz/5fjK2DVzfBNE\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 586,
		"path": "../public/assets/palette-BBsGTiZc.js"
	},
	"/assets/presentations-ei7NGjnd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c-R5s9NKTiN1eexB0hP6zfjkWHftw\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 140,
		"path": "../public/assets/presentations-ei7NGjnd.js"
	},
	"/assets/presentations._id-BjK_UZ3h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ae3-6DTvigFnTy5ZVV2nVrYTdP/ZoLo\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 31459,
		"path": "../public/assets/presentations._id-BjK_UZ3h.js"
	},
	"/assets/auth-middleware-BYbbnpMH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a387-XWRKJbCvsmGyIE/K/PTU6Y5PI6s\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 41863,
		"path": "../public/assets/auth-middleware-BYbbnpMH.js"
	},
	"/assets/route-ei7NGjnd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c-R5s9NKTiN1eexB0hP6zfjkWHftw\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 140,
		"path": "../public/assets/route-ei7NGjnd.js"
	},
	"/assets/search-DX6ljNv9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-ol2iUEn+jPMpEs1kCMCZJUYFYh0\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 173,
		"path": "../public/assets/search-DX6ljNv9.js"
	},
	"/assets/react-dom-C-Yba4o5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e04-PeOCCO93lwODDWgvkrEbJPlXQys\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 3588,
		"path": "../public/assets/react-dom-C-Yba4o5.js"
	},
	"/assets/styles-BWuoKdwk.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"1cb9a-r9f3vTdEaxRlfEcdS1HBU8DMB8M\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 117658,
		"path": "../public/assets/styles-BWuoKdwk.css"
	},
	"/assets/rolldown-runtime-aKtaBQYM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"43c-9jE38cZoaVbt+/WqnIZEXrfylzA\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 1084,
		"path": "../public/assets/rolldown-runtime-aKtaBQYM.js"
	},
	"/assets/research-BJHs8lSQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3970-mPJ4Aeo9rtkxMOkQwm0zOfx5BDw\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 14704,
		"path": "../public/assets/research-BJHs8lSQ.js"
	},
	"/assets/presentations.functions-CjPbBVCA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"833-kogkmXz/b6F7DaOkF+JoOf0TGmw\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 2099,
		"path": "../public/assets/presentations.functions-CjPbBVCA.js"
	},
	"/assets/presentations.index-DQTY_Y97.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3578-PfKJNV+60GeC04BVzdLeA1iEj2c\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 13688,
		"path": "../public/assets/presentations.index-DQTY_Y97.js"
	},
	"/assets/pptxgen.es-CaVuUuYZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"428e1-n4XR1mBRcPSIPI9Filo/5kYNvWQ\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 272609,
		"path": "../public/assets/pptxgen.es-CaVuUuYZ.js"
	},
	"/assets/index-BOWn12lz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1396f5-xnk+UXdxODv8r2+w6uWRVxgMW6A\"",
		"mtime": "2026-10-04T07:58:21.532Z",
		"size": 1283829,
		"path": "../public/assets/index-BOWn12lz.js"
	},
	"/assets/trash-2-DKYd37PA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23c6-eg5aTF4cmSEaTqgBp9FQOLA5uy4\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 9158,
		"path": "../public/assets/trash-2-DKYd37PA.js"
	},
	"/assets/useRouter-Cwc0JnUz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f38-KIO6Z56TuGYYc7h0iKUJTjzhclc\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 7992,
		"path": "../public/assets/useRouter-Cwc0JnUz.js"
	},
	"/assets/useStore-Dn2ieOM0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e75-s30Kq9rZI6Cn2GbYJoVQtXkgdpQ\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 20085,
		"path": "../public/assets/useStore-Dn2ieOM0.js"
	},
	"/assets/video-Dn7k6bl0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ec9-3iK8j6NVFXfiPLPxQcNNjbLtIfA\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 11977,
		"path": "../public/assets/video-Dn7k6bl0.js"
	},
	"/assets/volume-2-9vMHsWHp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"185-2MBkbR/cGNZK5WoOBi3Rf25o7Cc\"",
		"mtime": "2026-10-04T07:58:21.533Z",
		"size": 389,
		"path": "../public/assets/volume-2-9vMHsWHp.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_6qWkqV = defineLazyEventHandler(() => import("./_chunks/renderer-template.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_6qWkqV
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };

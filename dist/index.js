"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenValid = exports.authToken = exports.init = void 0;
const fetch_intercept_1 = __importDefault(require("fetch-intercept"));
const SAPI_API_BASE_URL = "https://api.usesapi.com/";
const SAPI_PROXY_HOST = "proxy.usesapi.com";
class Sapi {
    constructor() {
        this.sapiId = null;
        this.proxyHost = null;
        this.tokenOwner = null;
        this.platform = null;
        this.expirationThresholdMs = 60 * 1000;
        this.requireAuth = null;
        this.apiHost = null;
        this.getStorageKey = () => {
            return `__sapi_token_${this.proxyHost}`;
        };
        this.registerFetchIntercept = () => {
            fetch_intercept_1.default.register({
                request: (url, config) => __awaiter(this, void 0, void 0, function* () {
                    const host = new URL(url).host;
                    if (host !== this.apiHost) {
                        return [url, config];
                    }
                    if (!isTokenValid()) {
                        yield this.fetchToken();
                    }
                    const proxyUrl = new URL(url);
                    proxyUrl.host = this.proxyHost;
                    const headers = Object.assign(Object.assign({}, (config.headers || {})), { Authorization: `Bearer ${this.getLocalSapiTokenData().token}` });
                    return [
                        proxyUrl.toString(),
                        Object.assign(Object.assign({}, config), { headers }),
                    ];
                }),
            });
        };
        this.refreshToken = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.fetchToken();
                this.setLocalSapiTokenData(data);
                const toms = new Date(data.expiresAt).getTime() -
                    Date.now() -
                    this.expirationThresholdMs;
                setTimeout(() => {
                    this.refreshToken();
                }, toms);
            }
            catch (e) {
                console.error(e);
            }
        });
        this.fetchToken = (auth) => __awaiter(this, void 0, void 0, function* () {
            const res = yield fetch(`${SAPI_API_BASE_URL}v1/token?code=${this.sapiId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.assign(Object.assign({}, (auth ? { auth } : {})), { tokenOwner: this.tokenOwner, metadata: {
                        platform: this.platform,
                    } })),
            });
            if (res.status >= 400) {
                throw new Error("Error while trying to create a Sapi token.");
            }
            const json = yield res.json();
            const token = json["token"];
            const expiresAt = json["expiresAt"];
            return { token, expiresAt };
        });
        this.getLocalSapiTokenData = () => {
            const localData = localStorage.getItem(this.getStorageKey());
            if (!localData) {
                return null;
            }
            return JSON.parse(localData);
        };
        this.setLocalSapiTokenData = (data) => localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
        this.isTokenValid = () => {
            const localData = this.getLocalSapiTokenData();
            if (!localData) {
                return false;
            }
            console.log(localData.expiresAt, new Date().toISOString());
            return (localData.expiresAt >
                new Date(Date.now() + this.expirationThresholdMs).toISOString());
        };
    }
    init({ sapiId, tokenOwner = "anonymous", platform = "app", requireAuth, }) {
        this.sapiId = sapiId;
        this.proxyHost = `${sapiId}.${SAPI_PROXY_HOST}`;
        this.tokenOwner = tokenOwner;
        this.platform = platform;
        this.requireAuth = requireAuth;
        this.apiHost = decodeHost(sapiId);
        this.registerFetchIntercept();
        if (this.requireAuth) {
            return;
        }
        if (!this.isTokenValid()) {
            this.refreshToken().catch(console.error);
        }
        else {
            const data = this.getLocalSapiTokenData();
            const ms = new Date(data.expiresAt).getTime() -
                Date.now() -
                this.expirationThresholdMs;
            setTimeout(() => {
                this.refreshToken().catch(console.error);
            }, ms);
        }
    }
    authToken(auth) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.fetchToken(auth);
            this.setLocalSapiTokenData(data);
        });
    }
}
const decodeHost = (input) => {
    const host = input.split(".")[0].replace(/--/g, "@@@@@@");
    const parts = host.split("-");
    parts.pop();
    return parts.join(".").replace(/@@@@@@/g, "-");
};
const sapi = new Sapi();
const init = sapi.init.bind(sapi);
exports.init = init;
const authToken = sapi.authToken.bind(sapi);
exports.authToken = authToken;
const isTokenValid = sapi.isTokenValid.bind(sapi);
exports.isTokenValid = isTokenValid;

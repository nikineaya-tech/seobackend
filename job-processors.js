'use strict';

const { app } = require('./server');

const ROUTES = {
    funnel: '/api/analyze-funnel',
    technical: '/api/technical-seo',
    competitors: '/api/competitors',
    keywords: '/api/generate-keywords'
};

function findBusinessHandler(path) {
    const routeLayer = app?._router?.stack?.find(layer =>
        layer.route?.path === path &&
        layer.route?.methods?.post === true
    );

    const handlers = routeLayer?.route?.stack || [];
    const businessLayer = handlers[handlers.length - 1];

    if (!businessLayer?.handle) {
        throw new Error(`No business handler registered for ${path}`);
    }

    return businessLayer.handle;
}

function runBusinessHandler(path, payload = {}) {
    const handler = findBusinessHandler(path);
    const body = { ...(payload || {}) };
    delete body.async;

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback(value);
        };

        const req = {
            body,
            method: 'POST',
            path,
            originalUrl: path,
            headers: { 'x-daka-worker-bypass': '1' },
            queueBypass: true,
            ip: 'railway-worker',
            user: null,
            get(name) {
                return this.headers[String(name || '').toLowerCase()];
            }
        };

        const res = {
            statusCode: 200,
            headers: {},
            status(code) {
                this.statusCode = code;
                return this;
            },
            set(name, value) {
                this.headers[String(name).toLowerCase()] = value;
                return this;
            },
            setHeader(name, value) {
                this.headers[String(name).toLowerCase()] = value;
            },
            json(data) {
                if (this.statusCode >= 400) {
                    const error = new Error(data?.message || data?.error || `HTTP ${this.statusCode}`);
                    error.statusCode = this.statusCode;
                    error.response = data;
                    finish(reject, error);
                } else {
                    finish(resolve, data);
                }
                return this;
            },
            send(data) {
                return this.json(data);
            },
            end(data) {
                return this.json(data);
            }
        };

        const next = (error) => {
            finish(reject, error || new Error(`Unexpected next() from ${path}`));
        };

        const timer = setTimeout(() => {
            finish(reject, new Error(`Processor timeout for ${path}`));
        }, Number(process.env.WORKER_JOB_TIMEOUT_MS || 180000));

        Promise.resolve(handler(req, res, next)).catch(error => finish(reject, error));
    });
}

function processJobFunnel(payload) {
    return runBusinessHandler(ROUTES.funnel, payload);
}

function processJobTechnical(payload) {
    return runBusinessHandler(ROUTES.technical, payload);
}

function processJobCompetitors(payload) {
    return runBusinessHandler(ROUTES.competitors, payload);
}

function processJobKeywords(payload) {
    return runBusinessHandler(ROUTES.keywords, payload);
}

function processJob(type, payload) {
    switch (type) {
        case 'funnel':
            return processJobFunnel(payload);
        case 'technical':
            return processJobTechnical(payload);
        case 'competitors':
            return processJobCompetitors(payload);
        case 'keywords':
            return processJobKeywords(payload);
        default:
            throw new Error(`Unsupported job type: ${type}`);
    }
}

module.exports = {
    processJob,
    processJobFunnel,
    processJobTechnical,
    processJobCompetitors,
    processJobKeywords
};

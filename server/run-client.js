'use strict';
class RunError extends Error {
    constructor(status, body) { super(body.detail || body.title || `Run returned ${status}`); this.status = status; this.code = body.code || 'run.upstream_error'; this.body = body; }
}

function createRunClient({ baseUrl, fetchImpl = globalThis.fetch }) {
    async function request(token, path, { method = 'GET', body } = {}) {
        const res = await fetchImpl(`${baseUrl}/api/v1${path}`, {
            method, headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new RunError(res.status, data);
        return data;
    }
    return {
        list: (token, query = '') => request(token, `/sessions${query}`),
        get: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}`),
        create: (token, body) => {
            const { template, ...payload } = body || {};
            return request(token, `/sessions${template ? `?template=${encodeURIComponent(template)}` : ''}`, { method: 'POST', body: payload });
        },
        stop: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/end`, { method: 'POST', body: {} }),
        command: (token, id, body) => request(token, `/sessions/${encodeURIComponent(id)}/commands`, { method: 'POST', body }),
        control: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/control`),
        take: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/control/take`, { method: 'POST', body: {} }),
        timeline: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/timeline`),
        snapshot: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/snapshot`),
    };
}
module.exports = { createRunClient, RunError };

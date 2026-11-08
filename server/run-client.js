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
        create: (token, body) => request(token, '/sessions', { method: 'POST', body }),
        stop: (token, id) => request(token, `/sessions/${encodeURIComponent(id)}/end`, { method: 'POST', body: {} }),
        command: (token, id, body) => request(token, `/sessions/${encodeURIComponent(id)}/commands`, { method: 'POST', body }),
    };
}
module.exports = { createRunClient, RunError };

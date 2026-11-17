'use strict';
/**
 * The machine registry, read and used as the person (plan §AD.15: machines are Computer's). Bot holds the registry
 * until the move (its devices table: your own computers through the OpenVibe Link, and shared nodes); Computer is the
 * front door now, and every call carries the person's own token, so Bot answers exactly what it answers them.
 *
 *   list(token)                         → { machines: [machine] }
 *   get(token, id)                      → { machine }
 *   desks(token, id), shares(token, id)
 *   leaseCreate(token, id, body), leaseGet(token, id, desk), leaseCommand(token, id, desk, body), leaseEnd(token, id, desk)
 */
class MachinesError extends Error {
    constructor(status, body) { super(body.detail || body.title || body.error || `Machines answered ${status}`); this.status = status; this.code = body.code || 'computer.machines.upstream_error'; this.body = body; }
}

function createMachinesClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    const id = (v) => encodeURIComponent(String(v || ''));
    async function request(token, path, { method = 'GET', body } = {}) {
        let res;
        try {
            res = await fetchImpl(`${base}/api/v1${path}`, {
                method, headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err) { throw new MachinesError(502, { detail: 'the machine registry could not be reached', code: 'computer.machines.unreachable' }); }
        const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
        if (!res.ok) throw new MachinesError(res.status, data);
        return data;
    }
    return {
        list: (token) => request(token, '/machines'),
        get: (token, m) => request(token, `/machines/${id(m)}`),
        desks: (token, m) => request(token, `/machines/${id(m)}/desks`),
        shares: (token, m) => request(token, `/machines/${id(m)}/shares`),
        leaseCreate: (token, m, body) => request(token, `/machines/${id(m)}/desk-leases`, { method: 'POST', body: body || {} }),
        leaseGet: (token, m, desk) => request(token, `/machines/${id(m)}/desk-leases/${id(desk)}`),
        leaseCommand: (token, m, desk, body) => request(token, `/machines/${id(m)}/desk-leases/${id(desk)}/commands`, { method: 'POST', body: body || {} }),
        leaseEnd: (token, m, desk) => request(token, `/machines/${id(m)}/desk-leases/${id(desk)}`, { method: 'DELETE' }),
    };
}

module.exports = { createMachinesClient, MachinesError };

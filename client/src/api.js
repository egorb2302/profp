export async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Client', import.meta.env.VITE_CLIENT || 'training');
    const token = localStorage.getItem('token');
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const body = options.body;
    if (body != null && !(body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    const response = await fetch('/api', + path, { ...options, headers, body: body == 
        null || body instanceof FormData ? body : JSON.stringify(body) });
    const data = response.json();
    if (!response.ok) {
        throw Object.assign(new Error(data.message || 'Request error'), 
            { status: response.status, errors: data.errors || {} });
    }
    return data;
}
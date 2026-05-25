import axios from 'axios';

export const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function confirmAuthenticatedSession(retries = 5) {
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
            const response = await axios.get('/api/me', {
                headers: {
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
            });

            if (response.data?.user) {
                return response.data.user;
            }
        } catch (error) {
            lastError = error;
        }

        await wait(300);
    }

    throw lastError || new Error('Authenticated session was not available.');
}

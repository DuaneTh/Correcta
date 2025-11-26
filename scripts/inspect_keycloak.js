const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'correcta-realm';
const CLIENT_ID = 'correcta-client';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function main() {
    try {
        // 1. Get Admin Token
        const params = new URLSearchParams();
        params.append('client_id', 'admin-cli');
        params.append('username', ADMIN_USERNAME);
        params.append('password', ADMIN_PASSWORD);
        params.append('grant_type', 'password');

        const tokenResponse = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!tokenResponse.ok) throw new Error(`Failed to get token: ${tokenResponse.statusText}`);
        const { access_token } = await tokenResponse.json();

        // 2. Get Client
        const clientsResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        if (!clientsResponse.ok) throw new Error(`Failed to get clients: ${clientsResponse.statusText}`);
        const clients = await clientsResponse.json();

        if (clients.length === 0) {
            console.log('Client not found');
        } else {
            console.log('Current Redirect URIs:', clients[0].redirectUris);
            console.log('Web Origins:', clients[0].webOrigins);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

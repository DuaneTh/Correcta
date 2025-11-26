const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'correcta-realm';
const CLIENT_ID = 'correcta-client';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function main() {
    try {
        // 1. Get Admin Token
        console.log('Getting Admin Token...');
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

        // 2. Get Client UUID
        console.log(`Finding client ${CLIENT_ID}...`);
        const clientsResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        if (!clientsResponse.ok) throw new Error(`Failed to get clients: ${clientsResponse.statusText}`);
        const clients = await clientsResponse.json();

        if (clients.length === 0) throw new Error(`Client ${CLIENT_ID} not found`);

        const client = clients[0];
        const clientUuid = client.id;
        console.log(`Client UUID: ${clientUuid}`);

        // 3. Force Update Redirect URIs
        // We explicitly set the array to exactly what we want, removing any potential garbage.
        const cleanRedirectUris = [
            'http://localhost:3000/api/auth/callback/oidc',
            'http://localhost:3000/login'
        ];

        console.log('Force updating Redirect URIs to:', cleanRedirectUris);

        const updateResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUuid}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...client,
                    redirectUris: cleanRedirectUris,
                    webOrigins: ['http://localhost:3000', '+'] // Add + for good measure
                })
            }
        );

        if (!updateResponse.ok) {
            throw new Error(`Failed to update client: ${updateResponse.statusText}`);
        }
        console.log('Client updated successfully!');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

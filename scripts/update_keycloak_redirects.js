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

        if (!tokenResponse.ok) {
            throw new Error(`Failed to get token: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Get Client UUID
        console.log(`Finding client ${CLIENT_ID}...`);
        const clientsResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!clientsResponse.ok) {
            throw new Error(`Failed to get clients: ${clientsResponse.statusText}`);
        }

        const clients = await clientsResponse.json();

        if (clients.length === 0) {
            throw new Error(`Client ${CLIENT_ID} not found`);
        }

        const client = clients[0];
        const clientUuid = client.id;
        console.log(`Client UUID: ${clientUuid}`);

        // 3. Update Redirect URIs
        const redirectUris = client.redirectUris || [];
        const newUri = 'http://localhost:3000/login';

        let needsUpdate = false;
        if (!redirectUris.includes(newUri)) {
            redirectUris.push(newUri);
            needsUpdate = true;
        }

        if (needsUpdate) {
            console.log(`Adding ${newUri} to redirect URIs...`);
            console.log('New Redirect URIs:', redirectUris);

            const updateResponse = await fetch(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUuid}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ...client, redirectUris })
                }
            );

            if (!updateResponse.ok) {
                throw new Error(`Failed to update client: ${updateResponse.statusText}`);
            }
            console.log('Client updated successfully!');
        } else {
            console.log('URI already exists. No changes needed.');
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

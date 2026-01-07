/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'correcta-realm';
const CLIENT_ID = 'correcta-client';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function main() {
    try {
        // 1. Get Admin Token
        console.log('Getting Admin Token...');
        const tokenResponse = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                client_id: 'admin-cli',
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                grant_type: 'password',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const accessToken = tokenResponse.data.access_token;

        // 2. Get Client UUID
        console.log(`Finding client ${CLIENT_ID}...`);
        const clientsResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (clientsResponse.data.length === 0) {
            throw new Error(`Client ${CLIENT_ID} not found`);
        }

        const client = clientsResponse.data[0];
        const clientUuid = client.id;
        console.log(`Client UUID: ${clientUuid}`);

        // 3. Update Redirect URIs
        const redirectUris = client.redirectUris || [];
        const newUri = 'http://localhost:3000/login';

        if (!redirectUris.includes(newUri)) {
            redirectUris.push(newUri);
            console.log(`Adding ${newUri} to redirect URIs...`);

            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUuid}`,
                { ...client, redirectUris },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            console.log('Client updated successfully!');
        } else {
            console.log('URI already exists. No changes needed.');
        }

        // 4. Verify
        console.log('Current Redirect URIs:', redirectUris);

    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

main();

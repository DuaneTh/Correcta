const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'correcta-realm';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';
const TARGET_USERNAME = 'prof@demo-sso.edu';
const NEW_PASSWORD = 'prof123';

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

        // 2. Get User ID
        console.log(`Finding user ${TARGET_USERNAME}...`);
        const usersResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${TARGET_USERNAME}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        if (!usersResponse.ok) throw new Error(`Failed to get users: ${usersResponse.statusText}`);
        const users = await usersResponse.json();

        if (users.length === 0) throw new Error(`User ${TARGET_USERNAME} not found`);

        // Filter exact match because search is fuzzy
        const user = users.find(u => u.username === TARGET_USERNAME);
        if (!user) throw new Error(`User ${TARGET_USERNAME} not found (fuzzy match only)`);

        const userId = user.id;
        console.log(`User UUID: ${userId}`);

        // 3. Reset Password
        console.log(`Resetting password to '${NEW_PASSWORD}'...`);
        const resetResponse = await fetch(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/reset-password`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'password',
                    value: NEW_PASSWORD,
                    temporary: false
                })
            }
        );

        if (!resetResponse.ok) {
            throw new Error(`Failed to reset password: ${resetResponse.statusText}`);
        }
        console.log('Password reset successfully!');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

import axios from 'axios';
import { UserData, TokenData } from '../types';
import { SessionData } from 'express-session';

export class AuthService {
    public getAuthUrl(): string {
        const tenantId = process.env.TENANT_ID;
        const clientId = process.env.CLIENT_ID;
        const redirectUri = process.env.REDIRECT_URI;

        return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=Files.Read offline_access`;
    }

    public async exchangeCodeForTokens(code: string): Promise<TokenData> {
        const tenantId = process.env.TENANT_ID;
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        const redirectUri = process.env.REDIRECT_URI;

        if (!tenantId || !clientId || !clientSecret || !redirectUri) {
            throw new Error('Fehlende Umgebungsvariablen für die Microsoft-Authentifizierung');
        }

        console.log('Starting token exchange process');
        console.log('Tenant ID:', tenantId);
        console.log('Client ID:', clientId);
        console.log('Redirect URI:', redirectUri);

        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });

        try {
            console.log('Sending POST request to token endpoint');
            const tokenResponse = await axios.post(tokenEndpoint, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            console.log('Token response status:', tokenResponse.status);
            return tokenResponse.data;
        } catch (error) {
            console.error('Error in token exchange:');
            if (axios.isAxiosError(error) && error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                throw new Error(`Token exchange failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                console.error('Unexpected error:', error);
                throw new Error('Unexpected error during token exchange');
            }
        }
    }

    private async getUserPhoto(accessToken: string): Promise<string | null> {
        try {
            console.log('getUserPhoto called: ', accessToken);
            const photoResponse = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                responseType: 'arraybuffer'
            });
            console.log('photoResponse: ', photoResponse);
            const photoBuffer = Buffer.from(photoResponse.data, 'binary').toString('base64');
            return `data:image/jpeg;base64,${photoBuffer}`;
        } catch (photoError) {
            console.error('Fehler beim Abrufen des Benutzerfotos:', photoError);
            return null;
        }
    }

    public async getUserData(accessToken: string): Promise<UserData> {
        try {
            const graphResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const userData = graphResponse.data;
            const photoUrl = await this.getUserPhoto(accessToken);

            return {
                displayName: userData.displayName,
                mail: userData.mail,
                userPrincipalName: userData.userPrincipalName,
                photo: photoUrl || undefined
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('Fehler beim Abrufen der Benutzerdaten:', error.response?.data || error.message);
            } else {
                console.error('Unerwarteter Fehler:', error);
            }
            throw new Error('Fehler beim Abrufen der Benutzerdaten');
        }
    }

    public isAuthenticated(session: SessionData): boolean {
        return !!session.accessToken;
    }

}
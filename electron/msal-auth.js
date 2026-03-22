/**
 * @fileoverview MSAL Public Client für Electron Main (delegiert, Scope Files.Read)
 *
 * Nutzt ELECTRON_MSAL_CLIENT_ID und optional ELECTRON_MSAL_TENANT_ID (Default: organizations).
 * Token-Cache wird unter userData/msal-stream-relay-cache.json persistiert.
 * In Azure AD muss die App als öffentlicher Client registriert sein; Redirect-URIs für
 * Desktop/Loopback (z. B. http://localhost) müssen erlaubt sein.
 */

const fs = require('fs').promises;
const path = require('path');
const {
  PublicClientApplication,
  InteractionRequiredAuthError,
} = require('@azure/msal-node');

const SCOPES = ['Files.Read'];

/**
 * @param {object} opts
 * @param {string} opts.userDataPath app.getPath('userData')
 * @param {(url: string) => Promise<void>} opts.openBrowser z. B. shell.openExternal
 */
function createMsalStreamRelayAuth(opts) {
  const { userDataPath, openBrowser } = opts;
  const clientId = (process.env.ELECTRON_MSAL_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error(
      'ELECTRON_MSAL_CLIENT_ID fehlt: Setze die Azure-AD-Client-ID in der .env (öffentlicher Client).'
    );
  }

  const tenant = (process.env.ELECTRON_MSAL_TENANT_ID || 'organizations').trim();
  const cachePath = path.join(userDataPath, 'msal-stream-relay-cache.json');

  const beforeCacheAccess = async (cacheContext) => {
    try {
      const data = await fs.readFile(cachePath, 'utf8');
      if (data && data.trim()) {
        cacheContext.tokenCache.deserialize(data);
      }
    } catch {
      /* Cache noch nicht vorhanden oder ungültig */
    }
  };

  const afterCacheAccess = async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      await fs.writeFile(cachePath, cacheContext.tokenCache.serialize(), 'utf8');
    }
  };

  const pca = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
    cache: {
      cachePlugin: {
        beforeCacheAccess,
        afterCacheAccess,
      },
    },
  });

  /**
   * @returns {Promise<string>} Access Token für graph.microsoft.com
   */
  async function acquireTokenForGraph() {
    const accounts = await pca.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const silent = await pca.acquireTokenSilent({
          account: accounts[0],
          scopes: SCOPES,
        });
        if (silent?.accessToken) return silent.accessToken;
      } catch (e) {
        const needInteractive =
          e instanceof InteractionRequiredAuthError ||
          e?.errorCode === 'interaction_required' ||
          e?.name === 'InteractionRequiredAuthError';
        if (!needInteractive) {
          throw e;
        }
      }
    }

    const interactive = await pca.acquireTokenInteractive({
      scopes: SCOPES,
      openBrowser: async (authUrl) => {
        await openBrowser(authUrl);
      },
    });
    if (!interactive?.accessToken) {
      throw new Error('msal_interactive_no_token: Kein Access Token erhalten');
    }
    return interactive.accessToken;
  }

  return { acquireTokenForGraph, pca, cachePath };
}

module.exports = { createMsalStreamRelayAuth, SCOPES };

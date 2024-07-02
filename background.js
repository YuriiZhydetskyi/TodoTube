const CLIENT_ID = 'e965264e-81d4-4f60-8718-d2329a35281e';
const SCOPES = 'offline_access Tasks.ReadWrite';
const REDIRECT_URI = chrome.identity.getRedirectURL();
const AUTH_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

let isLoggedIn = false;

function login() {
    return new Promise((resolve) => {
        const codeVerifier = generateCodeVerifier();
        generateCodeChallenge(codeVerifier).then(codeChallenge => {
            const state = Math.random().toString(36).substring(7);
            const AUTH_URL = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

            console.log("Starting login process");
            console.log("Auth URL:", AUTH_URL);

            chrome.storage.local.set({ codeVerifier: codeVerifier }, () => {
                chrome.identity.launchWebAuthFlow({
                    url: AUTH_URL,
                    interactive: true
                }, (redirectUrl) => {
                    console.log("Received redirect URL:", redirectUrl);
                    if (chrome.runtime.lastError) {
                        console.error("Chrome runtime error:", chrome.runtime.lastError);
                        resolve(false);
                    } else if (!redirectUrl) {
                        console.error("No redirect URL received");
                        resolve(false);
                    } else {
                        const url = new URL(redirectUrl);
                        console.log("Parsed URL:", url);
                        const code = url.searchParams.get('code');
                        const error = url.searchParams.get('error');
                        const returnedState = url.searchParams.get('state');

                        if (returnedState !== state) {
                            console.error("State mismatch. Possible CSRF attack.");
                            resolve(false);
                        } else if (code) {
                            console.log("Authorization code received");
                            exchangeCodeForToken(code).then((token) => {
                                console.log("Token received");
                                isLoggedIn = true;
                                chrome.storage.local.set({ isLoggedIn: true, accessToken: token }, () => {
                                    resolve(true);
                                });
                            }).catch((error) => {
                                console.error("Token exchange failed:", error);
                                resolve(false);
                            });
                        } else {
                            console.error("No code received. Error:", error);
                            resolve(false);
                        }
                    }
                });
            });
        });
    });
}

function exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['codeVerifier'], function (result) {
            const codeVerifier = result.codeVerifier;
            if (!codeVerifier) {
                reject(new Error('No code verifier found'));
                return;
            }

            const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            const body = new URLSearchParams({
                client_id: CLIENT_ID,
                scope: SCOPES,
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier
            });

            fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            })
                .then(response => response.json())
                .then(data => {
                    if (data.access_token) {
                        chrome.storage.local.remove('codeVerifier');
                        resolve(data.access_token);
                    } else {
                        reject(new Error('No access token received'));
                    }
                })
                .catch(error => reject(error));
        });
    });
}

function checkLoginState() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['isLoggedIn', 'accessToken'], (result) => {
            isLoggedIn = result.isLoggedIn && result.accessToken;
            resolve(isLoggedIn);
        });
    });
}

function logout() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['isLoggedIn', 'accessToken'], () => {
            isLoggedIn = false;
            resolve(true);
        });
    });
}

function fetchTodoItems() {
    console.log("[Background] Fetching To-Do items");
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('accessToken', function (result) {
            if (!result.accessToken) {
                console.error("[Background] No access token found");
                reject(new Error('Not logged in'));
                return;
            }

            console.log("[Background] Access token found, fetching todo lists");
            fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
                headers: {
                    'Authorization': `Bearer ${result.accessToken}`
                }
            })
                .then(response => response.json())
                .then(data => {
                    console.log("[Background] Todo lists response:", data);
                    if (data.value && data.value.length > 0) {
                        const listId = data.value[0].id;
                        console.log("[Background] Fetching tasks for list:", listId);
                        return fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`, {
                            headers: {
                                'Authorization': `Bearer ${result.accessToken}`
                            }
                        });
                    } else {
                        throw new Error('No todo lists found');
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log("[Background] Tasks response:", data);
                    if (data.value) {
                        resolve(data.value);
                    } else {
                        throw new Error('No tasks found');
                    }
                })
                .catch(error => {
                    console.error("[Background] Error fetching todo items:", error);
                    reject(error);
                });
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received message:", request);
    if (request.action === "checkLoginState") {
        checkLoginState().then(state => {
            console.log("[Background] Login state:", state);
            sendResponse({ isLoggedIn: state });
        });
        return true;
    } else if (request.action === "login") {
        login().then(success => {
            console.log("[Background] Login result:", success);
            sendResponse({ success: success });
        });
        return true;
    } else if (request.action === "logout") {
        logout().then(success => {
            console.log("[Background] Logout result:", success);
            sendResponse({ success: success });
        });
        return true;
    } else if (request.action === "GET_TODO_ITEMS") {
        fetchTodoItems().then(items => {
            console.log("[Background] Fetched todo items:", items);
            sendResponse({ success: true, items: items });
        }).catch(error => {
            console.error("[Background] Error fetching todo items:", error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

function generateCodeChallenge(codeVerifier) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
        .then(digest => base64UrlEncode(new Uint8Array(digest)));
}

function base64UrlEncode(array) {
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

console.log("REDIRECT_URI:", REDIRECT_URI);
console.log("[Background] Background script loaded and initialized");
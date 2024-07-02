document.addEventListener('DOMContentLoaded', function () {
    const loginStatus = document.getElementById('login-status');
    const loginButton = document.getElementById('login-button');
    const refreshButton = document.getElementById('refresh-button');

    function updateUI(isLoggedIn) {
        if (isLoggedIn) {
            loginStatus.textContent = 'Logged in to Microsoft';
            loginButton.style.display = 'none';
            refreshButton.style.display = 'block';
        } else {
            loginStatus.textContent = 'Not logged in';
            loginButton.style.display = 'block';
            refreshButton.style.display = 'none';
        }
    }

    chrome.runtime.sendMessage({ action: "checkLoginState" }, function (response) {
        updateUI(response.isLoggedIn);
    });

    loginButton.addEventListener('click', function () {
        chrome.runtime.sendMessage({ action: "login" }, function (response) {
            if (response.success) {
                updateUI(true);
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.tabs.reload(tabs[0].id);
                });
            } else {
                console.error('Login failed');
                loginStatus.textContent = 'Login failed. Please try again.';
            }
        });
    });

    refreshButton.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "REFRESH_TODO_LIST" });
        });
    });

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            chrome.runtime.sendMessage({ action: "logout" }, function (response) {
                if (response.success) {
                    updateUI(false);
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        chrome.tabs.reload(tabs[0].id);
                    });
                } else {
                    console.error('Logout failed');
                }
            });
        });
    }
});
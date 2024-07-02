function replaceSidebarWithTodoList() {
    const secondaryDiv = document.getElementById('secondary');
    if (secondaryDiv) {
        console.log("[Content] Secondary div found, replacing with To-Do list");
        const todoListDiv = document.createElement('div');
        todoListDiv.id = 'ms-todo-list';
        todoListDiv.innerHTML = '<h2>My To Do List</h2><ul id="todo-items"></ul>';
        secondaryDiv.parentNode.replaceChild(todoListDiv, secondaryDiv);
        fetchTodoItems();
    } else {
        console.log("[Content] Secondary div not found");
    }
}

function fetchTodoItems() {
    console.log("[Content] Fetching To-Do items");
    chrome.runtime.sendMessage({ action: "GET_TODO_ITEMS" }, function (response) {
        console.log("[Content] Received response for GET_TODO_ITEMS:", response);
        if (response && response.success) {
            displayTodoItems(response.items);
        } else {
            console.error("[Content] Failed to fetch To-Do items:", response ? response.error : "No response");
            const todoList = document.getElementById('todo-items');
            if (todoList) {
                todoList.innerHTML = '<li>Failed to load To Do items. Please check your configuration.</li>';
            }
        }
    });
}

function displayTodoItems(items) {
    console.log("[Content] Displaying To-Do items:", items);
    const todoList = document.getElementById('todo-items');
    if (todoList) {
        todoList.innerHTML = '';
        if (items && items.length > 0) {
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.title;
                todoList.appendChild(li);
            });
        } else {
            todoList.innerHTML = '<li>No items in the To-Do list.</li>';
        }
    } else {
        console.error("[Content] Todo list element not found");
    }
}

function checkLoginAndReplace() {
    console.log("[Content] Checking login state");
    chrome.runtime.sendMessage({ action: "checkLoginState" }, function (response) {
        console.log("[Content] Login state response:", response);
        if (response && response.isLoggedIn) {
            console.log("[Content] User is logged in, attempting to replace sidebar");
            replaceSidebarWithTodoList();
        } else {
            console.log("[Content] User is not logged in or no response, sidebar not replaced");
        }
    });
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
                if (node.id === 'secondary') {
                    console.log("[Content] Secondary div detected by MutationObserver");
                    checkLoginAndReplace();
                    observer.disconnect();
                    return;
                }
            }
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check when the script loads
checkLoginAndReplace();

// Check when the URL changes
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("[Content] URL changed, checking for secondary div");
        checkLoginAndReplace();
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "REFRESH_TODO_LIST") {
        console.log("[Content] Refresh request received, updating To-Do list");
        fetchTodoItems();
    }
});

console.log("[Content] Content script loaded and initialized");
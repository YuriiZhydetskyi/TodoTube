function replaceSidebarWithTodoList() {
    const secondaryDiv = document.getElementById('secondary');
    if (secondaryDiv) {
        const todoListDiv = document.createElement('div');
        todoListDiv.id = 'ms-todo-list';
        todoListDiv.innerHTML = '<h2>My To Do List</h2><ul id="todo-items"></ul>';
        secondaryDiv.parentNode.replaceChild(todoListDiv, secondaryDiv);
        fetchTodoItems();
    }
}

function fetchTodoItems() {
    chrome.runtime.sendMessage({ action: "GET_TODO_ITEMS" }, function (response) {
        if (response.success) {
            displayTodoItems(response.items);
        } else {
            document.getElementById('todo-items').innerHTML = '<li>Failed to load To Do items. Please check your configuration.</li>';
        }
    });
}

function displayTodoItems(items) {
    const todoList = document.getElementById('todo-items');
    todoList.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.title;
        if (item.status === 'completed') {
            li.style.textDecoration = 'line-through';
        }
        todoList.appendChild(li);
    });
}

replaceSidebarWithTodoList();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "REFRESH_TODO_LIST") {
        fetchTodoItems();
    }
});
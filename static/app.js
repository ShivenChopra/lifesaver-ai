// ============================================
// LifeSaver AI — Main Application Script
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    // ============ STATE ============
    let tasks = [];
    let currentFilter = "all";
    let searchQuery = "";
    let isPlanning = false;
    let currentTab = "planner";

    const TIPS = [
        "The 5-Minute Rule: commit to working on the first task for just 5 minutes. The hardest part is starting.",
        "Topological order matters — complete prerequisite tasks before starting dependent ones.",
        "Batch similar tasks together to reduce context-switching overhead.",
        "Work on high-priority tasks when your energy is highest (usually morning).",
        "Take a 10-minute break after every 50-minute work block for sustained focus.",
        "Break complex tasks into sub-steps: you can't eat an elephant in one bite.",
        "A done plan beats a perfect plan. Start imperfectly, iterate quickly.",
        "Use the deadline as a hard constraint — work backwards from it to set daily targets.",
    ];
    let tipIndex = 0;
    document.getElementById("tip-text").textContent = TIPS[tipIndex];
    setInterval(() => {
        tipIndex = (tipIndex + 1) % TIPS.length;
        const tipEl = document.getElementById("tip-text");
        tipEl.style.opacity = "0";
        setTimeout(() => { tipEl.textContent = TIPS[tipIndex]; tipEl.style.opacity = "1"; }, 300);
    }, 8000);

    // ============ DOM REFS ============
    const goalInput = document.getElementById("goal-input");
    const deadlineSlider = document.getElementById("deadline-slider");
    const deadlineValEl = document.getElementById("deadline-val");
    const planBtn = document.getElementById("plan-btn");
    const planIcon = document.getElementById("plan-icon");
    const planText = document.getElementById("plan-text");
    const apiStatusBadge = document.getElementById("api-status-badge");
    const clearDbBtn = document.getElementById("clear-db-btn");
    const tasksList = document.getElementById("tasks-list");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const progressPercentage = document.getElementById("progress-percentage");
    const manualTaskTitle = document.getElementById("manual-task-title");
    const addTaskBtn = document.getElementById("add-task-btn");
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const calendarTimeline = document.getElementById("calendar-timeline");
    const taskSearch = document.getElementById("task-search");
    const loadingOverlay = document.getElementById("loading-overlay");
    const taskCountBadge = document.getElementById("task-count-badge");

    // ============ TAB NAVIGATION ============
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            switchTab(target);
        });
    });

    window.switchTab = function(tabName) {
        currentTab = tabName;
        document.querySelectorAll(".nav-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
        document.querySelectorAll(".tab-section").forEach(s => s.classList.toggle("hidden", s.id !== `tab-${tabName}`));
        const hero = document.getElementById("tab-planner");
        hero.classList.toggle("hidden", tabName !== "planner");
    };

    // ============ SLIDER ============
    deadlineSlider.addEventListener("input", () => {
        const v = deadlineSlider.value;
        deadlineValEl.textContent = `${v} ${v == 1 ? "day" : "days"}`;
        const pct = ((v - 1) / 13) * 100;
        deadlineSlider.style.background = `linear-gradient(to right, var(--indigo), var(--indigo) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
    });

    // ============ FILTER & SEARCH ============
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentFilter = pill.dataset.filter;
            renderTasks();
        });
    });
    if (taskSearch) {
        taskSearch.addEventListener("input", () => {
            searchQuery = taskSearch.value.toLowerCase();
            renderTasks();
        });
    }

    // ============ INIT ============
    checkApiStatus();
    loadTasks();
    loadChatHistory();

    // ============ API STATUS ============
    async function checkApiStatus() {
        try {
            const res = await fetch("/api/status");
            if (res.ok) {
                const data = await res.json();
                if (data.configured) {
                    apiStatusBadge.className = "status-pill status-active";
                    apiStatusBadge.innerHTML = `<span class="status-dot"></span><span class="status-text">Gemini Active</span>`;
                } else {
                    apiStatusBadge.className = "status-pill status-inactive";
                    apiStatusBadge.innerHTML = `<span class="status-dot"></span><span class="status-text">Key Unconfigured</span>`;
                }
            }
        } catch {
            apiStatusBadge.className = "status-pill status-checking";
            apiStatusBadge.innerHTML = `<span class="status-dot"></span><span class="status-text">Offline</span>`;
        }
    }

    // ============ TASK LOADING ============
    async function loadTasks() {
        try {
            const res = await fetch("/api/tasks");
            if (res.ok) {
                tasks = await res.json();
                renderTasks();
                renderCalendar();
                updateStats();
            }
        } catch (err) {
            console.error("Failed to load tasks:", err);
        }
    }

    // ============ STATS UPDATE ============
    function updateStats() {
        const total = tasks.length;
        const done = tasks.filter(t => t.completed).length;
        const high = tasks.filter(t => t.priority === "high" && !t.completed).length;
        const medium = tasks.filter(t => t.priority === "medium").length;
        const low = tasks.filter(t => t.priority === "low").length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-done").textContent = done;
        document.getElementById("stat-high").textContent = high;
        document.getElementById("stat-progress").textContent = pct + "%";
        document.getElementById("ring-pct").textContent = pct + "%";
        document.getElementById("legend-high").textContent = `${tasks.filter(t=>t.priority==="high").length} High`;
        document.getElementById("legend-medium").textContent = `${medium} Med`;
        document.getElementById("legend-low").textContent = `${low} Low`;
        taskCountBadge.textContent = total;

        // SVG ring
        const circumference = 2 * Math.PI * 50; // r=50
        const offset = circumference - (pct / 100) * circumference;
        const ring = document.getElementById("ring-fill");
        if (ring) ring.style.strokeDashoffset = offset;
    }

    // ============ RENDER TASKS ============
    function renderTasks() {
        const filtered = tasks.filter(task => {
            const matchSearch = !searchQuery || task.title.toLowerCase().includes(searchQuery) || task.description.toLowerCase().includes(searchQuery);
            let matchFilter = true;
            if (currentFilter === "high") matchFilter = task.priority === "high";
            else if (currentFilter === "medium") matchFilter = task.priority === "medium";
            else if (currentFilter === "low") matchFilter = task.priority === "low";
            else if (currentFilter === "pending") matchFilter = !task.completed;
            else if (currentFilter === "done") matchFilter = task.completed;
            return matchSearch && matchFilter;
        });

        if (filtered.length === 0) {
            tasksList.innerHTML = tasks.length === 0
                ? `<div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-rocket"></i></div>
                    <h3 class="empty-title">No tasks yet</h3>
                    <p class="empty-sub">Head to the Planner tab and enter your goal to generate an AI-powered task plan.</p>
                    <button class="btn-primary" onclick="switchTab('planner')"><i class="fa-solid fa-wand-magic-sparkles"></i> Go to Planner</button>
                  </div>`
                : `<div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-filter-circle-xmark"></i></div>
                    <h3 class="empty-title">No matching tasks</h3>
                    <p class="empty-sub">Try a different filter or search term.</p>
                  </div>`;
            return;
        }

        tasksList.innerHTML = "";
        filtered.forEach(task => {
            const el = createTaskElement(task);
            tasksList.appendChild(el);
        });
    }

    function createTaskElement(task) {
        const depTitles = (task.dependencies || []).map(id => {
            const dep = tasks.find(t => t.id === id);
            return dep ? dep.title : "Prerequisite";
        });

        const priorityBadgeClass = { high: "badge-high", medium: "badge-medium", low: "badge-low" }[task.priority] || "badge-low";
        const priorityIcon = { high: "fa-arrow-up", medium: "fa-equals", low: "fa-minus" }[task.priority] || "fa-minus";
        const dueLabel = task.due_date ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A";

        const wrapper = document.createElement("div");
        wrapper.className = `task-item priority-${task.priority}${task.completed ? " completed" : ""}`;
        wrapper.dataset.id = task.id;

        wrapper.innerHTML = `
            <div class="task-top">
                <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
                <div class="task-main">
                    <div class="task-title ${task.completed ? "strikethrough" : ""}">${task.title}</div>
                    <div class="task-meta">
                        <span class="priority-badge ${priorityBadgeClass}">
                            <i class="fa-solid ${priorityIcon} fa-xxs"></i> ${task.priority}
                        </span>
                        <span class="meta-chip"><i class="fa-regular fa-clock"></i> ${task.duration_mins}m</span>
                        ${task.scheduled_time ? `<span class="meta-chip time"><i class="fa-regular fa-calendar"></i> ${task.scheduled_time}</span>` : ""}
                        ${task.due_date ? `<span class="meta-chip"><i class="fa-solid fa-flag"></i> ${dueLabel}</span>` : ""}
                    </div>
                </div>
                <div class="task-actions">
                    <i class="fa-solid fa-chevron-down task-expand-icon"></i>
                    <button class="task-delete-btn" title="Delete task"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="task-detail">
                <div class="task-detail-inner">
                    <div>
                        <p class="detail-label">Description</p>
                        <p class="detail-description">${task.description || "No description provided."}</p>
                    </div>
                    <div class="detail-meta-row">
                        <div class="detail-meta-box">
                            <p class="detail-label">Duration</p>
                            <p class="detail-meta-val">${task.duration_mins}m</p>
                        </div>
                        <div class="detail-meta-box">
                            <p class="detail-label">Scheduled</p>
                            <p class="detail-meta-val">${task.scheduled_time || "—"}</p>
                        </div>
                        <div class="detail-meta-box">
                            <p class="detail-label">Due Date</p>
                            <p class="detail-meta-val">${dueLabel}</p>
                        </div>
                    </div>
                    ${depTitles.length > 0 ? `
                    <div class="dep-chain">
                        <i class="fa-solid fa-link"></i>
                        <span><strong>Requires:</strong> ${depTitles.join(", ")}</span>
                    </div>` : ""}
                </div>
            </div>
        `;

        // Expand toggle
        const topRow = wrapper.querySelector(".task-top");
        const detailPanel = wrapper.querySelector(".task-detail");
        const expandIcon = wrapper.querySelector(".task-expand-icon");

        topRow.addEventListener("click", (e) => {
            if (e.target.closest(".task-checkbox") || e.target.closest(".task-delete-btn")) return;
            const isOpen = detailPanel.classList.contains("open");
            // close all
            document.querySelectorAll(".task-detail.open").forEach(p => p.classList.remove("open"));
            document.querySelectorAll(".task-expand-icon.rotated").forEach(i => i.classList.remove("rotated"));
            if (!isOpen) {
                detailPanel.classList.add("open");
                expandIcon.classList.add("rotated");
            }
        });

        // Checkbox
        const checkbox = wrapper.querySelector(".task-checkbox");
        checkbox.addEventListener("click", e => e.stopPropagation());
        checkbox.addEventListener("change", () => toggleTaskComplete(task.id, checkbox.checked));

        // Delete
        const delBtn = wrapper.querySelector(".task-delete-btn");
        delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteTask(task.id); });

        return wrapper;
    }

    // ============ CALENDAR ============
    function renderCalendar() {
        if (tasks.length === 0) {
            calendarTimeline.innerHTML = `<div class="empty-state">
                <div class="empty-icon"><i class="fa-regular fa-calendar-plus"></i></div>
                <h3 class="empty-title">No schedule yet</h3>
                <p class="empty-sub">Generate a plan in the Planner tab to see your timeline.</p>
            </div>`;
            return;
        }
        calendarTimeline.innerHTML = "";

        const groups = {};
        tasks.forEach(t => {
            const key = t.due_date || "Unscheduled";
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        Object.keys(groups).sort().forEach(dateKey => {
            const dayTasks = groups[dateKey];
            let title = dateKey, subtitle = "";
            if (dateKey !== "Unscheduled") {
                const d = new Date(dateKey + "T00:00:00");
                title = d.toLocaleDateString("en-US", { weekday: "long" });
                subtitle = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
            }

            const col = document.createElement("div");
            col.className = "day-column";
            col.innerHTML = `
                <div class="day-col-header">
                    <div>
                        <div class="day-name">${title}</div>
                        ${subtitle ? `<div class="day-date">${subtitle}</div>` : ""}
                    </div>
                    <span class="day-count">${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""}</span>
                </div>
                <div class="day-slots"></div>
            `;
            const slots = col.querySelector(".day-slots");

            dayTasks
                .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""))
                .forEach(task => {
                    const dotClass = task.completed ? "done-dot" : task.priority;
                    const slot = document.createElement("div");
                    slot.className = `cal-slot${task.completed ? " done" : ""}`;
                    slot.title = `Click to view "${task.title}" in Tasks tab`;

                    slot.innerHTML = `
                        <div class="slot-dot ${dotClass}"></div>
                        <div class="slot-content">
                            <div class="slot-title ${task.completed ? "done-text" : ""}">${task.title}</div>
                            <div class="slot-duration-row">
                                ${task.scheduled_time ? `<span class="slot-time"><i class="fa-regular fa-clock" style="font-size:10px;margin-right:3px"></i>${task.scheduled_time}</span>` : ""}
                                <span class="slot-dur">${task.duration_mins}m</span>
                            </div>
                        </div>
                    `;

                    // Click: navigate to Tasks tab and highlight/expand this task
                    slot.addEventListener("click", () => {
                        navigateToTask(task.id);
                    });

                    slots.appendChild(slot);
                });
            calendarTimeline.appendChild(col);
        });
    }

    // Navigate from Calendar to the corresponding task in Tasks tab
    function navigateToTask(taskId) {
        // 1. Switch to tasks tab
        switchTab("tasks");

        // 2. Reset filters so the task is visible
        currentFilter = "all";
        searchQuery = "";
        document.querySelectorAll(".filter-pill").forEach(p => p.classList.toggle("active", p.dataset.filter === "all"));
        const searchEl = document.getElementById("task-search");
        if (searchEl) searchEl.value = "";
        renderTasks();

        // 3. Find and scroll to the task element, then expand it
        setTimeout(() => {
            const taskEl = document.querySelector(`.task-item[data-id="${taskId}"]`);
            if (!taskEl) return;

            // Close all open panels first
            document.querySelectorAll(".task-detail.open").forEach(p => p.classList.remove("open"));
            document.querySelectorAll(".task-expand-icon.rotated").forEach(i => i.classList.remove("rotated"));

            // Scroll into view smoothly
            taskEl.scrollIntoView({ behavior: "smooth", block: "center" });

            // Highlight flash animation
            taskEl.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
            taskEl.style.boxShadow = "0 0 0 2px rgba(99,102,241,0.6), 0 0 30px rgba(99,102,241,0.2)";
            taskEl.style.borderColor = "rgba(99,102,241,0.5)";

            // Open the detail panel of this task
            const detailPanel = taskEl.querySelector(".task-detail");
            const expandIcon = taskEl.querySelector(".task-expand-icon");
            if (detailPanel) detailPanel.classList.add("open");
            if (expandIcon) expandIcon.classList.add("rotated");

            // Remove highlight after 2.5 seconds
            setTimeout(() => {
                taskEl.style.boxShadow = "";
                taskEl.style.borderColor = "";
            }, 2500);
        }, 120); // small delay to let the tab render
    }

    // ============ PROGRESS BAR ============
    function updateProgress() {
        const total = tasks.length;
        const done = tasks.filter(t => t.completed).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressBarFill.style.width = `${pct}%`;
        progressPercentage.textContent = `${pct}% Complete`;
    }

    // ============ TOGGLE COMPLETE ============
    async function toggleTaskComplete(taskId, completed) {
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return;
        const updated = { ...tasks[idx], completed };
        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updated)
            });
            if (res.ok) {
                tasks[idx] = await res.json();
                renderTasks(); renderCalendar(); updateProgress(); updateStats();
                showToast(completed ? "Task completed! 🎉" : "Task marked pending", "success");
            }
        } catch (err) { console.error(err); }
    }

    // ============ DELETE TASK ============
    async function deleteTask(taskId) {
        try {
            const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
            if (res.ok) {
                tasks = tasks.filter(t => t.id !== taskId);
                renderTasks(); renderCalendar(); updateProgress(); updateStats();
                showToast("Task removed", "info");
            }
        } catch (err) { console.error(err); }
    }

    // ============ PLAN GOAL ============
    planBtn.addEventListener("click", async () => {
        const goal = goalInput.value.trim();
        if (!goal) { goalInput.focus(); showToast("Please enter your goal first!", "error"); return; }

        isPlanning = true;
        planBtn.disabled = true;
        planIcon.className = "fa-solid fa-spinner fa-spin";
        planText.textContent = "Planning...";

        showLoadingOverlay();

        try {
            const res = await fetch("/api/plan-goal", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goal, deadline_days: parseInt(deadlineSlider.value) })
            });
            const data = await res.json();

            if (res.ok) {
                await loadTasks();
                goalInput.value = "";
                hideLoadingOverlay();
                showToast(`✨ Plan created! ${data.new_tasks.length} tasks scheduled.`, "success");
                switchTab("tasks");
            } else {
                hideLoadingOverlay();
                showToast("Error: " + (data.detail || "Planning failed"), "error");
            }
        } catch (err) {
            hideLoadingOverlay();
            showToast("Network error. Is the server running?", "error");
        } finally {
            isPlanning = false;
            planBtn.disabled = false;
            planIcon.className = "fa-solid fa-wand-magic-sparkles";
            planText.textContent = "Generate AI Plan";
        }
    });

    // Loading overlay steps
    function showLoadingOverlay() {
        loadingOverlay.classList.remove("hidden");
        const steps = ["lstep-1", "lstep-2", "lstep-3"];
        const subs = ["Parsing your goal description...", "Mapping task dependencies...", "Building your time schedule..."];
        steps.forEach((id, i) => {
            const el = document.getElementById(id);
            el.className = "loading-step";
            setTimeout(() => {
                el.className = "loading-step active";
                document.getElementById("loading-sub").textContent = subs[i];
                setTimeout(() => el.className = "loading-step done", 1500);
            }, i * 1800);
        });
    }
    function hideLoadingOverlay() {
        loadingOverlay.classList.add("hidden");
        ["lstep-1","lstep-2","lstep-3"].forEach(id => document.getElementById(id).className = "loading-step");
    }

    // ============ QUICK ADD TASK ============
    async function handleAddTask() {
        const title = manualTaskTitle.value.trim();
        if (!title) return;
        const newTask = {
            title, description: "Manually added task",
            duration_mins: 30, priority: "medium",
            due_date: new Date().toISOString().split("T")[0],
            dependencies: [], completed: false, scheduled_time: "Manual"
        };
        try {
            const res = await fetch("/api/tasks", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTask)
            });
            if (res.ok) {
                const added = await res.json();
                tasks.push(added);
                renderTasks(); renderCalendar(); updateStats();
                manualTaskTitle.value = "";
                showToast("Task added!", "success");
            }
        } catch (err) { console.error(err); }
    }
    addTaskBtn.addEventListener("click", handleAddTask);
    manualTaskTitle.addEventListener("keydown", e => { if (e.key === "Enter") handleAddTask(); });

    // ============ CHAT ============
    async function loadChatHistory() {
        try {
            const res = await fetch("/api/chat/history");
            if (res.ok) {
                const history = await res.json();
                if (history.length > 0) {
                    chatMessages.innerHTML = "";
                    history.forEach(m => appendMessage(m.sender, m.text, false));
                }
            }
        } catch (err) { console.error(err); }
    }

    function appendMessage(sender, text, animate = true) {
        const isUser = sender === "user";
        const msg = document.createElement("div");
        msg.className = `message ${isUser ? "user-msg" : "companion-msg"}`;
        const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const parsedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
        msg.innerHTML = isUser
            ? `<div class="msg-bubble">${parsedText}<span class="msg-time">${time}</span></div>`
            : `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
               <div class="msg-bubble">${parsedText}<span class="msg-time">${time}</span></div>`;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const el = document.createElement("div");
        el.className = "message companion-msg"; el.id = "typing-indicator";
        el.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-bubble"><div class="typing-indicator">
                <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
            </div></div>`;
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function handleSendChat() {
        const text = chatInput.value.trim();
        if (!text) return;
        appendMessage("user", text);
        chatInput.value = "";
        showTypingIndicator();

        try {
            const res = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(text)
            });
            const data = await res.json();
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();
            if (res.ok) appendMessage("companion", data.response);
            else appendMessage("companion", "Sorry, I ran into an error: " + (data.detail || "Unknown issue"));
        } catch {
            const typing = document.getElementById("typing-indicator");
            if (typing) typing.remove();
            appendMessage("companion", "Connection error. Make sure the server is running.");
        }
    }

    chatSendBtn.addEventListener("click", handleSendChat);
    chatInput.addEventListener("keydown", e => { if (e.key === "Enter") handleSendChat(); });

    // Quick prompts
    document.querySelectorAll(".quick-prompt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            chatInput.value = btn.dataset.prompt;
            handleSendChat();
        });
    });

    // ============ RESET ============
    clearDbBtn.addEventListener("click", async () => {
        if (!confirm("Reset all tasks and chat history?")) return;
        const res = await fetch("/api/clear-all", { method: "POST" });
        if (res.ok) {
            tasks = [];
            renderTasks(); renderCalendar(); updateStats();
            chatMessages.innerHTML = `<div class="message companion-msg">
                <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-bubble">Fresh start! 🚀 Tell me about your next goal.</div>
            </div>`;
            showToast("All data cleared", "info");
        }
    });

    // ============ TOAST ============
    function showToast(message, type = "info") {
        const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = "toastOut 0.3s ease forwards";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
});

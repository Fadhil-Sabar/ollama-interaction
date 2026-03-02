$(document).ready(function () {
  // --- Elements ---
  const $chatArea = $("#chat-area");
  const $chatForm = $("#chat-form");
  const $userInput = $("#user-input");
  const $themeToggle = $("#theme-toggle");
  const $modelSelect = $("#model-select");
  const $sendBtn = $("#send-btn");
  const $stopBtn = $("#stop-btn");
  const $chatList = $("#chat-list");
  const $newChatBtn = $("#new-chat-btn");
  const $sidebar = $("#sidebar");
  const $openSidebar = $("#open-sidebar");
  const $closeSidebar = $("#close-sidebar");
  const $currentChatTitle = $("#current-chat-title");
  const $welcomeScreen = $("#welcome-screen");
  const $fileUpload = $("#file-upload");
  const $attachBtn = $("#attach-btn");
  const $contextPreview = $("#context-preview");

  const OLLAMA_BASE_URL = "http://localhost:11434";

  // --- State ---
  let chats = JSON.parse(localStorage.getItem("ollama_chats")) || [];
  let currentChatId = localStorage.getItem("ollama_current_chat_id") || null;
  let activeContext = []; // Stores objects like { type: 'file'|'link', name: string, content: string }
  let currentAbortController = null;

  // --- Initialization ---
  init();

  function init() {
    renderChatList();
    if (currentChatId) {
      loadChat(currentChatId);
    }
    fetchModels();
    checkTheme();
    configureMarked();
  }

  function configureMarked() {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  // --- Model Fetching ---
  async function fetchModels() {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      const data = await response.json();

      const prevVal = $modelSelect.val();
      $modelSelect.empty();
      if (data.models && data.models.length > 0) {
        data.models.forEach((model) => {
          const name = model.name;
          $modelSelect.append(`<option value="${name}">${name}</option>`);
        });
        if (prevVal) $modelSelect.val(prevVal);
      } else {
        $modelSelect.append('<option value="">No Models</option>');
      }
    } catch (error) {
      $modelSelect.empty().append('<option value="">Offline</option>');
    }
  }

  // --- Context Managers (RAG & Link Analysis) ---
  $attachBtn.on("click", () => $fileUpload.click());

  $fileUpload.on("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      addContext("file", file.name, content);
    };
    reader.readAsText(file);
    $fileUpload.val(""); // Reset
  });

  async function processLink(url) {
    // Option 3: Jina Reader Integration
    const jinaUrl = `https://r.jina.ai/${url}`;
    try {
      const response = await fetch(jinaUrl);
      const content = await response.text();
      addContext("link", url, content);
    } catch (error) {
      console.error("Link analysis failed:", error);
      alert("Could not analyze the link. Make sure it's valid.");
    }
  }

  function addContext(type, name, content) {
    // Prevent duplicate links
    if (activeContext.some((c) => c.name === name)) return;

    activeContext.push({ type, name, content });
    renderContextChips();
  }

  function removeContext(index) {
    activeContext.splice(index, 1);
    renderContextChips();
  }

  function renderContextChips() {
    $contextPreview.empty();
    activeContext.forEach((context, index) => {
      const chipHtml = `
                <div class="flex items-center gap-2 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full text-[0.65rem] font-bold border border-zinc-300 dark:border-zinc-700 animate-in fade-in zoom-in">
                    <span class="opacity-50">${context.type === "file" ? "📄" : "🔗"}</span>
                    <span class="truncate max-w-[120px]">${context.name}</span>
                    <button class="remove-ctx hover:text-red-500 transition-colors ml-1" data-index="${index}">×</button>
                </div>
            `;
      $contextPreview.append(chipHtml);
    });
  }

  $contextPreview.on("click", ".remove-ctx", function () {
    removeContext($(this).data("index"));
  });

  // --- Chat Management ---
  function createNewChat() {
    const id = "chat-" + Date.now();
    const newChat = {
      id: id,
      title: "Untitled",
      messages: [],
      timestamp: Date.now(),
      context: [], // Initialize empty tokens for memory
    };
    chats.unshift(newChat);
    saveChats();

    // Clear active context when starting fresh
    activeContext = [];
    renderContextChips();

    renderChatList();
    loadChat(id);
  }

  function loadChat(id) {
    currentChatId = id;
    localStorage.setItem("ollama_current_chat_id", id);
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;

    // Clear UI and Global state context to prevent data leakage from other chats
    activeContext = [];
    renderContextChips();

    $currentChatTitle.text(chat.title);
    $chatArea.find(".message-bubble").remove();

    if (chat.messages.length === 0) {
      $welcomeScreen.show();
    } else {
      $welcomeScreen.hide();
      chat.messages.forEach((msg) => {
        appendMessageUI(msg.text, msg.isUser, false);
      });
    }

    $(".chat-item").removeClass("active");
    $(`.chat-item[data-id="${id}"]`).addClass("active");
    $chatArea.scrollTop($chatArea[0].scrollHeight);
  }

  function saveChats() {
    localStorage.setItem("ollama_chats", JSON.stringify(chats));
  }

  function renderChatList() {
    $chatList.empty();
    chats.forEach((chat) => {
      const activeClass = chat.id === currentChatId ? "active" : "";
      const chatItem = `
                <div class="chat-item ${activeClass}" data-id="${chat.id}">
                    <span class="chat-title-text">${chat.title}</span>
                    <div class="chat-item-actions">
                        <button class="chat-action-btn rename-item" title="Rename" data-id="${chat.id}">✎</button>
                        <button class="chat-action-btn delete-item" title="Delete" data-id="${chat.id}">×</button>
                    </div>
                </div>
            `;
      $chatList.append(chatItem);
    });
  }

  // --- Actions ---
  function deleteChat(id) {
    if (confirm("Delete this thread permanently?")) {
      chats = chats.filter((c) => c.id !== id);
      saveChats();
      if (currentChatId === id) {
        if (chats.length > 0) loadChat(chats[0].id);
        else createNewChat();
      }
      renderChatList();
    }
  }

  function renameChat(id) {
    const chat = chats.find((c) => c.id === id);
    const newTitle = prompt("New Thread Name:", chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      saveChats();
      renderChatList();
      if (currentChatId === id) $currentChatTitle.text(chat.title);
    }
  }

  $chatList.on("click", ".delete-item", function (e) {
    e.stopPropagation();
    deleteChat($(this).data("id"));
  });

  $chatList.on("click", ".rename-item", function (e) {
    e.stopPropagation();
    renameChat($(this).data("id"));
  });

  function appendMessageUI(text, isUser = false, animate = true) {
    const id = "msg-" + Date.now() + Math.random().toString(36).substr(2, 9);
    const content = isUser ? text : marked.parse(text);

    const messageHtml = `
            <div id="${id}" class="message-bubble w-full ${isUser ? "user-msg" : "bot-msg"}">
                <div class="content-box">
                    <div class="prose-custom max-w-none">${content}</div>
                </div>
                ${!isUser ? "" : `<div class="mt-2 text-[10px] text-zinc-400 font-bold uppercase tracking-widest px-1 opacity-60 italic">Personal Transmission</div>`}
            </div>
        `;

    $chatArea.append(messageHtml);
    const $newMsg = $(`#${id}`);
    if (!isUser) {
      processMessageContent($newMsg.find(".prose-custom"));
    }
    $chatArea.scrollTop($chatArea[0].scrollHeight);
    return id;
  }

  function processMessageContent($container) {
    // 1. Highlight Code Blocks
    $container.find("pre code").each(function () {
      if (!$(this).data("highlighted")) {
        hljs.highlightElement(this);
        $(this).data("highlighted", "true");

        // 2. Prepend Copy Button to parent PRE
        const $pre = $(this).parent("pre");
        if ($pre.find(".copy-btn").length === 0) {
          $pre.append('<button class="copy-btn">COPY</button>');
        }
      }
    });
  }

  $chatArea.on("click", ".copy-btn", function () {
    const $btn = $(this);
    const $code = $btn.siblings("code");
    const text = $code.text();

    navigator.clipboard.writeText(text).then(() => {
      $btn.text("COPIED!").addClass("copied");
      setTimeout(() => {
        $btn.text("COPY").removeClass("copied");
      }, 2000);
    });
  });

  // --- Theme Control ---
  $themeToggle.on("click", function () {
    $("html").toggleClass("dark");
    const isDark = $("html").hasClass("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  function checkTheme() {
    const theme = localStorage.getItem("theme");
    const isDark =
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) $("html").addClass("dark");
  }

  // --- Main Logics ---
  $chatForm.on("submit", async function (e) {
    e.preventDefault();
    const rawMessage = $userInput.val().trim();
    const selectedModel = $modelSelect.val();

    if (!rawMessage || !selectedModel) return;

    // Auto-detect URL for Jina Reader
    const urlMatch = rawMessage.match(/https?:\/\/[^\s]+/);
    if (urlMatch && activeContext.length === 0) {
      const url = urlMatch[0];
      await processLink(url);
    }

    if (!currentChatId) createNewChat();
    const chat = chats.find((c) => c.id === currentChatId);

    $welcomeScreen.hide();
    appendMessageUI(rawMessage, true);
    $userInput.val("").css("height", "auto"); // Reset height after send

    // --- CONTEXT CONSTRUCTION ---

    // 1. Get Pinned Context (Files/Links)
    let pinnedContextText = "";
    if (activeContext.length > 0) {
      pinnedContextText = "### PRIMARY KNOWLEDGE SOURCE (PINNED):\n";
      activeContext.forEach((ctx) => {
        pinnedContextText += `DOCUMENT [${ctx.name}]: ${ctx.content}\n\n`;
      });
    }

    // 2. Get Last 5 Chat Bubbles (The Limit)
    const historyLimit = 5;
    const recentHistory = chat.messages.slice(-historyLimit);
    let historyText = "";
    if (recentHistory.length > 0) {
      historyText = "### RECENT CONVERSATION HISTORY (LAST 5):\n";
      recentHistory.forEach((m) => {
        historyText += `${m.isUser ? "USER" : "ASSISTANT"}: ${m.text}\n`;
      });
    }

    // 3. Final Formatted Prompt (Structured for clarity)
    let finalPrompt = "";
    if (pinnedContextText) finalPrompt += `${pinnedContextText}\n`;
    if (historyText) finalPrompt += `${historyText}\n`;
    finalPrompt += `### USER QUESTION:\n${rawMessage}`;

    // Update local logs
    chat.messages.push({ text: rawMessage, isUser: true });

    if (chat.title === "Untitled") {
      chat.title = rawMessage.substring(0, 30);
      $currentChatTitle.text(chat.title);
      renderChatList();
    }

    saveChats();
    $userInput.prop("disabled", true);
    $sendBtn.prop("disabled", true).addClass("opacity-50");

    const botMsgId = appendMessageUI(
      '<div class="thinking-container"><div class="dot dot-1"></div><div class="dot dot-2"></div><div class="dot dot-3"></div></div>',
      false,
    );
    const $botMsgContainer = $(`#${botMsgId} .prose-custom`);
    let fullResponse = "";

    // Toggle stop button visibility
    $sendBtn.hide();
    $stopBtn.removeClass("hidden").show();

    currentAbortController = new AbortController();

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentAbortController.signal,
        body: JSON.stringify({
          model: selectedModel,
          system:
            "You are a professional AI assistant. Use the provided DOCUMENT context to provide a detailed, accurate, and structured response. Break down complex information into bullet points if helpful. If the answer is not in the documents, clarify that and use your general knowledge to assist. Aim for clarity and depth.",
          prompt: finalPrompt,
          stream: true,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      $botMsgContainer.html("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              $botMsgContainer.html(marked.parse(fullResponse));
              processMessageContent($botMsgContainer);
              $chatArea.scrollTop($chatArea[0].scrollHeight);
            }
            // Save the context tokens for next turn
            if (json.done) {
              chat.context = json.context;
            }
          } catch (e) {}
        }
      }

      chat.messages.push({ text: fullResponse, isUser: false });
      saveChats();

      // Note: We no longer clear activeContext here.
      // It stays "Pinned" until the user clicks 'x' on the chip.
    } catch (error) {
      if (error.name === "AbortError") {
        $botMsgContainer.html(
          marked.parse(fullResponse + "\n\n*(Execution halted by user)*"),
        );
        processMessageContent($botMsgContainer);
      } else {
        $botMsgContainer.html(
          "<span class='text-red-500 text-xs'>(Sync Error: Engine Not Responding)</span>",
        );
      }
    } finally {
      $userInput.prop("disabled", false).focus();
      $sendBtn.show().prop("disabled", false).removeClass("opacity-50");
      $stopBtn.hide();
      currentAbortController = null;
    }
  });

  // --- Event Listeners ---
  $newChatBtn.on("click", createNewChat);

  $chatList.on("click", ".chat-item", function () {
    loadChat($(this).data("id"));
    if (window.innerWidth < 768) {
      $sidebar.addClass("-translate-x-full");
    }
  });

  $openSidebar.on("click", () => $sidebar.removeClass("-translate-x-full"));
  $closeSidebar.on("click", () => $sidebar.addClass("-translate-x-full"));

  $stopBtn.on("click", function () {
    if (currentAbortController) {
      currentAbortController.abort();
    }
  });

  // --- Multi-line Input Handling ---
  $userInput.on("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  $userInput.on("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $chatForm.submit();
    }
  });
});

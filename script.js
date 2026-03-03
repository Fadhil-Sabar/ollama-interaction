$(document).ready(function () {
  // --- Elements ---
  const $chatArea = $("#chat-area");
  const $chatForm = $("#chat-form");
  const $userInput = $("#user-input");
  const $themeToggle = $("#theme-toggle");
  const $modelSelect = $("#model-select");
  const $thinkConfig = $("#thinking-config");
  const $thinkToggle = $("#think-toggle");
  const $thinkLevel = $("#think-level");
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
  let thinkModels = [
    "qwen3",
    "qwen3.5",
    "deepseek-r1",
    "deepseek-v3.1",
    "gpt-oss",
  ];

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
      updateThinkUIVisibility();
    } catch (error) {
      $modelSelect.empty().append('<option value="">Offline</option>');
    }
  }

  function updateThinkUIVisibility() {
    const model = $modelSelect.val() || "";
    const isThinkModel = thinkModels.some((m) =>
      model.toLowerCase().includes(m),
    );
    if (isThinkModel) $thinkConfig.removeClass("hidden").addClass("flex");
    else $thinkConfig.addClass("hidden").removeClass("flex");
  }

  $modelSelect.on("change", updateThinkUIVisibility);

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

  function appendMessageUI(text, isUser = false, isHtml = false) {
    const id = "msg-" + Date.now() + Math.random().toString(36).substr(2, 9);

    // Determine initial content
    let content = "";
    if (isUser) {
      content = text;
    } else if (isHtml) {
      content = text;
    } else {
      const result = formatThinkResponse(text);
      content = typeof result === "string" ? result : result.html;
    }

    const messageHtml = `
            <div id="${id}" class="message-bubble w-full ${isUser ? "user-msg" : "bot-msg"}">
                <div class="content-box">
                    <div class="prose-custom max-w-none">${content}</div>
                    <div class="status-indicator-zone"></div>
                </div>
                ${!isUser ? "" : `<div class="mt-2 text-[10px] text-zinc-400 font-bold uppercase tracking-widest px-1 opacity-60 italic">Personal Transmission</div>`}
            </div>
        `;

    $chatArea.append(messageHtml);

    // Post-processing
    if (!isUser) {
      const $newMsg = $(`#${id}`);
      const $container = $newMsg.find(".prose-custom");
      processMessageContent($container);
    }

    $chatArea.scrollTop($chatArea[0].scrollHeight);
    return id;
  }

  function safeMarkedParse(text, isStreaming = false) {
    if (!isStreaming)
      return { html: marked.parse(text), isGeneratingCode: false };

    // Detect unclosed backticks
    const parts = text.split("```");
    if (parts.length % 2 === 0) {
      // Odd number of ``` means parts.length is even
      // Extract language if possible
      const lastPart = parts[parts.length - 1];
      const langMatch = lastPart.match(/^([a-zA-Z0-9#+.-]*)/);
      const language =
        langMatch && langMatch[1] ? langMatch[1].toUpperCase() : "CODE";

      const readyToRender = parts.slice(0, -1).join("```");
      return {
        html: marked.parse(readyToRender),
        isGeneratingCode: true,
        language: language,
      };
    }
    return { html: marked.parse(text), isGeneratingCode: false };
  }

  function formatThinkResponse(text, nativeThinking = "", isStreaming = false) {
    const parse = (t) => safeMarkedParse(t, isStreaming);

    let isGeneratingCode = false;
    let codeLanguage = "";

    const processPart = (t) => {
      const result = parse(t);
      if (result.isGeneratingCode) {
        isGeneratingCode = true;
        codeLanguage = result.language;
      }
      return result.html;
    };

    if (!text.includes("<think>") && !nativeThinking) {
      const res = parse(text);
      return isStreaming ? res : res.html;
    }

    let html = "";

    // 1. Handle native thinking field from Ollama API
    if (nativeThinking) {
      html += `
            <div class="thought-block is-thinking">
                <div class="thought-header">
                    <div class="thinking-dot-mini"></div>
                    <span>Thinking...</span>
                </div>
                <div class="thought-content">${processPart(nativeThinking)}</div>
            </div>
        `;
    }

    let currentPos = 0;

    // Regex to match <think> blocks (including unclosed ones at the end)
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
    let match;

    while ((match = thinkRegex.exec(text)) !== null) {
      // 1. Content BEFORE <think>
      const before = text.substring(currentPos, match.index);
      if (before.trim()) html += processPart(before);

      // 2. The Thought Block
      const thoughtContent = match[1];
      const isUnclosed = !match[0].endsWith("</think>");

      html += `
                <div class="thought-block ${isUnclosed ? "is-thinking" : ""}">
                    <div class="thought-header">
                        ${isUnclosed ? '<div class="thinking-dot-mini"></div>' : '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>'}
                        <span>${isUnclosed ? "Thinking..." : "Thought Process"}</span>
                    </div>
                    <div class="thought-content">${processPart(thoughtContent)}</div>
                </div>
            `;

      currentPos = thinkRegex.lastIndex;
    }

    // 3. Content AFTER the last closed <think> tag
    const after = text.substring(currentPos);
    if (after.trim()) html += processPart(after);

    if (isStreaming) {
      return { html, isGeneratingCode, language: codeLanguage };
    }
    return html;
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

    // Determine 'think' value
    let thinkValue = false;
    if ($thinkToggle.is(":checked")) {
      const level = $thinkLevel.val();
      thinkValue = level === "true" ? true : level;
    }

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
      true,
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
          think: thinkValue,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Remove the early clearing of $botMsgContainer.html("");
      // It will be replaced naturally when the first chunk of fullResponse arrives.

      let wordsSinceLastUpdate = 0;
      const wordThreshold = 10;

      // Smoothing state
      let displayedResponse = "";
      let displayedThinking = "";
      let animationFrameId = null;

      const smoothUpdate = () => {
        let hasNewContent = false;

        // Catch up thinking
        if (
          displayedThinking.length < (window.currentNativeThinking || "").length
        ) {
          const syncSpeed = Math.ceil(
            ((window.currentNativeThinking || "").length -
              displayedThinking.length) /
              5,
          );
          displayedThinking += (window.currentNativeThinking || "").substring(
            displayedThinking.length,
            displayedThinking.length + syncSpeed,
          );
          hasNewContent = true;
        }

        // Catch up response
        if (displayedResponse.length < fullResponse.length) {
          // If we are way behind, speed up (catch up faster)
          const diff = fullResponse.length - displayedResponse.length;
          const syncSpeed = Math.ceil(diff / 4);
          displayedResponse += fullResponse.substring(
            displayedResponse.length,
            displayedResponse.length + syncSpeed,
          );
          hasNewContent = true;
        }

        if (hasNewContent) {
          const result = formatThinkResponse(
            displayedResponse,
            displayedThinking,
            true,
          );
          $botMsgContainer.html(result.html);

          // Handle persistent indicator
          const $indicatorZone = $botMsgContainer.siblings(
            ".status-indicator-zone",
          );
          if (result.isGeneratingCode) {
            if ($indicatorZone.children().length === 0) {
              $indicatorZone.html(
                `<div class="code-generating-indicator"><div class="spinner"></div><span>Generating ${result.language}...</span><div class="cursor"></div></div>`,
              );
            } else {
              $indicatorZone
                .find("span")
                .text(`Generating ${result.language}...`);
            }
          } else {
            $indicatorZone.empty();
          }

          $chatArea.scrollTop($chatArea[0].scrollHeight);
        }

        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      // Start the smoothing loop
      animationFrameId = requestAnimationFrame(smoothUpdate);

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          cancelAnimationFrame(animationFrameId);
          // Final sync
          $botMsgContainer.html(
            formatThinkResponse(
              fullResponse,
              window.currentNativeThinking || "",
              false,
            ),
          );
          processMessageContent($botMsgContainer);
          $chatArea.scrollTop($chatArea[0].scrollHeight);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);

            if (json.thinking) {
              if (!window.currentNativeThinking)
                window.currentNativeThinking = "";
              window.currentNativeThinking += json.thinking;
            }

            if (json.response) {
              fullResponse += json.response;
            }

            if (json.done) {
              chat.context = json.context;
              window.currentNativeThinking = "";
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
          formatThinkResponse(
            fullResponse + "\n\n*(Execution halted by user)*",
            window.currentNativeThinking || "",
          ),
        );
        processMessageContent($botMsgContainer);
      } else {
        $botMsgContainer.html(
          `<div class="flex flex-col gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <span class="text-xs font-black uppercase tracking-widest text-red-500">Sync Error</span>
            <p class="text-sm font-medium text-red-600 dark:text-red-400">${error.message || "Engine Not Responding"}</p>
          </div>`,
        );
      }
    } finally {
      $userInput.prop("disabled", false).focus();
      $sendBtn.show().prop("disabled", false).removeClass("opacity-50");
      $stopBtn.hide();
      currentAbortController = null;
      window.currentNativeThinking = ""; // Reset for next interaction
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

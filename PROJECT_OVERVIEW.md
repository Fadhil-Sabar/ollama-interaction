# Ollama Interaction: Minimalist Zinc Interface

A high-performance, private, and minimalist web interface for interacting with local LLMs via Ollama.

## 🚀 Overview
This project provides a clean, "Zen" style interface for Ollama. It focuses on privacy, speed, and advanced RAG (Retrieval-Augmented Generation) capabilities without requiring a complex backend.

## 🛠 Tech Stack
- **Frontend**: HTML5, Vanilla CSS, jQuery 3.7.1
- **Styling**: Tailwind CSS (CDN Integration)
- **AI Engine**: Ollama (Running on `localhost:11434`)
- **Rendering**: Marked.js for Markdown support
- **Web Analysis**: Jina Reader (`r.jina.ai`)

## ✨ Key Features

### 1. Minimalist Zinc Design
- **Aesthetic**: Premium monochromatic palette with Zinc/Slate accents.
- **Responsive**: Sidebar for history, adaptive container for chat.
- **Modes**: Full support for System-aware Light and Dark modes.

### 2. Advanced Context Management (RAG)
- **Local File RAG**: Users can attach `.txt`, `.md`, or code files. Content is read client-side and injected into the prompt.
- **Link Analysis**: Pasting a URL triggers an automatic analysis via Jina Reader, allowing the AI to "read" live web pages.
- **Pinned Context**: Attached files/links stay active (pinned) for multiple questions until manually removed.

### 3. Smart Memory Control
- **Sliding Window**: The system only sends the **last 5 chat bubbles** to Ollama. This prevents memory bloat, increases response speed, and maintains focus.
- **Token Independent**: Memory is managed via text-based history rather than Ollama context tokens for precise control.

### 4. Chat Management
- **Persistence**: Full chat history and settings saved in `LocalStorage`.
- **Organization**: Users can create new threads, rename them, and delete old ones.
- **Streaming**: Full support for real-time streaming responses.

## 📂 Project Structure
- `index.html`: Semantic structure and layout.
- `style.css`: Custom design tokens, transitions, and Zinc theme variables.
- `script.js`: State management, Ollama API integration, and RAG logic.

## 📝 Important Notes for Future Agents
- **Local Nature**: The app expects Ollama to be running locally with `OLLAMA_ORIGINS="*"` set to allow CORS.
- **Zero Backend**: All logic is client-side. Do not introduce server-side dependencies (Node.js/Python) unless explicitly requested.
- **Prompt Engineering**: The prompt structure is hierarchical: 1. Pinned Knowledge, 2. Last 5 Chats, 3. New Instruction.

---
*Documented on March 2026*

# DocuSense

## About
**DocuSense** is a powerful Retrieval-Augmented Generation (RAG) application that allows you to chat intelligently with your PDF documents and scraped web pages. By leveraging state-of-the-art open-source LLMs through Groq, local HuggingFace embeddings, and MongoDB Atlas Vector Search, DocuSense extracts context-aware insights from your knowledge base with blazing fast performance.

## Tech Stack
- **Frontend:** React, Vite
- **Backend:** Python, FastAPI
- **Embeddings:** HuggingFace `all-MiniLM-L6-v2` (Local)
- **Vector DB:** MongoDB Atlas Vector Search
- **LLM:** Groq API (`llama-3.3-70b-versatile`)
- **Scraping:** BeautifulSoup, Playwright

---

## Setup & Installation

### 1. Requirements
- Node.js (v16+)
- Python 3.10+
- A [MongoDB Atlas](https://cloud.mongodb.com/) cluster (free tier works)
- A [Groq API Key](https://console.groq.com/keys)

### 2. MongoDB Atlas Configuration
1. Create a free cluster and get your connection string (`mongodb+srv://...`).
2. Go to **Atlas Search** → **Create Search Index** → **Atlas Vector Search**.
3. Select database `rag_app`, collection `documents` (or `chunks`), and use the following JSON:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "doc_id"
    }
  ]
}
```
*Note: The index takes 1-3 minutes to become active.*

### 3. Backend Setup
1. Open a terminal and navigate to the `backend` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows: .\venv\Scripts\activate
   # Mac/Linux: source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` directory with your secrets:
   ```env
   MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0"
   GROQ_API_KEY="gsk_your_api_key_here"
   ```
5. Start the backend server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

### 4. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5174](http://localhost:5174) (or the port specified by Vite) in your browser.

---

## Features
- **Upload & Index PDFs:** Automatically chunk and embed PDF content.
- **Scrape Websites:** Extract textual content from URLs (includes Playwright support for JS-heavy sites).
- **Interactive Chat:** Ask questions and get answers cited directly from your indexed documents.
- **Session Management:** Save, load, and manage your chat sessions.
- **User Authentication:** Secure login and registration.

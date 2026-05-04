# DocuSense

Chat with PDF documents and websites using HuggingFace embeddings, MongoDB Atlas Vector Search, and Groq AI.

## Tech Stack

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| Frontend     | React + Vite                                |
| Backend      | Python + FastAPI                            |
| Embeddings   | HuggingFace `all-MiniLM-L6-v2` (local)     |
| Vector DB    | MongoDB Atlas Vector Search                 |
| LLM          | Groq `mixtral-8x7b-32768` (32k context)    |
| Web Scraping | BeautifulSoup (extendable to Playwright)    |

---

## Project Structure

```
rag-app/
├── backend/
│   ├── main.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## MongoDB Atlas Setup (required before running)

### 1. Create a free cluster at https://cloud.mongodb.com

### 2. Get your connection string
- Go to: Cluster → Connect → Drivers
- Copy the URI: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`

### 3. Create the Vector Search Index
- In Atlas: Your Cluster → Search → Create Search Index
- Choose: Atlas Vector Search
- Database: `rag_app`, Collection: `chunks`
- Paste this JSON:

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

- Name the index: `vector_index`

> The index takes 1-3 minutes to become active.

---

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

export MONGO_URI="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/"
export GROQ_API_KEY="gsk_..."    # https://console.groq.com

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | `/`                   | Health check                   |
| POST   | `/upload`             | Upload and index a PDF         |
| POST   | `/scrape`             | Scrape and index a URL         |
| POST   | `/chat`               | Ask a question                 |
| GET    | `/documents`          | List all indexed sources       |
| DELETE | `/documents/{doc_id}` | Remove a source                |

---

## Extending Web Scraping (JS-heavy sites)

Install Playwright and replace the `requests` block in `scrape_url()`:

```bash
pip install playwright && playwright install chromium
```

```python
from playwright.async_api import async_playwright
async with async_playwright() as p:
    browser = await p.chromium.launch()
    page = await browser.new_page()
    await page.goto(request.url)
    await page.wait_for_load_state("networkidle")
    html = await page.content()
    await browser.close()
```

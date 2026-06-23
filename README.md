# the_monitor

Dashboard de monitoramento com backend FastAPI e frontend Next.js.

## Estrutura

```
├── backend/   # FastAPI + SQLModel
└── frontend/  # Next.js 15 + React 19
```

## Rodando

### Backend
```bash
cd backend
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testes

### Backend
```bash
cd backend
.venv/bin/pytest
```

### Frontend
```bash
cd frontend
npm test
```

## Autor

- Alfredo Holz Junior

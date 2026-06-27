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

## Licença

Distribuído sob a [Business Source License 1.1](LICENSE) (BUSL-1.1).

O código é aberto para leitura e uso, **exceto** oferecê-lo a terceiros como
serviço hospedado/gerenciado concorrente. Em **2030-06-26** a licença converte
automaticamente para Apache-2.0. Para licenciamento comercial, contate
alfredojrgasper@gmail.com.

## Autor

- Alfredo Holz Junior

## Histórico

- 2026-06-23 — início do projeto

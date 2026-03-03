# Loyalto – Transforme dados em lealdade

Plataforma de previsão de churn e retenção de clientes com LightGBM, FastAPI e Next.js 14.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend ML**: FastAPI (Python) + LightGBM + SHAP
- **Auth + DB**: Supabase (PostgreSQL + Supabase Auth)
- **Deploy**: Vercel (frontend) + Railway (backend)

---

## Setup Rápido (Desenvolvimento Local)

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com)
2. No SQL Editor, cole e execute o conteúdo de `supabase_schema.sql`
3. Copie a **URL** e a **anon key** do projeto

### 2. Backend (FastAPI)

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Treinar o modelo (usa base_churn.csv da pasta raiz)
python ml/train_model.py

# Iniciar o servidor
uvicorn app.main:app --reload --port 8000
```

API disponível em: http://localhost:8000
Documentação: http://localhost:8000/docs

### 3. Frontend (Next.js)

```bash
cd frontend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local .env.local
# Edite .env.local com suas credenciais do Supabase

# Iniciar o servidor de desenvolvimento
npm run dev
```

Frontend disponível em: http://localhost:3000

### 4. Docker Compose (alternativa)

```bash
# Na raiz do projeto
cp .env.example .env  # configure as variáveis
docker-compose up --build
```

---

## Variáveis de Ambiente

### Frontend (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Formato do CSV

O CSV deve ter as colunas do arquivo original `base_churn.csv`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| codcli | int | Código do cliente |
| Id_produto | int | Código do produto |
| dt_nota_fiscal | date (YYYY-MM-DD) | Data da nota fiscal |
| vl_nota | float | Valor da nota |
| meses_sem_compra | float | Meses sem compra |
| ultimacompra | int (YYYYMMDD) | Data da última compra |
| dias_na_empresa | float | Dias como cliente |
| regiao | text | NORTE/NORDESTE/SUDESTE/SUL/EXTERIOR/CENTRO_OESTE |
| ano | int | Ano |
| mes | int | Mês |
| valor_base | float | Valor base |
| custo_medio | float | Custo médio |
| qtd_prd_nota | float | Quantidade de produtos |

---

## Segmentação de Risco

| Probabilidade | Segmento |
|--------------|----------|
| 0–20% | Sem Risco |
| 20–40% | Baixo |
| 40–60% | Médio |
| 60–80% | Alto |
| 80–100% | Crítico |

---

## Deploy

### Backend (Railway)
1. Conecte o repo ao Railway
2. O `railway.toml` e `Dockerfile` já estão configurados
3. Configure a variável `PORT` (Railway a informa automaticamente)

### Frontend (Vercel)
1. Conecte o diretório `frontend/` ao Vercel
2. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (URL do backend no Railway)

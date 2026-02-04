# Data Scientist Projects

A collection of hands-on data science and ML engineering projects focused on practical, production-ready skills.

## 🗂️ Projects Overview

| Project | Description | Tech Stack |
|---------|-------------|------------|
| [**CICD-MLflow**](./CICD-MLflow) | Enterprise CI/CD simulation for ML pipelines with real MLflow tracking | Docker, FastAPI, Next.js, MLflow, PostgreSQL, MinIO |
| [**ab-test**](./ab-test) | Interactive A/B testing learning lab with CUPED and DiD methods | React, TypeScript, Vite, Recharts |

---

## 📦 CICD-MLflow

An enterprise CI/CD simulation for medical claim ML pipelines with real MLflow tracking. Learn the complete lifecycle of ML engineering in an enterprise environment.

### Key Features
- Interactive Pipeline DAG with real-time status updates
- Real MLflow integration for experiment tracking
- Champion vs Challenger model promotion logic
- Drift monitoring and rollback capabilities

### Quick Start

```bash
cd CICD-MLflow

# Setup environment (optional - .env is already included)
cp .env.example .env

# Start all services with Docker
docker compose up --build
```

### Access Points
- **Frontend UI**: http://localhost:3001
- **MLflow UI**: http://localhost:5000
- **Backend API**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001

### Prerequisites
- Docker Desktop (with Docker Compose)
- At least 4GB RAM available for Docker
- Ports available: 3000, 5000, 8000, 9000, 9001, 5432

📖 [Full Documentation →](./CICD-MLflow/README.md)

---

## 📊 ab-test

An interactive web application that teaches A/B testing concepts through real-time simulated streaming events. Learn how **CUPED** reduces variance and **Difference-in-Differences (DiD)** removes confounding time effects.

### Key Features
- Multi-language support (English / 中文)
- Sample size calculator for pre-experiment planning
- Real-time streaming simulation of user events
- Step-by-step walkthroughs of CUPED and DiD calculations

### Quick Start

```bash
cd ab-test

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

📖 [Full Documentation →](./ab-test/README.md)

---

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Data-scientist-projects.git
cd Data-scientist-projects
```

### Choose a Project

Navigate to the project directory you want to explore and follow the Quick Start instructions above.

---

## 📚 Learning Path

If you're new to these topics, here's a suggested learning order:

1. **Start with [ab-test](./ab-test)** - Learn fundamental A/B testing concepts, statistical methods (CUPED, DiD), and experimental design
2. **Continue with [CICD-MLflow](./CICD-MLflow)** - Understand enterprise ML pipelines, experiment tracking, and model deployment workflows

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - See individual project LICENSE files for details.

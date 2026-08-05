# 🎓 Student Performance Intelligence

A full-stack ML workbench that predicts a student's final score from three
behavioural inputs — and, just as importantly, tells you how much to trust
that prediction.

Trained on **1,000,000 student records**, served by a **FastAPI** API with four
competing models, and driven by a **React + TypeScript** front end with seven
analysis surfaces.

🔗 **Live demo:** https://students-prediction-model.vercel.app

> **A note on this dataset.** Only one of the three inputs actually predicts the
> target. Attendance and class participation are uncorrelated with the final
> score at every level of study hours (Pearson r = −0.001 and +0.001). Rather
> than hide that, the app measures it, reports it, and flags any recommendation
> that leans on a dead feature. See [Feature signal audit](#feature-signal-audit).

---

## 📌 What it does

| Tab | What it answers |
|---|---|
| **Predict** | What score, with what uncertainty, at what risk — and which levers move it |
| **Explain** | Why *this* score: exact Shapley attribution plus per-feature response curves |
| **Simulate** | What would it take: goal seeking and side-by-side scenario comparison |
| **Batch** | Score a whole roster from CSV, export CSV/PDF |
| **Analytics** | Explore the training data: distributions, correlations, response curves |
| **Model** | Leaderboard, held-out metrics, permutation importance, signal audit |
| **History** | Saved predictions, kept locally in the browser |

---

## 🛠️ Tech Stack

**Frontend** — React 18, TypeScript, Tailwind CSS, hand-written SVG charts,
jsPDF (report export), Axios

**Backend** — FastAPI, Pydantic v2, Uvicorn

**Machine learning** — scikit-learn, pandas, NumPy, joblib

**Deployment** — Vercel (frontend), Render (backend)

---

## 📊 Modelling

### Four models, one held-out split

Every candidate is trained on the same 800k/200k split and scored on the same
held-out rows. The champion is selected by test R².

| Model | R² | CV R² (3-fold) | MAE | RMSE | Intervals |
|---|---|---|---|---|---|
| **Hist Gradient Boosting** *(champion)* | 0.7177 | 0.7174 ± 0.0040 | 6.103 | 8.198 | residual-based |
| Extra Trees | 0.7173 | 0.7143 ± 0.0029 | 6.104 | 8.204 | per-point (tree spread) |
| Random Forest | 0.7165 | 0.7093 ± 0.0040 | 6.112 | 8.215 | per-point (tree spread) |
| Ridge Regression | 0.6600 | 0.6594 ± 0.0018 | 7.161 | 8.996 | residual-based |

The Ridge baseline is kept deliberately: the gap to it is what the non-linear
models actually buy (≈0.058 R²).

### Prediction intervals

Tree ensembles expose per-estimator predictions, so the spread across trees
estimates model uncertainty *at that point in feature space*. That variance is
combined with the held-out residual spread, so the interval covers both model
uncertainty and irreducible noise. Models without that structure fall back to a
residual-based normal interval. The method used is reported in every response.

### Exact Shapley attribution

With three features there are only 2³ = 8 coalitions, so the Shapley
decomposition is computed **exactly** rather than sampled the way KernelSHAP
would:

```
φᵢ = Σ_{S ⊆ N\{i}}  |S|!·(n−|S|−1)!/n! · [v(S∪{i}) − v(S)]
```

where `v(S)` marginalises the features outside `S` over a 128-row background
sample. All 8 coalitions are stacked into a single batched forward pass. The
efficiency property — `Σφᵢ = v(N) − v(∅)` — is verified numerically and returned
as `residual` on every call (it comes back `0.0`).

### Feature signal audit

Three independent tests per feature, computed at training time:

| Feature | Pearson r | Spearman ρ | Mutual info | Permutation ΔR² | Verdict |
|---|---|---|---|---|---|
| Weekly self-study hours | 0.8122 | 0.8450 | 0.6219 | +1.43319 | **predictive** |
| Attendance | −0.0010 | −0.0003 | 0.0000 | −0.00003 | **no signal** |
| Class participation | 0.0007 | 0.0008 | 0.0034 | −0.00001 | **no signal** |

A feature must clear at least one weak-evidence threshold to be called
predictive. The two that fail are still served to the model, so the audit stays
visible — but the Predict tab labels any lever touching them as having no
measurable effect, and the recommendation engine *measures* each lever's gain
through the model instead of asserting one.

**Also worth knowing:** 26.8% of training scores sit at exactly 100. The target
is censored, which compresses the top of every response curve and caps
achievable R².

---

## 🚀 Running it

### Prerequisites

- **Python 3.12** (see note below)
- **Node 18+**

> **Python 3.12, not 3.14.** On Windows with Smart App Control enabled, the
> Python 3.14 build of scikit-learn ships an unsigned `_binning.pyd` that gets
> blocked, which takes down all of `sklearn.ensemble` — including `joblib.load`
> of any tree model. The 3.12 wheels clear the policy.

### Server

```bash
cd server
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

python model/train_model.py          # ~51s on 1M rows; writes model/artifacts/
python -m uvicorn main:app --reload --port 8000
```

`train_model.py` accepts `--sample N` to train on a subsample, `--quick` for
smaller ensembles during iteration, and `--lite` for the memory-constrained
preset used by the deployment build (see below).

### Deploying the backend

The `--lite` artifacts are **committed** under `server/model/artifacts/` (~3.7MB),
so a deploy needs nothing but `pip install -r requirements.txt`. There is no
build-time training step and no dashboard configuration to get wrong.

This is why `requirements.txt` pins `scikit-learn`, `numpy` and `scipy` exactly,
and why `server/.python-version` exists: the committed pickles must be unpickled
by the same library versions that wrote them. **If you retrain, regenerate with
`--lite` and commit the result** — a full-fidelity run produces ~54MB of pickles
that must not be committed.

`--lite` trains on 150k rows with shallower trees. It exists because the free
plan caps a service at 512MB: at full depth the four ensembles occupy ~186MB of
tree nodes once loaded, versus ~27MB under `--lite`, and it costs about 0.001
R² on this dataset. On a paid plan you can train full-fidelity at build time
instead by setting the build command to:

```
pip install --no-cache-dir -r requirements.txt && python model/train_model.py
```

If every endpoint returns `503 Model registry has not been loaded`, the
artifacts did not reach the container — check that `server/model/artifacts/`
is present in the deployed commit.

Interactive API docs: <http://localhost:8000/docs>

### Client

```bash
cd client
npm install
npm run dev
```

Set the API base URL in `client/.env`:

```
VITE_API_URL=http://localhost:8000
```

---

## 🔌 API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness, champion, dataset size, training timestamp |
| `POST` | `/prediction/predict` | Score one student: interval, grade, risk, levers |
| `POST` | `/prediction/batch` | Score a JSON array of students |
| `POST` | `/prediction/batch/csv` | Score an uploaded CSV roster |
| `GET` | `/prediction/template.csv` | Download a roster template |
| `POST` | `/explain/attribution` | Exact Shapley values for one prediction |
| `POST` | `/explain/sensitivity` | Per-feature ICE curves |
| `GET` | `/explain/importance` | Permutation importance + signal audit |
| `POST` | `/simulate/goal-seek` | Solve for the lever value hitting a target |
| `POST` | `/simulate/scenarios` | Compare up to eight named profiles |
| `GET` | `/model/catalog` | All models with held-out metrics |
| `GET` | `/model/features` | Feature schema with cohort ranges |
| `GET` | `/model/grades` | Empirical grade bands |
| `GET` | `/analytics/overview` | Distributions, correlations, response curves |

Batch upload matches common header spellings automatically
(`weekly_self_study_hours`, `attendance_pct`, `engagement`, …) and isolates
per-row failures rather than rejecting the whole file.

---

## 🗂️ Architecture

```
server/
  main.py                     FastAPI app, CORS, lifespan, health
  config/ml_model.py          Thread-safe model registry, lazy .pkl loading
  schemas/                    Pydantic request/response contracts
  helper/
    prediction_helper.py      Scoring, intervals, grading, risk, levers
    explain_helper.py         Exact Shapley, ICE curves
    simulate_helper.py        Goal seeking, scenarios
    batch_helper.py           CSV parsing, validation, batch scoring
  routes/                     prediction · explain · simulate · catalog
  model/
    train_model.py            Training pipeline
    artifacts/                *.pkl, background.npy, metadata.json

client/src/
  api/                        Axios client, typed endpoint wrappers
  components/
    charts/                   Hand-rolled SVG: gauge, line, bar, waterfall, heatmap
    ui/                       Card, Button, Badge, Stat, Field, states
  hooks/                      useAsync, useTheme, useDebounced
  lib/                        format, storage, CSV/PDF export
  tabs/                       One module per analysis surface
```

### Notes on the front end

- **No chart library.** Every visualisation is hand-written SVG, so the bundle
  stays small and the marks follow one spec.
- **Accessible by construction.** Every chart ships a table fallback, colour is
  never the only encoding, and both themes are deliberately stepped rather than
  auto-inverted.
- **Colour follows the entity.** Each feature keeps its hue everywhere; grades
  use an ordinal ramp; risk uses a reserved status palette paired with an icon
  and a label.

---

## ⚠️ Disclaimer

Predictions are model estimates with quantified uncertainty, not determinations
about any individual. Held-out R² is 0.72 — roughly 28% of score variance is
unexplained — and two of the three inputs carry no signal in this dataset.
Review the Model tab before acting on any result.

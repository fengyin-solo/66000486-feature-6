import math
import random
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Protein Folding Analyzer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

RAMACHANDRAN_REGIONS = [
    {"name": "alpha-helix", "phi": (-100, -30), "psi": (-80, -10)},
    {"name": "beta-sheet",  "phi": (-180, -45), "psi": (60, 180)},
    {"name": "left-helix",  "phi": (20, 100),   "psi": (-40, 80)},
    {"name": "beta-sheet-2","phi": (-180, -45), "psi": (-180, -60)},
]

def classify_region(phi: float, psi: float) -> str:
    for region in RAMACHANDRAN_REGIONS:
        if region["phi"][0] <= phi <= region["phi"][1] and region["psi"][0] <= psi <= region["psi"][1]:
            name = region["name"]
            return "beta-sheet" if name == "beta-sheet-2" else name
    return "disallowed"

def lennard_jones_energy(phi: float, psi: float, sigma: float = 3.4, epsilon: float = 0.5) -> float:
    """Simplified Lennard-Jones potential for phi-psi angle pair"""
    r = math.sqrt(phi * phi + psi * psi) / 180.0 * 3.0 + 2.0
    r = max(r, 1.0)
    ratio = sigma / r
    return 4 * epsilon * (ratio ** 12 - ratio ** 6) + epsilon

class SampleRequest(BaseModel):
    residues: int = 10
    conformations: int = 1000
    seed: Optional[int] = None

class ConformationOut(BaseModel):
    id: int
    phi: float
    psi: float
    energy: float
    region: str
    cluster: str

class SampleResponse(BaseModel):
    params: dict
    conformations: list[ConformationOut]
    energyRange: list[float]
    stats: dict
    seed: int

@app.post("/api/sample", response_model=SampleResponse)
def sample_conformations(req: SampleRequest):
    # 同一种子 + 参数必须确定性地产出同一批结果，保证链接复现
    seed = req.seed if req.seed is not None else random.randrange(1, 2_000_000_000)
    rng = random.Random(f"{seed}:{req.residues}:{req.conformations}")
    confs = []
    for i in range(req.conformations):
        phi = rng.uniform(-180, 180)
        psi = rng.uniform(-180, 180)
        energy = lennard_jones_energy(phi, psi) + rng.gauss(0, 0.05)
        region = classify_region(phi, psi)
        confs.append({
            "id": i + 1, "phi": round(phi, 2), "psi": round(psi, 2),
            "energy": round(energy, 3), "region": region
        })

    energies = [c["energy"] for c in confs]
    e_min, e_max = min(energies), max(energies)
    clusters = ["low-energy", "mid-energy", "high-energy"]
    for c in confs:
        t = (c["energy"] - e_min) / (e_max - e_min or 1)
        c["cluster"] = clusters[0] if t < 0.33 else (clusters[1] if t < 0.67 else clusters[2])

    regions = [c["region"] for c in confs]
    stats = {"alpha": regions.count("alpha-helix"), "beta": regions.count("beta-sheet"),
             "left": regions.count("left-helix"), "disallowed": regions.count("disallowed")}

    return SampleResponse(
        params={"residues": req.residues, "conformations": req.conformations},
        conformations=confs, energyRange=[e_min, e_max], stats=stats,
        seed=seed
    )
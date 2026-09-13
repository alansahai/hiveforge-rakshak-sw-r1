"""
Geographic utility module for MPLADS Monitoring System.
Provides district centroid lookups, Haversine distance calculations,
and cross-district / geo-adjacency duplicate work detection.
"""

import math
import hashlib
import json
import re
from pathlib import Path
from difflib import SequenceMatcher
from typing import Tuple, Dict, Any, Optional
import pandas as pd
import numpy as np

# Load comprehensive verified nationwide district coordinates database
_DB_PATH = Path(__file__).resolve().parent / "district_coordinates.json"
LOADED_DISTRICT_COORDINATES: Dict[str, Tuple[float, float]] = {}
if _DB_PATH.exists():
    try:
        _raw = json.loads(_DB_PATH.read_text(encoding="utf-8"))
        LOADED_DISTRICT_COORDINATES = {k.lower(): (float(v[0]), float(v[1])) for k, v in _raw.items()}
    except Exception as _e:
        pass


# Approximate centroid coordinates for Indian States and major Union Territories
STATE_CENTROIDS: Dict[str, Tuple[float, float]] = {
    'andhra pradesh': (15.9129, 79.7400),
    'arunachal pradesh': (28.2180, 94.7278),
    'assam': (26.2006, 92.9376),
    'bihar': (25.0961, 85.3131),
    'chhattisgarh': (21.2787, 81.8661),
    'goa': (15.2993, 74.1240),
    'gujarat': (22.2587, 71.1924),
    'haryana': (29.0588, 76.0856),
    'himachal pradesh': (31.1048, 77.1734),
    'jharkhand': (23.6102, 85.2799),
    'karnataka': (15.3173, 75.7139),
    'kerala': (10.8505, 76.2711),
    'madhya pradesh': (22.9734, 78.6569),
    'maharashtra': (19.7515, 75.7139),
    'manipur': (24.6637, 93.9063),
    'meghalaya': (25.4670, 91.3662),
    'mizoram': (23.1645, 92.9376),
    'nagaland': (26.1584, 94.5624),
    'odisha': (20.9517, 85.0985),
    'punjab': (31.1471, 75.3412),
    'rajasthan': (27.0238, 74.2179),
    'sikkim': (27.5330, 88.5122),
    'tamil nadu': (11.1271, 78.6569),
    'telangana': (18.1124, 79.0193),
    'tripura': (23.9408, 91.9882),
    'uttar pradesh': (26.8467, 80.9462),
    'uttarakhand': (30.0668, 79.0193),
    'west bengal': (22.9868, 87.8550),
    'delhi': (28.7041, 77.1025),
    'jammu and kashmir': (33.7782, 76.5762),
    'ladakh': (34.1526, 77.5771),
    'puducherry': (11.9416, 79.8083),
    'chandigarh': (30.7333, 76.7794),
    'andaman and nicobar islands': (11.7401, 92.6586),
    'dadra and nagar haveli and daman and diu': (20.1809, 73.0169),
    'lakshadweep': (10.5667, 72.6417),
    'central': (22.0000, 78.0000)
}

# District centroids for high-density districts in MPLADS datasets
DISTRICT_CENTROIDS: Dict[str, Tuple[float, float]] = {
    # Karnataka
    'dharwad': (15.4589, 75.0078),
    'haveri': (14.7954, 75.3992),
    'belagavi': (15.8497, 74.4977),
    'gadag': (15.4167, 75.6333),
    'uttara kannada': (14.7954, 74.6858),
    'bengaluru urban': (12.9716, 77.5946),
    'bengaluru rural': (13.2255, 77.5753),
    'mysuru': (12.2958, 76.6394),
    'ballari': (15.1394, 76.9214),
    'shivamogga': (13.9299, 75.5681),
    # Uttar Pradesh
    'jaunpur': (25.7464, 82.6837),
    'varanasi': (25.3176, 82.9739),
    'pratapgarh': (25.9000, 81.9833),
    'allahabad': (25.4358, 81.8463),
    'prayagraj': (25.4358, 81.8463),
    'ghazipur': (25.5833, 83.5833),
    'sonbhadra': (24.6858, 83.0683),
    'mirzapur': (25.1337, 82.5644),
    'bijnor': (29.3724, 78.1358),
    'lucknow': (26.8467, 80.9462),
    'kanpur nagar': (26.4499, 80.3319),
    'kaushambi': (25.5333, 81.4167),
    'budaun': (28.0333, 79.1167),
    'kheri': (27.9167, 80.7833),
    'shrawasti': (27.7000, 81.9000),
    'hamirpur': (25.9500, 80.1500),
    # Bihar & Jharkhand
    'patna': (25.5941, 85.1376),
    'vaishali': (25.6833, 85.2167),
    'gaya': (24.7914, 85.0002),
    'muzaffarpur': (26.1209, 85.3647),
    'ranchi': (23.3441, 85.3096),
    'ramgarh': (23.6333, 85.5167),
    'dhanbad': (23.7957, 86.4304),
    'bokaro': (23.6693, 86.1511),
    # Maharashtra
    'mumbai': (19.0760, 72.8777),
    'mumbai suburban': (19.1334, 72.8956),
    'thane': (19.2183, 72.9781),
    'pune': (18.5204, 73.8567),
    'nagpur': (21.1458, 79.0882),
    'nashik': (19.9975, 73.7898),
    'hingoli': (19.7167, 77.1500),
    # Tamil Nadu (All 38 Districts)
    'chennai': (13.0827, 80.2707),
    'kancheepuram': (12.8342, 79.7036),
    'chengalpattu': (12.6841, 79.9836),
    'tiruvallur': (13.1439, 79.9083),
    'coimbatore': (11.0168, 76.9558),
    'tirupur': (11.1085, 77.3411),
    'tiruppur': (11.1085, 77.3411),
    'erode': (11.3410, 77.7172),
    'salem': (11.6643, 78.1460),
    'namakkal': (11.2189, 78.1674),
    'dharmapuri': (12.1211, 78.1582),
    'krishnagiri': (12.5186, 78.2137),
    'nilgiris': (11.4102, 76.6950),
    'the nilgiris': (11.4102, 76.6950),
    'dindigul': (10.3673, 77.9803),
    'madurai': (9.9252, 78.1198),
    'theni': (10.0104, 77.4768),
    'virudhunagar': (9.5872, 77.9514),
    'sivaganga': (9.8433, 78.4809),
    'ramanathapuram': (9.3639, 78.8395),
    'thoothukudi': (8.7642, 78.1348),
    'tuticorin': (8.7642, 78.1348),
    'tirunelveli': (8.7139, 77.7567),
    'tenkasi': (8.9594, 77.3152),
    'kanyakumari': (8.0883, 77.5385),
    'tiruchirappalli': (10.7905, 78.7047),
    'trichy': (10.7905, 78.7047),
    'karur': (10.9601, 78.0766),
    'perambalur': (11.2342, 78.8821),
    'ariyalur': (11.1401, 79.0786),
    'thanjavur': (10.7870, 79.1378),
    'tiruvarur': (10.7725, 79.6365),
    'thiruvarur': (10.7725, 79.6365),
    'nagapattinam': (10.7672, 79.8449),
    'mayiladuthurai': (11.1075, 79.6523),
    'pudukkottai': (10.3797, 78.8208),
    'cuddalore': (11.7480, 79.7714),
    'viluppuram': (11.9401, 79.4861),
    'villupuram': (11.9401, 79.4861),
    'kallakurichi': (11.7384, 78.9639),
    'tiruvannamalai': (12.2253, 79.0747),
    'vellore': (12.9165, 79.1325),
    'ranipet': (12.9272, 79.3330),
    'tirupathur': (12.4958, 78.5678),
    'tirupattur': (12.4958, 78.5678),
    # Andhra Pradesh & Telangana
    'hyderabad': (17.3850, 78.4867),
    'visakhapatnam': (17.6868, 83.2185),
    'vijayawada': (16.5062, 80.6480),
    'guntur': (16.3067, 80.4365),
    'chittoor': (13.2172, 79.1003),
    'anantapur': (14.6819, 77.6006),
    'warangal': (17.9689, 79.5941),
    # Rajasthan
    'jaipur': (26.9124, 75.7873),
    'jodhpur': (26.2389, 73.0243),
    'udaipur': (24.5854, 73.7125),
    'kota': (25.2138, 75.8648),
    'ajmer': (26.4499, 74.6399),
    'bikaner': (28.0229, 73.3119),
    # Madhya Pradesh
    'bhopal': (23.2599, 77.4126),
    'indore': (22.7196, 75.8577),
    'gwalior': (26.2183, 78.1828),
    'jabalpur': (23.1815, 79.9864),
    'ujjain': (23.1765, 75.7885),
    # Punjab & Haryana
    'ludhiana': (30.9010, 75.8573),
    'amritsar': (31.6340, 74.8723),
    'jalandhar': (31.3260, 75.5762),
    'gurugram': (28.4595, 77.0266),
    'faridabad': (28.4089, 77.3178),
    'panipat': (29.3909, 76.9635),
    'ambala': (30.3782, 76.7767),
    # Assam & North East
    'kamrup': (26.3114, 91.5979),
    'kamrup metropolitan': (26.1445, 91.7362),
    'guwahati': (26.1445, 91.7362),
    'dibrugarh': (27.4728, 94.9120),
    'silchar': (24.8333, 92.7789),
    'cachar': (24.8333, 92.7789),
    # West Bengal & Odisha
    'kolkata': (22.5726, 88.3639),
    'south 24 parganas': (22.1667, 88.5000),
    'north 24 parganas': (22.7500, 88.5500),
    'murshidabad': (24.1750, 88.2802),
    'bhubaneswar': (20.2961, 85.8245),
    'puri': (19.8135, 85.8312),
    'khordha': (20.1833, 85.6167),
    'cuttack': (20.4625, 85.8828),
    # Kerala & Gujarat
    'thiruvananthapuram': (8.5241, 76.9366),
    'kollam': (8.8932, 76.6141),
    'malappuram': (11.0732, 76.0740),
    'ahmedabad': (23.0225, 72.5714),
    'gandhinagar': (23.2156, 72.6369),
    'mahesana': (23.6000, 72.4000),
    'panch mahals': (22.7500, 73.6167),
    'kangra': (32.1000, 76.2667)
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes Great-Circle (Haversine) distance between two coordinate pairs in kilometers.
    """
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_district_coordinates(district: str, state: str = "Central") -> Tuple[float, float]:
    """
    Retrieves verified centroid coordinates for a given district from the nationwide database.
    Falls back to state centroid with deterministic hash perturbation only if completely unknown.
    """
    d_clean = str(district).strip().lower()
    s_clean = str(state).strip().lower()

    # 1. State-namespaced lookup in verified database
    namespaced_key = f"{s_clean}::{d_clean}"
    if namespaced_key in LOADED_DISTRICT_COORDINATES:
        return LOADED_DISTRICT_COORDINATES[namespaced_key]

    # 2. Direct lookup in verified database
    if d_clean in LOADED_DISTRICT_COORDINATES:
        return LOADED_DISTRICT_COORDINATES[d_clean]

    # 3. Lookup in static centroids table
    if d_clean in DISTRICT_CENTROIDS:
        return DISTRICT_CENTROIDS[d_clean]

    # Fallback to state centroid with deterministic pseudo-location
    base_lat, base_lon = STATE_CENTROIDS.get(s_clean, STATE_CENTROIDS['central'])
    
    # Generate deterministic offset based on district name so districts in same state are distinct
    h = int(hashlib.md5(d_clean.encode('utf-8')).hexdigest()[:6], 16)
    offset_lat = ((h % 100) - 50) / 150.0  # ±0.33 degrees (~35 km)
    offset_lon = (((h // 100) % 100) - 50) / 150.0
    
    return round(base_lat + offset_lat, 4), round(base_lon + offset_lon, 4)


GENERIC_STOPWORDS = {
    'and', 'the', 'of', 'in', 'at', 'to', 'for', 'with', 'on', 'a', 'an',
    'by', 'from', 'is', 'as', 'into', 'under', 'per', 'all', 'nos', 'no',
    'work', 'works', 'public', 'mplads', 'scheme', 'supply', 'providing',
    'provision', 'construction', 'constructing', 'maintenance', 'installation',
    'installing', 'erection', 'development', 'developing', 'infrastructure',
    'area', 'areas', 'nagar', 'colony', 'village', 'panchayat', 'district',
    'taluk', 'block', 'state', 'fund', 'funds', 'project', 'projects', 'phase',
    'stage', 'item', 'items', 'etc', 'towards', 'near', 'gram', 'ward', 'town'
}


def extract_meaningful_tokens(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', str(text).lower())
    words = cleaned.split()
    return {w for w in words if len(w) > 2 and w not in GENERIC_STOPWORDS}


def text_similarity_ratio(desc1: str, desc2: str) -> float:
    """
    Computes semantic similarity ratio between two public work descriptions
    using tokenized Jaccard similarity and SequenceMatcher with domain stopword filtering.
    Requires shared meaningful domain tokens to produce a non-zero similarity score.
    """
    d1 = str(desc1 or '').strip()
    d2 = str(desc2 or '').strip()
    if not d1 or not d2 or len(d1) < 4 or len(d2) < 4:
        return 0.0

    tokens1 = extract_meaningful_tokens(d1)
    tokens2 = extract_meaningful_tokens(d2)

    if not tokens1 or not tokens2:
        return 0.0

    intersection = tokens1 & tokens2
    if len(intersection) < 2:
        # Descriptions sharing 0 or only 1 isolated token cannot constitute duplicate public works
        return 0.0

    union = tokens1 | tokens2
    jaccard = len(intersection) / len(union) if union else 0.0

    # SequenceMatcher on normalized lowercase string
    seq_ratio = SequenceMatcher(None, d1.lower(), d2.lower()).ratio()

    # Overlap relative to shorter token set
    overlap_ratio = len(intersection) / min(len(tokens1), len(tokens2))

    # Balanced score: high weighting on token overlap and Jaccard
    blended = (0.35 * jaccard) + (0.45 * overlap_ratio) + (0.20 * seq_ratio)
    return round(float(blended), 4)


# Backwards-compatibility alias
calculate_work_similarity = text_similarity_ratio


def compute_geo_duplicate_flags(df: pd.DataFrame, max_dist_km: float = 40.0) -> pd.Series:
    """
    Evaluates dataset for cross-district geo-adjacency duplicate works.
    Flags projects that have matching categories, similar sanction amounts (±12%),
    and genuine semantic text similarity (>= 0.50) in neighboring districts within max_dist_km.
    """
    n = len(df)
    geo_flags = pd.Series(0, index=df.index, dtype=int)
    
    if n <= 1:
        return geo_flags

    # Extract coordinates
    districts = df.get('district', pd.Series('Central', index=df.index)).astype(str).str.strip().str.lower()
    states = df.get('state', pd.Series('Central', index=df.index)).astype(str).str.strip().str.lower()
    categories = df.get('category', pd.Series('Other', index=df.index)).astype(str)
    amounts = pd.to_numeric(df.get('amount_sanctioned', 500000), errors='coerce').fillna(500000)
    descs = df.get('work_description', pd.Series('', index=df.index)).astype(str)

    unique_pairs = list(set(zip(districts, states)))
    coord_map = {pair: get_district_coordinates(pair[0], pair[1]) for pair in unique_pairs}

    budget_buckets = (np.log10(amounts.clip(lower=10000)) * 10).astype(int)
    grouped = df.groupby([categories, budget_buckets])
    
    for _, group_indices in grouped.groups.items():
        if len(group_indices) < 2 or len(group_indices) > 500:
            continue
            
        indices = group_indices.values
        sub_districts = districts.iloc[indices].values
        sub_states = states.iloc[indices].values
        sub_amounts = amounts.iloc[indices].values
        sub_descs = descs.iloc[indices].values
        
        for i in range(len(indices)):
            dist_i = sub_districts[i]
            pair_i = (dist_i, sub_states[i])
            lat_i, lon_i = coord_map.get(pair_i, (20.0, 78.0))
            amt_i = sub_amounts[i]
            desc_i = sub_descs[i]
            
            for j in range(i + 1, len(indices)):
                dist_j = sub_districts[j]
                if dist_i != dist_j:
                    amt_j = sub_amounts[j]
                    if abs(amt_i - amt_j) / (max(amt_i, amt_j) + 1e-4) <= 0.12:
                        pair_j = (dist_j, sub_states[j])
                        lat_j, lon_j = coord_map.get(pair_j, (20.0, 78.0))
                        d_km = haversine_distance_km(lat_i, lon_i, lat_j, lon_j)
                        if d_km <= max_dist_km:
                            # Verify semantic text similarity to eliminate false positives
                            desc_j = sub_descs[j]
                            sim = text_similarity_ratio(desc_i, desc_j)
                            if sim >= 0.50:
                                geo_flags.iloc[indices[i]] = 1
                                geo_flags.iloc[indices[j]] = 1

    return geo_flags


def check_single_project_geo_duplicate(
    project_dict: dict,
    master_df: Optional[pd.DataFrame] = None,
    max_dist_km: float = 65.0
) -> Dict[str, Any]:
    """
    Examines a single project against master dataset or district reference data
    to detect same-district or cross-district duplicate works using BOTH spatial
    distance and semantic text similarity on work descriptions.
    Enforces a strict similarity threshold (>= 0.50, or >= 0.45 for same contractor).
    """
    p_id = str(project_dict.get('project_id', '')).strip().lower()
    p_district = str(project_dict.get('district', 'Central')).strip()
    p_state = str(project_dict.get('state', 'Central')).strip()
    p_amount = float(project_dict.get('amount_sanctioned', 500000.0) or 500000.0)
    p_contractor = str(project_dict.get('contractor', '')).strip()
    p_desc = str(project_dict.get('work_description', '')).strip()

    lat1, lon1 = get_district_coordinates(p_district, p_state)

    if master_df is not None and not master_df.empty and len(p_desc) >= 6:
        # Exclude project itself
        candidates = master_df
        if 'project_id' in candidates.columns:
            candidates = candidates[candidates['project_id'].astype(str).str.strip().str.lower() != p_id]

        if not candidates.empty:
            # Filter candidates within ±35% budget
            amt_col = pd.to_numeric(candidates.get('amount_sanctioned', 0), errors='coerce').fillna(0)
            budget_mask = (abs(amt_col - p_amount) / (p_amount + 1e-4) <= 0.35)
            budget_candidates = candidates[budget_mask]

            if not budget_candidates.empty:
                best_match = None
                highest_sim = 0.0
                best_dist_km = 0.0
                best_dup_type = "none"
                best_shared_tokens = []

                p_tokens = extract_meaningful_tokens(p_desc)

                same_dist_candidates = budget_candidates[
                    budget_candidates['district'].astype(str).str.strip().str.lower() == p_district.lower()
                ]
                other_candidates = budget_candidates[
                    budget_candidates['district'].astype(str).str.strip().str.lower() != p_district.lower()
                ]

                # 1. Search same district
                for _, row in same_dist_candidates.head(150).iterrows():
                    cand_desc = str(row.get('work_description', ''))
                    sim = text_similarity_ratio(p_desc, cand_desc)
                    if sim > highest_sim:
                        highest_sim = sim
                        best_match = row
                        best_dist_km = 0.0
                        best_dup_type = "same_district"
                        best_shared_tokens = sorted(list(p_tokens & extract_meaningful_tokens(cand_desc)))

                # 2. Search cross district within max_dist_km
                for _, row in other_candidates.head(150).iterrows():
                    cand_desc = str(row.get('work_description', ''))
                    sim = text_similarity_ratio(p_desc, cand_desc)
                    if sim > highest_sim:
                        other_dist = str(row.get('district', '')).strip()
                        other_state = str(row.get('state', p_state)).strip()
                        lat2, lon2 = get_district_coordinates(other_dist, other_state)
                        dist_km = round(haversine_distance_km(lat1, lon1, lat2, lon2), 1)
                        if dist_km <= max_dist_km:
                            highest_sim = sim
                            best_match = row
                            best_dist_km = dist_km
                            best_dup_type = "cross_district"
                            best_shared_tokens = sorted(list(p_tokens & extract_meaningful_tokens(cand_desc)))

                # Strict requirement: Minimum 0.50 semantic similarity (or 0.45 if exact contractor match)
                is_same_vendor = False
                if best_match is not None:
                    m_vend = str(best_match.get('contractor', '')).strip().lower()
                    is_same_vendor = bool(p_contractor and m_vend and m_vend == p_contractor.lower())
                
                threshold = 0.45 if is_same_vendor else 0.50

                if best_match is not None and highest_sim >= threshold and best_shared_tokens:
                    matched_amt = float(pd.to_numeric(best_match.get('amount_sanctioned', 0), errors='coerce') or 0)
                    matched_spent = float(pd.to_numeric(best_match.get('amount_spent', 0), errors='coerce') or 0)
                    m_contractor = str(best_match.get('contractor', 'N/A')).strip()
                    m_dist = str(best_match.get('district', p_district)).strip()
                    m_state = str(best_match.get('state', p_state)).strip()
                    variance = round(abs(matched_amt - p_amount) / (p_amount + 1e-4) * 100.0, 1)
                    token_str = ", ".join(best_shared_tokens[:4])

                    if best_dup_type == "same_district":
                        explanation = (
                            f"Same-district duplicate detected: Work scope matches sibling project with "
                            f"{round(highest_sim * 100)}% semantic text similarity (shared scope: {token_str}) "
                            f"and budget ₹{matched_amt:,.0f} (Variance: {variance}%)."
                        )
                    else:
                        explanation = (
                            f"Cross-boundary duplicate detected: Near-identical work ({round(highest_sim * 100)}% similarity, "
                            f"shared scope: {token_str}) sanctioned in adjacent district '{m_dist}' "
                            f"(~{best_dist_km} km away, {variance}% budget variance)."
                        )

                    return {
                        "geo_duplicate_detected": True,
                        "geo_duplicate_type": best_dup_type,
                        "distance_to_duplicate_km": best_dist_km,
                        "matched_project_id": str(best_match.get('project_id', 'PROJ-MATCH')),
                        "matched_district": m_dist,
                        "matched_state": m_state,
                        "matched_location": f"{m_dist}, {m_state}",
                        "matched_amount": matched_amt,
                        "matched_spent": matched_spent,
                        "matched_contractor": m_contractor,
                        "matched_work_description": str(best_match.get('work_description', '')),
                        "budget_variance_pct": variance,
                        "similarity_score": round(highest_sim, 3),
                        "shared_tokens": best_shared_tokens,
                        "same_contractor": is_same_vendor,
                        "explanation": explanation
                    }

    return {
        "geo_duplicate_detected": False,
        "geo_duplicate_type": "none",
        "distance_to_duplicate_km": None,
        "matched_project_id": None,
        "matched_district": None,
        "matched_state": None,
        "matched_location": None,
        "matched_amount": None,
        "matched_spent": None,
        "matched_contractor": None,
        "matched_work_description": None,
        "budget_variance_pct": None,
        "similarity_score": 0.0,
        "shared_tokens": [],
        "same_contractor": False,
        "explanation": "No evidence of duplicate work found in same district or across adjacent boundaries."
    }


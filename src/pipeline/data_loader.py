import os
import sys
import re
import logging
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Ensure UTF-8 output on Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import (
    CLEANED_DATA_PATH, 
    RAW_DATA_PATH, 
    LOK_SABHA_DIR, 
    RAJYA_SABHA_DIR, 
    DATA_QUALITY_LOG, 
    INDIAN_STATES, 
    PROJECT_CATEGORIES
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    handlers=[
        logging.FileHandler(DATA_QUALITY_LOG, mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("DataLoader")

REQUIRED_COLUMNS = [
    'approval_id', 'amount_sanctioned', 'amount_spent',
    'approval_date', 'completion_date', 'location',
    'state', 'contractor', 'category'
]

FINAL_PROJECTION_COLUMNS = [
    'project_id', 'approval_id', 'amount_sanctioned', 'amount_spent',
    'approval_date', 'expected_completion_date', 'actual_completion_date', 'completion_date',
    'state', 'district', 'location', 'contractor', 'category',
    'mp_name', 'constituency', 'house', 'progress_percentage',
    'tranche_count', 'days_to_first_payment', 'work_description', 'work_status'
]

def _extract_work_id(val: str) -> str:
    """Extracts standardized Work ID (e.g. WS/MP620/2024-2025/133166)."""
    val_str = str(val).strip()
    m = re.search(r'(WS/\s*[A-Za-z0-9_\-]+/\d{4}-\d{4}/\d+)', val_str)
    if m:
        return re.sub(r'\s+', '', m.group(1)).upper()
    return re.sub(r'\s+', '', val_str).upper()

def _extract_district(ida_str: str) -> str:
    """Extracts clean district name from IDA string."""
    if not ida_str or pd.isna(ida_str):
        return 'Central'
    s = str(ida_str).split('(')[0].strip()
    s = re.sub(r'^(DISTRICT\s+|DEPUTY\s+COMMISSIONER\s+)', '', s, flags=re.IGNORECASE).strip()
    return s.title() if s else 'Central'

def _categorize_work(text: str) -> str:
    """Maps free-text work description and titles to 8 canonical categories."""
    t = str(text).lower()
    if any(k in t for k in ['health', 'hospital', 'ambulance', 'dispensary', 'clinic', 'medical', 'ayush', 'patient']):
        return 'Health'
    if any(k in t for k in ['school', 'college', 'room', 'hall in school', 'library', 'it system', 'computer', 'student', 'hostel', 'smart class', 'education', 'mid day']):
        return 'Education'
    if any(k in t for k in ['road', 'drain', 'culvert', 'pathway', 'bridge', 'paving', 'cc road', 'pcc', 'link road', 'interlocking', 'bituminous']):
        return 'Road Infrastructure'
    if any(k in t for k in ['water', 'borewell', 'tubewell', 'handpump', 'tank', 'drinking', 'pipeline', 'jal', 'submersible', 'r.o.']):
        return 'Water Supply'
    if any(k in t for k in ['toilet', 'sanitation', 'sewerage', 'waste', 'drainage system', 'soak pit', 'cleanliness']):
        return 'Sanitation'
    if any(k in t for k in ['light', 'electric', 'solar', 'transformer', 'high mast', 'led', 'street light', 'lighting']):
        return 'Electricity'
    if any(k in t for k in ['community', 'bhavan', 'bhawan', 'cultural', 'crematorium', 'shed', 'mandapam', 'auditorium', 'kalyana', 'samudayik']):
        return 'Community Hall'
    if any(k in t for k in ['market', 'mandi', 'shop', 'commercial', 'vendor', 'stall', 'haat']):
        return 'Market'
    return 'Road Infrastructure'

def load_real_mplads_data() -> pd.DataFrame:
    """
    Ingests and merges real Lok Sabha and Rajya Sabha datasets.
    """
    logger.info("Loading real MoSPI MPLADS dataset for Lok Sabha & Rajya Sabha...")
    
    dfs = []
    house_configs = [
        ('Lok Sabha', LOK_SABHA_DIR, 'LS_'),
        ('Rajya Sabha', RAJYA_SABHA_DIR, 'RS_')
    ]
    
    for house_name, house_dir, prefix in house_configs:
        sanc_file = house_dir / f"{prefix}Works Sanctioned.xlsx"
        exp_file = house_dir / f"{prefix}Expenditure on Completed and On-going Works as on Date.xlsx"
        comp_file = house_dir / f"{prefix}Works Completed.xlsx"
        
        if not (sanc_file.exists() and exp_file.exists()):
            logger.warning(f"Required files not found in {house_dir}. Skipping {house_name}.")
            continue
            
        logger.info(f"Ingesting {house_name} files...")
        
        # 1. Load Works Sanctioned
        df_sanc = pd.read_excel(sanc_file, engine='calamine', header=1)
        df_sanc['work_id'] = df_sanc['Work'].apply(_extract_work_id)
        
        # 2. Load Expenditure
        df_exp = pd.read_excel(exp_file, engine='calamine', header=1)
        df_exp['work_id'] = df_exp['Work ID'].apply(_extract_work_id)
        
        exp_amt_col = [c for c in df_exp.columns if 'disbursed' in str(c).lower() or 'fund' in str(c).lower()]
        exp_amt_col = exp_amt_col[0] if exp_amt_col else df_exp.columns[-1]
        df_exp['disbursed_numeric'] = pd.to_numeric(df_exp[exp_amt_col], errors='coerce').fillna(0.0)
        df_exp['exp_date_parsed'] = pd.to_datetime(df_exp['Expenditure Date'], errors='coerce')
        
        vendor_col = [c for c in df_exp.columns if 'vendor' in str(c).lower()]
        vendor_col_name = vendor_col[0] if vendor_col else 'Vendor Name'
        
        exp_agg = df_exp.groupby('work_id').agg(
            total_spent=('disbursed_numeric', 'sum'),
            tranche_count=('disbursed_numeric', 'count'),
            primary_vendor=(vendor_col_name, lambda s: s.dropna().iloc[0] if len(s.dropna()) > 0 else 'Unknown Contractor'),
            first_payment_date=('exp_date_parsed', 'min'),
            last_payment_date=('exp_date_parsed', 'max')
        ).reset_index()
        
        # 3. Load Works Completed
        comp_agg = None
        if comp_file.exists():
            df_comp = pd.read_excel(comp_file, engine='calamine', header=1)
            df_comp['work_id'] = df_comp['Work'].apply(_extract_work_id)
            df_comp['comp_date_parsed'] = pd.to_datetime(df_comp['Completion Date'], errors='coerce')
            comp_amt_col = [c for c in df_comp.columns if 'amount disbursed' in str(c).lower()]
            comp_amt_col_name = comp_amt_col[0] if comp_amt_col else df_comp.columns[-1]
            df_comp['comp_amt_numeric'] = pd.to_numeric(df_comp[comp_amt_col_name], errors='coerce').fillna(0.0)
            
            comp_agg = df_comp.groupby('work_id').agg(
                actual_completion_date=('comp_date_parsed', 'max'),
                completed_spent=('comp_amt_numeric', 'max')
            ).reset_index()
            
        # 4. Merge
        merged = df_sanc.merge(exp_agg, on='work_id', how='left')
        if comp_agg is not None:
            merged = merged.merge(comp_agg, on='work_id', how='left')
        else:
            merged['actual_completion_date'] = pd.NaT
            merged['completed_spent'] = 0.0
            
        merged['house'] = house_name
        dfs.append(merged)
        logger.info(f"Loaded {len(merged)} {house_name} sanctioned projects")
        
    if not dfs:
        raise FileNotFoundError("No valid Lok Sabha or Rajya Sabha Excel files could be loaded.")
        
    df_combined = pd.concat(dfs, ignore_index=True)
    
    # 5. Extract canonical features
    sanction_amt_col = [c for c in df_combined.columns if 'sanction amount' in str(c).lower()]
    sanc_col_name = sanction_amt_col[0] if sanction_amt_col else 'sanction_amount'
    
    df_res = pd.DataFrame()
    df_res['project_id'] = df_combined['work_id'].astype(str)
    df_res['approval_id'] = df_combined['work_id'].astype(str)
    
    df_res['amount_sanctioned'] = pd.to_numeric(df_combined[sanc_col_name], errors='coerce').fillna(500000.0).clip(lower=1000.0)
    
    spent = df_combined['total_spent'].fillna(0.0)
    mask_zero = (spent <= 0.0) & (df_combined['completed_spent'] > 0.0)
    spent[mask_zero] = df_combined.loc[mask_zero, 'completed_spent']
    df_res['amount_spent'] = spent.clip(lower=0.0)
    
    app_date = pd.to_datetime(df_combined['Sanction Date'], errors='coerce')
    rec_date = pd.to_datetime(df_combined.get('Recommended date', pd.Series(pd.NaT, index=df_combined.index)), errors='coerce')
    df_res['approval_date'] = app_date.fillna(rec_date).fillna(pd.to_datetime('2023-01-01'))
    
    df_res['expected_completion_date'] = df_res['approval_date'] + pd.to_timedelta(365, unit='D')
    df_res['actual_completion_date'] = df_combined['actual_completion_date']
    df_res['completion_date'] = df_res['actual_completion_date'].fillna(df_res['expected_completion_date'])
    
    df_res['district'] = df_combined['IDA'].apply(_extract_district)
    df_res['state'] = df_combined['State'].fillna('Central').astype(str).str.strip().str.title()
    df_res['location'] = df_res['district'] + ", " + df_res['state']
    
    contractor = df_combined['primary_vendor'].fillna('Departmental Works / Local Body').astype(str).str.strip()
    contractor[contractor == 'nan'] = 'Departmental Works / Local Body'
    contractor[contractor == ''] = 'Departmental Works / Local Body'
    df_res['contractor'] = contractor
    
    desc_series = df_combined['Work'].astype(str) + " " + df_combined.get('Work description', pd.Series('', index=df_combined.index)).fillna('').astype(str)
    df_res['category'] = desc_series.apply(_categorize_work)
    
    mp_col = [c for c in df_combined.columns if 'members of parliament' in str(c).lower()]
    mp_col_name = mp_col[0] if mp_col else 'Hon\'ble Members of Parliament'
    df_res['mp_name'] = df_combined[mp_col_name].fillna('Honble MP').astype(str).str.strip()
    
    const_col = [c for c in df_combined.columns if 'constituency' in str(c).lower() or 'elected' in str(c).lower()]
    const_col_name = const_col[0] if const_col else 'constituency'
    df_res['constituency'] = df_combined[const_col_name].fillna('State-wide').astype(str).str.strip()
    
    df_res['house'] = df_combined['house']
    
    status_col = [c for c in df_combined.columns if 'work status' in str(c).lower()]
    status_name = status_col[0] if status_col else 'status'
    df_res['work_status'] = df_combined[status_name].fillna('In-Progress').astype(str)
    
    def calc_prog(row):
        st = str(row['work_status']).lower()
        if 'completed' in st and 'partially' not in st:
            return 100.0
        elif 'partially completed' in st or 'inspection' in st:
            ratio = (row['amount_spent'] / (row['amount_sanctioned'] + 1e-4)) * 100.0
            return float(np.clip(max(ratio, 65.0), 50.0, 95.0))
        else:
            ratio = (row['amount_spent'] / (row['amount_sanctioned'] + 1e-4)) * 100.0
            return float(np.clip(ratio, 10.0, 85.0))
            
    df_res['progress_percentage'] = df_res.apply(calc_prog, axis=1)
    
    df_res['tranche_count'] = df_combined['tranche_count'].fillna(1).astype(int).clip(lower=1)
    
    first_exp = df_combined['first_payment_date']
    days_to_first = (first_exp - df_res['approval_date']).dt.days.fillna(45).clip(lower=5, upper=180).astype(int)
    df_res['days_to_first_payment'] = days_to_first
    
    df_res['work_description'] = df_combined.get('Work description', df_combined['Work']).fillna(df_combined['Work']).astype(str)
    
    return df_res

def create_synthetic_data(output_path: Path, n_records: int = 2000) -> pd.DataFrame:
    """Generates realistic synthetic MPLADS records with realistic anomaly patterns."""
    logger.info(f"Generating {n_records} realistic synthetic MPLADS records...")
    np.random.seed(42)
    
    states = INDIAN_STATES[:28]
    categories = PROJECT_CATEGORIES
    
    base_date = datetime(2021, 1, 1)
    approval_dates = [base_date + timedelta(days=int(x)) for x in np.random.randint(0, 1200, n_records)]
    
    sanctioned = np.random.lognormal(12.5, 1.2, n_records).round(2)
    spent = (sanctioned * np.random.uniform(0.7, 1.2, n_records)).round(2)
    
    df = pd.DataFrame({
        'project_id': [f'PROJ-{i:06d}' for i in range(n_records)],
        'approval_id': [f'WS/MP{np.random.randint(100, 999)}/2023-2024/{i:06d}' for i in range(n_records)],
        'state': np.random.choice(states, n_records),
        'district': [f'District-{np.random.randint(1, 15)}' for _ in range(n_records)],
        'category': np.random.choice(categories, n_records),
        'amount_sanctioned': sanctioned,
        'amount_spent': spent,
        'approval_date': approval_dates,
        'expected_completion_date': [d + timedelta(days=int(np.random.randint(180, 540))) for d in approval_dates],
        'actual_completion_date': [d + timedelta(days=int(np.random.randint(150, 700))) if np.random.random() > 0.3 else None for d in approval_dates],
        'contractor': [f'Contractor-{np.random.randint(1, 120)}' for _ in range(n_records)],
        'progress_percentage': np.random.uniform(15, 100, n_records).round(1),
        'work_description': ['Infrastructure and development work under MPLADS'] * n_records,
        'location': [f'Location-{np.random.randint(1, 200)}' for _ in range(n_records)],
        'mp_name': [f'Honble MP {np.random.randint(1, 80)}' for _ in range(n_records)],
        'constituency': [f'Constituency-{np.random.randint(1, 80)}' for _ in range(n_records)],
        'house': np.random.choice(['Lok Sabha', 'Rajya Sabha'], n_records, p=[0.75, 0.25]),
        'tranche_count': np.random.randint(1, 6, n_records),
        'days_to_first_payment': np.random.randint(15, 90, n_records),
        'work_status': ['In-Progress'] * n_records
    })
    
    df['completion_date'] = df['actual_completion_date'].fillna(df['expected_completion_date'])
    
    # Inject anomalies
    fraud_idx = np.random.choice(n_records, size=int(0.06 * n_records), replace=False)
    df.loc[fraud_idx, 'amount_spent'] = df.loc[fraud_idx, 'amount_sanctioned'] * np.random.uniform(1.4, 2.2, len(fraud_idx))
    
    delay_idx = np.random.choice(n_records, size=int(0.12 * n_records), replace=False)
    df.loc[delay_idx, 'actual_completion_date'] = df.loc[delay_idx, 'expected_completion_date'] + pd.to_timedelta(np.random.randint(45, 200, len(delay_idx)), unit='D')
    df.loc[delay_idx, 'completion_date'] = df.loc[delay_idx, 'actual_completion_date']
    
    ghost_idx = np.random.choice(n_records, size=int(0.03 * n_records), replace=False)
    df.loc[ghost_idx, 'amount_spent'] = 0.0
    df.loc[ghost_idx, 'progress_percentage'] = 0.0
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info(f"Saved {n_records} synthetic records to {output_path}")
    return df

def load_and_clean_data(file_path: Path = None) -> pd.DataFrame:
    """
    Main entry point for pipeline data loader.
    """
    logger.info("Initializing MPLADS data loading & cleaning workflow...")
    df = None
    
    # Priority 1: Official MoSPI Excel Files
    has_real_ls = (LOK_SABHA_DIR / "LS_Works Sanctioned.xlsx").exists()
    has_real_rs = (RAJYA_SABHA_DIR / "RS_Works Sanctioned.xlsx").exists()
    
    if has_real_ls or has_real_rs:
        try:
            df = load_real_mplads_data()
            logger.info(f"Loaded {len(df)} records from official MoSPI Lok Sabha / Rajya Sabha files.")
        except Exception as e:
            logger.warning(f"Error reading real Excel files ({str(e)}). Falling back to CSV / synthetic...")
            df = None
            
    # Priority 2: Existing CSV
    if df is None:
        csv_path = file_path if file_path and file_path.exists() else RAW_DATA_PATH
        if csv_path.exists():
            try:
                df = pd.read_csv(csv_path)
                logger.info(f"Loaded {len(df)} records from raw CSV: {csv_path}")
            except Exception as e:
                logger.warning(f"Error reading raw CSV ({str(e)}). Generating synthetic dataset...")
                df = None
                
    # Priority 3: Synthetic fallback
    if df is None:
        logger.warning("=" * 72)
        logger.warning("⚠️  PROMINENT WARNING: FALLING BACK TO SYNTHETIC MPLADS DATA GENERATOR!")
        logger.warning("⚠️  Real MoSPI Lok Sabha / Rajya Sabha Excel datasets were not found.")
        logger.warning("⚠️  Generating synthetic dataset (2,000 records) for demonstration.")
        logger.warning("=" * 72)
        df = create_synthetic_data(RAW_DATA_PATH, n_records=2000)
        
    initial_rows = len(df)
    logger.info(f"Initial record count for pipeline cleaning: {initial_rows}")
    
    # Ensure all required columns exist
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Schema validation failed. Missing required columns: {missing}")
        
    # Deduplication
    before_dedup = len(df)
    df_cleaned = df.drop_duplicates(subset=['approval_id', 'contractor', 'location', 'approval_date']).copy()
    duplicates_removed = before_dedup - len(df_cleaned)
    logger.info(f"Deduplication removed {duplicates_removed} duplicate records.")
    
    # Export cleaned dataset
    CLEANED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(CLEANED_DATA_PATH, index=False)
    logger.info(f"Cleaned dataset saved successfully to {CLEANED_DATA_PATH} ({len(df_cleaned)} records)")
    
    return df_cleaned

if __name__ == '__main__':
    df = load_and_clean_data()
    print(f"Data loading complete! Total records: {len(df)}, Columns: {len(df.columns)}")

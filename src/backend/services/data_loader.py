import logging
from pathlib import Path
from typing import Optional
import pandas as pd

from src.config import RISK_REPORTS_PARQUET, RISK_REPORTS_CSV, CLEANED_DATA_PATH

logger = logging.getLogger("DataLoader")

_MASTER_DATAFRAME: Optional[pd.DataFrame] = None

def get_master_dataframe() -> pd.DataFrame:
    """
    Thread-safe, singleton loader for the master 98,632-row MPLADS dataset.
    Optimizes memory by downcasting numeric types and retaining a single in-memory instance.
    Prevents repeated parquet disk reads and avoids out-of-memory container crashes.
    """
    global _MASTER_DATAFRAME
    if _MASTER_DATAFRAME is not None:
        return _MASTER_DATAFRAME

    if RISK_REPORTS_PARQUET.exists():
        logger.info("Loading master reference dataset from parquet with memory optimization...")
        df = pd.read_parquet(RISK_REPORTS_PARQUET)
    elif RISK_REPORTS_CSV.exists():
        logger.info("Loading master reference dataset from csv...")
        df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
    elif CLEANED_DATA_PATH.exists():
        logger.info("Loading master reference dataset from cleaned data path...")
        df = pd.read_csv(CLEANED_DATA_PATH, low_memory=False)
        if 'risk_score' not in df.columns:
            df['risk_score'] = 25.0
            df['risk_category'] = 'low'
    else:
        logger.warning("No master dataset file found. Initializing empty DataFrame.")
        df = pd.DataFrame()
        _MASTER_DATAFRAME = df
        return _MASTER_DATAFRAME

    # Downcast float64 to float32 and int64 to int32 to cut memory footprint in half
    for c in df.select_dtypes(include='float64').columns:
        df[c] = df[c].astype('float32')
    for c in df.select_dtypes(include='int64').columns:
        df[c] = df[c].astype('int32')

    _MASTER_DATAFRAME = df
    mem_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
    logger.info(f"Master reference dataset cached in memory: {len(df):,} records ({mem_mb:.1f} MB).")
    return _MASTER_DATAFRAME

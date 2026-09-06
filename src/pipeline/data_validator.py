import os
import sys
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import DATA_QUALITY_LOG, INDIAN_STATES, MAX_SANCTIONED_AMOUNT

logger = logging.getLogger("DataValidator")

class CriticalValidationError(Exception):
    """Exception raised when critical data validation checks fail."""
    pass

def validate_data(df: pd.DataFrame, baseline_df: pd.DataFrame = None) -> dict:
    """
    Executes complete data quality and schema validation checks on DataFrame.
    Returns structured data quality report dictionary.
    """
    logger.info("Executing Data Validation Suite...")
    warnings = []
    validation_passed = True
    
    # 1. Required Columns Check
    required_cols = [
        'approval_id', 'amount_sanctioned', 'amount_spent',
        'approval_date', 'completion_date', 'location',
        'state', 'contractor', 'category'
    ]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        msg = f"Critical Failure: Missing required columns: {missing_cols}"
        logger.error(msg)
        raise CriticalValidationError(msg)

    # 2. Date Range Validation (approval_date <= completion_date)
    df_approval = pd.to_datetime(df['approval_date'], errors='coerce')
    df_completion = pd.to_datetime(df['completion_date'], errors='coerce')
    
    invalid_dates = df[df_approval > df_completion]
    if len(invalid_dates) > 0:
        warning_msg = f"{len(invalid_dates)} records have approval_date after completion_date."
        logger.warning(warning_msg)
        warnings.append(warning_msg)

    # 3. Amount Range Validation (sanctioned > 0, spent >= 0)
    invalid_sanctioned = df[df['amount_sanctioned'] <= 0]
    if len(invalid_sanctioned) > 0:
        warning_msg = f"{len(invalid_sanctioned)} records have amount_sanctioned <= 0."
        logger.warning(warning_msg)
        warnings.append(warning_msg)

    invalid_spent = df[df['amount_spent'] < 0]
    if len(invalid_spent) > 0:
        msg = f"Critical Failure: {len(invalid_spent)} records have negative amount_spent."
        logger.error(msg)
        raise CriticalValidationError(msg)

    # 4. Outlier Detection using Interquartile Range (IQR) Method
    outlier_counts = 0
    for col in ['amount_sanctioned', 'amount_spent']:
        if col in df.columns:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
            outlier_counts += len(outliers)
            if len(outliers) > 0:
                warnings.append(f"IQR outlier check for {col}: found {len(outliers)} outliers outside range [{lower_bound:.2f}, {upper_bound:.2f}].")

    # 5. Geographic Codes Check (State & District validation)
    unrecognized_states = df[~df['state'].isin(INDIAN_STATES)]['state'].unique()
    if len(unrecognized_states) > 0:
        warning_msg = f"Unrecognized Indian states detected: {list(unrecognized_states)}"
        logger.warning(warning_msg)
        warnings.append(warning_msg)

    # 6. Data Drift Check (compare current vs baseline if provided)
    if baseline_df is not None and not baseline_df.empty:
        curr_mean = df['amount_sanctioned'].mean()
        base_mean = baseline_df['amount_sanctioned'].mean()
        drift_pct = abs(curr_mean - base_mean) / (base_mean + 1e-6) * 100
        if drift_pct > 25.0:
            warning_msg = f"Data Drift Alert: Mean sanctioned amount changed by {drift_pct:.2f}% relative to baseline."
            logger.warning(warning_msg)
            warnings.append(warning_msg)

    # 7. Null & Duplicate Audits
    null_counts = df[required_cols].isnull().sum().to_dict()
    duplicates_count = df.duplicated(subset=['approval_id', 'contractor', 'location']).sum()

    report = {
        "total_records": int(len(df)),
        "null_counts": {k: int(v) for k, v in null_counts.items()},
        "duplicate_counts": int(duplicates_count),
        "outlier_counts": int(outlier_counts),
        "validation_passed": True,
        "warnings": warnings,
        "timestamp": datetime.now().isoformat()
    }

    logger.info(f"Data Validation Complete. Passed: {report['validation_passed']} with {len(warnings)} warnings.")
    return report

if __name__ == '__main__':
    from src.config import CLEANED_DATA_PATH
    if CLEANED_DATA_PATH.exists():
        df_cleaned = pd.read_csv(CLEANED_DATA_PATH, low_memory=False)
        report = validate_data(df_cleaned)
        print(report)
    else:
        logger.warning("Cleaned data path not found for standalone validation execution.")


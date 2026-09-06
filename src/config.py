import os
from pathlib import Path

# Project Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
LOGS_DIR = BASE_DIR / "logs"

# Ensure directories exist
for path in [
    DATA_DIR / "raw", 
    DATA_DIR / "processed", 
    DATA_DIR / "features", 
    DATA_DIR / "results", 
    MODELS_DIR, 
    LOGS_DIR
]:
    path.mkdir(parents=True, exist_ok=True)

# 28 States & Recognized UTs of India
INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 
    'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    # Union Territories
    'Delhi', 'Jammu And Kashmir', 'Ladakh', 'Puducherry', 
    'Chandigarh', 'Andaman And Nicobar Islands', 
    'Dadra And Nagar Haveli And Daman And Diu', 'The Dadra And Nagar Haveli And Daman And Diu',
    'Lakshadweep', 'Central'
]

# Work Categories
PROJECT_CATEGORIES = [
    'Health', 'Education', 'Road Infrastructure', 'Water Supply',
    'Sanitation', 'Electricity', 'Community Hall', 'Market'
]

# Data Validation Thresholds
MAX_SANCTIONED_AMOUNT = 50000000.0  # 5 Crore INR limit per project in general context
ANOMALY_THRESHOLD = 0.70
FRAUD_THRESHOLD = 0.65

# Risk Score Bands
RISK_LOW_MAX = 40.0
RISK_MEDIUM_MAX = 60.0
RISK_HIGH_MAX = 80.0

# Cache TTL settings
ANALYZE_CACHE_TTL = 86400  # 24 hours
DASHBOARD_CACHE_TTL = 3600  # 1 hour

# File Paths
RAW_DATA_PATH = DATA_DIR / "raw" / "mplads_data.csv"
LOK_SABHA_DIR = DATA_DIR / "raw" / "lok_sabha"
RAJYA_SABHA_DIR = DATA_DIR / "raw" / "rajya_sabha"

CLEANED_DATA_PATH = DATA_DIR / "processed" / "mplads_cleaned.csv"
FEATURE_DATA_PATH = DATA_DIR / "features" / "engineered_features.csv"
FEATURE_METADATA_PATH = DATA_DIR / "features" / "feature_metadata.json"
DATA_QUALITY_LOG = LOGS_DIR / "data_quality.log"

RISK_REPORTS_PARQUET = DATA_DIR / "results" / "risk_reports.parquet"
RISK_REPORTS_CSV = DATA_DIR / "results" / "risk_reports.csv"

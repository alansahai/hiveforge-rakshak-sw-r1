import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.pipeline.feature_engineer import engineer_features
from src.pipeline.data_validator import validate_data

class TestDataPipeline(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        n = 50
        dates = [datetime(2022, 1, 1) + timedelta(days=i) for i in range(n)]
        self.sample_df = pd.DataFrame({
            'project_id': [f'PROJ-{i:04d}' for i in range(n)],
            'approval_id': [f'APP-{i:04d}' for i in range(n)],
            'state': ['Maharashtra'] * n,
            'district': ['District-1'] * n,
            'category': ['Health'] * n,
            'amount_sanctioned': np.random.uniform(1000000, 5000000, n),
            'amount_spent': np.random.uniform(900000, 4800000, n),
            'approval_date': dates,
            'completion_date': [d + timedelta(days=180) for d in dates],
            'location': ['Location-A'] * n,
            'contractor': ['Contractor-1'] * n,
            'progress_percentage': np.random.uniform(50, 100, n)
        })

    def test_data_validation(self):
        report = validate_data(self.sample_df)
        self.assertTrue(report['validation_passed'])
        self.assertEqual(report['total_records'], 50)

    def test_feature_engineering_count(self):
        feats = engineer_features(self.sample_df)
        # Verify 50+ features generated
        self.assertGreaterEqual(feats.shape[1], 50)

if __name__ == '__main__':
    unittest.main()


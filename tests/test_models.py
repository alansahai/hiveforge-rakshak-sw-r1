import unittest
import pandas as pd
import numpy as np
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.models.anomaly_detector import train_anomaly_detector
from src.models.fraud_classifier import train_fraud_classifier
from src.models.efficiency_analyzer import train_efficiency_analyzer
from src.models.ensemble import MPLADSEnsembleScorer

class TestModels(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        n = 30
        self.df_feats = pd.DataFrame({
            'project_id': [f'PROJ-{i:04d}' for i in range(n)],
            'amount_sanctioned': np.random.uniform(0.1, 1.0, n),
            'amount_spent': np.random.uniform(0.1, 1.0, n),
            'cost_deviation_pct': np.random.uniform(-10, 50, n),
            'days_behind_schedule': np.random.uniform(0, 100, n),
            'cost_round_number_flag': np.random.choice([0, 1], n),
            'audit_trigger_score': np.random.choice([0, 1], n),
            'project_duration_days': np.random.uniform(60, 400, n),
            'planned_duration_days': np.random.uniform(60, 400, n),
            'progress_percentage': np.random.uniform(50, 100, n)
        })

    def test_model_training_and_inference(self):
        tmp_dir = Path(__file__).resolve().parent / "tmp_models"
        tmp_dir.mkdir(exist_ok=True)
        
        train_anomaly_detector(self.df_feats, tmp_dir)
        train_fraud_classifier(self.df_feats, tmp_dir)
        train_efficiency_analyzer(self.df_feats, tmp_dir)
        
        scorer = MPLADSEnsembleScorer(tmp_dir)
        preds = scorer.predict_risk(self.df_feats)
        self.assertEqual(len(preds), 30)
        self.assertIn('ensemble_risk_score', preds.columns)

if __name__ == '__main__':
    unittest.main()


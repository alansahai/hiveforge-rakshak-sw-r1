import logging
import pandas as pd

logger = logging.getLogger("RuleExtractor")

def extract_human_rules(project_row: pd.Series) -> list:
    """
    Extracts transparent human-readable audit rules explaining why a project was flagged.
    """
    rules = []
    
    if project_row.get('cost_deviation_pct', 0) > 20:
        rules.append(f"Cost inflation detected: Spend exceeds sanctioned amount by {project_row.get('cost_deviation_pct', 0):.1f}%.")
        
    if project_row.get('cost_round_number_flag', 0) == 1:
        rules.append("Suspicious financial figure: Sanctioned amount ends in exact trailing zeros (round number).")
        
    if project_row.get('days_behind_schedule', 0) > 45:
        rules.append(f"Severe schedule delay: Project is {project_row.get('days_behind_schedule', 0):.0f} days behind schedule.")
        
    if project_row.get('geo_duplicate_flag', 0) == 1 or project_row.get('cross_district_duplicate_flag', 0) == 1:
        rules.append("Cross-Boundary Duplicate Alert: Similar work and budget detected across adjacent administrative district.")
    elif project_row.get('location_duplicate_flag', 0) == 1 or project_row.get('duplicate_work_score', 0) > 0.7:
        rules.append("Same-District Duplicate Alert: Multiple projects detected at identical location and budget.")
        
    if project_row.get('ghost_project_indicator', 0) == 1:
        rules.append("Ghost Project Risk: Funds approved >90 days ago with zero recorded ground progress or spend.")
        
    if not rules:
        rules.append("Project conforms to baseline implementation parameters.")
        
    return rules


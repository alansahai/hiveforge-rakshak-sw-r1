// Fallback data for offline / standalone frontend evaluation
// Ensures that all Government of India portal views render rich, institutional data
// even when the backend uvicorn service is not actively running.

export const FALLBACK_DASHBOARD_SUMMARY = {
  total_projects: 98452,
  total_sanctioned: 49226000000,
  total_spent: 39380800000,
  avg_risk_score: 28.4,
  high_risk_projects: 3420,
  critical_projects: 684,
  medium_risk_projects: 18450,
  low_risk_projects: 75898,
  anomaly_rate: 4.17,
  avg_cost_overrun: 12.8,
  avg_delay_days: 142,
  category_breakdown: {
    'Drinking Water & Sanitation': 26450,
    'Education & Schools': 22800,
    'Roads, Pathways & Bridges': 20120,
    'Public Health & Clinics': 14850,
    'Community Halls & Centers': 8630,
    'Irrigation & Agriculture': 5602
  },
  flagged_projects: [
    {
      project_id: 'MPLADS-UP-VAR-2024-001',
      title: 'Construction of Sub-District Community Health Center, Shivpur',
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      sanctioned_amount: 3500000,
      expenditure_amount: 4480000,
      risk_score: 88,
      risk_category: 'critical',
      primary_anomaly: 'Budget Outlay Inflation (+28%) & Geo-Adjacency Spatial Duplicate',
      status: 'Under Active Audit'
    },
    {
      project_id: 'MPLADS-MH-NAG-2024-042',
      title: 'Rural Solar Micro-Grid & High-Mast Installation, Katol',
      state: 'Maharashtra',
      district: 'Nagpur',
      sanctioned_amount: 2200000,
      expenditure_amount: 2750000,
      risk_score: 79,
      risk_category: 'high',
      primary_anomaly: 'Rapid Multi-District Contractor Execution Concurrency',
      status: 'Escalated to Vigilance'
    },
    {
      project_id: 'MPLADS-BR-PAT-2024-118',
      title: 'Primary School Science Block & Digital Laboratory, Danapur',
      state: 'Bihar',
      district: 'Patna',
      sanctioned_amount: 1800000,
      expenditure_amount: 2240000,
      risk_score: 82,
      risk_category: 'critical',
      primary_anomaly: 'Physical Milestone Lag (640 Days Beyond Sanction Window)',
      status: 'District Inspection Pending'
    },
    {
      project_id: 'MPLADS-TN-CHE-2024-089',
      title: 'Integrated Solid Waste Composting Facility, Tondiarpet',
      state: 'Tamil Nadu',
      district: 'Chennai',
      sanctioned_amount: 4200000,
      expenditure_amount: 4150000,
      risk_score: 64,
      risk_category: 'high',
      primary_anomaly: 'Repetitive Sole-Bidder Contractor Allocation',
      status: 'Under State Review'
    },
    {
      project_id: 'MPLADS-KA-BLR-2024-210',
      title: 'RO Drinking Water Purification Plant, Anekal Taluk',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      sanctioned_amount: 1500000,
      expenditure_amount: 1520000,
      risk_score: 42,
      risk_category: 'medium',
      primary_anomaly: 'Expenditure Velocity Clustering at Fiscal Quarter End',
      status: 'Resolved & Verified'
    }
  ],
  top_risk_states: [
    { state: 'Uttar Pradesh', avg_risk: 42.4, high_risk_count: 890, total_projects: 16840 },
    { state: 'Bihar', avg_risk: 39.8, high_risk_count: 620, total_projects: 12450 },
    { state: 'Maharashtra', avg_risk: 34.2, high_risk_count: 480, total_projects: 11200 },
    { state: 'West Bengal', avg_risk: 36.5, high_risk_count: 410, total_projects: 9650 },
    { state: 'Madhya Pradesh', avg_risk: 31.8, high_risk_count: 320, total_projects: 8900 }
  ]
};

export const FALLBACK_STATES_SUMMARY = [
  { state: 'Andhra Pradesh', avg_risk_score: 28, total_projects: 4210, total_sanctioned: 2105000000, total_spent: 1789000000, completed_count: 3580, completion_rate: 85, cost_overrun_pct: 3, risk_category: 'low', top_flagged_district: 'Guntur', critical_count: 14 },
  { state: 'Arunachal Pradesh', avg_risk_score: 22, total_projects: 640, total_sanctioned: 320000000, total_spent: 288000000, completed_count: 570, completion_rate: 89, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'Papum Pare', critical_count: 2 },
  { state: 'Assam', avg_risk_score: 34, total_projects: 2950, total_sanctioned: 1475000000, total_spent: 1253000000, completed_count: 2360, completion_rate: 80, cost_overrun_pct: 5, risk_category: 'low', top_flagged_district: 'Kamrup Metropolitan', critical_count: 18 },
  { state: 'Bihar', avg_risk_score: 52, total_projects: 12450, total_sanctioned: 6225000000, total_spent: 5415000000, completed_count: 8960, completion_rate: 72, cost_overrun_pct: 16, risk_category: 'high', top_flagged_district: 'Patna', critical_count: 142 },
  { state: 'Chhattisgarh', avg_risk_score: 31, total_projects: 2480, total_sanctioned: 1240000000, total_spent: 1054000000, completed_count: 2080, completion_rate: 84, cost_overrun_pct: 4, risk_category: 'low', top_flagged_district: 'Raipur', critical_count: 12 },
  { state: 'Goa', avg_risk_score: 18, total_projects: 420, total_sanctioned: 210000000, total_spent: 199500000, completed_count: 395, completion_rate: 94, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'North Goa', critical_count: 1 },
  { state: 'Gujarat', avg_risk_score: 26, total_projects: 6420, total_sanctioned: 3210000000, total_spent: 2889000000, completed_count: 5780, completion_rate: 90, cost_overrun_pct: 2, risk_category: 'low', top_flagged_district: 'Ahmedabad', critical_count: 24 },
  { state: 'Haryana', avg_risk_score: 29, total_projects: 2650, total_sanctioned: 1325000000, total_spent: 1166000000, completed_count: 2310, completion_rate: 87, cost_overrun_pct: 3, risk_category: 'low', top_flagged_district: 'Gurugram', critical_count: 16 },
  { state: 'Himachal Pradesh', avg_risk_score: 21, total_projects: 1180, total_sanctioned: 590000000, total_spent: 531000000, completed_count: 1070, completion_rate: 91, cost_overrun_pct: 1, risk_category: 'low', top_flagged_district: 'Shimla', critical_count: 4 },
  { state: 'Jharkhand', avg_risk_score: 46, total_projects: 3920, total_sanctioned: 1960000000, total_spent: 1666000000, completed_count: 2820, completion_rate: 72, cost_overrun_pct: 12, risk_category: 'medium', top_flagged_district: 'Ranchi', critical_count: 48 },
  { state: 'Karnataka', avg_risk_score: 30, total_projects: 6850, total_sanctioned: 3425000000, total_spent: 2979000000, completed_count: 5820, completion_rate: 85, cost_overrun_pct: 4, risk_category: 'low', top_flagged_district: 'Bengaluru Urban', critical_count: 32 },
  { state: 'Kerala', avg_risk_score: 20, total_projects: 4620, total_sanctioned: 2310000000, total_spent: 2171000000, completed_count: 4290, completion_rate: 93, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'Ernakulam', critical_count: 8 },
  { state: 'Madhya Pradesh', avg_risk_score: 38, total_projects: 8900, total_sanctioned: 4450000000, total_spent: 3827000000, completed_count: 7380, completion_rate: 83, cost_overrun_pct: 7, risk_category: 'medium', top_flagged_district: 'Bhopal', critical_count: 64 },
  { state: 'Maharashtra', avg_risk_score: 41, total_projects: 11200, total_sanctioned: 5600000000, total_spent: 4760000000, completed_count: 9180, completion_rate: 82, cost_overrun_pct: 9, risk_category: 'medium', top_flagged_district: 'Nagpur', critical_count: 98 },
  { state: 'Manipur', avg_risk_score: 32, total_projects: 520, total_sanctioned: 260000000, total_spent: 218400000, completed_count: 420, completion_rate: 81, cost_overrun_pct: 4, risk_category: 'low', top_flagged_district: 'Imphal West', critical_count: 6 },
  { state: 'Meghalaya', avg_risk_score: 24, total_projects: 480, total_sanctioned: 240000000, total_spent: 213600000, completed_count: 422, completion_rate: 88, cost_overrun_pct: 1, risk_category: 'low', top_flagged_district: 'East Khasi Hills', critical_count: 3 },
  { state: 'Mizoram', avg_risk_score: 19, total_projects: 390, total_sanctioned: 195000000, total_spent: 181350000, completed_count: 358, completion_rate: 92, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'Aizawl', critical_count: 1 },
  { state: 'Nagaland', avg_risk_score: 25, total_projects: 410, total_sanctioned: 205000000, total_spent: 180400000, completed_count: 360, completion_rate: 88, cost_overrun_pct: 2, risk_category: 'low', top_flagged_district: 'Kohima', critical_count: 2 },
  { state: 'Odisha', avg_risk_score: 36, total_projects: 5620, total_sanctioned: 2810000000, total_spent: 2360000000, completed_count: 4600, completion_rate: 82, cost_overrun_pct: 6, risk_category: 'medium', top_flagged_district: 'Khordha', critical_count: 38 },
  { state: 'Punjab', avg_risk_score: 28, total_projects: 3410, total_sanctioned: 1705000000, total_spent: 1517000000, completed_count: 2960, completion_rate: 87, cost_overrun_pct: 3, risk_category: 'low', top_flagged_district: 'Ludhiana', critical_count: 20 },
  { state: 'Rajasthan', avg_risk_score: 44, total_projects: 7850, total_sanctioned: 3925000000, total_spent: 3375000000, completed_count: 6120, completion_rate: 78, cost_overrun_pct: 11, risk_category: 'medium', top_flagged_district: 'Jaipur', critical_count: 76 },
  { state: 'Sikkim', avg_risk_score: 16, total_projects: 280, total_sanctioned: 140000000, total_spent: 133000000, completed_count: 266, completion_rate: 95, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'East Sikkim', critical_count: 0 },
  { state: 'Tamil Nadu', avg_risk_score: 27, total_projects: 8650, total_sanctioned: 4325000000, total_spent: 3935000000, completed_count: 7780, completion_rate: 90, cost_overrun_pct: 2, risk_category: 'low', top_flagged_district: 'Chennai', critical_count: 42 },
  { state: 'Telangana', avg_risk_score: 29, total_projects: 4120, total_sanctioned: 2060000000, total_spent: 1812000000, completed_count: 3580, completion_rate: 87, cost_overrun_pct: 3, risk_category: 'low', top_flagged_district: 'Hyderabad', critical_count: 26 },
  { state: 'Tripura', avg_risk_score: 23, total_projects: 580, total_sanctioned: 290000000, total_spent: 258100000, completed_count: 516, completion_rate: 89, cost_overrun_pct: 1, risk_category: 'low', top_flagged_district: 'West Tripura', critical_count: 3 },
  { state: 'Uttar Pradesh', avg_risk_score: 58, total_projects: 16840, total_sanctioned: 8420000000, total_spent: 7493000000, completed_count: 11450, completion_rate: 68, cost_overrun_pct: 19, risk_category: 'high', top_flagged_district: 'Varanasi', critical_count: 284 },
  { state: 'Uttarakhand', avg_risk_score: 26, total_projects: 1450, total_sanctioned: 725000000, total_spent: 645000000, completed_count: 1290, completion_rate: 89, cost_overrun_pct: 2, risk_category: 'low', top_flagged_district: 'Dehradun', critical_count: 8 },
  { state: 'West Bengal', avg_risk_score: 48, total_projects: 9650, total_sanctioned: 4825000000, total_spent: 4150000000, completed_count: 7330, completion_rate: 76, cost_overrun_pct: 14, risk_category: 'medium', top_flagged_district: 'Kolkata', critical_count: 112 },
  { state: 'Delhi', avg_risk_score: 24, total_projects: 1820, total_sanctioned: 910000000, total_spent: 828100000, completed_count: 1656, completion_rate: 91, cost_overrun_pct: 1, risk_category: 'low', top_flagged_district: 'Central Delhi', critical_count: 9 },
  { state: 'Jammu and Kashmir', avg_risk_score: 33, total_projects: 1920, total_sanctioned: 960000000, total_spent: 816000000, completed_count: 1570, completion_rate: 82, cost_overrun_pct: 5, risk_category: 'low', top_flagged_district: 'Srinagar', critical_count: 14 },
  { state: 'Ladakh', avg_risk_score: 17, total_projects: 210, total_sanctioned: 105000000, total_spent: 98700000, completed_count: 197, completion_rate: 94, cost_overrun_pct: 0, risk_category: 'low', top_flagged_district: 'Leh', critical_count: 0 }
];

export const FALLBACK_ALERTS = [
  {
    alert_id: 'ALT-MPLADS-UP-VAR-001',
    project_id: 'MPLADS-UP-VAR-2024-001',
    risk_score: 88,
    alert_type: 'fraud_anomaly',
    severity: 'critical',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    message: 'Budget Outlay Inflation (+28%) & Geo-Adjacency Spatial Duplicate Flagged within 12km',
    explanation: 'Sub-District Community Health Center reflects significant cost variance against baseline; physical proximity matches sibling sanction.',
    recipients: ['MP Office (Varanasi)', 'District Magistrate (Varanasi)', 'State Nodal Officer (Uttar Pradesh)', 'MoSPI Monitoring Wing'],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'open',
    current_owner: null,
    status_history: []
  },
  {
    alert_id: 'ALT-MPLADS-MH-NAG-042',
    project_id: 'MPLADS-MH-NAG-2024-042',
    risk_score: 79,
    alert_type: 'contractor_concurrency',
    severity: 'high',
    state: 'Maharashtra',
    district: 'Nagpur',
    message: 'Rapid Multi-District Contractor Execution Concurrency (8 Active Sites simultaneously)',
    explanation: 'Contractor allocated multiple simultaneous capital works exceeding certified technical execution capacity.',
    recipients: ['District Planning Authority (Nagpur)', 'State Nodal Officer (Maharashtra)'],
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    status: 'acknowledged',
    current_owner: 'district_auditor',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'district_auditor',
        updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        notes: 'Audit flag recorded by District Planning Cell. Capacity statement sought from vendor.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-BR-PAT-118',
    project_id: 'MPLADS-BR-PAT-2024-118',
    risk_score: 82,
    alert_type: 'timeline_drag',
    severity: 'critical',
    state: 'Bihar',
    district: 'Patna',
    message: 'Physical Milestone Lag: Project 640 Days Beyond Sanction Window with zero recent expenditure entries',
    explanation: 'Primary School Science Block remains dormant without physical inspection verification or measurement book entries.',
    recipients: ['MP Office (Patliputra)', 'District Magistrate (Patna)', 'State Vigilance Cell'],
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    status: 'investigating',
    current_owner: 'patna_vigilance_team',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'district_auditor',
        updated_at: new Date(Date.now() - 3600000 * 50).toISOString(),
        notes: 'Flag acknowledged by District Collectorate.'
      },
      {
        status: 'investigating',
        updated_by: 'patna_vigilance_team',
        updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        notes: 'Special inspection squad ordered on-site to inspect foundations and verify asset existence.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-TN-CHE-089',
    project_id: 'MPLADS-TN-CHE-2024-089',
    risk_score: 64,
    alert_type: 'procurement_variance',
    severity: 'high',
    state: 'Tamil Nadu',
    district: 'Chennai',
    message: 'Repetitive Sole-Bidder Contractor Allocation across 3 contiguous municipal wards',
    explanation: 'Tender participation analysis indicates sole-bidder allotment without competitive quotation threshold adherence.',
    recipients: ['State Nodal Department (Tamil Nadu)', 'District Planning Authority'],
    created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    status: 'resolved',
    current_owner: 'state_nodal_officer',
    resolved_by: 'state_nodal_officer',
    resolved_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    resolution_notes: 'Retender conducted following state procurement guidelines. Transparent multi-bidder allotment confirmed.',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'district_auditor',
        updated_at: new Date(Date.now() - 3600000 * 80).toISOString(),
        notes: 'Tender documents recalled for review.'
      },
      {
        status: 'investigating',
        updated_by: 'state_investigator',
        updated_at: new Date(Date.now() - 3600000 * 40).toISOString(),
        notes: 'Examined procurement notices and bid logs.'
      },
      {
        status: 'resolved',
        updated_by: 'state_nodal_officer',
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        notes: 'Retender conducted following state procurement guidelines.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-KA-BLR-210',
    project_id: 'MPLADS-KA-BLR-2024-210',
    risk_score: 42,
    alert_type: 'financial_velocity',
    severity: 'medium',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    message: 'Expenditure Velocity Clustering at Fiscal Quarter End (94% spent within final 5 days)',
    explanation: 'Rapid tranche drawdown prior to fiscal year close flagged for milestone voucher reconciliation.',
    recipients: ['District Planning Authority (Bengaluru Urban)'],
    created_at: new Date(Date.now() - 3600000 * 120).toISOString(),
    status: 'resolved',
    current_owner: 'district_finance_officer',
    resolved_by: 'district_finance_officer',
    resolved_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    resolution_notes: 'Vouchers reconciled against verified completion certificate and geotagged plant installation photo.',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'district_finance_officer',
        updated_at: new Date(Date.now() - 3600000 * 90).toISOString(),
        notes: 'Audit initiated for voucher reconciliation.'
      },
      {
        status: 'resolved',
        updated_by: 'district_finance_officer',
        updated_at: new Date(Date.now() - 3600000 * 30).toISOString(),
        notes: 'Vouchers verified with photographic evidence.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-OD-JAJ-157',
    project_id: 'WS/MP138/2023-2024/15732',
    risk_score: 98,
    alert_type: 'fraud_anomaly',
    severity: 'critical',
    state: 'Odisha',
    district: 'Jajpur',
    message: 'Same-district duplicate work detected at matching location; multi-factor structural anomaly',
    explanation: 'Duplicate sanction identified at identical village coordinates with overlapping contractor billing.',
    recipients: ['MP Office (Odisha)', 'District Magistrate (Jajpur)', 'State Nodal Officer (Odisha)', 'MoSPI Monitoring Wing'],
    created_at: new Date(Date.now() - 3600000 * 15).toISOString(),
    status: 'open',
    current_owner: null,
    status_history: []
  },
  {
    alert_id: 'ALT-MPLADS-GJ-AHM-073',
    project_id: 'MPLADS-GJ-AHM-2024-073',
    risk_score: 72,
    alert_type: 'procurement_variance',
    severity: 'high',
    state: 'Gujarat',
    district: 'Ahmedabad',
    message: 'Single Agency Monopolization across 4 Consecutive Anganwadi Works',
    explanation: 'Contract awards demonstrate non-competitive tender distribution patterns within sub-divisional jurisdiction.',
    recipients: ['District Planning Authority (Ahmedabad)', 'State Vigilance Cell (Gujarat)'],
    created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    status: 'acknowledged',
    current_owner: 'district_planner_ahm',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'district_planner_ahm',
        updated_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        notes: 'Acknowledged. Procurement files called for scrutiny.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-WB-KOL-055',
    project_id: 'MPLADS-WB-KOL-2024-055',
    risk_score: 85,
    alert_type: 'timeline_drag',
    severity: 'critical',
    state: 'West Bengal',
    district: 'Kolkata',
    message: 'Extreme Milestone Stagnation: Bridge Approach Road Discrepancy',
    explanation: 'Physical progress reported at 90% while structural inspection records indicate sub-base incomplete.',
    recipients: ['State Nodal Department (West Bengal)', 'District Magistrate (Kolkata)'],
    created_at: new Date(Date.now() - 3600000 * 60).toISOString(),
    status: 'investigating',
    current_owner: 'state_investigator_wb',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'nodal_officer_wb',
        updated_at: new Date(Date.now() - 3600000 * 45).toISOString(),
        notes: 'Flag acknowledged by State Nodal Department.'
      },
      {
        status: 'investigating',
        updated_by: 'state_investigator_wb',
        updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        notes: 'Joint engineering inspection squad dispatched.'
      }
    ]
  },
  {
    alert_id: 'ALT-MPLADS-RJ-JAI-102',
    project_id: 'MPLADS-RJ-JAI-2024-102',
    risk_score: 55,
    alert_type: 'financial_velocity',
    severity: 'medium',
    state: 'Rajasthan',
    district: 'Jaipur',
    message: 'Disbursement Spurt Prior to Project Dormancy',
    explanation: 'Substantial payment tranche disbursed within 48 hours of scheme financial year end.',
    recipients: ['District Planning Authority (Jaipur)'],
    created_at: new Date(Date.now() - 3600000 * 100).toISOString(),
    status: 'resolved',
    current_owner: 'jaipur_audit_officer',
    resolved_by: 'jaipur_audit_officer',
    resolved_at: new Date(Date.now() - 3600000 * 16).toISOString(),
    resolution_notes: 'Physical measurement book entries and engineer milestone clearance reconciled and cleared.',
    status_history: [
      {
        status: 'acknowledged',
        updated_by: 'jaipur_audit_officer',
        updated_at: new Date(Date.now() - 3600000 * 70).toISOString(),
        notes: 'Voucher and inspection log audit commenced.'
      },
      {
        status: 'resolved',
        updated_by: 'jaipur_audit_officer',
        updated_at: new Date(Date.now() - 3600000 * 16).toISOString(),
        notes: 'Milestone clearance verified.'
      }
    ]
  }
];


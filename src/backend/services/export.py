import io
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd

logger = logging.getLogger("ExportService")

def generate_csv_export(projects_df: pd.DataFrame, filters: Optional[dict] = None) -> bytes:
    """Exports filtered project records to CSV bytes."""
    df_export = projects_df.copy()
    if filters:
        if filters.get('state'):
            df_export = df_export[df_export['state'].astype(str).str.lower() == filters['state'].lower()]
        if filters.get('risk_category'):
            df_export = df_export[df_export['risk_category'].astype(str).str.lower() == filters['risk_category'].lower()]
        if filters.get('category'):
            df_export = df_export[df_export['category'].astype(str).str.lower() == filters['category'].lower()]
            
    limit = filters.get('limit', 100) if filters else 100
    df_export = df_export.head(limit)
    
    output = io.StringIO()
    df_export.to_csv(output, index=False)
    return output.getvalue().encode('utf-8')

def generate_pdf_report(projects_df: pd.DataFrame, filters: Optional[dict] = None) -> bytes:
    """Generates a professional compliance PDF report using ReportLab."""
    df_export = projects_df.copy()
    if filters:
        if filters.get('state'):
            df_export = df_export[df_export['state'].astype(str).str.lower() == filters['state'].lower()]
        if filters.get('risk_category'):
            df_export = df_export[df_export['risk_category'].astype(str).str.lower() == filters['risk_category'].lower()]
        if filters.get('category'):
            df_export = df_export[df_export['category'].astype(str).str.lower() == filters['category'].lower()]
            
    limit = min(filters.get('limit', 50) if filters else 50, 100)
    df_export = df_export.head(limit)
    
    buffer = io.BytesIO()
    
    try:
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=landscape(letter),
            rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20
        )
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1E3A8A'),
            spaceAfter=10
        )
        elements.append(Paragraph("MPLADS AI Monitoring & Compliance Audit Report", title_style))
        
        sub_text = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Total Projects Audited: {len(df_export)}"
        if filters and filters.get('state'):
            sub_text += f" | State: {filters['state']}"
        elements.append(Paragraph(sub_text, styles['Normal']))
        elements.append(Spacer(1, 15))
        
        # Table data
        headers = ['Project ID', 'State', 'District', 'Category', 'Sanctioned (₹)', 'Spent (₹)', 'Risk Score', 'Category', 'Status']
        table_data = [headers]
        
        for _, row in df_export.iterrows():
            table_data.append([
                str(row.get('project_id', ''))[:18],
                str(row.get('state', ''))[:14],
                str(row.get('district', ''))[:14],
                str(row.get('category', ''))[:14],
                f"{float(row.get('amount_sanctioned', 0)):,.0f}",
                f"{float(row.get('amount_spent', 0)):,.0f}",
                f"{float(row.get('risk_score', 0)):.0f}",
                str(row.get('risk_category', 'low')).upper(),
                str(row.get('house', 'Lok Sabha'))[:10]
            ])
            
        col_widths = [110, 75, 75, 80, 80, 80, 60, 60, 60]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (4, 1), (5, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
        ]))
        
        elements.append(table)
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"ReportLab PDF generation failed: {str(e)}. Generating simple text fallback...")
        fallback_text = f"MPLADS Compliance Report\nGenerated: {datetime.now()}\n\n"
        fallback_text += df_export[['project_id', 'state', 'category', 'risk_score']].to_string()
        return fallback_text.encode('utf-8')

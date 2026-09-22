import React, { createContext, useContext, useState, useEffect } from 'react';

export const LanguageContext = createContext();

export const translations = {
  en: {
    // Header & Meta
    gov_title: 'Government of India',
    mospi_name: 'Ministry of Statistics & Programme Implementation',
    portal_title: 'MPLADS Project Monitoring System',
    portal_tagline: 'Public Transparency & Infrastructure Assurance Platform',
    sign_in: 'Officer Login',
    sign_out: 'Sign Out',
    dashboard: 'Administrative Dashboard',
    back_to_portal: 'Public Portal',
    
    // Accessibility & Tools
    skip_to_content: 'Skip to Main Content',
    text_size: 'Text Size',
    high_contrast: 'High Contrast',
    normal_contrast: 'Standard View',
    search: 'Search',
    
    // Navigation
    nav_overview: 'National Overview',
    nav_mp: 'MP Constituency',
    nav_state: 'State Authority',
    nav_district: 'District Authority',
    nav_ministry: 'MoSPI Ministry',
    nav_studio: 'Analytics Studio',
    nav_risk_analyzer: 'Project Risk Analyzer',
    nav_alerts: 'Alerts & Audit Flags',
    
    // Hero Section (Clean Public Sector)
    hero_title: 'MPLADS Infrastructure Works Surveillance & Expenditure Ledger',
    hero_subtitle: 'Comprehensive monitoring portal tracking statutory compliance, physical milestone progress, and financial accountability across Parliamentary constituencies nationwide.',
    hero_stat_projects: 'Total Works Sanctioned',
    hero_stat_expenditure: 'Cumulative Expenditure',
    hero_stat_completion: 'National Completion Rate',
    hero_stat_monitoring: 'Constituencies Tracked',
    
    // Search & Explorer
    search_placeholder: 'Search by Project ID, work description, MP name, or district…',
    filter_state: 'State / UT Jurisdiction',
    filter_all_states: 'All States & UTs',
    filter_category: 'Infrastructure Sector',
    filter_all_categories: 'All Sectors',
    filter_status: 'Implementation Status',
    filter_all_statuses: 'All Statuses',
    filter_risk: 'Appraisal Band',
    filter_all_risks: 'All Appraisal Bands',
    
    // Table Headers
    col_project_id: 'Project Identifier',
    col_work_desc: 'Work Description & Sector',
    col_location: 'Location & Constituency',
    col_mp: 'Recommending MP',
    col_sanctioned: 'Sanctioned Outlay',
    col_spent: 'Disbursed',
    col_progress: 'Physical Progress',
    col_status: 'Statutory Status',
    col_actions: 'Audit Inspection',
    
    // Buttons & Statuses
    btn_inspect: 'Inspect Ledger',
    btn_view_details: 'View Details',
    btn_filter_apply: 'Apply Filter',
    btn_reset: 'Reset Filters',
    btn_export: 'Export Data',
    
    // Risk & Diagnostic Wording
    risk_assessment_title: 'Project Risk Assessment Details & Diagnostic Signals',
    risk_factors_title: 'Reasoning Behind Risk Flags',
    risk_factors_sub: 'Transparent breakdown of administrative and progress factors influencing the appraisal score',
    risk_score_label: 'Risk Classification Score',
    risk_low: 'Low Risk',
    risk_medium: 'Medium Variance',
    risk_high: 'High Risk',
    risk_critical: 'Critical Anomaly',
    
    // Login
    login_heading: 'Officer & Administrative Sign-In',
    login_subheading: 'Access restricted to authorized MoSPI officers, State Nodal Officers, District Authorities, and Parliamentary Offices.',
    login_username: 'Username / Official ID',
    login_password: 'Password',
    login_role_select: 'Select Institutional Role',
    login_submit: 'Authenticate & Enter Portal',
    login_demo_hint: 'Demo Credentials for Evaluation:',
    login_error_msg: 'Invalid credentials. Please verify your official ID and password.',
    
    // Footer
    footer_disclaimer: 'This official prototype is developed for the Ministry of Statistics and Programme Implementation (MoSPI). All project records represent monitored MPLADS works.',
    footer_copyright: '© 2026 Ministry of Statistics and Programme Implementation, Government of India. All rights reserved.',
    footer_links_privacy: 'Privacy Policy',
    footer_links_terms: 'Terms of Use',
    footer_links_help: 'Support & Helpdesk',
    footer_links_contact: 'Contact MoSPI'
  },
  hi: {
    // Header & Meta
    gov_title: 'भारत सरकार',
    mospi_name: 'सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय',
    portal_title: 'सांसद स्थानीय क्षेत्र विकास योजना निगरानी प्रणाली',
    portal_tagline: 'सार्वजनिक पारदर्शिता एवं अवसंरचना निगरानी मंच',
    sign_in: 'अधिकारी लॉगिन',
    sign_out: 'लॉग आउट',
    dashboard: 'प्रशासनिक डैशबोर्ड',
    back_to_portal: 'सार्वजनिक पोर्टल',
    
    // Accessibility & Tools
    skip_to_content: 'मुख्य सामग्री पर जाएं',
    text_size: 'अक्षर आकार',
    high_contrast: 'उच्च कंट्रास्ट',
    normal_contrast: 'सामान्य दृश्य',
    search: 'खोजें',
    
    // Navigation
    nav_overview: 'राष्ट्रीय अवलोकन',
    nav_mp: 'सांसद संसदीय क्षेत्र',
    nav_state: 'राज्य नोडल प्राधिकरण',
    nav_district: 'जिला प्राधिकरण',
    nav_ministry: 'सांख्यिकी मंत्रालय (MoSPI)',
    nav_studio: 'विश्लेषण स्टूडियो',
    nav_risk_analyzer: 'परियोजना जोखिम विश्लेषक',
    nav_alerts: 'सतर्कता एवं ऑडिट सूचनाएं',
    
    // Hero Section
    hero_title: 'सांसद निधि अवसंरचना कार्य निगरानी एवं व्यय लेखा',
    hero_subtitle: 'देशभर के संसदीय क्षेत्रों में वैधानिक अनुपालन, भौतिक प्रगति और वित्तीय जवाबदेही की निगरानी हेतु आधिकारिक पोर्टल।',
    hero_stat_projects: 'स्वीकृत कुल कार्य',
    hero_stat_expenditure: 'संचयी कुल व्यय',
    hero_stat_completion: 'राष्ट्रीय पूर्णता दर',
    hero_stat_monitoring: 'ट्रैक किए गए संसदीय क्षेत्र',
    
    // Search & Explorer
    search_placeholder: 'परियोजना आईडी, कार्य विवरण, सांसद का नाम या जिला खोजें…',
    filter_state: 'राज्य / केंद्र शासित प्रदेश',
    filter_all_states: 'सभी राज्य एवं संघ राज्य क्षेत्र',
    filter_category: 'अवसंरचना क्षेत्र',
    filter_all_categories: 'सभी क्षेत्र',
    filter_status: 'कार्यान्वयन स्थिति',
    filter_all_statuses: 'सभी स्थितियां',
    filter_risk: 'मूल्यांकन श्रेणी',
    filter_all_risks: 'सभी मूल्यांकन श्रेणियां',
    
    // Table Headers
    col_project_id: 'परियोजना पहचानकर्ता',
    col_work_desc: 'कार्य विवरण एवं क्षेत्र',
    col_location: 'स्थान एवं संसदीय क्षेत्र',
    col_mp: 'अनुशंसाकर्ता सांसद',
    col_sanctioned: 'स्वीकृत राशि',
    col_spent: 'व्यय की गई राशि',
    col_progress: 'भौतिक प्रगति',
    col_status: 'वैधानिक स्थिति',
    col_actions: 'ऑडिट निरीक्षण',
    
    // Buttons & Statuses
    btn_inspect: 'लेखा निरीक्षण',
    btn_view_details: 'विवरण देखें',
    btn_filter_apply: 'फ़िल्टर लागू करें',
    btn_reset: 'फ़िल्टर हटाएं',
    btn_export: 'डेटा निर्यात करें',
    
    // Risk & Diagnostic Wording
    risk_assessment_title: 'परियोजना जोखिम मूल्यांकन विवरण एवं नैदानिक संकेत',
    risk_factors_title: 'जोखिम झंडों के पीछे का तर्क',
    risk_factors_sub: 'मूल्यांकन स्कोर को प्रभावित करने वाले प्रशासनिक और प्रगति कारकों का पारदर्शी विवरण',
    risk_score_label: 'जोखिम वर्गीकरण स्कोर',
    risk_low: 'निम्न जोखिम',
    risk_medium: 'मध्यम विचलन',
    risk_high: 'उच्च जोखिम',
    risk_critical: 'गंभीर विसंगति',
    
    // Login
    login_heading: 'अधिकारी एवं प्रशासनिक साइन-इन',
    login_subheading: 'प्रवेश केवल अधिकृत सांख्यिकी मंत्रालय, राज्य नोडल अधिकारी, जिला प्राधिकरण एवं संसदीय कार्यालयों के लिए सीमित है।',
    login_username: 'उपयोगकर्ता नाम / आधिकारिक आईडी',
    login_password: 'पासवर्ड',
    login_role_select: 'संस्थागत भूमिका चुनें',
    login_submit: 'सत्यापित करें एवं पोर्टल में प्रवेश करें',
    login_demo_hint: 'मूल्यांकन हेतु डेमो क्रेडेंशियल:',
    login_error_msg: 'अमान्य क्रेडेंशियल। कृपया अपनी आधिकारिक आईडी और पासवर्ड की पुनः जांच करें।',
    
    // Footer
    footer_disclaimer: 'यह आधिकारिक प्रोटोटाइप सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI) के लिए विकसित किया गया है। सभी रिकॉर्ड सांसद निधि कार्यों का प्रतिनिधित्व करते हैं।',
    footer_copyright: '© 2026 सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय, भारत सरकार। सर्वाधिकार सुरक्षित।',
    footer_links_privacy: 'गोपनीयता नीति',
    footer_links_terms: 'उपयोग की शर्तें',
    footer_links_help: 'सहायता एवं हेल्पलाइन',
    footer_links_contact: 'मंत्रालय से संपर्क करें'
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('mplads_lang') || 'en';
  });

  const setLanguage = (lang) => {
    const validLang = lang === 'hi' ? 'hi' : 'en';
    setLanguageState(validLang);
    localStorage.setItem('mplads_lang', validLang);
    document.documentElement.lang = validLang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    const langDict = translations[language] || translations.en;
    return langDict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key) => translations.en[key] || key,
    };
  }
  return context;
};

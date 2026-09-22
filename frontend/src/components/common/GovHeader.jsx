import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser, getCurrentRole } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import {
  GovSealIcon,
  IconSun,
  IconMoon,
  IconLogOut,
  IconMP,
  IconDistrict,
  IconState,
  IconMinistry,
  IconLock
} from './GovIcons';

const ROLE_ICONS = {
  mp: <IconMP size={15} />,
  district: <IconDistrict size={15} />,
  state: <IconState size={15} />,
  ministry: <IconMinistry size={15} />,
};

const ROLE_LABELS = {
  mp: 'Member of Parliament',
  district: 'District Authority',
  state: 'State Nodal Officer',
  ministry: 'Ministry Official (MoSPI)',
};

export default function GovHeader({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState(getCurrentUser());
  const [role, setRole] = useState(getCurrentRole());
  const [timeStr, setTimeStr] = useState('');
  const [fontSizeTier, setFontSizeTier] = useState(1); // 0 = 14.5px, 1 = 16px (default), 2 = 18px

  useEffect(() => {
    const onAuthChange = () => {
      setUser(getCurrentUser());
      setRole(getCurrentRole());
    };
    window.addEventListener('mplads_auth_changed', onAuthChange);
    return () => window.removeEventListener('mplads_auth_changed', onAuthChange);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  const handleFontSizeChange = (tier) => {
    setFontSizeTier(tier);
    const root = document.documentElement;
    if (tier === 0) root.style.fontSize = '14.5px';
    else if (tier === 1) root.style.fontSize = '16px';
    else if (tier === 2) root.style.fontSize = '18px';
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setRole(null);
    navigate('/login', { replace: true });
  };

  return (
    <header className="gov-header" role="banner">
      {/* ── Top Tricolor Accent Line ── */}
      <div className="gov-tricolor-stripe" aria-hidden="true">
        <span className="stripe-saffron" />
        <span className="stripe-white" />
        <span className="stripe-green" />
      </div>

      {/* ── Top Accessibility & Utility Ribbon ── */}
      <div className="gov-top-ribbon">
        <div className="gov-container gov-top-ribbon-inner">
          <div className="gov-top-left">
            <a href="#main-content" className="gov-skip-link">
              {t('skip_to_content')}
            </a>
          </div>

          <div className="gov-top-right">
            {/* Language Switcher Toggle */}
            <div className="gov-lang-switcher" role="group" aria-label="Language Selector">
              <button
                type="button"
                className={`gov-lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
                aria-label="Switch language to English"
              >
                EN
              </button>
              <span className="gov-lang-divider" aria-hidden="true">|</span>
              <button
                type="button"
                className={`gov-lang-btn ${language === 'hi' ? 'active' : ''}`}
                onClick={() => setLanguage('hi')}
                aria-label="हिंदी भाषा चुनें"
              >
                हिंदी
              </button>
            </div>

            {/* Live IST Clock */}
            <span className="gov-clock" aria-label="Current Standard Time">
              {timeStr || 'Connecting…'}
            </span>

            {/* Accessibility Font Resizer */}
            <div className="gov-a11y-resizer" role="group" aria-label="Text Size Controls">
              <button
                type="button"
                className={`gov-resizer-btn ${fontSizeTier === 0 ? 'active' : ''}`}
                onClick={() => handleFontSizeChange(0)}
                title="Decrease font size (A-)"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className={`gov-resizer-btn ${fontSizeTier === 1 ? 'active' : ''}`}
                onClick={() => handleFontSizeChange(1)}
                title="Normal font size (A)"
                aria-label="Default font size"
              >
                A
              </button>
              <button
                type="button"
                className={`gov-resizer-btn ${fontSizeTier === 2 ? 'active' : ''}`}
                onClick={() => handleFontSizeChange(2)}
                title="Increase font size (A+)"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Theme Toggle (High Contrast / Dark Mode) */}
            <button
              type="button"
              className="gov-theme-toggle"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light Theme' : 'High Contrast / Dark Theme'}`}
              aria-label="Toggle High Contrast Theme"
            >
              {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
              <span>{theme === 'dark' ? t('normal_contrast') : t('high_contrast')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Portal Masthead ── */}
      <div className="gov-masthead">
        <div className="gov-container gov-masthead-inner">
          <div
            className="gov-branding"
            onClick={() => navigate(user ? '/overview' : '/')}
            style={{ cursor: 'pointer' }}
            title={user ? 'Go to National Overview' : 'Go to Public Portal Overview'}
          >
            <GovSealIcon size={46} />
            <div className="gov-titles">
              {language === 'hi' ? (
                <>
                  <div className="gov-title-hi">
                    सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय | भारत सरकार
                  </div>
                  <h1 className="gov-title-en">
                    सांसद स्थानीय क्षेत्र विकास योजना (एमपीलैड्स) निगरानी प्रणाली
                  </h1>
                  <div className="gov-subtitle">
                    संसदीय क्षेत्र अवसंरचना निगरानी एवं व्यय जवाबदेही मंच
                  </div>
                </>
              ) : (
                <>
                  <div className="gov-title-hi">
                    Ministry of Statistics &amp; Programme Implementation | Government of India
                  </div>
                  <h1 className="gov-title-en">
                    MPLADS Project Monitoring System
                  </h1>
                  <div className="gov-subtitle">
                    Parliamentary Constituency Infrastructure Surveillance &amp; Expenditure Ledger
                  </div>
                </>
              )}
            </div>
          </div>

          {/* User & Role Badge or Official Login Action */}
          {!user ? (
            <div className="gov-header-actions">
              <button
                type="button"
                className="gov-header-login-btn"
                onClick={() => navigate('/login')}
                title="Access Authorized Government Portal"
              >
                <IconLock size={15} />
                <span>{t('sign_in')}</span>
              </button>
            </div>
          ) : (
            <div className="gov-user-control">
              <div className="gov-user-meta">
                <span className="gov-user-name" title={user.full_name || user.username}>
                  {user.full_name?.split('—')[0]?.trim() || user.username}
                </span>
                <span className={`gov-user-role-badge role-${role || 'generic'}`}>
                  {ROLE_ICONS[role] || <IconMP size={14} />}
                  <span>{ROLE_LABELS[role] || role}</span>
                </span>
              </div>
              <button
                type="button"
                className="gov-signout-btn"
                onClick={handleLogout}
                title="Sign out of portal"
                aria-label="Sign out"
              >
                <IconLogOut size={15} />
                <span className="gov-signout-label">{t('sign_out')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

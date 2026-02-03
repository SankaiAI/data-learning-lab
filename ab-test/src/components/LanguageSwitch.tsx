import { useLanguage } from '../i18n';
import './LanguageSwitch.css';

export function LanguageSwitch() {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div className="language-switch">
            <button
                className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
            >
                {t('english')}
            </button>
            <button
                className={`lang-btn ${language === 'zh' ? 'active' : ''}`}
                onClick={() => setLanguage('zh')}
            >
                {t('chinese')}
            </button>
        </div>
    );
}

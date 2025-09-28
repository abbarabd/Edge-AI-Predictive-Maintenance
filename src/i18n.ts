import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  // Détecte la langue du navigateur
  .use(LanguageDetector)
  // Passe l'instance i18n à react-i18next
  .use(initReactI18next)
  // Initialise i18next
  .init({
    debug: true, // Affiche des logs en mode développement
    fallbackLng: 'en', // Langue par défaut si la détection échoue
    interpolation: {
      escapeValue: false, // React échappe déjà les valeurs
    },
    // Tu peux ajouter tes traductions ici
    resources: {
      fr: {
        translation: {
          // exemple
          welcome: 'Bienvenue sur votre Dashboard'
        }
      },
      en: {
        translation: {
          // exemple
          welcome: 'Welcome to your Dashboard'
        }
      }
    }
  });

export default i18n;
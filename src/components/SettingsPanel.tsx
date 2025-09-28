import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings, Moon, Sun, Monitor, Globe } from 'lucide-react';

export const SettingsPanel = () => {
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLanguage: string) => {
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const getThemeIcon = (currentTheme: string) => {
    switch (currentTheme) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-[9999] bg-background border shadow-lg hover:shadow-xl transition-shadow"
        title="Paramètres"
      >
        <Settings className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Paramètres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {getThemeIcon(theme || 'system')}
              Thème
            </Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Clair
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Sombre
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Système
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Langue
            </Label>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">
                  <div className="flex items-center gap-2">
                    🇫🇷 Français
                  </div>
                </SelectItem>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    🇺🇸 English
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};